# IAM Requirements for AI Data Explorer

This document outlines the comprehensive IAM permissions required to deploy and run the Panoptic AI Data Explorer application on AWS.

## Required IAM Permissions for Deployment

### Core AWS Services

#### AWS CloudFormation
- `cloudformation:CreateStack`
- `cloudformation:UpdateStack`
- `cloudformation:DeleteStack`
- `cloudformation:DescribeStacks`
- `cloudformation:DescribeStackEvents`
- `cloudformation:DescribeStackResources`
- `cloudformation:GetTemplate`
- `cloudformation:ListStacks`

#### AWS CDK Bootstrap
- `cloudformation:CreateChangeSet`
- `cloudformation:ExecuteChangeSet`
- `cloudformation:DescribeChangeSet`

### Container & Compute Services

#### Amazon ECS
- `ecs:CreateCluster`
- `ecs:CreateService`
- `ecs:UpdateService`
- `ecs:DeleteService`
- `ecs:DescribeClusters`
- `ecs:DescribeServices`
- `ecs:DescribeTaskDefinition`
- `ecs:RegisterTaskDefinition`
- `ecs:DeregisterTaskDefinition`

#### Amazon ECR
- `ecr:GetAuthorizationToken`
- `ecr:BatchCheckLayerAvailability`
- `ecr:GetDownloadUrlForLayer`
- `ecr:BatchGetImage`
- `ecr:CreateRepository`
- `ecr:PutImage`
- `ecr:InitiateLayerUpload`
- `ecr:UploadLayerPart`
- `ecr:CompleteLayerUpload`

#### AWS Fargate
- `ecs:RunTask`
- `ecs:StopTask`
- `ecs:DescribeTasks`

### Networking & Load Balancing

#### Amazon VPC
- `ec2:CreateVpc`
- `ec2:CreateSubnet`
- `ec2:CreateInternetGateway`
- `ec2:CreateNatGateway`
- `ec2:CreateRouteTable`
- `ec2:CreateRoute`
- `ec2:CreateSecurityGroup`
- `ec2:AuthorizeSecurityGroupIngress`
- `ec2:AuthorizeSecurityGroupEgress`
- `ec2:DescribeVpcs`
- `ec2:DescribeSubnets`
- `ec2:DescribeSecurityGroups`
- `ec2:DescribeRouteTables`
- `ec2:DescribeInternetGateways`
- `ec2:DescribeNatGateways`
- `ec2:DescribeAvailabilityZones`
- `ec2:AllocateAddress`
- `ec2:AssociateAddress`

#### Application Load Balancer
- `elasticloadbalancing:CreateLoadBalancer`
- `elasticloadbalancing:CreateListener`
- `elasticloadbalancing:CreateTargetGroup`
- `elasticloadbalancing:CreateRule`
- `elasticloadbalancing:ModifyLoadBalancerAttributes`
- `elasticloadbalancing:ModifyTargetGroup`
- `elasticloadbalancing:RegisterTargets`
- `elasticloadbalancing:DescribeLoadBalancers`
- `elasticloadbalancing:DescribeListeners`
- `elasticloadbalancing:DescribeTargetGroups`

### AI & Machine Learning Services

#### Amazon Bedrock
- `bedrock:InvokeModel`
- `bedrock:InvokeModelWithResponseStream`
- `bedrock:ApplyGuardrail`
- `bedrock:CreateKnowledgeBase`
- `bedrock:GetKnowledgeBase`
- `bedrock:ListKnowledgeBases`
- `bedrock:CreateDataSource`
- `bedrock:GetDataSource`
- `bedrock:ListDataSources`
- `bedrock:StartIngestionJob`
- `bedrock:GetIngestionJob`
- `bedrock:ListIngestionJobs`
- `bedrock:Retrieve`
- `bedrock:RetrieveAndGenerate`
- `bedrock:CreateFlow`
- `bedrock:InvokeFlow`
- `bedrock:GetFlow`
- `bedrock:CreateFlowVersion`
- `bedrock:CreateFlowAlias`

#### Bedrock AgentCore Memory
- `bedrock-agentcore:ListMemories`
- `bedrock-agentcore:CreateMemory`
- `bedrock-agentcore:GetMemory`
- `bedrock-agentcore:DeleteMemory`
- `bedrock-agentcore:CreateEvent`
- `bedrock-agentcore:ListEvents`
- `bedrock-agentcore:GetLastKTurns`

### Storage Services

#### Amazon S3
- `s3:CreateBucket`
- `s3:DeleteBucket`
- `s3:GetBucketLocation`
- `s3:GetBucketVersioning`
- `s3:PutBucketVersioning`
- `s3:GetBucketNotification`
- `s3:PutBucketNotification`
- `s3:GetObject`
- `s3:PutObject`
- `s3:DeleteObject`
- `s3:ListBucket`
- `s3:GetBucketPolicy`
- `s3:PutBucketPolicy`

#### S3 Vectors (for Knowledge Base)
- `s3vectors:CreateVectorBucket`
- `s3vectors:GetVectorBucket`
- `s3vectors:ListVectorBuckets`
- `s3vectors:CreateIndex`
- `s3vectors:GetIndex`
- `s3vectors:ListIndexes`
- `s3vectors:QueryVectors`
- `s3vectors:PutVectors`
- `s3vectors:DeleteVectors`
- `s3vectors:GetVectors`
- `s3vectors:ListVectors`

### Database Services

#### Amazon DynamoDB
- `dynamodb:CreateTable`
- `dynamodb:DeleteTable`
- `dynamodb:DescribeTable`
- `dynamodb:PutItem`
- `dynamodb:GetItem`
- `dynamodb:UpdateItem`
- `dynamodb:Query`
- `dynamodb:Scan`

#### Amazon Neptune (if using graph database)
- `neptune:CreateDBCluster`
- `neptune:CreateDBInstance`
- `neptune:CreateDBSubnetGroup`
- `neptune:CreateDBClusterParameterGroup`
- `neptune:CreateDBParameterGroup`
- `neptune:DescribeDBClusters`
- `neptune:DescribeDBInstances`
- `neptune:ModifyDBCluster`

### Authentication & Security

#### Amazon Cognito
- `cognito-idp:CreateUserPool`
- `cognito-idp:CreateUserPoolClient`
- `cognito-idp:CreateUserPoolDomain`
- `cognito-idp:CreateGroup`
- `cognito-idp:DescribeUserPool`
- `cognito-idp:UpdateUserPool`
- `cognito-idp:AdminCreateUser`
- `cognito-idp:AdminSetUserPassword`

#### AWS Secrets Manager
- `secretsmanager:CreateSecret`
- `secretsmanager:GetSecretValue`
- `secretsmanager:UpdateSecret`
- `secretsmanager:DescribeSecret`

### Content Delivery & Monitoring

#### Amazon CloudFront
- `cloudfront:CreateDistribution`
- `cloudfront:GetDistribution`
- `cloudfront:UpdateDistribution`
- `cloudfront:CreateOriginRequestPolicy`
- `cloudfront:CreateCachePolicy`

#### Amazon CloudWatch
- `logs:CreateLogGroup`
- `logs:CreateLogStream`
- `logs:PutLogEvents`
- `logs:DescribeLogGroups`
- `logs:DescribeLogStreams`
- `cloudwatch:PutMetricData`
- `cloudwatch:CreateDashboard`

#### AWS X-Ray (for tracing)
- `xray:PutTraceSegments`
- `xray:PutTelemetryRecords`

### Lambda Functions

#### AWS Lambda (for ETL and data processing)
- `lambda:CreateFunction`
- `lambda:UpdateFunctionCode`
- `lambda:UpdateFunctionConfiguration`
- `lambda:InvokeFunction`
- `lambda:GetFunction`
- `lambda:DeleteFunction`
- `lambda:AddPermission`

### IAM Management

#### AWS IAM
- `iam:CreateRole`
- `iam:AttachRolePolicy`
- `iam:DetachRolePolicy`
- `iam:PutRolePolicy`
- `iam:GetRole`
- `iam:PassRole`
- `iam:CreatePolicy`
- `iam:GetPolicy`
- `iam:ListRoles`

### Additional Services

#### Amazon SQS (for ETL processing)
- `sqs:CreateQueue`
- `sqs:GetQueueAttributes`
- `sqs:SendMessage`
- `sqs:ReceiveMessage`
- `sqs:DeleteMessage`

#### Amazon EventBridge
- `events:PutRule`
- `events:PutTargets`
- `events:DescribeRule`

## Recommended IAM Policy Structure

For deployment, you can use these managed policies as a starting point:
- `PowerUserAccess` (covers most services except IAM)
- Plus specific IAM permissions for role creation and management

Or create a custom policy combining all the permissions listed above.

## Runtime Permissions

The application also creates service roles with these key permissions:
- **ECS Task Role**: Bedrock model access, Knowledge Base queries, DynamoDB access
- **Lambda Execution Roles**: VPC access, Neptune connectivity, S3 access
- **Knowledge Base Role**: S3 access, Bedrock embedding model access

The deployment handles creating these service roles automatically with the appropriate permissions.