import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as neptune from 'aws-cdk-lib/aws-neptune';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as python from '@aws-cdk/aws-lambda-python-alpha'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import { aws_bedrock as bedrock } from 'aws-cdk-lib';
import * as path from "path";
import { Construct } from 'constructs';
import { Stack } from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { FLOW_CSV_EDGE_GENERATOR, FLOW_CSV_OPENCYPHER_CONVERTER } from './agent-prompts';
import { NagSuppressions } from 'cdk-nag';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets'
import { createDynamoDBPolicy, createLambdaExecRole, createNeptunePolicy, createS3Policy } from './bedrock-utils';

interface NeptuneStackProps extends cdk.StackProps {
  environment: string;
  dbClusterId?: string;
  dbInstanceType: string;
  minNcus: number;
  maxNcus: number;
  dbReplicaIdentifierSuffix?: string;
  dbClusterPort: string;
  neptuneQueryTimeout: number;
  neptuneEnableAuditLog: number;
  iamAuthEnabled: boolean;
  backupRetention: number;
  attachBulkloadIamRole: boolean;
  storageEncrypted: boolean;
  kmsKeyId?: string;
  notebookInstanceType?: string;
  engineVersion?: string;
  preserveDataBuckets?: boolean
}

export class NeptuneBaseStack extends cdk.Stack {

  // Make these public so they can be accessed by other stacks
  public readonly vpc: ec2.IVpc;
  public readonly securityGroup: ec2.ISecurityGroup;
  public readonly accessLogsBucket: s3.Bucket;
  public readonly dataAnalyzerLogTable: dynamodb.Table;
  public readonly schemaTranslatorLogTable: dynamodb.Table;
  public readonly etlLogTable: dynamodb.Table;
  public readonly bulkLoadLogTable: dynamodb.Table;
  public readonly neptuneCluster: neptune.CfnDBCluster;
  public readonly etlProcessorLogGroup: LogGroup;
  public readonly etlThrottleProcessorLogGroup: LogGroup;
  public readonly dataLoaderLogGroup: LogGroup;

  constructor(scope: Construct, id: string, props: NeptuneStackProps) {
    super(scope, id, props);

    // ──────────────────────────────────────────────────────────────────────────
    // Access Logs Bucket
    // ──────────────────────────────────────────────────────────────────────────
    this.accessLogsBucket = new s3.Bucket(this, 'AccessLogs', {
      enforceSSL: true,
      versioned: true,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,  // Enable ACLs
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    NagSuppressions.addResourceSuppressions(this.accessLogsBucket, [
      {
        id: 'AwsSolutions-S1',
        reason: 'No need to enable access logging for the AccessLogs bucket itself.',
      },
    ]);

    // VPC Creation or Lookup
    const vpcId = this.node.tryGetContext('vpcid');
    const dbSubnetIds = this.node.tryGetContext('dbSubnetIds'); // Changed from dbSubnetCidr to dbSubnetIds
    const dbSecurityGroupId = this.node.tryGetContext('dbsecuritygroup');

    // Helper function to find subnets by IDs from a comma-separated list
    const getSubnetsByIds = (subnetIdsStr: string): ec2.ISubnet[] => {
      // Split the comma-separated list of subnet IDs
      const subnetIds = subnetIdsStr.split(',').map(id => id.trim());
      
      const subnets: ec2.ISubnet[] = [];
      
      // We need to get the VPC's subnets to find the availability zones
      const allVpcSubnets = [
        ...this.vpc.privateSubnets,
        ...this.vpc.isolatedSubnets,
        ...this.vpc.publicSubnets
      ];
      
      // Create a map of subnet ID to availability zone
      const subnetAzMap = new Map<string, string>();
      allVpcSubnets.forEach(subnet => {
        subnetAzMap.set(subnet.subnetId, subnet.availabilityZone);
      });
      
      // Import each subnet by ID with its availability zone
      for (const subnetId of subnetIds) {
        // Get the AZ for this subnet ID from the VPC lookup
        const az = subnetAzMap.get(subnetId);
        
        // If we found the AZ, use fromSubnetAttributes, otherwise fall back to fromSubnetId
        const subnet = az 
          ? ec2.Subnet.fromSubnetAttributes(this, `ImportedSubnet-${subnetId}`, {
              subnetId: subnetId,
              availabilityZone: az
            })
          : ec2.Subnet.fromSubnetId(this, `ImportedSubnet-${subnetId}`, subnetId);
        
        subnets.push(subnet);
      }
      
      if (subnets.length === 0) {
        throw new Error(`No valid subnet IDs found in: ${subnetIdsStr}. Please provide valid subnet IDs.`);
      }
      
      return subnets;
    };

    if (vpcId) {
      // Use existing VPC via lookup
      this.vpc = ec2.Vpc.fromLookup(this, 'ExistingVPC', {
        vpcId: vpcId,
      });
    } else {
      // Create new VPC
      this.vpc = new ec2.Vpc(this, 'VPC', {
        ipAddresses: ec2.IpAddresses.cidr('172.30.0.0/16'),
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
    }

    // Neptune Subnet Group
    // Priority: 1) Specific subnet IDs if provided, 2) Existing VPC subnet selection, 3) New VPC private subnets
    let selectedSubnets: ec2.ISubnet[];
    
    if (dbSubnetIds) {
      // Use subnets with the specified IDs
      selectedSubnets = getSubnetsByIds(dbSubnetIds);
    } else if (vpcId) {
      // For existing VPC, use private subnets; fallback to isolated, then public
      selectedSubnets = this.vpc.privateSubnets.length > 0 
        ? this.vpc.privateSubnets 
        : this.vpc.isolatedSubnets.length > 0 
          ? this.vpc.isolatedSubnets 
          : this.vpc.publicSubnets; // fallback to public if no private subnets exist
    } else {
      // For new VPC, use the created private subnets
      selectedSubnets = this.vpc.privateSubnets;
    }

    if (selectedSubnets.length === 0) {
      const errorMsg = dbSubnetIds 
        ? `No valid subnets found for IDs: ${dbSubnetIds}. Please verify the subnet IDs are correct.`
        : 'No suitable subnets found in the VPC. Please ensure the VPC has private, isolated, or public subnets available.';
      throw new Error(errorMsg);
    }

    // When using dbSubnetIds, we can't validate AZs at synthesis time
    // because the imported subnets don't have availability zone information
    // This validation will happen at deployment time by CloudFormation
    if (!dbSubnetIds) {
      // Only validate AZs when not using dbSubnetIds
      try {
        const availabilityZones = new Set(selectedSubnets.map(subnet => subnet.availabilityZone));
        if (availabilityZones.size < 2) {
          throw new Error('Selected subnets must span at least 2 Availability Zones for Neptune DB subnet group.');
        }
      } catch (error) {
        // If we can't access availabilityZone property, we'll skip this validation
        // The actual validation will happen at CloudFormation deployment time
        console.warn('Could not validate subnet availability zones at synthesis time. ' +
                    'Validation will occur during deployment.');
      }
    }

    // Setup VPC flow logs only for newly created VPC
    if (!vpcId) {
      const flowLogRole = new iam.Role(this, 'Panoptic-FlowLogRole', {
        assumedBy: new iam.ServicePrincipal('vpc-flow-logs.amazonaws.com')
      });
      const flowLogGroup = new LogGroup(this, 'Panoptic-FlowLogGroup', {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      const flowLog = new ec2.CfnFlowLog(this, 'Panoptic-VPCFlowLog', {
        resourceId: this.vpc.vpcId,
        resourceType: 'VPC',
        trafficType: 'ALL',
        deliverLogsPermissionArn: flowLogRole.roleArn,
        logDestinationType: 'cloud-watch-logs',
        logGroupName: flowLogGroup.logGroupName,
        logFormat: '${traffic-path} ${flow-direction} ${region} ${account-id} ${interface-id} ${srcaddr} ${dstaddr} ${srcport} ${dstport} ${action} ${log-status}',
      });
    }

    // VPC Endpoints for Bedrock (only create for new VPC to avoid conflicts)
    if (!vpcId) {
    const bedrockEndpointSG = new ec2.SecurityGroup(this, 'BedrockEndpointSG', {
      vpc: this.vpc,
      description: 'Security group for Bedrock VPC endpoint',
      allowAllOutbound: true,
    });
    // Suppress both EC23 and CdkNagValidationFailure warnings
    NagSuppressions.addResourceSuppressions(bedrockEndpointSG, [
      {
        id: 'AwsSolutions-EC23',
        reason: 'Security group is used for Bedrock VPC endpoint and requires access to VPC CIDR'
      },
      {
        id: 'CdkNagValidationFailure',
        reason: 'Security group uses intrinsic function to reference VPC CIDR block'
      }
    ]);
    
    const bedrockEndpoint = new ec2.InterfaceVpcEndpoint(this, 'BedrockEndpoint', {
      vpc: this.vpc,
      service: new ec2.InterfaceVpcEndpointService(`com.amazonaws.${this.region}.bedrock-runtime`),
      privateDnsEnabled: true,
      subnets: { subnets: selectedSubnets },
      securityGroups: [ bedrockEndpointSG ]
    });

    const bedrockRuntimeEndpointSG = new ec2.SecurityGroup(this, 'BedrockRuntimeEndpointSG', {
      vpc: this.vpc,
      description: 'Security group for Bedrock Runtime VPC endpoint',
      allowAllOutbound: true,
    })
    NagSuppressions.addResourceSuppressions(bedrockRuntimeEndpointSG, [
      {
        id: 'AwsSolutions-EC23',
        reason: 'Security group is used for Bedrock VPC endpoint and requires access to VPC CIDR',
      },
      {
        id: 'CdkNagValidationFailure',
        reason: 'Security group uses intrinsic function to reference VPC CIDR block'
      }
    ]);
    const bedrockRuntimeEndpoint = new ec2.InterfaceVpcEndpoint(this, 'BedrockRuntimeEndpoint', {
      vpc: this.vpc,
      service: new ec2.InterfaceVpcEndpointService(`com.amazonaws.${this.region}.bedrock`),
      privateDnsEnabled: true,
      subnets: { subnets: selectedSubnets },
      securityGroups: [ bedrockRuntimeEndpointSG ]
    });

      // Add ingress rules to the security groups
      bedrockEndpoint.connections.allowDefaultPortFromAnyIpv4('Allow HTTPS traffic from within VPC');
      bedrockRuntimeEndpoint.connections.allowDefaultPortFromAnyIpv4('Allow HTTPS traffic from within VPC');

      // Add VPC endpoint policy for Amazon Bedrock actions
      bedrockEndpoint.addToPolicy(
        new iam.PolicyStatement({
          actions: ['bedrock:*'],
          resources: ['*'],
          principals: [new iam.AnyPrincipal()],
        }),
      );

    // Create VPC Endpoints for Bedrock Agents
    const bedrockAgentEndpointSG = new ec2.SecurityGroup(this, 'BedrockAgentEndpointSG', {
      vpc: this.vpc,
      description: 'Security group for Bedrock Agent VPC endpoint',
      allowAllOutbound: true,
    });
    NagSuppressions.addResourceSuppressions(bedrockAgentEndpointSG, [
      {
        id: 'AwsSolutions-EC23',
        reason: 'Security group is used for Bedrock VPC endpoint and requires access to VPC CIDR',
      },
      {
        id: 'CdkNagValidationFailure',
        reason: 'Security group uses intrinsic function to reference VPC CIDR block'
      }
    ]);
    
    const bedrockAgentEndpoint = new ec2.InterfaceVpcEndpoint(this, 'BedrockAgentEndpoint', {
      vpc: this.vpc,
      service: new ec2.InterfaceVpcEndpointService(`com.amazonaws.${this.region}.bedrock-agent`),
      privateDnsEnabled: true,
      subnets: { subnets: selectedSubnets },
      securityGroups: [ bedrockAgentEndpointSG ]
    });

      const bedrockAgentRuntimeEndpointSG = new ec2.SecurityGroup(this, 'BedrockAgentRuntimeEndpointSG', {
        vpc: this.vpc,
        description: 'Security group for Bedrock Agent Runtime VPC endpoint',
        allowAllOutbound: true,
      });
      NagSuppressions.addResourceSuppressions(bedrockAgentRuntimeEndpointSG, [
        {
          id: 'AwsSolutions-EC23',
          reason: 'Security group is used for Bedrock VPC endpoint and requires access to VPC CIDR',
        },
        {
          id: 'CdkNagValidationFailure',
          reason: 'Security group uses intrinsic function to reference VPC CIDR block'
        }
      ]);

    const bedrockAgentRuntimeEndpoint = new ec2.InterfaceVpcEndpoint(this, 'BedrockAgentRuntimeEndpoint', {
      vpc: this.vpc,
      service: new ec2.InterfaceVpcEndpointService(`com.amazonaws.${this.region}.bedrock-agent-runtime`),
      privateDnsEnabled: true,
      subnets: { subnets: selectedSubnets },
      securityGroups: [ bedrockAgentRuntimeEndpointSG ]
    });

      // Add ingress rules to the security groups
      bedrockAgentEndpoint.connections.allowDefaultPortFromAnyIpv4('Allow HTTPS traffic from within VPC');
      bedrockAgentRuntimeEndpoint.connections.allowDefaultPortFromAnyIpv4('Allow HTTPS traffic from within VPC');
      bedrockAgentEndpoint.addToPolicy(
        new iam.PolicyStatement({
          actions: ['bedrock:*'],
          resources: ['*'],
          principals: [new iam.AnyPrincipal()],
        }),
      );

      // Create S3 Gateway Endpoint
      const s3Endpoint = new ec2.GatewayVpcEndpoint(this, 'S3GatewayEndpoint', {
        vpc: this.vpc,
        service: ec2.GatewayVpcEndpointAwsService.S3,
      });
      // Add VPC endpoint policy for S3 access
      s3Endpoint.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          principals: [new iam.AnyPrincipal()],
          actions: [
            's3:*',
          ],
          resources: ['*']
        })
      );
    }


      //create DynamoDB Gateway Endpoint
      const dynamodbEndpoint = new ec2.GatewayVpcEndpoint(this, 'DynamoDBGatewayEndpoint', {
        vpc: this.vpc,
        service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      });

      // Add VPC endpoint policy for DynamoDB access
      dynamodbEndpoint.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          principals: [new iam.AnyPrincipal()],
          actions: [
            'dynamodb:*',
          ],
          resources: ['*']
        })
      );

    // Neptune Security Group - use existing or create new
    let neptuneSG: ec2.ISecurityGroup;

    if (dbSecurityGroupId) {
      // Use existing security group
      neptuneSG = ec2.SecurityGroup.fromSecurityGroupId(this, 'ExistingNeptuneSG', dbSecurityGroupId);
    } else {
      // Create new security group
      const newNeptuneSG = new ec2.SecurityGroup(this, 'NeptuneSG', {
        securityGroupName: 'PanopticNeptuneSG',
        vpc: this.vpc,
        description: 'Allow Neptune DBPort Access',
        allowAllOutbound: true,
      });

      // Add suppression for the Neptune security group
      NagSuppressions.addResourceSuppressions(newNeptuneSG, [
        {
          id: 'AwsSolutions-EC23',
          reason: 'Neptune security group is restricted to VPC CIDR range only.'
        },
        {
          id: 'CdkNagValidationFailure',
          reason: 'Security group uses intrinsic function to reference VPC CIDR block'
        }
      ]);

      // Instead of allowing access from any IP, restrict to VPC CIDR
      newNeptuneSG.addIngressRule(
        ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
        ec2.Port.tcp(parseInt(props.dbClusterPort)),
        'Neptune access from within VPC'
      );

      neptuneSG = newNeptuneSG;
    }

    // Assign to public property for access by other stacks
    this.securityGroup = neptuneSG;

    const subnetGroup = new neptune.CfnDBSubnetGroup(this, 'NeptuneDBSubnetGroup', {
      dbSubnetGroupName: 'PanopticNeptuneSubnetGroup',
      dbSubnetGroupDescription: 'Neptune DB subnet group',
      subnetIds: selectedSubnets.map(subnet => subnet.subnetId),
    });

    // Neptune Parameter Groups
    const clusterParameterGroup = new neptune.CfnDBClusterParameterGroup(this, 'NeptuneDBClusterParameterGroup', {
      family: 'neptune1.4',
      name: 'panoptic-neptune-db-cluster-parameter-group',
      description: 'Panoptic cluster parameter group for Neptune',
      parameters: {
        neptune_enable_audit_log: props.neptuneEnableAuditLog.toString()
      },
    });

    const dbParameterGroup = new neptune.CfnDBParameterGroup(this, 'NeptuneDBParameterGroup', {
      family: 'neptune1.4',
      name: 'panoptic-neptune-db-parameter-group',
      description: 'Panoptic parameter group for Neptune',
      parameters: {
        neptune_query_timeout: props.neptuneQueryTimeout.toString(),
      },
    });

    // IAM Roles
    const neptuneLoadFromS3Role = new iam.Role(this, 'NeptuneLoadFromS3Role', {
      assumedBy: new iam.ServicePrincipal('rds.amazonaws.com'),
    });

    // Neptune Cluster
    this.neptuneCluster = new neptune.CfnDBCluster(this, 'NeptuneDBCluster', {
      dbClusterIdentifier: props.dbClusterId,
      engineVersion: props.engineVersion,
      dbSubnetGroupName: subnetGroup.ref,
      vpcSecurityGroupIds: [neptuneSG.securityGroupId],
      dbClusterParameterGroupName: clusterParameterGroup.ref,
      dbPort: parseInt(props.dbClusterPort),
      iamAuthEnabled: props.iamAuthEnabled,
      storageEncrypted: props.storageEncrypted,
      kmsKeyId: props.kmsKeyId,
      backupRetentionPeriod: props.backupRetention, // In Days
      serverlessScalingConfiguration: {
        minCapacity: props.minNcus,
        maxCapacity: props.maxNcus,
      },
      associatedRoles: props.attachBulkloadIamRole ? [{
        roleArn: neptuneLoadFromS3Role.roleArn,
      }] : undefined,
    });

    // Add suppression for Neptune IAM Authentication warning
    NagSuppressions.addResourceSuppressions(this.neptuneCluster, [
      {
        id: 'AwsSolutions-N5',
        reason: 'IAM Authentication is intentionally configured based on environment requirements. IAM Auth can be enabled for production use.'
      }
    ]);

    // Neptune Instance
    new neptune.CfnDBInstance(this, 'NeptuneDBInstance', {
      dbInstanceIdentifier: `${this.neptuneCluster.ref}-instance`,
      dbClusterIdentifier: this.neptuneCluster.ref,
      dbInstanceClass: props.dbInstanceType,
      dbParameterGroupName: dbParameterGroup.ref,
      autoMinorVersionUpgrade: true,
    });

    // Create read replica if specified
    if (props.dbReplicaIdentifierSuffix) {
      new neptune.CfnDBInstance(this, 'NeptuneDBReplicaInstance', {
        dbInstanceIdentifier: `${this.neptuneCluster.ref}-${props.dbReplicaIdentifierSuffix}`,
        dbClusterIdentifier: this.neptuneCluster.ref,
        dbInstanceClass: props.dbInstanceType,
        autoMinorVersionUpgrade: true,
      });
    }

    // Create an S3 bucket for ETL
    const etlDataBucket = new s3.Bucket(this, 'EtlDataBucket', {
      bucketName: `panoptic-etl-${this.account}-${this.region}`,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      serverAccessLogsBucket: this.accessLogsBucket,
      serverAccessLogsPrefix: 'panopticEtlDataLogs/',
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicPolicy: true,
        blockPublicAcls: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      }),
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
            s3.HttpMethods.DELETE,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
        },
      ],
      removalPolicy: props.preserveDataBuckets ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !props.preserveDataBuckets,
    });

    // give bulk loader access to the bucket
    neptuneLoadFromS3Role.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:GetObjectVersion', 's3:ListBucket'],
      resources: [
        `arn:aws:s3:::${etlDataBucket.bucketName}`,
        `arn:aws:s3:::${etlDataBucket.bucketName}/*`
      ]
    }));
    NagSuppressions.addResourceSuppressions(
      neptuneLoadFromS3Role,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Requires full access to bucket for agentic functionality.'
        }
      ],
      true
    );

    const deployRole = new iam.Role(this, 'S3DeployRole', {
      description: `S3 Bucket Deployment Role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    etlDataBucket.grantReadWrite(deployRole)

    // Add suppressions for the S3DeployRole
    NagSuppressions.addResourceSuppressions(
      deployRole,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'S3 Deploy Role requires these permissions to deploy files to S3 buckets. The permissions are scoped to specific buckets.',
        }
      ],
      true
    );

    // Deploy local files to the bucket
    const deployDataFiles = new s3deploy.BucketDeployment(this, 'DeployDataFiles', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../data')),
      ],
      role: deployRole,
      exclude: ['.DS_Store', '**/.DS_Store'],
      destinationBucket: etlDataBucket,
      destinationKeyPrefix: 'sample_data',
      useEfs: false,
      memoryLimit: 512,
      prune: false,
      retainOnDelete: false,
    });

    // create a graph.txt file in schema directory 
    const initGraphSchema = new s3deploy.BucketDeployment(this, 'InitGraphSchema', {
      sources: [
        s3deploy.Source.data('graph.txt', ''),
      ],
      role: deployRole,
      destinationBucket: etlDataBucket,
      destinationKeyPrefix: 'public/schema',
      useEfs: false,
      memoryLimit: 512,
      prune: false,
      retainOnDelete: false,
    });

    const flowRole = new iam.Role(this, 'BedrockFlowExecutionRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Execution role for Bedrock Flow',
    });

    flowRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:GetFlow',
          'bedrock:GetPrompt',
          'bedrock:RenderPrompt',
          'bedrock:InvokeModel',
          'bedrock:InvokeAgent',
          'bedrock:InvokeAgentPrompt',
        ],
        resources: ['*'],
      })
    );

    flowRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject', 's3:GetObjectVersion', 's3:ListBucket'],
        resources: [
          `arn:aws:s3:::${etlDataBucket.bucketName}`,
          `arn:aws:s3:::${etlDataBucket.bucketName}/*`
        ]
      })
    );

    flowRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: [`*`],
      })
    );

    // Add suppressions for the BedrockFlowExecutionRole
    NagSuppressions.addResourceSuppressions(flowRole, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Bedrock Flow execution role requires permissions to invoke any Lambda function and access Bedrock resources.'
      }
    ], true);

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
              modelId: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
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
              modelId: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
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
    const cfnFlow = new bedrock.CfnFlow(this, 'EtlFlow', {
      name: "Panoptic_ETL_Flow",
      description: "Panoptic ETL",
      executionRoleArn: flowRole.roleArn,
      definition: {
        nodes: [inputNode, graphSchemaNode, headersPrompt, edgesPrompt, headersOutput, edgesOutput],
        connections: connections
      }
    });

    // Create a version of the flow
    const cfnFlowVersion = new bedrock.CfnFlowVersion(this, 'BedrockFlowVersion', {
      flowArn: cfnFlow.attrArn,
    });

    // create bedrock flow alias
    const cfnFlowAlias = new bedrock.CfnFlowAlias(this, 'BedrockFlowAlias', {
      flowArn: cfnFlow.attrArn,
      name: 'panoptic',
      routingConfiguration: [{
        flowVersion: cfnFlowVersion.attrVersion
      }]
    });
    // Make sure the alias depends on the version
    cfnFlowAlias.addDependency(cfnFlowVersion);

    // create a dynamodb table for Data Analyzer logging
    this.dataAnalyzerLogTable = new dynamodb.Table(this, "DataAnalyzerLogTable", {
      tableName: "Panoptic-Data_Analyzer_Log",
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "file_name", type: dynamodb.AttributeType.STRING },
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // create a dynamodb table for Schema Translator logging
    this.schemaTranslatorLogTable = new dynamodb.Table(this, "SchemaTranslatorLogTable", {
      tableName: "Panoptic-Schema_Translator_Log",
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // create a dynamodb table for ETL logging
    this.etlLogTable = new dynamodb.Table(this, "EtlLogTable", {
      tableName: "Panoptic-ETL_Log",
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create the etl throttle dead letter queue first
    const etlThrottleDLQ = new Queue(this, 'EtlThrottleDLQ', {
      queueName: 'Panoptic-ETL-DLQ',
      retentionPeriod: cdk.Duration.days(14), // Messages are retained for 14 days
      enforceSSL: true,
    });

    // Add an sqs queue for etl throttle
    const etlThrottleQueue = new Queue(this, 'EtlThrottleQueue', {
      queueName: 'Panoptic-ETL-Queue',
      visibilityTimeout: cdk.Duration.seconds(90),
      enforceSSL: true,
      deadLetterQueue: {
        queue: etlThrottleDLQ,
        maxReceiveCount: 8, // After 8 failed processing attempts, messages go to DLQ
      },
    });

    // create a dynamodb table for Bulk Loader logging
    const bulkLoadLog = new dynamodb.Table(this, "BulkLoadLog", {
      tableName: "Panoptic-Bulk_Load_Log",
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "loadId", type: dynamodb.AttributeType.STRING },
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.bulkLoadLogTable = bulkLoadLog

    // ETL Processing with Bedrock
    const etlProcessorFn = 'Panoptic-ETL_Processor';

    // Create Log Group and Lambda
    this.etlProcessorLogGroup = new cdk.aws_logs.LogGroup(this, `EtlProcessorLambdaLogGroup`, {
      logGroupName: `/aws/lambda/panoptic/${etlProcessorFn}`,
      retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Lambda Role
    const etlProcessorLambdaRole = createLambdaExecRole(this, `${etlProcessorFn}-Lambda`, etlProcessorFn, this.vpc.vpcId);

    // Create Lambda
    const etlProcessorLambda = new python.PythonFunction(this, 'EtlProcessorLambda', {
      functionName: etlProcessorFn,
      role: etlProcessorLambdaRole,
      runtime: lambda.Runtime.PYTHON_3_13,
      entry: path.join(__dirname, '../lambda/etl-processor'),
      index: 'lambda.py',
      handler: 'lambda_handler',
      memorySize: 1024,
      timeout: cdk.Duration.minutes(5),
      vpc: this.vpc,
      vpcSubnets: {subnets: selectedSubnets},
      securityGroups: [neptuneSG],
      logGroup: this.etlProcessorLogGroup,
      environment: {
        FLOW_IDENTIFIER: cfnFlow.attrId,
        FLOW_ALIAS_IDENTIFIER: cfnFlowAlias.attrId,
        S3_LOADER_BUCKET: etlDataBucket.bucketName,
        ETL_LOG_TABLE: this.etlLogTable.tableName,
        ETL_SQS_QUEUE: etlThrottleQueue.queueName,
        QUEUE_URL: etlThrottleQueue.queueUrl,
        MAX_RETRIES: "10",
        BASE_BACKOFF_SECONDS: "10.0",
        MAX_BACKOFF_SECONDS: "100.0",
        JITTER_FACTOR: "0.25",
        MAX_MESSAGES: "5",
        VISIBILITY_TIMEOUT: "30",
        MSG_DELAY: "5",
        WAIT_TIME_SECONDS: "20",
      }
    });

    // Suppress Lambda runtime warning
    NagSuppressions.addResourceSuppressions(etlProcessorLambda, [
      {
        id: 'AwsSolutions-L1',
        reason: 'Using the specified runtime version for compatibility with existing code.'
      },
    ]);

    // Grant permissions
    etlProcessorLambda.addToRolePolicy(createDynamoDBPolicy(this.etlLogTable.tableName));
    etlProcessorLambda.addToRolePolicy(createS3Policy(etlDataBucket.bucketName));
    etlProcessorLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeFlow'],
      resources: [
        cfnFlow.attrArn,
        `${cfnFlow.attrArn}/alias/*`
      ],
    }));

    etlThrottleQueue.grantConsumeMessages(etlProcessorLambda);
    etlProcessorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'sqs:ReceiveMessage',
          'sqs:DeleteMessage',
          'sqs:GetQueueUrl',
          'sqs:GetQueueAttributes'
        ],
        resources: [etlThrottleQueue.queueArn]
      })
    );
    etlDataBucket.grantRead(etlProcessorLambda);
    etlDataBucket.grantPut(etlProcessorLambda);
    etlDataBucket.grantDelete(etlProcessorLambda);

    // Suppress the IAM5 errors for the Lambda's default policy
    NagSuppressions.addResourceSuppressions(
      etlProcessorLambda.role!, // The '!' asserts that the role is defined
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'The wildcard permissions are required for ETL operations on specific S3 bucket objects',
          appliesTo: [
            'Action::s3:Get*',
            'Action::s3:GetBucket*',
            'Action::s3:GetObject*',
            'Action::s3:List*',
            'Action::s3:Abort*',
            'Action::s3:PutObject*',
            'Action::s3:DeleteObject*',
            'Resource::arn:aws:s3:::${BucketName}/*'
          ]
        },
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Lambda needs wildcard permissions for log streams within its specific log group.',
        }
      ],
      true
    );

    // Add S3 notification to trigger only for 'incoming' prefix
    etlDataBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SqsDestination(etlThrottleQueue),
      { prefix: 'incoming/' }
    );

    // The BucketNotificationsHandler has a unique ID that includes a hash
    // We can use a partial path match to find it
    NagSuppressions.addResourceSuppressionsByPath(
      this,
      `/${this}/BucketNotificationsHandler050a0587b7544547bf325f094a3db834/Role/Resource`,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'This is an auto-generated handler by CDK for S3 bucket notification creation',
          appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']
        }
      ]
    );

    NagSuppressions.addResourceSuppressionsByPath(this,
      `/${this}/BucketNotificationsHandler050a0587b7544547bf325f094a3db834/Role/DefaultPolicy/Resource`,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'This is an auto-generated handler by CDK for S3 bucket notification creation',
          appliesTo: ['Resource::*']
        }
      ],
      true // Apply to child resources
    );

    NagSuppressions.addResourceSuppressionsByPath(this,
      `/${this}/Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C512MiB/Resource`,
      [
        {
          id: 'AwsSolutions-L1',
          reason: 'This is an auto-generated deployment resource by CDK',
        }
      ]
    );

    // Allow the lambda to send messages to the queue
    etlThrottleQueue.grantSendMessages(etlProcessorLambda);

    // Add permissions to the etl processor lambda to write to the queue
    this.etlLogTable.grantReadWriteData(etlProcessorLambda);
    etlProcessorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'sqs:SendMessage',
          'sqs:GetQueueUrl',
          'sqs:GetQueueAttributes'
        ],
        resources: [etlThrottleQueue.queueArn]
      })
    );

    // Create an EventBridge rule that runs every minute 
    const etlThrottleProcessorRule = new events.Rule(this, 'EtlProcessorMinuteRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      description: 'Triggers the ETL Throttle Processor Lambda every minute',
      enabled: true,
    });
    etlThrottleProcessorRule.addTarget(new targets.LambdaFunction(etlProcessorLambda));

    const dataLoaderFn = 'Panoptic-Bulk_Data_Loader';
    // Create Log Group and Lambda
    this.dataLoaderLogGroup = new cdk.aws_logs.LogGroup(this, `DataLoaderLambdaLogGroup`, {
      logGroupName: `/aws/lambda/panoptic/${dataLoaderFn}`,
      retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })
    // Create Lambda Role
    const dataLoaderLambdaRole = createLambdaExecRole(this, `${dataLoaderFn}-Lambda`, dataLoaderFn, this.vpc.vpcId);
    dataLoaderLambdaRole.addToPolicy(createNeptunePolicy())

    // Add suppressions for the Lambda role's CloudWatch Logs permissions
    NagSuppressions.addResourceSuppressions(
      dataLoaderLambdaRole,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Lambda needs wildcard permissions for log streams within its specific log group.',
        }
      ],
      true
    );

    // Create Lambda
    const dataLoaderLambda = new python.PythonFunction(this, 'DataLoaderLambda', {
      functionName: dataLoaderFn,
      role: dataLoaderLambdaRole,
      entry: 'lambda/data-loader',
      runtime: lambda.Runtime.PYTHON_3_13,
      index: 'lambda.py',
      handler: 'lambda_handler',
      memorySize: 128,
      timeout: cdk.Duration.minutes(5),
      vpc: this.vpc,
      vpcSubnets: { subnets: selectedSubnets },
      securityGroups: [neptuneSG],
      logGroup: this.dataLoaderLogGroup,
      environment: {
        NEPTUNE_HOST: this.neptuneCluster.attrEndpoint,
        S3_LOADER_ROLE: neptuneLoadFromS3Role.roleArn,
        S3_LOADER_BUCKET: etlDataBucket.bucketName,
        BULK_LOAD_LOG: bulkLoadLog.tableName,
      },
    });
    NagSuppressions.addResourceSuppressions(dataLoaderLambda, [
      {
        id: 'AwsSolutions-L1',
        reason: 'The sleep behavior is intentional and required for this function to poll the Neptune bulk loader.',
      },
    ]);
    dataLoaderLambda.addToRolePolicy(createS3Policy(etlDataBucket.bucketName));
    dataLoaderLambda.addToRolePolicy(createDynamoDBPolicy(bulkLoadLog.tableName));

    // Add S3 notification to trigger only for 'output' prefix
    etlDataBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(dataLoaderLambda),
      { prefix: 'output/' }
    );

    // Create SSM parameter for the etl data bucket
    new ssm.StringParameter(this, 'EtlBucketNameParameter', {
      parameterName: '/panoptic/etlBucket',
      stringValue: etlDataBucket.bucketName
    })

    // Create SSM parameter for the data load lambda ARN
    new ssm.StringParameter(this, 'DataLoadLambdaArnParameter', {
      parameterName: '/panoptic/lambda/dataloader/arn',
      stringValue: dataLoaderLambda.functionArn,
      description: 'ARN of the data load Lambda function',
    });

    // Add outputs
    new cdk.CfnOutput(this, 'DBClusterId', { value: this.neptuneCluster.ref, exportName: 'DBClusterId' });
    new cdk.CfnOutput(this, 'DBClusterPort', { value: props.dbClusterPort, exportName: 'DBClusterPort' });
    new cdk.CfnOutput(this, 'DBClusterEndpoint', { value: this.neptuneCluster.attrEndpoint, exportName: 'DBClusterEndpoint' });
    new cdk.CfnOutput(this, 'NeptuneS3LoadRole', { value: neptuneLoadFromS3Role.roleArn, exportName: 'NeptuneS3LoadRole' });
    new cdk.CfnOutput(this, 'NeptuneS3LoadBucket', { value: etlDataBucket.bucketName, exportName: 'NeptuneS3LoadBucket' });
    new cdk.CfnOutput(this, 'EtlDataBucketName', { value: etlDataBucket.bucketName, exportName: 'EtlDataBucket' });
    new cdk.CfnOutput(this, 'BulkLoadLogTableName', { value: bulkLoadLog.tableName, exportName: 'BulkLoadLogTable' });
    new cdk.CfnOutput(this, 'DataAnalyzerLogTableName', { value: this.dataAnalyzerLogTable.tableName, exportName: 'DataAnalyzerLogTable' });
    new cdk.CfnOutput(this, 'SchemaTranslatorLogTableName', { value: this.schemaTranslatorLogTable.tableName, exportName: 'SchemaTranslatorLogTable' });

  }
}
