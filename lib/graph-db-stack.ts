import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as neptune from 'aws-cdk-lib/aws-neptune';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { aws_bedrock as bedrock } from 'aws-cdk-lib';
import * as path from 'path';
import * as fs from 'fs';
import { Construct } from 'constructs';
import { createDynamoDBPolicy, createLambdaExecRole, createNeptunePolicy, createS3Policy } from './bedrock-utils';

interface GraphDbStackProps extends cdk.StackProps {
  vpcId?: string;
}

export class GraphDbStack extends cdk.Stack {
  public readonly neptuneCluster: neptune.CfnDBCluster;
  public readonly neptuneSecurityGroup: ec2.ISecurityGroup;
  public readonly neptuneHost: string;
  public readonly neptuneLoadRoleArn: string;
  public readonly etlBucketName: string;

  constructor(scope: Construct, id: string, props: GraphDbStackProps) {
    super(scope, id, props);

    // Get or create VPC
    const vpc = props.vpcId 
      ? ec2.Vpc.fromLookup(this, 'ExistingVpc', { vpcId: props.vpcId })
      : new ec2.Vpc(this, 'DxVpc', {
          ipAddresses: ec2.IpAddresses.cidr('172.31.0.0/16'),
          maxAzs: 3,
          subnetConfiguration: [
            {
              cidrMask: 24,
              name: 'Private',
              subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            {
              cidrMask: 24,
              name: 'Public',
              subnetType: ec2.SubnetType.PUBLIC,
            },
          ],
        });

    const selectedSubnets = vpc.privateSubnets.length > 0 ? vpc.privateSubnets : vpc.publicSubnets;

    // Access logs bucket
    const accessLogsBucket = new s3.Bucket(this, 'DxAccessLogs', {
      // bucketName: `ai-data-explorer-access-logs-${this.account}-${this.region}`,
      enforceSSL: true,
      versioned: true,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ETL data bucket
    const etlDataBucket = new s3.Bucket(this, 'DxEtlDataBucket', {
      bucketName: `ai-data-explorer-graph-etl-${this.account}-${this.region}`,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: 'etl-data-logs/',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Neptune security group
    this.neptuneSecurityGroup = new ec2.SecurityGroup(this, 'DxNeptuneSG', {
      vpc,
      description: 'Neptune database security group',
      allowAllOutbound: true,
    });

    this.neptuneSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(8182),
      'Neptune access from within VPC'
    );

    // Neptune subnet group
    const subnetGroup = new neptune.CfnDBSubnetGroup(this, 'DxNeptuneSubnetGroup', {
      dbSubnetGroupName: 'ai-data-explorer-neptune-subnet-group',
      dbSubnetGroupDescription: 'Neptune DB subnet group',
      subnetIds: selectedSubnets.map(subnet => subnet.subnetId),
    });

    // Neptune parameter groups
    const clusterParameterGroup = new neptune.CfnDBClusterParameterGroup(this, 'DxNeptuneClusterParameterGroup', {
      family: 'neptune1.4',
      name: 'ai-data-explorer-neptune-cluster-params',
      description: 'Neptune cluster parameter group',
      parameters: {
        neptune_enable_audit_log: '1'
      },
    });

    const dbParameterGroup = new neptune.CfnDBParameterGroup(this, 'DxNeptuneDbParameterGroup', {
      family: 'neptune1.4',
      name: 'ai-data-explorer-neptune-db-params',
      description: 'Neptune DB parameter group',
      parameters: {
        neptune_query_timeout: '120000',
      },
    });

    // Neptune load role
    const neptuneLoadRole = new iam.Role(this, 'DxNeptuneLoadRole', {
      assumedBy: new iam.ServicePrincipal('rds.amazonaws.com'),
    });

    neptuneLoadRole.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:GetObjectVersion', 's3:ListBucket'],
      resources: [
        etlDataBucket.bucketArn,
        `${etlDataBucket.bucketArn}/*`
      ]
    }));

    // Neptune cluster
    this.neptuneCluster = new neptune.CfnDBCluster(this, 'DxNeptuneCluster', {
      dbClusterIdentifier: 'ai-data-explorer-neptune',
      engineVersion: '1.4.1.0',
      dbSubnetGroupName: subnetGroup.ref,
      vpcSecurityGroupIds: [this.neptuneSecurityGroup.securityGroupId],
      dbClusterParameterGroupName: clusterParameterGroup.ref,
      dbPort: 8182,
      iamAuthEnabled: false,
      storageEncrypted: true,
      backupRetentionPeriod: 7,
      serverlessScalingConfiguration: {
        minCapacity: 2.5,
        maxCapacity: 128,
      },
      associatedRoles: [{
        roleArn: neptuneLoadRole.roleArn,
      }],
    });

    // Neptune instance
    new neptune.CfnDBInstance(this, 'DxNeptuneInstance', {
      dbInstanceIdentifier: `${this.neptuneCluster.ref}-instance`,
      dbClusterIdentifier: this.neptuneCluster.ref,
      dbInstanceClass: 'db.serverless',
      dbParameterGroupName: dbParameterGroup.ref,
      autoMinorVersionUpgrade: true,
    });

    this.neptuneHost = this.neptuneCluster.attrEndpoint;
    this.neptuneLoadRoleArn = neptuneLoadRole.roleArn;
    this.etlBucketName = etlDataBucket.bucketName;

    // DynamoDB tables
    const dataAnalyzerLogTable = new dynamodb.Table(this, 'DxDataAnalyzerLogTable', {
      tableName: 'AI-Data-Explorer-Data-Analyzer-Log',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'file_name', type: dynamodb.AttributeType.STRING },
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const schemaTranslatorLogTable = new dynamodb.Table(this, 'DxSchemaTranslatorLogTable', {
      tableName: 'AI-Data-Explorer-Schema-Translator-Log',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const etlLogTable = new dynamodb.Table(this, 'DxEtlLogTable', {
      tableName: 'AI-Data-Explorer-ETL-Log',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const bulkLoadLogTable = new dynamodb.Table(this, 'DxBulkLoadLogTable', {
      tableName: 'AI-Data-Explorer-Bulk-Load-Log',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'loadId', type: dynamodb.AttributeType.STRING },
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Deploy sample data files
    new s3deploy.BucketDeployment(this, 'DxDeployDataFiles', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../data'))],
      destinationBucket: etlDataBucket,
      destinationKeyPrefix: 'sample_data',
      exclude: ['.DS_Store', '**/.DS_Store'],
      prune: false,
      retainOnDelete: false,
    });

    // Bedrock flow execution role
    const flowRole = new iam.Role(this, 'DxBedrockFlowRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Execution role for Bedrock Flow',
    });

    flowRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:GetFlow',
        'bedrock:GetPrompt',
        'bedrock:RenderPrompt',
        'bedrock:InvokeModel',
      ],
      resources: ['*'],
    }));

    flowRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject', 's3:GetObjectVersion', 's3:ListBucket'],
      resources: [etlDataBucket.bucketArn, `${etlDataBucket.bucketArn}/*`]
    }));

    // Define the nodes
    const inputNode = {
      type: "Input",
      name: "FlowInput",
      outputs: [
        {
          name: "document",
          type: "Object"
        }
      ]
    };

    const graphSchemaNode = {
      type: "Retrieval",
      name: "GraphSchema",
      configuration: {
        retrieval: {
          serviceConfiguration: {
            s3: {
              bucketName: etlDataBucket.bucketName,
            },
          },
        },
      },
      inputs: [
        {
          name: "objectKey",
          type: "String",
          expression: "$.data.graph_schema"
        }
      ],
      outputs: [
        {
          name: "s3Content",
          type: "String"
        }
      ]
    };

    const headersPrompt = {
      type: "Prompt",
      name: "ConvertHeaders",
      configuration: {
        prompt: {
          sourceConfiguration: {
            inline: {
              modelId: "us.anthropic.claude-sonnet-4-20250514-v1:0",
              inferenceConfiguration: {
                text: {
                  temperature: 0.0,
                  length: 4096
                }
              },
              templateType: "TEXT",
              templateConfiguration: {
                system: "You are a graph database transformation specialist with expertise in openCypher and CSV data modeling.",
                text: {
                  text: FLOW_CSV_OPENCYPHER_CONVERTER
                }
              }
            }
          }
        }
      },
      inputs: [
        {
          name: "records",
          type: "String",
          expression: "$.data.records"
        },
        {
          name: "file_name",
          type: "String",
          expression: "$.data.file_name"
        }
      ],
      outputs: [
        {
          name: "modelCompletion",
          type: "String"
        }
      ]
    };

    const headersOutput = {
      type: "Output",
      name: "HeadersOutput",
      inputs: [
        {
          name: "document",
          type: "String",
          expression: "$.data"
        }
      ]
    };

    const edgesPrompt = {
      type: "Prompt",
      name: "GenerateEdges",
      configuration: {
        prompt: {
          sourceConfiguration: {
            inline: {
              modelId: "us.anthropic.claude-sonnet-4-20250514-v1:0",
              inferenceConfiguration: {
                text: {
                  temperature: 0.0,
                  length: 4096,
                  topP: 0.01
                }
              },
              templateType: "TEXT",
              templateConfiguration: {
                system: "You are a graph database transformation specialist with expertise in openCypher and CSV data modeling.",
                text: {
                  text: FLOW_CSV_EDGE_GENERATOR
                }
              }
            }
          }
        }
      },
      inputs: [
        {
          name: "headers_output",
          type: "String",
          expression: "$.data"
        },
        {
          name: "graph_schema",
          type: "String",
          expression: "$.data"
        }
      ],
      outputs: [
        {
          name: "modelCompletion",
          type: "String"
        }
      ]
    };

    const edgesOutput = {
      type: "Output",
      name: "EdgesOutput",
      inputs: [
        {
          name: "document",
          type: "String",
          expression: "$.data"
        }
      ]
    };

    // Create connections
    const connections = [];

    // Connect input to Headers prompt node
    headersPrompt.inputs.forEach(input => {
      connections.push({
        name: `${inputNode.name}_${headersPrompt.name}_${input.name}`,
        source: inputNode.name,
        target: headersPrompt.name,
        type: "Data",
        configuration: {
          data: {
            sourceOutput: inputNode.outputs[0].name,
            targetInput: input.name
          }
        }
      });
    });

    // Connect input to Graph Schema node
    graphSchemaNode.inputs.forEach(input => {
      connections.push({
        name: `${inputNode.name}_${graphSchemaNode.name}_${input.name}`,
        source: inputNode.name,
        target: graphSchemaNode.name,
        type: "Data",
        configuration: {
          data: {
            sourceOutput: inputNode.outputs[0].name,
            targetInput: input.name
          }
        }
      });
    });

    // Connect Headers prompt to Headers output node
    connections.push({
      name: `${headersPrompt.name}_${headersOutput.name}`,
      source: headersPrompt.name,
      target: headersOutput.name,
      type: "Data",
      configuration: {
        data: {
          sourceOutput: headersPrompt.outputs[0].name,
          targetInput: headersOutput.inputs[0].name
        }
      }
    });

    // Connect Headers prompt to Generate Edges prompt
    connections.push({
      name: `${headersPrompt.name}_${edgesPrompt.name}`,
      source: headersPrompt.name,
      target: edgesPrompt.name,
      type: "Data",
      configuration: {
        data: {
          sourceOutput: headersPrompt.outputs[0].name,
          targetInput: edgesPrompt.inputs[0].name
        }
      }
    });

    // Connect Graph schema to Generate Edges prompt
    connections.push({
      name: `${graphSchemaNode.name}_${edgesPrompt.name}`,
      source: graphSchemaNode.name,
      target: edgesPrompt.name,
      type: "Data",
      configuration: {
        data: {
          sourceOutput: graphSchemaNode.outputs[0].name,
          targetInput: edgesPrompt.inputs[1].name
        }
      }
    });

    // Connect Edges prompt to Edges output node
    connections.push({
      name: `${edgesPrompt.name}_${edgesOutput.name}`,
      source: edgesPrompt.name,
      target: edgesOutput.name,
      type: "Data",
      configuration: {
        data: {
          sourceOutput: edgesPrompt.outputs[0].name,
          targetInput: edgesOutput.inputs[0].name
        }
      }
    });

    // Create the Bedrock Flow
    const cfnFlow = new bedrock.CfnFlow(this, 'DxEtlFlow', {
      name: "DataExplorer_ETL_Flow",
      description: "DataExplorer ETL",
      executionRoleArn: flowRole.roleArn,
      definition: {
        nodes: [inputNode, graphSchemaNode, headersPrompt, edgesPrompt, headersOutput, edgesOutput],
        connections: connections
      }
    });

    // Create a version of the flow
    const cfnFlowVersion = new bedrock.CfnFlowVersion(this, 'DxBedrockFlowVersion', {
      flowArn: cfnFlow.attrArn,
    });

    // create bedrock flow alias
    const cfnFlowAlias = new bedrock.CfnFlowAlias(this, 'DxBedrockFlowAlias', {
      flowArn: cfnFlow.attrArn,
      name: 'test',
      routingConfiguration: [{
        flowVersion: cfnFlowVersion.attrVersion
      }]
    });
    // Make sure the alias depends on the version
    cfnFlowAlias.addDependency(cfnFlowVersion);

    // ETL queues
    const etlDLQ = new sqs.Queue(this, 'DxEtlDLQ', {
      queueName: 'AI-Data-Explorer-ETL-DLQ',
      retentionPeriod: cdk.Duration.days(14),
      enforceSSL: true,
    });

    const etlQueue = new sqs.Queue(this, 'DxEtlQueue', {
      queueName: 'AI-Data-Explorer-ETL-Queue',
      visibilityTimeout: cdk.Duration.seconds(90),
      enforceSSL: true,
      deadLetterQueue: {
        queue: etlDLQ,
        maxReceiveCount: 8,
      },
    });

    // ETL processor lambda
    const etlProcessorName = 'AI-Data-Explorer-ETL-Processor'
    const etlProcessorLogGroup = new logs.LogGroup(this, 'DxEtlProcessorLogGroup', {
      logGroupName: `/aws/lambda/${etlProcessorName}`,
      retention: logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const etlProcessorRole = createLambdaExecRole(this, 'EtlProcessorRole', etlProcessorName, vpc.vpcId);

    const etlProcessorLambda = new lambda.Function(this, 'DxEtlProcessorLambda', {
      functionName: etlProcessorName,
      role: etlProcessorRole,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'etl-processor-lambda.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/etl')),
      memorySize: 1024,
      timeout: cdk.Duration.minutes(5),
      vpc,
      vpcSubnets: { subnets: selectedSubnets },
      securityGroups: [this.neptuneSecurityGroup],
      logGroup: etlProcessorLogGroup,
      environment: {
        FLOW_IDENTIFIER: cfnFlow.attrId,
        FLOW_ALIAS_IDENTIFIER: cfnFlowAlias.attrArn,
        S3_LOADER_BUCKET: etlDataBucket.bucketName,
        ETL_LOG_TABLE: etlLogTable.tableName,
        ETL_SQS_QUEUE: etlQueue.queueName,
        QUEUE_URL: etlQueue.queueUrl,
      }
    });

    // Grant permissions using bedrock-utils
    etlProcessorLambda.addToRolePolicy(createDynamoDBPolicy(etlLogTable.tableName));
    etlProcessorLambda.addToRolePolicy(createS3Policy(etlDataBucket.bucketName));
    etlQueue.grantConsumeMessages(etlProcessorLambda);
    etlQueue.grantSendMessages(etlProcessorLambda);

    etlProcessorLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeFlow'],
      resources: [cfnFlow.attrArn, `${cfnFlow.attrArn}/alias/*`],
    }));

    // S3 notification to trigger ETL
    etlDataBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SqsDestination(etlQueue),
      { prefix: 'incoming/' }
    );

    // EventBridge rule for periodic processing
    const etlRule = new events.Rule(this, 'DxEtlProcessorRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      description: 'Triggers ETL processor every minute',
      enabled: true,
    });
    etlRule.addTarget(new targets.LambdaFunction(etlProcessorLambda));

    // Data loader lambda
    const dataLoaderName = 'AI-Data-Explorer-Data-Loader'
    const dataLoaderLogGroup = new logs.LogGroup(this, 'DxDataLoaderLogGroup', {
      logGroupName: `/aws/lambda/${dataLoaderName}`,
      retention: logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const dataLoaderRole = createLambdaExecRole(this, 'DataLoaderRole', dataLoaderName, vpc.vpcId);
    dataLoaderRole.addToPolicy(createNeptunePolicy());

    const dataLoaderLambda = new lambda.Function(this, 'DxDataLoaderLambda', {
      functionName: dataLoaderName,
      role: dataLoaderRole,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'data-loader-lambda.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/dl')),
      memorySize: 128,
      timeout: cdk.Duration.minutes(5),
      vpc,
      vpcSubnets: { subnets: selectedSubnets },
      securityGroups: [this.neptuneSecurityGroup],
      logGroup: dataLoaderLogGroup,
      environment: {
        NEPTUNE_HOST: this.neptuneHost,
        S3_LOADER_ROLE: neptuneLoadRole.roleArn,
        S3_LOADER_BUCKET: etlDataBucket.bucketName,
        BULK_LOAD_LOG: bulkLoadLogTable.tableName,
      },
    });

    // Grant permissions using bedrock-utils
    dataLoaderLambda.addToRolePolicy(createDynamoDBPolicy(bulkLoadLogTable.tableName));
    dataLoaderLambda.addToRolePolicy(createS3Policy(etlDataBucket.bucketName));

    // S3 notification for data loading
    etlDataBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(dataLoaderLambda),
      { prefix: 'output/' }
    );

    // Save outputs to temp files
    this.saveOutputsToFiles();

    // Outputs
    new cdk.CfnOutput(this, 'NeptuneClusterId', { 
      value: this.neptuneCluster.ref, 
      exportName: 'GraphDbNeptuneClusterId' 
    });
    new cdk.CfnOutput(this, 'NeptuneEndpoint', { 
      value: this.neptuneHost, 
      exportName: 'GraphDbNeptuneEndpoint' 
    });
    new cdk.CfnOutput(this, 'NeptuneLoadRoleArn', { 
      value: this.neptuneLoadRoleArn, 
      exportName: 'GraphDbNeptuneLoadRoleArn' 
    });
    new cdk.CfnOutput(this, 'NeptuneEtlBucketName', { 
      value: this.etlBucketName, 
      exportName: 'GraphDbNeptuneEtlBucketName' 
    });
    new cdk.CfnOutput(this, 'DataAnalyzerLogTableName', { 
      value: dataAnalyzerLogTable.tableName, 
      exportName: 'GraphDbDataAnalyzerLogTableName' 
    });
    new cdk.CfnOutput(this, 'SchemaTranslatorLogTableName', { 
      value: schemaTranslatorLogTable.tableName, 
      exportName: 'GraphDbSchemaTranslatorLogTableName' 
    });
    new cdk.CfnOutput(this, 'EtlLogTableName', { 
      value: etlLogTable.tableName, 
      exportName: 'GraphDbEtlLogTableName' 
    });
    new cdk.CfnOutput(this, 'BulkLoadLogTableName', { 
      value: bulkLoadLogTable.tableName, 
      exportName: 'GraphDbBulkLoadLogTableName' 
    });
    new cdk.CfnOutput(this, 'NeptuneSecurityGroupId', { 
      value: this.neptuneSecurityGroup.securityGroupId, 
      exportName: 'GraphDbNeptuneSecurityGroupId' 
    });
    new cdk.CfnOutput(this, 'EtlDataBucketOutput', { 
      value: etlDataBucket.bucketName, 
      exportName: 'GraphDbEtlDataBucket' 
    });
    new cdk.CfnOutput(this, 'NeptuneLoadRole', { 
      value: neptuneLoadRole.roleArn, 
      exportName: 'GraphDbNeptuneLoadRole' 
    });
    new cdk.CfnOutput(this, 'VpcId', { 
      value: vpc.vpcId, 
      exportName: 'GraphDbVpcId' 
    });
  }

  private saveOutputsToFiles(): void {
    try {
      // Ensure output directory exists
      const outputDir = '/tmp/graph-db-outputs';
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Save Neptune cluster ID
      fs.writeFileSync(
        path.join(outputDir, 'neptune-cluster-id.txt'),
        this.neptuneCluster.ref
      );

      // Save Neptune endpoint
      fs.writeFileSync(
        path.join(outputDir, 'neptune-endpoint.txt'),
        this.neptuneHost
      );

      // Save Neptune security group ID
      fs.writeFileSync(
        path.join(outputDir, 'neptune-sg-id.txt'),
        this.neptuneSecurityGroup.securityGroupId
      );
    } catch (error) {
      console.warn('Could not save outputs to files:', error);
      // Don't fail the deployment if file writing fails
    }
  }
}

export const FLOW_CSV_OPENCYPHER_CONVERTER = 
`You are a data transformation specialist with expertise in graph databases and CSV processing. Your task is to analyze CSV data and transform it into openCypher-compatible format.

<context>
You will receive CSV records and need to analyze their structure to create openCypher-compatible headers, identify unique identifiers, and infer appropriate node labels. The transformation must follow openCypher CSV import specifications.
</context>

<examples>
File Name: "Person.csv"
Original CSV headers: "First Name,Last Name,Email,UserID"
Transformed headers: "First_Name:string,Last_Name:string,Email:string,UserID:ID,:LABEL"
Unique identifier: "UserID"
Node label: "Person"

{
  "file_name": "Person.csv",
  "originalHeaders": ["FirstName", "LastName", "Email", "UserID"],
  "transformedHeaders": ["FirstName:string", "LastName:string", "Email:string,:LABEL","UserID:ID", ":LABEL"],
  "uniqueIdentifier": "UserID",
  "nodeLabel": "Person"
}

File Name: "Product_Code.csv"
Original CSV headers: "Product Code,Name,Price,Category"
Transformed headers: "Product_Code:ID,Name:string,Price:float,:LABEL"
Unique identifier: "ProductCode"
Node label: "ProductCode"

{
  "file_name": "Product_Code.csv",
  "originalHeaders": ["ProductCode", "Name", "Price", "Category"],
  "transformedHeaders": ["ProductCode:ID", "Name:string", "Price:float", ":LABEL"],
  "uniqueIdentifier": "ProductCode",
  "nodeLabel": "ProductCode"
}
</examples>

<inputs>
<records>{{records}}</records>
</inputs>

<instructions>
1. Analyze the CSV headers from the input records
2. Transform each header to openCypher format:
  - Add :ID to the unique identifier column. 
  - Replace any spaces in headers with underscores
  - Map data types based on content:
    * Text/categorical -> :string
    * Numeric whole numbers -> :int
    * Numeric decimals -> :float
    * Date/time -> :datetime
    * Boolean -> :boolean
3. Identify the unique identifier based on:
  - Column names containing: ID, Code, Key, Number
  - Unique value patterns
  - Primary key characteristics
4. Infer the node label based on:
  - The provided file name: {{file_name}}
  - Use the entire text of the file name before the file extension to generate the node label
  - The node label value should be Pascal case
5. Structure the results in a JSON object with specified properties
6. Return only the JSON object as your response. Skip any explanation and preamble.
</instructions>

RESPONSE FORMAT:
{
  "file_name": {{file_name}},
  "originalHeaders": [Array of original CSV column names],
  "nodeLabel": "Inferred node label",
  "uniqueIdentifier": "Selected unique identifier column name",
  "transformedHeaders": [Array of openCypher-formatted headers with data types]
}`;

export const FLOW_CSV_EDGE_GENERATOR = `Your job is to review {{headers_output}} and define expected graph database edge nodes for the vertex represented by this data.

<inputs>
  <headers_output>
    {{headers_output}}
  </headers_output>
  <graph_schema>
    {{graph_schema}}
  </graph_schema>
</inputs>

Instructions:
1. Review each row in the {{graph_schema}} which follows the format [Vertex] —(edge)→ [Vertex]
2. Extract rows that repesent potential edges for the vertex described in {{headers_output}}. Each record you select from the should reference the Vertex node label. 
3. List each extracted row
4. For each row where the node label on the left side of the notation matches the current node type being processed, generate the appropriate edge record in OpenCypher format.

## Response Format

The output should be a list of rows in the following format:

[Book] —(CONTAINS)→ [Chapter]
[Book] —(WRITTEN_BY)→ [Author]

Generate edge definitions in the following format to match column headings: "Current Node ID","Edge Type","Related Node ID"

<This Node ID>,<edge type1>,<Related Node ID1>
<This Node ID>,<edge type2>,<Related Node ID2>

Wrap all output in a formatted json document as follows:

{
  "matching_edges": [
    "[Book] —(CONTAINS)→ [Chapter]",
    "[Book] —(WRITTEN_BY)→ [Author]"
  ],
  "edge_definitions": [
    "book_id,CONTAINS,chapter_id",
    "book_id,WRITTEN_BY,author_id"
  ]
}

Do not add any additional preamble or explanation.
`;