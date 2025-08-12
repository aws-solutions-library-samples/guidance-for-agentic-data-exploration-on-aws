import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as python from '@aws-cdk/aws-lambda-python-alpha'
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as cwlogs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { createHash } from 'node:crypto';
import { Construct } from 'constructs';
import * as path from "path";
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';



import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Agent, Guardrail, AgentActionGroup, ContentFilterStrength, ContentFilterType, GuardrailAction, ManagedWordFilterType, 
  CrossRegionInferenceProfile, CrossRegionInferenceProfileRegion, BedrockFoundationModel, PIIType, Topic, VectorKnowledgeBase, 
  S3DataSource, ChunkingStrategy, ActionGroupExecutor, ApiSchema, AgentAlias} from '@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock';
import {createDynamoDBPolicy, createBedrockAgentRole, createLambdaExecRole, createS3Policy, createAgentCollaborationPolicy, createNeptunePolicy } from './bedrock-utils';

import { 
  GRAPH_DB_AGENT_PROMPT, 
  SUPERVISOR_AGENT_PROMPT, 
  HELP_AGENT_PROMPT, 
  DATA_ANALYZER_EXPLAINER, 
  SCHEMA_TRANSLATOR, 
  GENERATE_OPENCYPHER_DATA, 
  WEATHER_AGENT_PROMPT,
  SAP_ORDER_AGENT_PROMPT
} from './agent-prompts';
import { NagSuppressions } from 'cdk-nag';

export interface BedrockAgentStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
  accessLogsBucket: s3.Bucket;
  dataVisualizationAgent: Agent;
}

const ETL_BUCKET = cdk.Fn.importValue('NeptuneS3LoadBucket');

const SUPERVISOR_LLM = 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';
const OC_QUERY_LLM = 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';

export class BedrockAgentStack extends cdk.Stack {

  // Bedrock Agents
  public readonly panopticSupervisorAgent: bedrock.CfnAgent
  public readonly panopticSupervisorAgentAlias: bedrock.CfnAgentAlias

  // Log Groups
  public readonly ocQueryLogGroup: cwlogs.LogGroup;
  public readonly loaderStatusLogGroup: cwlogs.LogGroup;
  public readonly graphSummaryLogGroup: cwlogs.LogGroup;
  public readonly syncKbLogGroup: cwlogs.LogGroup;
  public readonly dataAnalyzerLogGroup: cwlogs.LogGroup;
  public readonly dataAnalyzerSaveLogGroup: cwlogs.LogGroup;  
  public readonly schemaTranslatorLogGroup: cwlogs.LogGroup;
  public readonly saveDataLogGroup: cwlogs.LogGroup;
  public readonly currentDatetimeLogGroup : cwlogs.LogGroup;
  public readonly geoCoordinatesLogGroup: cwlogs.LogGroup;
  public readonly weatherLogGroup: cwlogs.LogGroup;
  public readonly sapOrderLogGroup:cwlogs.LogGroup

  constructor(scope: Construct, id: string, props: BedrockAgentStackProps) {
    super(scope, id, props);

    // ──────────────────────────────────────────────────────────────────────────
    // START > Bedrock Guardrails
    // ──────────────────────────────────────────────────────────────────────────
    const blocked_msg = 'Sorry, I am unable to answer this question. I am limited to discussing specific topics related to Panoptic.';

    const guardrails = new Guardrail(this, 'PanopticGuardrails', {
      name: 'panoptic-guardrails',
      description: 'Default Panoptic guardrails',
      blockedInputMessaging: blocked_msg,
      blockedOutputsMessaging: blocked_msg,
    });

    // Harmful Content Filters
    guardrails.addContentFilter({ type: ContentFilterType.HATE,
      inputStrength: ContentFilterStrength.HIGH, outputStrength: ContentFilterStrength.HIGH })
    guardrails.addContentFilter({ type: ContentFilterType.INSULTS,
      inputStrength: ContentFilterStrength.HIGH, outputStrength: ContentFilterStrength.HIGH })
    guardrails.addContentFilter({ type: ContentFilterType.SEXUAL,
      inputStrength: ContentFilterStrength.HIGH, outputStrength: ContentFilterStrength.HIGH })
    guardrails.addContentFilter({ type: ContentFilterType.VIOLENCE,
      inputStrength: ContentFilterStrength.HIGH, outputStrength: ContentFilterStrength.HIGH })
    guardrails.addContentFilter({ type: ContentFilterType.MISCONDUCT,
      inputStrength: ContentFilterStrength.HIGH, outputStrength: ContentFilterStrength.HIGH })

    // Custom Word Filter
    guardrails.addWordFilter('TikTok');

    // Sensitive Information Filters
    guardrails.addPIIFilter({
      type: PIIType.Finance.CREDIT_DEBIT_CARD_NUMBER,
      action: GuardrailAction.ANONYMIZE,
    });
    guardrails.addPIIFilter({
      type: PIIType.USASpecific.US_SOCIAL_SECURITY_NUMBER,
      action: GuardrailAction.ANONYMIZE,
    });

    // Managed Denied Topic
    guardrails.addDeniedTopicFilter(Topic.INAPPROPRIATE_CONTENT);

    // Custom Denied Topic
    guardrails.addDeniedTopicFilter(
      Topic.custom({
        name: 'Dinosaurs',
        definition:
          'No talking about dinosaurs.',
        examples: [
          'Tell me about the largest dinosaur.',
          'Tell me about Tyrannosaurus rex (T-Rex).',
          'What is a pterodactyl?',
          'Are dinosaurs extinct?'
        ],
      })
    );

    // Profanity Filter
    guardrails.addManagedWordListFilter(ManagedWordFilterType.PROFANITY);

    // Create version
    const gdVersion = guardrails.createVersion();
    // ──────────────────────────────────────────────────────────────────────────
    // END > Bedrock Guardrails
    // ──────────────────────────────────────────────────────────────────────────

    // ──────────────────────────────────────────────────────────────────────────
    // START > Bedrock Agent Security - Role, Policies
    // ──────────────────────────────────────────────────────────────────────────

    // Foundation Model access
    const agentFoundationModelPolicy = new iam.PolicyStatement({
      sid: 'AmazonBedrockAgentBedrockFoundationModelPolicy',
      effect: iam.Effect.ALLOW,
      actions: [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
      ],
      resources: [
        `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/*`,
      ],
    });

    // // Guardrail access
    const agentGuardrailPolicy = new iam.PolicyStatement({
      sid: 'AmazonBedrockAgentGuardrailPolicy',
      effect: iam.Effect.ALLOW,
      actions: [
        "bedrock:GetGuardrail",
        "bedrock:ApplyGuardrail",
        "bedrock:UpdateGuardrail",
      ],
      resources: [ guardrails.guardrailArn ],
    });

    // // Inference Profile access
    const agentInferenceProfileCRPolicy = new iam.PolicyStatement({
      sid: 'AmazonBedrockAgentInferenceProfilesCrossRegionPolicy',
      effect: iam.Effect.ALLOW,
      actions: [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:GetInferenceProfile",
        "bedrock:GetFoundationModel",
      ],
      resources: [
        `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/*`,
        `arn:aws:bedrock:*::foundation-model/*`,
      ],
    })

    // Agent Collaboration access
    const agentCollabPolicy = new iam.PolicyStatement({
      actions: [
        'bedrock:GetAgentAlias',
        'bedrock:InvokeAgent',
      ],
      resources: [
        `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:agent-alias/*`,
      ]
    });    

    // Bedrock Agent Resource Role
    const bedrockAgentRole = new iam.Role(this, 'BedrockAgentExecutionRole', {
      roleName: 'Panoptic-BedrockAgent-ExecutionRole',
      description: 'Amazon Bedrock Execution Role for Agents',
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
    });

    // Attach policies to Bedrock Agent Resource Role
    bedrockAgentRole.addToPolicy(agentFoundationModelPolicy);
    bedrockAgentRole.addToPolicy(agentInferenceProfileCRPolicy);
    bedrockAgentRole.addToPolicy(agentCollabPolicy);
    bedrockAgentRole.addToPolicy(agentGuardrailPolicy);

    // Add trust policy/conditions to Bedrock Agent Resource Role
    bedrockAgentRole.assumeRolePolicy?.addStatements(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        principals: [new iam.ServicePrincipal('bedrock.amazonaws.com')],
        conditions: {
          StringEquals: {
            'aws:SourceAccount': cdk.Aws.ACCOUNT_ID
          },
          ArnLike: {
            'aws:SourceArn': `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:agent/*`
          }
        }
      })
    );

    // ──────────────────────────────────────────────────────────────────────────
    // END > Bedrock Agent Security - Role, Policies
    // ──────────────────────────────────────────────────────────────────────────

    // ──────────────────────────────────────────────────────────────────────────
    // START > Lambda Action Security
    // ──────────────────────────────────────────────────────────────────────────
   
    // Lambda agent security group with self-referencing rule for all protocols
    const lambdaSG = new ec2.SecurityGroup(this, 'SelfRefSecurityGroup', {
      vpc: props.vpc, 
      description: 'Security group that allows all inbound traffic from itself',
      allowAllOutbound: true, 
    });
    lambdaSG.addIngressRule(
      lambdaSG, // Source is the security group itself
      ec2.Port.allTraffic(), // Allows all protocols and ports
      'Allow all traffic from resources in this security group'
    );

    // ──────────────────────────────────────────────────────────────────────────
    // END > Lambda Action Security
    // ──────────────────────────────────────────────────────────────────────────

    // ──────────────────────────────────────────────────────────────────────────
    // START > Graph DB Agent - Neptune Action Lambdas
    // ──────────────────────────────────────────────────────────────────────────
    const ocQueryFn = 'Panoptic-OpenCypher_Query';
    // Create Log Group
    this.ocQueryLogGroup = new cdk.aws_logs.LogGroup(this, `OCQueryLambdaLogGroup`, {
      logGroupName: `/aws/lambda/panoptic/${ocQueryFn}`,
      retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })
    // Create Lambda Role
    const ocQueryLambdaRole = createLambdaExecRole(this, `${ocQueryFn}-Lambda`, ocQueryFn, props.vpc.vpcId);
    
    // Add Neptune Graph Summary API permissions
    ocQueryLambdaRole.addToPolicy(createNeptunePolicy());
    
    // Create Lambda
    const ocQueryPython = new python.PythonFunction(this, 'OpenCypherQueryLambda', {
      functionName: ocQueryFn,
      role: ocQueryLambdaRole,
      entry: 'lambda/oc-query',
      runtime: lambda.Runtime.PYTHON_3_11,
      index: 'lambda.py', 
      handler: 'lambda_handler', 
      memorySize: 1024,
      timeout: cdk.Duration.minutes(5),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      logGroup: this.ocQueryLogGroup,      
      environment: {
        NEPTUNE_HOST: cdk.Fn.importValue('DBClusterEndpoint'),
        LLM_MODEL: OC_QUERY_LLM,
      }      
    });

    // Configure provisioned concurrency for the Lambda function
    const version = ocQueryPython.currentVersion;
    const alias = new lambda.Alias(this, 'OcQueryLambdaAlias', {
      aliasName: 'test',
      version,
      provisionedConcurrentExecutions: 1,
    });

    // Add auto-scaling for provisioned concurrency
    const scaling = alias.addAutoScaling({ 
      minCapacity: 1,
      maxCapacity: 20
    });
    
    // Configure scaling based on utilization
    scaling.scaleOnUtilization({
      utilizationTarget: 0.75, // Target utilization percentage
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60)
    });

    const loaderStatusFn = 'Panoptic-Bulk_Load_Job_Status';
    // Create Log Group
    this.loaderStatusLogGroup = new cdk.aws_logs.LogGroup(this, `LoaderStatusLambdaLogGroup`, {
      logGroupName: `/aws/lambda/panoptic/${loaderStatusFn}`,
      retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })
    // Create Lambda Role
    const loaderStatusLambdaRole = createLambdaExecRole(this, `${loaderStatusFn}-Lambda`, loaderStatusFn, props.vpc.vpcId);
    
    // Create Lambda
    const loaderStatusLambda = new python.PythonFunction(this, 'LoaderStatusLambda', {
      functionName: loaderStatusFn,
      role: loaderStatusLambdaRole,
      entry: 'lambda/loader-status',
      runtime: lambda.Runtime.PYTHON_3_13,
      index: 'lambda.py', 
      handler: 'lambda_handler', 
      memorySize: 128,
      timeout: cdk.Duration.minutes(5),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      logGroup: this.loaderStatusLogGroup,
      environment: {
        BULK_LOAD_LOG: cdk.Fn.importValue('BulkLoadLogTable'),
      }
    });
    loaderStatusLambda.addToRolePolicy(createDynamoDBPolicy(cdk.Fn.importValue('BulkLoadLogTable')));


    const graphSummaryFn = 'Panoptic-Graph_DB_Summary';
    // Create Log Group
    this.graphSummaryLogGroup = new cdk.aws_logs.LogGroup(this, `GraphSummaryLambdaLogGroup`, {
      logGroupName: `/aws/lambda/panoptic/${graphSummaryFn}`,
      retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })
    // Create Lambda Role
    const graphSummaryLambdaRole = createLambdaExecRole(this, `${graphSummaryFn}-Lambda`, graphSummaryFn, props.vpc.vpcId);
    // Create Lambda
    const graphSummaryLambda = new python.PythonFunction(this, 'GraphSummaryLambda', {
      functionName: graphSummaryFn,
      role: graphSummaryLambdaRole,
      entry: 'lambda/graph-summary',
      runtime: lambda.Runtime.PYTHON_3_13,
      index: 'lambda.py', 
      handler: 'lambda_handler', 
      memorySize: 128,
      timeout: cdk.Duration.minutes(5),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      logGroup: this.graphSummaryLogGroup,      
      environment: {
        NEPTUNE_HOST: cdk.Fn.importValue('DBClusterEndpoint'),
      }
    });
    graphSummaryLambda.addToRolePolicy(createNeptunePolicy());

    // ──────────────────────────────────────────────────────────────────────────
    // END > Graph DB Agent - Neptune Action Lambdas
    // ──────────────────────────────────────────────────────────────────────────

    // Bedrock Inference Profile
    const primaryAgentInferenceProfile = CrossRegionInferenceProfile.fromConfig({
      geoRegion: CrossRegionInferenceProfileRegion.US,
      model: BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_V2_0,
    });

    const dataVisualizationAgentAlias = new bedrock.CfnAgentAlias(this, 'DataVizAgentAlias', {
      agentAliasName: 'test',
      description: 'Data Visualization Agent Alias',
      agentId: props.dataVisualizationAgent.agentId,
    })
    
    dataVisualizationAgentAlias.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
    const dataVizCollaborator: bedrock.CfnAgent.AgentCollaboratorProperty = {
      agentDescriptor: {
        aliasArn: dataVisualizationAgentAlias.attrAgentAliasArn,
      },
      collaborationInstruction: 'Use this agent when you need to generate a graph, chart, or word cloud image.',
      collaboratorName: 'DataVisualizer',
      relayConversationHistory: 'TO_COLLABORATOR',
    };
    // ──────────────────────────────────────────────────────────────────────────
    // END > Data Visualization Agent + Alias
    // ──────────────────────────────────────────────────────────────────────────

    // ──────────────────────────────────────────────────────────────────────────
    // START > Bedrock Schema Translator Agent + Alias
    // ──────────────────────────────────────────────────────────────────────────
    const schemaTranslatorFn = 'Panoptic-Schema_Translator';
    // Create Log Group and Lambda
    this.schemaTranslatorLogGroup = new cdk.aws_logs.LogGroup(this, `SchemaTranslatorLambdaLogGroup`, {
      logGroupName: `/aws/lambda/panoptic/${schemaTranslatorFn}`,
      retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // Create Lambda Role
    const schemaTranslatorLambdaRole = createLambdaExecRole(this, `${schemaTranslatorFn}-Lambda`, schemaTranslatorFn, props.vpc.vpcId);
    // Create Lambda
    const schemaTranslatorLambda = new python.PythonFunction(this, 'SchemaTranslatorLambda', {
      functionName: schemaTranslatorFn,
      role: schemaTranslatorLambdaRole,
      entry: 'lambda/schema-translator',
      runtime: lambda.Runtime.PYTHON_3_13,
      index: 'lambda.py', 
      handler: 'lambda_handler', 
      memorySize: 128,
      timeout: cdk.Duration.minutes(5),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      logGroup: this.schemaTranslatorLogGroup,      
      environment: {
        SCHEMA_TRANSLATOR_LOG_TABLE: cdk.Fn.importValue('SchemaTranslatorLogTable'),
      }
    });
    schemaTranslatorLambda.addToRolePolicy(createDynamoDBPolicy(cdk.Fn.importValue('SchemaTranslatorLogTable')));

    const schemaTranslatorName = 'Panoptic-SchemaTranslator';
    const schemaTranslatorAgent = new Agent(this, 'SchemaTranslatorAgent', {
      name: schemaTranslatorName,
      description: 'Translates relational database schema into a graph model representation.',
      userInputEnabled: true,
      foundationModel: primaryAgentInferenceProfile,
      instruction: SCHEMA_TRANSLATOR,
      // existingRole: createBedrockAgentRole(this, 'SchemaTranslatorAgentRole', schemaTranslatorName, guardrails.guardrailArn),
      shouldPrepareAgent: true,
      memory: {
        storageDays: 30,
        enabledMemoryTypes: [
          "SESSION_SUMMARY"
        ],
        sessionSummaryConfiguration: {
          maxRecentSessions: 20
        }
      }
    });

    const schemaTranslatorAgentAlias = new bedrock.CfnAgentAlias(this, 'SchemaTranslatorAgentAlias', {
      agentAliasName: 'test',
      description: 'Test Alias',
      agentId: schemaTranslatorAgent.agentId,
    })
    schemaTranslatorAgentAlias.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    const schemaTranslatorCollaborator: bedrock.CfnAgent.AgentCollaboratorProperty = {
      agentDescriptor: {
        aliasArn: schemaTranslatorAgentAlias.attrAgentAliasArn,
      },
      collaborationInstruction: 'Use this agent when you need to translate a Relational DB schema to a Graph DB schema',
      collaboratorName: 'SchemaTranslator',
      relayConversationHistory: 'TO_COLLABORATOR',
    };

    const schemaTranslatorActionGroup = new AgentActionGroup({
      name: 'save_data',
      description: 'Saves translation results to DynamoDB after its generated.',
      executor: ActionGroupExecutor.fromlambdaFunction(schemaTranslatorLambda),
      functionSchema: {
        functions: [
          {
            name: 'SaveData',
            description: 'Function to save translation results to DynamoDB',
            parameters: {
              schemaData: {
                type: "string",
                description: "The data translation results to save.",
                required: true,
              },
              originalInput: {
                type: "string",
                description: "The original input that was translated.",
                required: false,
              }              
            }            
          }
        ]
      }
    });
    schemaTranslatorAgent.addActionGroup(schemaTranslatorActionGroup)
    // ──────────────────────────────────────────────────────────────────────────
    // END > Bedrock Schema Translator Agent + Alias
    // ──────────────────────────────────────────────────────────────────────────

    // ──────────────────────────────────────────────────────────────────────────
    // START > Bedrock Knowledge Base - Panoptic Help
    // ──────────────────────────────────────────────────────────────────────────    
    const docBucket = new s3.Bucket(this, 'DocBucket', {
      bucketName: `panoptic-doc-kb-${this.account}-${this.region}`,
      enforceSSL: true,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      serverAccessLogsBucket: props.accessLogsBucket,
      serverAccessLogsPrefix: 'panopticDocsKbLogs/',      
    });

    const kb = new VectorKnowledgeBase(this, 'KB', {
      name: 'Panoptic-Doc-KB',
      embeddingsModel: BedrockFoundationModel.TITAN_EMBED_TEXT_V1,
      instruction: 'Use this knowledge base to answer questions about Panoptic.',
    });

    const dataSource = new S3DataSource(this, 'DataSource', {
      bucket: docBucket,
      knowledgeBase: kb,
      dataSourceName: 'panoptic-docs',
      chunkingStrategy: ChunkingStrategy.fixedSize({
        maxTokens: 500,
        overlapPercentage: 20
      }),
    });

    const syncBedrockKbFn = 'Panoptic-Sync_Bedrock_KB';
    // Create Log Group and Lambda
    this.syncKbLogGroup = new cdk.aws_logs.LogGroup(this, `SyncBedrockKbLambdaLogGroup`, {
      logGroupName: `/aws/lambda/panoptic/${syncBedrockKbFn}`,
      retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // Create Lambda Role
    const syncBedrockKbLambdaRole = createLambdaExecRole(this, `${syncBedrockKbFn}-Lambda`, syncBedrockKbFn, props.vpc.vpcId);
    // Create Lambda
    const syncBedrockKbLambda = new python.PythonFunction(this, 'SyncBedrockKbLambda', {
      functionName: syncBedrockKbFn,
      role: syncBedrockKbLambdaRole,
      entry: 'lambda/sync-bedrock-kb',
      runtime: lambda.Runtime.PYTHON_3_13,
      index: 'lambda.py',
      handler: 'lambda_handler',
      memorySize: 128,
      timeout: cdk.Duration.minutes(1),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      logGroup: this.syncKbLogGroup,
      environment: {
        KB_ID: kb.knowledgeBaseId,
        KB_DATA_SOURCE_ID: dataSource.dataSourceId,
      }
    });

    // Add an iam policy allowing the Lambda function to invoke Bedrock Ingestion
    syncBedrockKbLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["bedrock:StartIngestionJob"],
      resources: [kb.knowledgeBaseArn],
    }));    

    // add s3 trigger
    syncBedrockKbLambda.addEventSource(new S3EventSource(docBucket, {
      events: [s3.EventType.OBJECT_CREATED]
    }));

    const assetsPath = path.join(__dirname, "../docs/kb/");
    const assetDoc = s3deploy.Source.asset(assetsPath);

    const filesDeployment = new s3deploy.BucketDeployment(this, "DeployKbDocs", {
      sources: [assetDoc],
      destinationBucket: docBucket,
    });
    filesDeployment.node.addDependency(syncBedrockKbLambda);

    // ──────────────────────────────────────────────────────────────────────────
    // END > Bedrock Knowledge Base - Panoptic Help
    // ──────────────────────────────────────────────────────────────────────────    

    // ──────────────────────────────────────────────────────────────────────────
    // START > Panoptic Help Agent + Alias
    // ──────────────────────────────────────────────────────────────────────────
    const helpName = 'Panoptic-Help';
    const helpAgent = new Agent(this, 'HelpAgent', {
      name: helpName,
      description: 'An expert in the AWS Panoptic accelerator.',
      foundationModel: primaryAgentInferenceProfile,
      instruction: HELP_AGENT_PROMPT,
      userInputEnabled: true,
      knowledgeBases: [kb],
      // existingRole: createBedrockAgentRole(this, 'HelpAgentRole', helpName, guardrails.guardrailArn),
      shouldPrepareAgent: true,
    });

    const helpAgentAlias = new bedrock.CfnAgentAlias(this, 'HelpAgentAlias', {
      agentAliasName: 'test',
      description: 'Test Alias',
      agentId: helpAgent.agentId,
    })
    helpAgentAlias.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    const helpCollaborator: bedrock.CfnAgent.AgentCollaboratorProperty = {
      agentDescriptor: {
        aliasArn: helpAgentAlias.attrAgentAliasArn,
      },
      collaborationInstruction: 'Use this agent when you need to know more about Panoptic and its capabilities.',
      collaboratorName: 'Help',
      relayConversationHistory: 'TO_COLLABORATOR',
    };    
    // ──────────────────────────────────────────────────────────────────────────
    // END > Panoptic Help Agent + Alias
    // ──────────────────────────────────────────────────────────────────────────

    // ──────────────────────────────────────────────────────────────────────────
    // START > Data Analyzer Agent + Alias
    // ──────────────────────────────────────────────────────────────────────────
    const dataAnalyzerFn = 'Panoptic-Data_Analyzer';
    // Create Log Group
    this.dataAnalyzerLogGroup = new cdk.aws_logs.LogGroup(this, `DataAnalyzerLambdaLogGroup`, {
      logGroupName: `/aws/lambda/panoptic/${dataAnalyzerFn}`,
      retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // Create Lambda Role
    const dataAnalyzerLambdaRole = createLambdaExecRole(this, `${dataAnalyzerFn}-Lambda`, dataAnalyzerFn, props.vpc.vpcId);
    // Create Lambda
    const dataAnalyzerLambda = new python.PythonFunction(this, 'DataAnalyzerLambda', {
      functionName: dataAnalyzerFn,
      role: dataAnalyzerLambdaRole,
      entry: 'lambda/data-analyzer',
      runtime: lambda.Runtime.PYTHON_3_13,
      index: 'lambda.py', 
      handler: 'lambda_handler', 
      memorySize: 128,
      timeout: cdk.Duration.minutes(5),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      logGroup: this.dataAnalyzerLogGroup,      
      environment: {
        S3_LOADER_BUCKET: ETL_BUCKET,
        DATA_ANALYZER_LOG_TABLE: cdk.Fn.importValue('DataAnalyzerLogTable'),
      }
    });
    dataAnalyzerLambda.addToRolePolicy(createS3Policy(ETL_BUCKET));
    dataAnalyzerLambda.addToRolePolicy(createDynamoDBPolicy(cdk.Fn.importValue('DataAnalyzerLogTable')));

    const dataAnalyzerName = 'Panoptic-DataAnalyzer';
    const dataAnalyzerAgent = new Agent(this, 'DataAnalyzerAgent', {
      name: dataAnalyzerName,
      description: 'Reviews csv files on S3 and generates a relational database schema to hold the data.',
      foundationModel: primaryAgentInferenceProfile,
      instruction: DATA_ANALYZER_EXPLAINER,
      userInputEnabled: true,
      // existingRole: createBedrockAgentRole(this, 'DataAnalyzerAgentRole', dataAnalyzerName, guardrails.guardrailArn),
      shouldPrepareAgent: true,
    });

    const dataAnalyzerAgentAlias = new bedrock.CfnAgentAlias(this, 'DataAnalyzerAgentAlias', {
      agentAliasName: 'test',
      description: 'Test Alias',
      agentId: dataAnalyzerAgent.agentId,
    })
    dataAnalyzerAgentAlias.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    const dataAnalyzerCollaborator: bedrock.CfnAgent.AgentCollaboratorProperty = {
      agentDescriptor: {
        aliasArn: dataAnalyzerAgentAlias.attrAgentAliasArn,
      },
      collaborationInstruction: 'Use this agent when you need to analyze a set of csv data files on S3.',
      collaboratorName: 'DataAnalyzer',
      relayConversationHistory: 'TO_COLLABORATOR',
    };    

    const dataGatherActionGroup = new AgentActionGroup({
      name: 'gather_data',
      description: 'Gets csv files from S3 for analysis.',
      executor: ActionGroupExecutor.fromlambdaFunction(dataAnalyzerLambda),
      functionSchema: {
        functions: [
          {
            name: 'GatherData',
            description: 'Function to get data from an S3 bucket prefix',
            parameters: {
              prefix: {
                type: "string",
                description: "The S3 bucket prefix to scan for csv files.",
                required: true,
              }
            }
          }
        ]
      }
    });
    dataAnalyzerAgent.addActionGroup(dataGatherActionGroup)


    const saveSchemaFn = 'Panoptic-Data_Analyzer_Save';
    // Create Log Group
    this.dataAnalyzerSaveLogGroup = new cdk.aws_logs.LogGroup(this, `DataAnalyzerSaveLambdaLogGroup`, {
      logGroupName: `/aws/lambda/panoptic/${saveSchemaFn}`,
      retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // Create Lambda Role
    const saveSchemaLambdaRole = createLambdaExecRole(this, `${saveSchemaFn}-Lambda`, saveSchemaFn, props.vpc.vpcId);
    // Create Lambda
    const saveSchemaLambda = new python.PythonFunction(this, 'SaveSchemaLambda', {
      functionName: saveSchemaFn,
      role: saveSchemaLambdaRole,
      entry: 'lambda/data-analyzer-save',
      runtime: lambda.Runtime.PYTHON_3_13,
      index: 'lambda.py', 
      handler: 'lambda_handler', 
      memorySize: 128,
      timeout: cdk.Duration.minutes(5),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      logGroup: this.dataAnalyzerSaveLogGroup,      
      environment: {
        DATA_ANALYZER_LOG_TABLE: cdk.Fn.importValue('DataAnalyzerLogTable'),
      }
    });
    saveSchemaLambda.addToRolePolicy(createDynamoDBPolicy(cdk.Fn.importValue('DataAnalyzerLogTable')));

    const saveSchemaActionGroup = new AgentActionGroup({
      name: 'save_schema',
      description: 'Saves the generated relational schema.',
      executor: ActionGroupExecutor.fromlambdaFunction(saveSchemaLambda),
      functionSchema: {
        functions: [
          {
            name: 'SaveSchema',
            description: 'Function to save the schema to Data Analyzer history.',
            parameters: {
              generated_schema: {
                type: "string",
                description: "The generated relational database schema.",
                required: true,
              },
            }
          }
        ]
      }
    });
    dataAnalyzerAgent.addActionGroup(saveSchemaActionGroup)        
    // ──────────────────────────────────────────────────────────────────────────
    // END > Data Analyzer Agent + Alias
    // ──────────────────────────────────────────────────────────────────────────    

    // ──────────────────────────────────────────────────────────────────────────
    // START > Neptune Graph DB Agent + Alias
    // ──────────────────────────────────────────────────────────────────────────
    const graphDbName = 'Panoptic-GraphDB';
    const graphDBAgent = new Agent(this, 'GraphDBAgent', {
      name: graphDbName,
      description: 'Calls the Neptune graph database API to load and query data.',
      foundationModel: primaryAgentInferenceProfile,
      instruction: GRAPH_DB_AGENT_PROMPT,
      userInputEnabled: true,
      // existingRole: createBedrockAgentRole(this, 'GraphDBAgentRole', graphDbName, guardrails.guardrailArn),
      shouldPrepareAgent: true,
    });

    const graphDBAgentAlias = new bedrock.CfnAgentAlias(this, 'GraphDBAgentAlias', {
      agentAliasName: 'test',
      description: 'Test Alias',
      agentId: graphDBAgent.agentId,
    })
    graphDBAgentAlias.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    const graphDBCollaborator: bedrock.CfnAgent.AgentCollaboratorProperty = {
      agentDescriptor: {
        aliasArn: graphDBAgentAlias.attrAgentAliasArn,
      },
      collaborationInstruction: `Use this to perform the following functions: 
        1. Get the graph schema summary
        2. Query the graph database using opencypher
        3. Run the bulk data loader
        4. Get the status of a previous bulk data loader job`,
      collaboratorName: 'GraphDB',
      relayConversationHistory: 'TO_COLLABORATOR',
    };   

    const graphSummaryActionGroup = new AgentActionGroup({
      name: 'get_schema_summary',
      description: 'Calls the Neptune graph summary API to get schema details.',
      executor: ActionGroupExecutor.fromlambdaFunction(graphSummaryLambda),
      functionSchema: {
        functions: [
          {
            name: 'GetSummary',
            description: 'Function to get the graph DB summary',
          }
        ]
      }
    });
    graphDBAgent.addActionGroup(graphSummaryActionGroup)

    const ocQueryActionGroup = new AgentActionGroup({
      name: 'oc_query',
      description: 'Queries the Neptune graph database.',
      executor: ActionGroupExecutor.fromlambdaFunction(ocQueryPython),
      functionSchema: {
        functions: [
          {
            name: 'RunQuery',
            description: 'Function to query the graph DB',
          }
        ]
      }
    });
    graphDBAgent.addActionGroup(ocQueryActionGroup)

    const dlStatusActionGroup = new AgentActionGroup({
      name: 'get_job_status',
      description: 'Checks the status of a previously created bulk load job.',
      executor: ActionGroupExecutor.fromlambdaFunction(loaderStatusLambda),
      functionSchema: {
        functions: [
          {
            name: 'GetBulkLoadStatus',
            description: 'Function to check the data loader bulk load job status',
            parameters: {
              bulk_load_job_id: {
                type: "string",
                description: "The bulk load job id.",
                required: true,
              }
            }
          }
        ]
      }
    });
    graphDBAgent.addActionGroup(dlStatusActionGroup)
    
    // Get the data loader lambda ARN from SSM parameter
    const dataLoaderLambdaArn = ssm.StringParameter.valueForStringParameter(
      this, 
      '/panoptic/lambda/dataloader/arn'
    );
    
    // Create a Lambda function reference from the ARN
    const dataLoaderLambda = lambda.Function.fromFunctionAttributes(this, 'ImportedDataLoadLambda', {
      functionArn: dataLoaderLambdaArn,
      sameEnvironment: true  // This tells CDK it can modify the function's permissions
    });

    const dataloaderActionGroup = new AgentActionGroup({
      name: 'run_bulk_data_load',
      description: 'Passes the indicated file path(s) to the Neptune bulk data loader.',
      executor: ActionGroupExecutor.fromlambdaFunction(dataLoaderLambda),
      functionSchema: {
        functions: [
          {
            name: 'LoadData',
            description: 'Runs the Neptune bulk data load process',
            parameters: {
              prefix: {
                type: "string",
                description: "The S3 bucket prefix that will be targeted by the bulk data loader.",
                required: true,
              }
            }
          }
        ]
      }
    });
    graphDBAgent.addActionGroup(dataloaderActionGroup)

    // ──────────────────────────────────────────────────────────────────────────
    // END > Neptune Graph DB Agent + Alias
    // ──────────────────────────────────────────────────────────────────────────

    // ──────────────────────────────────────────────────────────────────────────
    // START > Synthetic Data Agent + Alias
    // ────────────────────────────────────────────────────────────────────────── 
    const synthDataFn = 'Panoptic-Save_Synthetic_Data';
    // Create Log Group
    this.saveDataLogGroup = new cdk.aws_logs.LogGroup(this, `SaveSyntheticDataLambdaLogGroup`, {
      logGroupName: `/aws/lambda/panoptic/${synthDataFn}`,
      retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // Create Lambda Role
    const saveDataLambdaRole = createLambdaExecRole(this, `${synthDataFn}-Lambda`, synthDataFn, props.vpc.vpcId);
    // Create Lambda
    const saveDataLambda = new python.PythonFunction(this, 'SaveDataLambda', {
      functionName: synthDataFn,
      role: saveDataLambdaRole,
      entry: 'lambda/save-data',
      runtime: lambda.Runtime.PYTHON_3_13,
      index: 'lambda.py', 
      handler: 'lambda_handler', 
      memorySize: 128,
      timeout: cdk.Duration.minutes(5),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      logGroup: this.saveDataLogGroup,      
      environment: {
        S3_LOADER_BUCKET: ETL_BUCKET,
      }
    });
    saveDataLambda.addToRolePolicy(createS3Policy(ETL_BUCKET));

    const synthDataName = 'Panoptic-SyntheticData';
    const synthDataAgent = new Agent(this, 'SynthDataAgent', {
      name: synthDataName,
      description: 'Creates synthetic data in Open Cypher CSV format based on a given graph schema and company type.',
      foundationModel: primaryAgentInferenceProfile,
      instruction: GENERATE_OPENCYPHER_DATA,
      userInputEnabled: true,
      // existingRole: createBedrockAgentRole(this, 'SynthDataAgentRole', synthDataName, guardrails.guardrailArn),
      shouldPrepareAgent: true,
    });

    const synthDataAgentAlias = new bedrock.CfnAgentAlias(this, 'SynthDataAgentAlias', {
      agentAliasName: 'test',
      description: 'Test Alias',
      agentId: synthDataAgent.agentId,
    })
    synthDataAgentAlias.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    const synthDataCollaborator: bedrock.CfnAgent.AgentCollaboratorProperty = {
      agentDescriptor: {
        aliasArn: synthDataAgentAlias.attrAgentAliasArn,
      },
      collaborationInstruction: 'Use this agent when you need to generate and save synthetic data.',
      collaboratorName: 'SyntheticData',
      relayConversationHistory: 'TO_COLLABORATOR',
    };    

    const synthDataActionGroup = new AgentActionGroup({
      name: 'save_data',
      description: 'Saves synthetic data to S3 after its generated.',
      executor: ActionGroupExecutor.fromlambdaFunction(saveDataLambda),
      functionSchema: {
        functions: [
          {
            name: 'SaveData',
            description: 'Function to save generated data to an S3 bucket',
            parameters: {
              synthData: {
                type: "string",
                description: "The synthetic data to save.",
                required: true,
              }
            }            
          }
        ]
      }
    });
    synthDataAgent.addActionGroup(synthDataActionGroup)
    // ──────────────────────────────────────────────────────────────────────────
    // END > Synthetic Data Agent + Alias
    // ──────────────────────────────────────────────────────────────────────────    

    // ──────────────────────────────────────────────────────────────────────────
    // START > Bedrock Knowledge Base - Product Data
    // ──────────────────────────────────────────────────────────────────────────    
    const productsDataKbBucket = new s3.Bucket(this, 'ProductsDataKbBucket', {
      bucketName: `panoptic-products-kb-${this.account}-${this.region}`,
      enforceSSL: true,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      serverAccessLogsBucket: props.accessLogsBucket,
      serverAccessLogsPrefix: 'productsKbLogs/',
    });

    const products_kb = new VectorKnowledgeBase(this, 'ProductsDataKb', {
      name: 'Products-Data-KB',
      embeddingsModel: BedrockFoundationModel.TITAN_EMBED_TEXT_V1,
      instruction: 'Use this knowledge base to answer questions about product specifications, product performance, and customer reviews.',
    });

    const productReviewsDS = new S3DataSource(this, 'ProductReviewsDS', {
      bucket: productsDataKbBucket,
      knowledgeBase: products_kb,
      dataSourceName: 'product-reviews',
      chunkingStrategy: ChunkingStrategy.fixedSize({
        maxTokens: 500,
        overlapPercentage: 20
      }),
    });

     // Create Lambda
    const syncProductsKbFn = 'Panoptic-Sync_ProductsData';
    // Create Lambda Role
    const syncProductsDataKbLambdaRole = createLambdaExecRole(this, `${syncProductsKbFn}-Lambda`, syncProductsKbFn, props.vpc.vpcId);
    // Create Lambda
    const syncProductsDataKbLambda = new python.PythonFunction(this, 'SyncProductsDataKbLambda', {
      functionName: syncProductsKbFn,
      role: syncProductsDataKbLambdaRole,
      entry: 'lambda/sync-bedrock-kb',
      runtime: lambda.Runtime.PYTHON_3_13,
      index: 'lambda.py',
      handler: 'lambda_handler',
      memorySize: 128,
      timeout: cdk.Duration.minutes(1),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      logGroup: new cdk.aws_logs.LogGroup(this, `SyncProductsDataKbLambdaLogGroup`, {
        logGroupName: `/aws/lambda/panoptic/${syncProductsKbFn}`,
        retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: {
        KB_ID: products_kb.knowledgeBaseId,
        KB_DATA_SOURCE_ID: productReviewsDS.dataSourceId,
      }
    });

    // Add an iam policy allowing the Lambda function to invoke Bedrock Ingestion
    syncProductsDataKbLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["bedrock:StartIngestionJob"],
      resources: [products_kb.knowledgeBaseArn],
    }));    

    // add s3 trigger
    syncProductsDataKbLambda.addEventSource(new S3EventSource(productsDataKbBucket, {
      events: [s3.EventType.OBJECT_CREATED]
    }));

    // get s3 bucket by name ETL_BUCKET
    const fileUploadKbBucket = s3.Bucket.fromBucketName(this, 'kb_bucket_file_upload', ETL_BUCKET);
    const fileUploadsDS = new S3DataSource(this, 'FileUploadsDS', {
      bucket: fileUploadKbBucket,
      inclusionPrefixes: ['kbupload/'],
      knowledgeBase: products_kb,
      dataSourceName: 'file-uploads',
      chunkingStrategy: ChunkingStrategy.fixedSize({
        maxTokens: 500,
        overlapPercentage: 20
      }),
    });

    // Create Lambda
    const syncFileUploadKbFn = 'Panoptic-Sync_FileUploadKbData';
    // Create Lambda Role
    const syncFileUploadKbLambdaRole = createLambdaExecRole(this, `${syncFileUploadKbFn}-Lambda`, syncFileUploadKbFn, props.vpc.vpcId);
    // Create Lambda
    const syncFileUploadKbLambda = new python.PythonFunction(this, 'SyncFileUploadKbLambda', {
      functionName: syncFileUploadKbFn,
      role: syncFileUploadKbLambdaRole,
      entry: 'lambda/sync-bedrock-kb',
      runtime: lambda.Runtime.PYTHON_3_13,
      index: 'lambda.py',
      handler: 'lambda_handler',
      memorySize: 128,
      timeout: cdk.Duration.minutes(1),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      logGroup: new cdk.aws_logs.LogGroup(this, `SyncFileUploadKbLambdaLogGroup`, {
        logGroupName: `/aws/lambda/panoptic/${syncFileUploadKbFn}`,
        retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: {
        KB_ID: products_kb.knowledgeBaseId,
        KB_DATA_SOURCE_ID: fileUploadsDS.dataSourceId,
      }
    });

    // Add an iam policy allowing the Lambda function to invoke Bedrock Ingestion
    syncFileUploadKbLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["bedrock:StartIngestionJob"],
      resources: [products_kb.knowledgeBaseArn],
    }));

    // add s3 trigger
    fileUploadKbBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(syncFileUploadKbLambda),
      { prefix: 'kbupload/' }
    );

    const kbAssetsPath = path.join(__dirname, "../data/kb/");
    const kbAssetDoc = s3deploy.Source.asset(kbAssetsPath);

    const kbDeployment = new s3deploy.BucketDeployment(this, "DeployProductsDataKb", {
      sources: [kbAssetDoc],
      destinationBucket: productsDataKbBucket,
    });
    kbDeployment.node.addDependency(syncProductsDataKbLambda);

    // ──────────────────────────────────────────────────────────────────────────
    // END > Bedrock Knowledge Base - Product Data
    // ──────────────────────────────────────────────────────────────────────────    

    // ──────────────────────────────────────────────────────────────────────────
    // START > Panoptic Product Data Agent + Alias
    // ──────────────────────────────────────────────────────────────────────────
    const productAgName = 'Panoptic-ProductData';
    const productAgent = new Agent(this, 'ProductAgent', {
      name: productAgName,
      description: 'An expert on company product data.',
      foundationModel: primaryAgentInferenceProfile,
      instruction: 'Your job is to search for data on company products, their performance, and customer reviews.',
      userInputEnabled: true,
      knowledgeBases: [products_kb],
      // existingRole: createBedrockAgentRole(this, 'ProductAgentRole', productAgName, guardrails.guardrailArn),
      shouldPrepareAgent: true,
    });

    const productAgentAlias = new bedrock.CfnAgentAlias(this, 'ProductAgentAlias', {
      agentAliasName: 'test',
      description: 'Test Alias',
      agentId: productAgent.agentId,
    })
    productAgentAlias.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    const productAgentCollaborator: bedrock.CfnAgent.AgentCollaboratorProperty = {
      agentDescriptor: {
        aliasArn: productAgentAlias.attrAgentAliasArn,
      },
      collaborationInstruction: 'Use this agent when you need to know more about company products, their performance, and customer reviews.',
      collaboratorName: 'ProductData',
      relayConversationHistory: 'TO_COLLABORATOR',
    };
    // ──────────────────────────────────────────────────────────────────────────
    // END > Panoptic Product Data Agent + Alias
    // ──────────────────────────────────────────────────────────────────────────
    // ──────────────────────────────────────────────────────────────────────────
    // START > Virtual Weather Agent - Lambda Functions
    // ──────────────────────────────────────────────────────────────────────────
    // Date time lambda - Start, Log group, function and bedrock invocation permissions
    const curDatetimeFn = 'Panoptic-CurrentDatetime';
    // Create Log Group
    this.currentDatetimeLogGroup = new cdk.aws_logs.LogGroup(this, `CurrentDatetimeLogGroup`, {
      logGroupName: `/aws/lambda/panoptic/${curDatetimeFn}`,
      retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // Create Lambda Role
    const curDatetimeLambdaRole = createLambdaExecRole(this, `${curDatetimeFn}-Lambda`, curDatetimeFn, props.vpc.vpcId);
    // Create Lambda
    const curDatetime = new nodejs.NodejsFunction(this, 'Panoptic-Datetime', {
      functionName: curDatetimeFn,
      role: curDatetimeLambdaRole,
      entry: path.join(__dirname,"../lambda/weather/get-datetime/index.js"),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 128,
      timeout: cdk.Duration.minutes(3),
      logGroup: this.currentDatetimeLogGroup
    });

    // Date time lambda - End
    // Geo Coordinates - Start
    const geoCoordinatesFn = 'Panoptic-GeoCoordinates';
    // Create Log Group
    this.geoCoordinatesLogGroup = new cdk.aws_logs.LogGroup(this, `GeoCoordinatesLogGroup`, {
      logGroupName: `/aws/lambda/panoptic/${geoCoordinatesFn}`,
      retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // Create Lambda Role
    const geoCoordinatesLambdaRole = createLambdaExecRole(this, `${geoCoordinatesFn}-Lambda`, geoCoordinatesFn, props.vpc.vpcId);
    // Create Lambda
    const geoCoordinates = new nodejs.NodejsFunction(this, 'Panoptic-GeoCoordinates', {
      functionName: geoCoordinatesFn,
      role: geoCoordinatesLambdaRole,
      entry: path.join(__dirname,"../lambda/weather/geo-coordinates/index.js"),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 128,
      timeout: cdk.Duration.minutes(3),
      logGroup: this.geoCoordinatesLogGroup
    });

    // Geo Coordinates - End
    const weatherFn = 'Panoptic-GetWeather';
    // Create Log Group
    this.weatherLogGroup = new cdk.aws_logs.LogGroup(this, `WeatherLogGroupLogGroup`, {
      logGroupName: `/aws/lambda/panoptic/${weatherFn}`,
      retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // Create Lambda Role
    const getWeatherLambdaRole = createLambdaExecRole(this, `${weatherFn}-Lambda`, weatherFn, props.vpc.vpcId);
    // Create Lambda    
    const getWeather = new nodejs.NodejsFunction(this, 'Panoptic-GetWeather', {
      functionName: weatherFn,
      role: getWeatherLambdaRole,
      entry: path.join(__dirname,"../lambda/weather/get-weather/index.js"),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 128,
      timeout: cdk.Duration.minutes(3),
      logGroup: this.weatherLogGroup
    });

    // ──────────────────────────────────────────────────────────────────────────
    // END > Virtual Weather Agent - Lambda Functions
    // ──────────────────────────────────────────────────────────────────────────
    // ──────────────────────────────────────────────────────────────────────────
    // START > Virtual Weather Agent
    // ──────────────────────────────────────────────────────────────────────────
    //Agent for weather information
    const weatherAgName = 'Panoptic-Weather';

    //Add actions - Get date time, geocoding and weather to the agent
    const getDatetimeActionGroup = new AgentActionGroup({
      name: 'get_datetime',
      description: 'This tool will allow the agent to get the current date and time from a specific location provided by the human.',
      executor: ActionGroupExecutor.fromlambdaFunction(curDatetime),
      apiSchema: ApiSchema.fromLocalAsset(path.join(__dirname, './openApiSchemas/datetimeSchema.yaml')),    
    });
    
    const getGeoCoordinatesActionGroup = new AgentActionGroup({
      name: 'get_GeoCoordinates',
      description: 'This action group can query a geocoding API to translate location or places names into latitude and longitude coordinates to be used to obtain the weather information from coordinates.',
      executor: ActionGroupExecutor.fromlambdaFunction(geoCoordinates),
      apiSchema: ApiSchema.fromLocalAsset(path.join(__dirname, './openApiSchemas/geoCoordinatesSchema.yaml')),    
    });

    const getWeatherActionGroup = new AgentActionGroup({
      name: 'get_Weather',
      description: 'This action group can query weather information using latitude and longitude geolocation coordinates. The result will be explained to the customer.',
      executor: ActionGroupExecutor.fromlambdaFunction(getWeather),
      apiSchema: ApiSchema.fromLocalAsset(path.join(__dirname, './openApiSchemas/weatherSchema.yaml')),    
    });

    const weatherAgent = new Agent(this, 'WeatherAgent', {
      name: weatherAgName,
      description: 'Calls external weather API to get specific weather information',
      foundationModel: primaryAgentInferenceProfile,
      instruction: WEATHER_AGENT_PROMPT,
      userInputEnabled: true,
      actionGroups: [getWeatherActionGroup, getDatetimeActionGroup, getGeoCoordinatesActionGroup],
      // existingRole: createBedrockAgentRole(this, 'WeatherAgentRole', weatherAgName, guardrails.guardrailArn),
      shouldPrepareAgent: true,
    });

    const weatherAgentAlias = new bedrock.CfnAgentAlias(this, 'WeatherAgentAlias', {
      agentAliasName: 'test',
      description: 'Test Alias',
      agentId: weatherAgent.agentId,
    })
    weatherAgentAlias.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // Add Multi-Agent Colloborator details
    const weatherAgentCollaborator: bedrock.CfnAgent.AgentCollaboratorProperty = {
      agentDescriptor: {
        aliasArn: weatherAgentAlias.attrAgentAliasArn,
      },
      collaborationInstruction: `Use this agent to get any weather information from location described by user by following these steps: 
        1. Get current date time from the timezone from location provided by the user
        2. Obtain lattitude and longitude from the location provided by user. This steps performs geocoding 
        3. Obtain weather information from user provided date range and location(lattitude and longitude)`,
      collaboratorName: 'Weather',
      relayConversationHistory: 'TO_COLLABORATOR',
    };

    // ──────────────────────────────────────────────────────────────────────────
    // END > Virtual Weather Agent
    // ──────────────────────────────────────────────────────────────────────────



    // ──────────────────────────────────────────────────────────────────────────
    // START > SAP Order Agent - Lambda Functions
    // ──────────────────────────────────────────────────────────────────────────
    const sapOrderFn = 'Panoptic-GetSAPOrderStatus';
    //Create Log Group
    this.sapOrderLogGroup = new cdk.aws_logs.LogGroup(this, `SAPOrderLogGroup`, {
      logGroupName: `/aws/lambda/panoptic/${sapOrderFn}`,
      retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    //Create the secrete manager secret
    const sapApiCredentials = new Secret(this, 'SapApiCredentials', {
      secretName: 'sap_api_credential',
      description: 'SAP API connection credentials for sales order service',
      secretStringValue: cdk.SecretValue.unsafePlainText(JSON.stringify({
        "sales_order_url": "https://your-sap-base-url/sap/opu/odata/sap/API_SALES_ORDER_SRV",
        "username": "your-sap-username",
        "password": ""
     })),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    //Create Lambda Role
    const sapOrderLambdaRole = createLambdaExecRole(this, `${sapOrderFn}-Lambda`, sapOrderFn, props.vpc.vpcId);
    sapOrderLambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret'
      ],
      resources: [sapApiCredentials.secretArn]
    }));    

    //Create Lambda Function
    const sapOrderPython = new python.PythonFunction(this, 'SapOrderStatusLambda', {
      functionName: sapOrderFn,
      role: sapOrderLambdaRole, // Make sure you've defined this role with appropriate permissions
      entry: 'lambda/sap-order',
      runtime: lambda.Runtime.PYTHON_3_13,
      index: 'lambda.py',
      handler: 'lambda_handler',
      memorySize: 1024,
      timeout: cdk.Duration.minutes(5),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      logGroup: this.sapOrderLogGroup,
      environment: {
        SECRET_NAME: sapApiCredentials.secretName,
        // Add any other environment variables needed for your SAP integration
      }
    });



    //Create Secrets
    //Create the SAP order Agent
    const sapOrderName = 'Panoptic-SAPOrder';
    const sapOrderAgent = new Agent(this, 'SAPOrderAgent', {
      name: sapOrderName,
      description: 'Retrieves SAP sales order status information using the SAP OData service.',
      foundationModel: primaryAgentInferenceProfile,
      instruction: SAP_ORDER_AGENT_PROMPT,  // You'll need to define this constant
      userInputEnabled: true,
      // existingRole: createBedrockAgentRole(this, 'SAPOrderAgentRole', sapOrderName, guardrails.guardrailArn),
      shouldPrepareAgent: true,
    });
    

    const sapOrderAgentAlias = new bedrock.CfnAgentAlias(this, 'SAPOrderAgentAlias', {
      agentAliasName: 'test',
      description: 'Test Alias',
      agentId: sapOrderAgent.agentId,
    });
    sapOrderAgentAlias.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // Add Multi-Agent Collaborator details
    const sapOrderAgentCollaborator: bedrock.CfnAgent.AgentCollaboratorProperty = {
      agentDescriptor: {
        aliasArn: sapOrderAgentAlias.attrAgentAliasArn,
      },
      collaborationInstruction: 'Use this agent to check SAP sales order status information.',
      collaboratorName: 'SAPOrder',
      relayConversationHistory: 'TO_COLLABORATOR',
    };

    // Create Action Group for SAP Order Status
    const getSapOrderStatusActionGroup = new AgentActionGroup({
      name: 'get_sap_order_status',
      description: 'This action group can query SAP system to get sales order status information.',
      executor: ActionGroupExecutor.fromlambdaFunction(sapOrderPython),
      functionSchema: {
        functions: [
          {
            name: 'GetSAPOrderStatus',
            description: 'Function to get SAP sales order status',
            parameters: {
              salesOrderId: {
                type: "string",
                description: "The SAP sales order ID to query.",
                required: true,
              }
            }
          }
        ]
      }
    });
    // Add the action group to the agent
    sapOrderAgent.addActionGroup(getSapOrderStatusActionGroup);

    // ──────────────────────────────────────────────────────────────────────────
    // END > SAP Order Agent - Lambda
    // ──────────────────────────────────────────────────────────────────────────

    // ──────────────────────────────────────────────────────────────────────────
    // START > Panoptic Supervisor - Main Agent
    // ──────────────────────────────────────────────────────────────────────────
    const supervisorName = 'Panoptic-Supervisor';
    // const supervisorAgentRole = createBedrockAgentRole(this, `${supervisorName}Role`, supervisorName, guardrails.guardrailArn)
    this.panopticSupervisorAgent = new bedrock.CfnAgent (this, 'PanopticSupervisorAgent', {
      agentName: supervisorName,
      description: 'Main Panoptic Supervisor Agent',
      instruction: SUPERVISOR_AGENT_PROMPT,
      foundationModel: SUPERVISOR_LLM,
      agentCollaboration:  'SUPERVISOR_ROUTER',
      agentCollaborators: [ 
        dataVizCollaborator, 
        schemaTranslatorCollaborator, 
        graphDBCollaborator, 
        dataAnalyzerCollaborator, 
        synthDataCollaborator, 
        productAgentCollaborator, 
        helpCollaborator,
        weatherAgentCollaborator,
        sapOrderAgentCollaborator
      ],
      autoPrepare: true,
      agentResourceRoleArn: bedrockAgentRole.roleArn,
      guardrailConfiguration: {
        guardrailIdentifier: guardrails.guardrailId,
        guardrailVersion: gdVersion,
      },
      memoryConfiguration: {
        storageDays: 30,
        enabledMemoryTypes: [
          "SESSION_SUMMARY"
        ],
        sessionSummaryConfiguration: {
          maxRecentSessions: 20
        }
      }
    });

    const getAgentHash = (agent: Agent): string => {
      const resource = agent.node.findAll().find(construct => construct instanceof bedrock.CfnAgent)
      if (!resource) {
        throw new Error('Could not find L1 Bedrock Agent construct')
      }
      const rendered = JSON.stringify(cdk.Stack.of(agent).resolve(resource)._toCloudFormation())
      return createHash('md5').update(rendered).digest('hex')
    }

    //const agentHash = getAgentHash(this.panopticSupervisorAgent)
    //trying https://github.com/awslabs/generative-ai-cdk-constructs/issues/969
    this.panopticSupervisorAgentAlias = new bedrock.CfnAgentAlias(this, 'PanopticSupervisorAlias', {
      agentAliasName: 'latest-supervisor',
      description: 'Panoptic Supervisor Alias',
      agentId: this.panopticSupervisorAgent.attrAgentId,

    })

    this.panopticSupervisorAgent.addDependency(schemaTranslatorAgentAlias)
    this.panopticSupervisorAgent.addDependency(graphDBAgentAlias)
    this.panopticSupervisorAgent.addDependency(dataAnalyzerAgentAlias)
    this.panopticSupervisorAgent.addDependency(synthDataAgentAlias)
    this.panopticSupervisorAgent.addDependency(helpAgentAlias)
    this.panopticSupervisorAgent.addDependency(productAgentAlias)
    this.panopticSupervisorAgent.addDependency(weatherAgentAlias)
    this.panopticSupervisorAgent.addDependency(sapOrderAgentAlias);
    
    // Create SSM parameters for the Supervisor Agent
    new ssm.StringParameter(this, 'SupervisorAgentArnParameter', {
      parameterName: '/panoptic/supervisor/agentArn',
      stringValue: this.panopticSupervisorAgent.attrAgentArn,
      description: 'Arn of the Supervisor Agent',
    });
    new ssm.StringParameter(this, 'SupervisorAgentAliasArnParameter', {
      parameterName: '/panoptic/supervisor/agentAliasArn',
      stringValue: this.panopticSupervisorAgentAlias.attrAgentAliasArn,
      description: 'Arn of the Supervisor Agent Alias',
    });
    new ssm.StringParameter(this, 'SupervisorAgentIdParameter', {
      parameterName: '/panoptic/supervisor/agentId',
      stringValue: this.panopticSupervisorAgent.attrAgentId,
      description: 'ID of the Supervisor Agent',
    });
    new ssm.StringParameter(this, 'SupervisorAgentAliasIdParameter', {
      parameterName: '/panoptic/supervisor/agentAliasId',
      stringValue: this.panopticSupervisorAgentAlias.attrAgentAliasId,
      description: 'ID of the Supervisor Agent Alias',
    });    

    // ──────────────────────────────────────────────────────────────────────────
    // END > Panoptic Supervisor - Main Agent
    // ──────────────────────────────────────────────────────────────────────────    
    
    // Add stack-level suppressions for all CDK-NAG warnings
    NagSuppressions.addStackSuppressions(
      this,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Bedrock agents and Lambda functions require wildcard permissions for AWS service operations',
        },
        {
          id: 'AwsSolutions-IAM4',
          reason: 'AWS managed policies are used for standard Lambda execution roles',
        },
        {
          id: 'AwsSolutions-L1',
          reason: 'CDK-generated Lambda functions use specific runtime versions',
        },
        {
          id: 'AwsSolutions-SMG4',
          reason: 'Secret rotation not required for this demo application',
        }
      ],
      true
    );
  }

}
