import { Stack, StackProps, Duration, RemovalPolicy, SecretValue, CfnOutput, Fn, CfnMapping } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as custom from "aws-cdk-lib/custom-resources";
import {
  Guardrail,
  ContentFilterStrength,
  ContentFilterType,
  GuardrailAction,
  ManagedWordFilterType,
  PIIType,
  Topic,
} from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as path from "path";

export class AgentFargateStack extends Stack {
  private getHelpKnowledgeBaseId(): string {
    const fs = require("fs");
    try {
      return fs.readFileSync("/tmp/kb-outputs/help-kb-id.txt", "utf8").trim();
    } catch (error) {
      console.warn("Could not read Help KB ID from /tmp/kb-outputs/help-kb-id.txt, using placeholder");
      return "placeholder-help-kb-id";
    }
  }

  private getHelpDataSourceId(): string {
    const fs = require("fs");
    try {
      return fs.readFileSync("/tmp/kb-outputs/help-data-source-id.txt", "utf8").trim();
    } catch (error) {
      console.warn(
        "Could not read Help data source ID from /tmp/kb-outputs/help-data-source-id.txt, using placeholder",
      );
      return "placeholder-help-data-source-id";
    }
  }

  private getProductsKnowledgeBaseId(): string {
    const fs = require("fs");
    try {
      return fs.readFileSync("/tmp/kb-outputs/products-kb-id.txt", "utf8").trim();
    } catch (error) {
      console.warn("Could not read Products KB ID from /tmp/kb-outputs/products-kb-id.txt, using placeholder");
      return "placeholder-products-kb-id";
    }
  }

  private getProductsDataSourceId(): string {
    const fs = require("fs");
    try {
      return fs.readFileSync("/tmp/kb-outputs/products-data-source-id.txt", "utf8").trim();
    } catch (error) {
      console.warn(
        "Could not read Products data source ID from /tmp/kb-outputs/products-data-source-id.txt, using placeholder",
      );
      return "placeholder-products-data-source-id";
    }
  }

  private getTariffsKnowledgeBaseId(): string {
    const fs = require("fs");
    try {
      return fs.readFileSync("/tmp/kb-outputs/tariffs-kb-id.txt", "utf8").trim();
    } catch (error) {
      console.warn("Could not read Tariffs KB ID from /tmp/kb-outputs/tariffs-kb-id.txt, using placeholder");
      return "placeholder-tariffs-kb-id";
    }
  }

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // ===== VPC CONFIGURATION =====
    // Supports three modes:
    // 1. Create new VPC (default)
    // 2. Use existing VPC with tag-based subnet selection (--vpc-id only)
    // 3. Use existing VPC with explicit subnet IDs (enterprise mode)
    const vpcId = this.node.tryGetContext("vpcId");
    const publicSubnetIdsContext = this.node.tryGetContext("publicSubnetIds");
    const privateSubnetIdsContext = this.node.tryGetContext("privateSubnetIds");

    // Parse comma-separated subnet IDs if provided
    const publicSubnetIds = publicSubnetIdsContext ? publicSubnetIdsContext.split(",") : [];
    const privateSubnetIds = privateSubnetIdsContext ? privateSubnetIdsContext.split(",") : [];

    let vpc: ec2.IVpc;
    let publicSubnets: ec2.ISubnet[] | undefined;
    let privateSubnets: ec2.ISubnet[] | undefined;

    if (vpcId) {
      if (publicSubnetIds.length > 0 || privateSubnetIds.length > 0) {
        // Enterprise mode: explicit subnet IDs provided
        // Import VPC without subnet lookup to avoid tag dependency
        vpc = ec2.Vpc.fromVpcAttributes(this, "ExistingVpc", {
          vpcId: vpcId,
          availabilityZones: ["dummy-az-1", "dummy-az-2"], // Will be overridden by explicit subnets
        });

        // Import explicit subnets
        if (publicSubnetIds.length > 0) {
          publicSubnets = publicSubnetIds.map((subnetId: string, index: number) =>
            ec2.Subnet.fromSubnetId(this, `PublicSubnet${index}`, subnetId.trim())
          );
        }
        if (privateSubnetIds.length > 0) {
          privateSubnets = privateSubnetIds.map((subnetId: string, index: number) =>
            ec2.Subnet.fromSubnetId(this, `PrivateSubnet${index}`, subnetId.trim())
          );
        }
      } else {
        // Standard mode: use VPC lookup with tag-based subnet selection
        vpc = ec2.Vpc.fromLookup(this, "ExistingVpc", { vpcId });
      }
    } else {
      // Create new VPC
      vpc = new ec2.Vpc(this, "AgentVpc", {
        maxAzs: 2,
        natGateways: 1,
      });
    }

    // Helper to get subnet selection - prefers explicit subnets over tag-based
    const getPrivateSubnetSelection = (): ec2.SubnetSelection => {
      if (privateSubnets && privateSubnets.length > 0) {
        return { subnets: privateSubnets };
      }
      return { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS };
    };

    const getPublicSubnetSelection = (): ec2.SubnetSelection => {
      if (publicSubnets && publicSubnets.length > 0) {
        return { subnets: publicSubnets };
      }
      return { subnetType: ec2.SubnetType.PUBLIC };
    };

    // Create an ECS cluster
    const cluster = new ecs.Cluster(this, "AgentCluster", {
      vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    // Create log groups
    const agentLogGroup = new logs.LogGroup(this, "AgentServiceLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const uiLogGroup = new logs.LogGroup(this, "UIServiceLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ===== BEDROCK GUARDRAILS RESOURCES =====
    const blocked_msg =
      "Sorry, I am unable to answer this question. I am limited to discussing specific topics related to data exploration.";

    const guardrails = new Guardrail(this, "DataExplorerGuardrails", {
      name: "ai-data-explorer-guardrails",
      description: "Default AI Data Explorer guardrails",
      blockedInputMessaging: blocked_msg,
      blockedOutputsMessaging: blocked_msg,
    });

    // Harmful Content Filters
    guardrails.addContentFilter({
      type: ContentFilterType.HATE,
      inputStrength: ContentFilterStrength.HIGH,
      outputStrength: ContentFilterStrength.HIGH,
    });
    guardrails.addContentFilter({
      type: ContentFilterType.INSULTS,
      inputStrength: ContentFilterStrength.HIGH,
      outputStrength: ContentFilterStrength.HIGH,
    });
    guardrails.addContentFilter({
      type: ContentFilterType.SEXUAL,
      inputStrength: ContentFilterStrength.HIGH,
      outputStrength: ContentFilterStrength.HIGH,
    });
    guardrails.addContentFilter({
      type: ContentFilterType.VIOLENCE,
      inputStrength: ContentFilterStrength.HIGH,
      outputStrength: ContentFilterStrength.HIGH,
    });
    guardrails.addContentFilter({
      type: ContentFilterType.MISCONDUCT,
      inputStrength: ContentFilterStrength.HIGH,
      outputStrength: ContentFilterStrength.HIGH,
    });

    // Custom Word Filter
    guardrails.addWordFilter({ text: "TikTok" });

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
        name: "Dinosaurs",
        definition: "No talking about dinosaurs.",
        examples: [
          "Tell me about the largest dinosaur.",
          "Tell me about Tyrannosaurus rex (T-Rex).",
          "What is a pterodactyl?",
          "Are dinosaurs extinct?",
        ],
      }),
    );

    // Profanity Filter
    guardrails.addManagedWordListFilter({ type: ManagedWordFilterType.PROFANITY });

    // Create version
    const gdVersion = guardrails.createVersion();

    // ===== BEDROCK KNOWLEDGE BASE RESOURCES =====

    // S3 Bucket for Knowledge Base documents
    // Reference existing S3 bucket created by shell script
    const kbBucket = s3.Bucket.fromBucketName(
      this,
      "KnowledgeBaseBucket",
      `ai-data-explorer-kb-${this.account}-${this.region}`,
    );

    // Lambda role for KB sync function - commented out while KB is disabled
    const syncLambdaRole = new iam.Role(this, "KBSyncLambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")],
      inlinePolicies: {
        BedrockKBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["bedrock:StartIngestionJob", "bedrock:GetIngestionJob", "bedrock:ListIngestionJobs"],
              resources: [
                `arn:aws:bedrock:${this.region}:${this.account}:knowledge-base/${this.getHelpKnowledgeBaseId()}`,
                `arn:aws:bedrock:${this.region}:${this.account}:knowledge-base/${this.getHelpKnowledgeBaseId()}/datasource/*`,
              ],
            }),
          ],
        }),
      },
    });

    // Lambda function for KB sync
    const syncFunction = new lambda.Function(this, "KBSyncFunction", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "index.handler",
      role: syncLambdaRole,
      timeout: Duration.minutes(5),
      environment: {
        KNOWLEDGE_BASE_ID: this.getHelpKnowledgeBaseId(),
        DATA_SOURCE_ID: this.getHelpDataSourceId(),
      },
      code: lambda.Code.fromInline(`
import boto3
import os

client = boto3.client('bedrock-agent')

def handler(event, context):

  response = client.start_ingestion_job(
      dataSourceId=os.environ['DATA_SOURCE_ID'],
      knowledgeBaseId=os.environ['KNOWLEDGE_BASE_ID']
  )
  print(response)
`),
    });

    // S3 event notification to trigger sync - commented out while KB is disabled
    kbBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(syncFunction), {
      prefix: "docs/",
    });

    kbBucket.addEventNotification(s3.EventType.OBJECT_REMOVED, new s3n.LambdaDestination(syncFunction), {
      prefix: "docs/",
    });

    // Upload docs to S3
    new s3deploy.BucketDeployment(this, "DeployDocs", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../docs/kb"))],
      destinationBucket: kbBucket,
      destinationKeyPrefix: "docs",
    });

    // Upload products reviews data to S3
    new s3deploy.BucketDeployment(this, "DeployProductsData", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../data/kb"))],
      destinationBucket: kbBucket,
      destinationKeyPrefix: "products",
    });

    // Upload tariffs data to S3
    new s3deploy.BucketDeployment(this, "DeployTariffs", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../data/tariffs"))],
      destinationBucket: kbBucket,
      destinationKeyPrefix: "tariffs",
    });

    // Create DynamoDB table for user feedback
    const feedbackTable = new dynamodb.Table(this, "UserFeedbackTable", {
      tableName: "AI-Data-Explorer-Feedback",
      partitionKey: { name: "feedback_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ===== SAP API CREDENTIALS SECRET =====

    const sapApiCredentials = new secretsmanager.Secret(this, "SapApiCredentials", {
      secretName: "sap_api_credentials", // pragma: allowlist secret
      description: "SAP API connection credentials for sales order service",
      secretStringValue: SecretValue.unsafePlainText(
        JSON.stringify({
          sales_order_url: "https://your-sap-base-url/sap/opu/odata/sap/API_SALES_ORDER_SRV",
          username: "your-sap-username",
          password: "",
        }),
      ),
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Create execution role
    const executionRole = new iam.Role(this, "TaskExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy")],
    });

    // Create task role with Bedrock permissions
    const taskRole = new iam.Role(this, "TaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream", "bedrock:ApplyGuardrail"],
        resources: ["*"],
      }),
    );

    // Add Bedrock AgentCore Memory permissions
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock-agentcore:ListMemories",
          "bedrock-agentcore:CreateMemory",
          "bedrock-agentcore:GetMemory",
          "bedrock-agentcore:DeleteMemory",
          "bedrock-agentcore:CreateEvent",
          "bedrock-agentcore:ListEvents",
          "bedrock-agentcore:GetLastKTurns",
        ],
        resources: ["*"],
      }),
    );

    // Add knowledge base query permissions
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:Retrieve",
          "bedrock:RetrieveAndGenerate",
          "bedrock:GetKnowledgeBase",
          "bedrock:ListKnowledgeBases",
        ],
        resources: [
          `arn:aws:bedrock:${this.region}:${this.account}:knowledge-base/${this.getHelpKnowledgeBaseId()}`,
          `arn:aws:bedrock:${this.region}:${this.account}:knowledge-base/${this.getProductsKnowledgeBaseId()}`,
          `arn:aws:bedrock:${this.region}:${this.account}:knowledge-base/${this.getTariffsKnowledgeBaseId()}`,
          `arn:aws:bedrock:${this.region}:${this.account}:knowledge-base/*`,
        ],
      }),
    );

    // Add Secrets Manager permissions for SAP API credentials
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: [sapApiCredentials.secretArn],
      }),
    );

    // Add Lambda invoke permissions for data loader
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [`arn:aws:lambda:${this.region}:${this.account}:function:AI-Data-Explorer-Data-Loader`],
      }),
    );

    // Add DynamoDB permissions for schema assistant logging
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem"],
        resources: [
          `arn:aws:dynamodb:${this.region}:${this.account}:table/AI-Data-Explorer-Data-Analyzer-Log`,
          `arn:aws:dynamodb:${this.region}:${this.account}:table/AI-Data-Explorer-Schema-Translator-Log`,
          feedbackTable.tableArn,
        ],
      }),
    );

    // Add X-Ray permissions for tracing
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["xray:PutTraceSegments", "xray:PutTelemetryRecords"],
        resources: ["*"],
      }),
    );

    // Agent Service Task Definition
    const agentTaskDefinition = new ecs.FargateTaskDefinition(this, "AgentTaskDefinition", {
      memoryLimitMiB: 2048,
      cpu: 1024,
      executionRole,
      taskRole,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    const agentDockerAsset = new ecrAssets.DockerImageAsset(this, "AgentImage", {
      directory: path.join(__dirname, ".."),
      file: "./docker/Dockerfile",
      platform: ecrAssets.Platform.LINUX_AMD64,
    });

    const agentContainer = agentTaskDefinition.addContainer("AgentContainer", {
      image: ecs.ContainerImage.fromDockerImageAsset(agentDockerAsset),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "agent-service",
        logGroup: agentLogGroup,
      }),
      environment: {
        LOG_LEVEL: "INFO",
        NEPTUNE_HOST: this.node.tryGetContext("neptuneHost") || "localhost",
        NEPTUNE_PORT: "8182",
        NEPTUNE_LOAD_ROLE_ARN: this.node.tryGetContext("withGraphDb")
          ? Fn.importValue("GraphDbNeptuneLoadRoleArn")
          : "",
        NEPTUNE_ETL_BUCKET: this.node.tryGetContext("withGraphDb") ? Fn.importValue("GraphDbNeptuneEtlBucketName") : "",
        AWS_REGION: this.region,
        BYPASS_TOOL_CONSENT: "true",
        PYTHONUNBUFFERED: "1",
        PYTHONIOENCODING: "utf-8",
        ENVIRONMENT: "production",
        TRACING_ENABLED: "true",
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
        OTEL_SERVICE_NAME: "ai-data-explorer",
        SERVICE_VERSION: "2.0.0",
        BEDROCK_GUARDRAIL_ID: guardrails.guardrailId,
        BEDROCK_GUARDRAIL_VERSION: gdVersion,
        GUARDRAIL_MODE: this.node.tryGetContext("guardrailMode") || "shadow",
        KNOWLEDGE_BASE_ID: this.getHelpKnowledgeBaseId(),
        PRODUCTS_KB_ID: this.getProductsKnowledgeBaseId(),
        TARIFFS_KB_ID: this.getTariffsKnowledgeBaseId(),
        SECRET_NAME: sapApiCredentials.secretName,
        DATA_ANALYZER_LOG_TABLE: this.node.tryGetContext("withGraphDb")
          ? Fn.importValue("GraphDbDataAnalyzerLogTableName")
          : "",
        SCHEMA_TRANSLATOR_LOG_TABLE: this.node.tryGetContext("withGraphDb")
          ? Fn.importValue("GraphDbSchemaTranslatorLogTableName")
          : "",
      },
      portMappings: [
        {
          containerPort: 8000,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });

    // Add OTEL Collector sidecar container
    const otelCollectorContainer = agentTaskDefinition.addContainer("OtelCollectorContainer", {
      image: ecs.ContainerImage.fromRegistry("public.ecr.aws/aws-observability/aws-otel-collector:latest"),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "otel-collector",
        logGroup: agentLogGroup,
      }),
      environment: {
        AWS_REGION: this.region,
        AOT_CONFIG_CONTENT: JSON.stringify({
          receivers: {
            otlp: {
              protocols: {
                http: {
                  endpoint: "0.0.0.0:4318",
                },
              },
            },
          },
          processors: {
            batch: {},
          },
          exporters: {
            awsxray: {
              region: this.region,
            },
          },
          service: {
            pipelines: {
              traces: {
                receivers: ["otlp"],
                processors: ["batch"],
                exporters: ["awsxray"],
              },
            },
          },
        }),
      },
      portMappings: [
        {
          containerPort: 4318,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });

    // UI Service Task Definition
    const uiTaskRole = new iam.Role(this, "UITaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      inlinePolicies: {
        S3KnowledgeBasePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["s3:PutObject", "s3:PutObjectAcl"],
              resources: [`arn:aws:s3:::ai-data-explorer-kb-${this.account}-${this.region}/products/*`],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["bedrock:StartIngestionJob"],
              resources: [
                `arn:aws:bedrock:${this.region}:${this.account}:knowledge-base/${this.getProductsKnowledgeBaseId()}`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["s3:GetObject", "s3:PutObject"],
              resources: [`arn:aws:s3:::ai-data-explorer-graph-etl-${this.account}-${this.region}/public/schema/*`],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["s3:ListBucket"],
              resources: [`arn:aws:s3:::ai-data-explorer-graph-etl-${this.account}-${this.region}`],
            }),

            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:Query", "dynamodb:Scan"],
              resources: [feedbackTable.tableArn],
            }),
            ...(this.node.tryGetContext("withGraphDb")
              ? [
                  new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ["s3:PutObject", "s3:PutObjectAcl"],
                    resources: [`arn:aws:s3:::ai-data-explorer-graph-etl-${this.account}-${this.region}/incoming/*`],
                  }),
                  new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ["dynamodb:Scan", "dynamodb:Query", "dynamodb:GetItem"],
                    resources: [
                      Fn.sub("arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${TableName}", {
                        TableName: Fn.importValue("GraphDbEtlLogTableName"),
                      }),
                      Fn.sub("arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${TableName}", {
                        TableName: Fn.importValue("GraphDbBulkLoadLogTableName"),
                      }),
                      Fn.sub("arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${TableName}", {
                        TableName: Fn.importValue("GraphDbDataAnalyzerLogTableName"),
                      }),
                      Fn.sub("arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${TableName}", {
                        TableName: Fn.importValue("GraphDbSchemaTranslatorLogTableName"),
                      }),
                    ],
                  }),
                ]
              : []),
          ],
        }),
      },
    });

    const uiTaskDefinition = new ecs.FargateTaskDefinition(this, "UITaskDefinition", {
      memoryLimitMiB: 1024,
      cpu: 512,
      executionRole,
      taskRole: uiTaskRole,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    const uiDockerAsset = new ecrAssets.DockerImageAsset(this, "UIImage", {
      directory: path.join(__dirname, "../ui"),
      file: "./Dockerfile",
      platform: ecrAssets.Platform.LINUX_AMD64,
    });

    const uiContainer = uiTaskDefinition.addContainer("UIContainer", {
      image: ecs.ContainerImage.fromDockerImageAsset(uiDockerAsset),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "ui-service",
        logGroup: uiLogGroup,
      }),
      environment: {
        AGENT_SERVICE_URL: "placeholder",
        KB_S3_BUCKET_NAME: `ai-data-explorer-kb-${this.account}-${this.region}`,
        PRODUCTS_KB_ID: this.getProductsKnowledgeBaseId(),
        PRODUCTS_DS_ID: this.getProductsDataSourceId(),
        NEPTUNE_ETL_BUCKET: this.node.tryGetContext("withGraphDb") ? Fn.importValue("GraphDbNeptuneEtlBucketName") : "",
      },
      portMappings: [
        {
          containerPort: 5000,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });

    // ===== SECURITY GROUP CONFIGURATION =====
    // Supports two modes:
    // 1. Create new security groups (default)
    // 2. Use existing security groups (enterprise mode with --alb-security-group-id and --ecs-security-group-id)
    const albSecurityGroupId = this.node.tryGetContext("albSecurityGroupId");
    const ecsSecurityGroupId = this.node.tryGetContext("ecsSecurityGroupId");

    let lbSG: ec2.ISecurityGroup;
    let agentSG: ec2.ISecurityGroup;
    let uiSG: ec2.ISecurityGroup;

    if (albSecurityGroupId && ecsSecurityGroupId) {
      // Enterprise mode: use existing security groups
      // Note: When using existing SGs, the user is responsible for configuring ingress/egress rules
      lbSG = ec2.SecurityGroup.fromSecurityGroupId(this, "ExistingLoadBalancerSG", albSecurityGroupId);
      agentSG = ec2.SecurityGroup.fromSecurityGroupId(this, "ExistingAgentServiceSG", ecsSecurityGroupId);
      uiSG = ec2.SecurityGroup.fromSecurityGroupId(this, "ExistingUIServiceSG", ecsSecurityGroupId);
    } else {
      // Create new security groups
      agentSG = new ec2.SecurityGroup(this, "AgentServiceSG", {
        vpc,
        description: "Security group for Agent Service",
        allowAllOutbound: true,
      });

      uiSG = new ec2.SecurityGroup(this, "UIServiceSG", {
        vpc,
        description: "Security group for UI Service",
        allowAllOutbound: true,
      });

      lbSG = new ec2.SecurityGroup(this, "LoadBalancerSG", {
        vpc,
        description: "Security group for Application Load Balancer",
        allowAllOutbound: true,
      });

      // Allow HTTP traffic to load balancer from CloudFront only
      // CloudFront origin-facing IP ranges by region using CDK Mapping
      const cloudFrontPrefixMapping = new CfnMapping(this, "CloudFrontPrefixMapping", {
        mapping: {
          "us-east-1": {
            PrefixListId: "pl-3b927c52",
          },
          "us-east-2": {
            PrefixListId: "pl-b6a144df",
          },
          "us-west-2": {
            PrefixListId: "pl-82a045eb",
          },
          "eu-central-1": {
            PrefixListId: "pl-a3a144ca",
          },
          "ap-southeast-2": {
            PrefixListId: "pl-b8a742d1",
          },
        },
      });

      const cloudFrontPrefixList = cloudFrontPrefixMapping.findInMap(Fn.ref("AWS::Region"), "PrefixListId");

      (lbSG as ec2.SecurityGroup).addIngressRule(
        ec2.Peer.prefixList(cloudFrontPrefixList),
        ec2.Port.tcp(80),
        "Allow HTTP traffic from CloudFront only",
      );

      // Allow load balancer to communicate with services
      (agentSG as ec2.SecurityGroup).addIngressRule(lbSG, ec2.Port.tcp(8000), "Allow load balancer to agent service");
      (uiSG as ec2.SecurityGroup).addIngressRule(lbSG, ec2.Port.tcp(5000), "Allow load balancer to UI service");

      // Allow UI to communicate with Agent service
      (agentSG as ec2.SecurityGroup).addIngressRule(uiSG, ec2.Port.tcp(8000), "Allow UI to access Agent service");
    }

    // Automatically add Neptune access if Neptune security group ID is provided
    // Only add rules if we created the security groups (not using existing ones)
    const neptuneSgId = this.node.tryGetContext("neptuneSgId");
    if (neptuneSgId && !ecsSecurityGroupId) {
      const neptuneSG = ec2.SecurityGroup.fromSecurityGroupId(this, "NeptuneSG", neptuneSgId);
      neptuneSG.addIngressRule(agentSG, ec2.Port.tcp(8182), "Allow agent service to Neptune");
    }

    // Create services with appropriate subnet selection
    const agentService = new ecs.FargateService(this, "AgentService", {
      cluster,
      taskDefinition: agentTaskDefinition,
      desiredCount: 2,
      assignPublicIp: false,
      vpcSubnets: getPrivateSubnetSelection(),
      securityGroups: [agentSG],
      serviceName: "agent-service",
      circuitBreaker: { rollback: true },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      healthCheckGracePeriod: Duration.seconds(60),
    });

    const uiService = new ecs.FargateService(this, "UIService", {
      cluster,
      taskDefinition: uiTaskDefinition,
      desiredCount: 1,
      assignPublicIp: false,
      vpcSubnets: getPrivateSubnetSelection(),
      securityGroups: [uiSG],
      serviceName: "ui-service",
      circuitBreaker: { rollback: true },
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      healthCheckGracePeriod: Duration.seconds(60),
    });

    // Create Application Load Balancer with appropriate subnet selection
    const lb = new elbv2.ApplicationLoadBalancer(this, "LoadBalancer", {
      vpc,
      internetFacing: true,
      idleTimeout: Duration.seconds(300),
      securityGroup: lbSG,
      vpcSubnets: getPublicSubnetSelection(),
    });

    // Create listener with open=false to prevent automatic 0.0.0.0/0 rule
    const listener = lb.addListener("Listener", {
      port: 80,
      open: false, // Prevent automatic 0.0.0.0/0 security group rule
      defaultTargetGroups: [
        new elbv2.ApplicationTargetGroup(this, "DefaultUITargets", {
          port: 5000,
          protocol: elbv2.ApplicationProtocol.HTTP,
          vpc,
          targets: [uiService],
          healthCheck: {
            path: "/health",
            interval: Duration.seconds(30),
            timeout: Duration.seconds(5),
            healthyHttpCodes: "200",
          },
        }),
      ],
    });

    // Add Agent API targets for /query and /query-streaming
    listener.addTargets("AgentTargets", {
      port: 8000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [agentService],
      healthCheck: {
        path: "/health",
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        healthyHttpCodes: "200",
      },
      // Removed stickiness to avoid cookie issues with HTTPS/CloudFront
      priority: 100,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(["/query*", "/health", "/conversation*", "/get-models", "/set-*"]),
      ],
    });

    // Update UI container environment - use ALB but ensure get-image stays with UI service
    uiContainer.addEnvironment("AGENT_SERVICE_URL", `http://${lb.loadBalancerDnsName}`);

    // Output VPC information
    this.exportValue(vpc.vpcId, {
      name: "VpcId",
      description: "VPC ID where services are deployed",
    });

    // Output ECS information
    this.exportValue(cluster.clusterName, {
      name: "ECSClusterName",
      description: "ECS Cluster name",
    });

    this.exportValue(agentService.serviceName, {
      name: "AgentServiceName",
      description: "Agent service name",
    });

    this.exportValue(uiService.serviceName, {
      name: "UIServiceName",
      description: "UI service name",
    });

    // Output ALB information
    this.exportValue(lb.loadBalancerFullName, {
      name: "ALBName",
      description: "Application Load Balancer full name",
    });

    // Output endpoints
    this.exportValue(`http://${lb.loadBalancerDnsName}`, {
      name: "ALBEndpoint",
      description: "The UI endpoint URL",
    });

    this.exportValue(kbBucket.bucketName, {
      name: "KnowledgeBaseBucket",
      description: "S3 Bucket containing Knowledge Base documents",
    });

    // ========================================
    // Authentication Resources
    // ========================================

    // Create Cognito User Pool
    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: "ai-data-explorer-users",
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Create User Groups
    const adminGroup = new cognito.CfnUserPoolGroup(this, "AdminGroup", {
      userPoolId: userPool.userPoolId,
      groupName: "Admin",
      description: "Administrator users",
    });

    const userGroup = new cognito.CfnUserPoolGroup(this, "UserGroup", {
      userPoolId: userPool.userPoolId,
      groupName: "User",
      description: "Regular users",
    });

    // Create Cognito Domain
    const domain = userPool.addDomain("CognitoDomain", {
      cognitoDomain: {
        domainPrefix: `ai-data-explorer-${this.account}-${this.region}`,
      },
    });

    // Configure User Pool UI customization with inline CSS
    const customCss = `
.banner-customizable {
    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%) !important;
    padding: 2rem 0 !important;
}

.label-customizable {
  font-weight: 600 !important;
}

.logo-customizable {
    max-width: 200px !important;
    max-height: 60px !important;
}

.textDescription-customizable {
    font-size: 1.5rem !important;
    margin: 1rem 0 !important;
}

.inputField-customizable {
    border: 2px solid #e2e8f0 !important;
    border-radius: 8px !important;
    padding: 0.75rem 1rem !important;
    font-size: 1.5rem !important;
}

.inputField-customizable:focus {
    border-color: #3b82f6 !important;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
    outline: none !important;
}

.submitButton-customizable {
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%) !important;
    border: none !important;
    border-radius: 8px !important;
    padding: 0.75rem 1.5rem !important;
    font-weight: 600 !important;
    color: white !important;
}

.submitButton-customizable:hover {
    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%) !important;
}

.redirect-customizable {
    color: #3b82f6 !important;
}

.errorMessage-customizable {
    background: #fef2f2 !important;
    border: 1px solid #fecaca !important;
    color: #dc2626 !important;
    border-radius: 8px !important;
    padding: 0.75rem 1rem !important;
}`;

    const uiCustomization = new cognito.CfnUserPoolUICustomizationAttachment(this, "CognitoUICustomization", {
      userPoolId: userPool.userPoolId,
      clientId: "ALL",
      css: customCss,
    });

    // UI customization must wait for domain to be created
    uiCustomization.node.addDependency(domain);

    // Create User Pool Client for ALB-only approach
    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool,
      generateSecret: true,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: ["https://placeholder.example.com/callback"], // Placeholder - will be updated by custom resource
        logoutUrls: ["https://placeholder.example.com"], // Placeholder - will be updated by custom resource
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      authFlows: {
        userSrp: true,
      },
      accessTokenValidity: Duration.hours(24), // Max 24 hours
      idTokenValidity: Duration.hours(24), // Max 24 hours
      refreshTokenValidity: Duration.days(3650), // Max 10 years
    });

    // Store client secret in Secrets Manager
    const clientSecret = new secretsmanager.Secret(this, "CognitoClientSecret", {
      description: "Cognito User Pool Client Secret",
      secretStringValue: SecretValue.unsafePlainText(userPoolClient.userPoolClientSecret.unsafeUnwrap()),
    });

    // Create CloudFront distribution for HTTPS termination
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(lb, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          readTimeout: Duration.seconds(120),
          keepaliveTimeout: Duration.seconds(60),
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // Important for streaming!
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        compress: false, // Disable compression for streaming
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Set Cognito environment variables with HTTPS CloudFront URLs
    const httpsUrl = `https://${distribution.distributionDomainName}`;
    uiContainer.addEnvironment("COGNITO_DOMAIN", `https://${domain.domainName}.auth.${this.region}.amazoncognito.com`);
    uiContainer.addEnvironment("CLIENT_ID", userPoolClient.userPoolClientId);
    uiContainer.addSecret("CLIENT_SECRET", ecs.Secret.fromSecretsManager(clientSecret));
    uiContainer.addEnvironment("USER_POOL_ID", userPool.userPoolId);
    uiContainer.addEnvironment("REDIRECT_URI", `${httpsUrl}/callback`);

    // Set CORS allowed origins for agent container
    agentContainer.addEnvironment("ALLOWED_ORIGINS", `${httpsUrl},http://${lb.loadBalancerDnsName}`);

    // Update Cognito User Pool Client URLs to use HTTPS CloudFront domain
    const updateCognitoUrls = new custom.AwsCustomResource(this, "UpdateCognitoUrls", {
      onCreate: {
        service: "CognitoIdentityServiceProvider",
        action: "updateUserPoolClient",
        parameters: {
          UserPoolId: userPool.userPoolId,
          ClientId: userPoolClient.userPoolClientId,
          CallbackURLs: [`${httpsUrl}/callback`],
          LogoutURLs: [httpsUrl],
          AllowedOAuthFlows: ["code"],
          AllowedOAuthScopes: ["openid", "email", "profile"],
          AllowedOAuthFlowsUserPoolClient: true,
          SupportedIdentityProviders: ["COGNITO"],
          AccessTokenValidity: 1440, // 24 hours in minutes
          IdTokenValidity: 1440, // 24 hours in minutes
          RefreshTokenValidity: 5256000, // ~10 years in minutes
          TokenValidityUnits: {
            AccessToken: "minutes",
            IdToken: "minutes",
            RefreshToken: "minutes",
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("cognito-urls-update"),
      },
      onUpdate: {
        service: "CognitoIdentityServiceProvider",
        action: "updateUserPoolClient",
        parameters: {
          UserPoolId: userPool.userPoolId,
          ClientId: userPoolClient.userPoolClientId,
          CallbackURLs: [`${httpsUrl}/callback`],
          LogoutURLs: [httpsUrl],
          AllowedOAuthFlows: ["code"],
          AllowedOAuthScopes: ["openid", "email", "profile"],
          AllowedOAuthFlowsUserPoolClient: true,
          SupportedIdentityProviders: ["COGNITO"],
          AccessTokenValidity: 1440, // 24 hours in minutes
          IdTokenValidity: 1440, // 24 hours in minutes
          RefreshTokenValidity: 5256000, // ~10 years in minutes
          TokenValidityUnits: {
            AccessToken: "minutes",
            IdToken: "minutes",
            RefreshToken: "minutes",
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("cognito-urls-update"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: custom.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    // Ensure the custom resource runs after CloudFront is created
    updateCognitoUrls.node.addDependency(distribution);

    // Authentication Outputs - using CloudFront HTTPS
    new CfnOutput(this, "ApplicationUrl", {
      value: httpsUrl,
      description: "Application URL (HTTPS via CloudFront)",
      exportName: "ApplicationUrl",
    });

    // Output CloudFront information
    new CfnOutput(this, "CloudFrontDistributionId", {
      value: httpsUrl,
      description: "CloudFront distribution ID",
      exportName: "CloudFrontDistributionId",
    });

    new CfnOutput(this, "CognitoDomain", {
      value: `https://${domain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: "Cognito Hosted UI Domain",
      exportName: "CognitoDomain",
    });

    new CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
      description: "Cognito User Pool ID",
      exportName: "UserPoolId",
    });
  }
}
