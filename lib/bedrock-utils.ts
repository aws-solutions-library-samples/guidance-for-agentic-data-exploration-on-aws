import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * Creates an IAM role for a Bedrock Agent with necessary permissions for agent collaboration,
 * guardrails, foundation model access, and inference profiles
 * @param scope The CDK construct scope in which to create the role
 * @param id The unique identifier for the role construct
 * @param agentName The name of the Bedrock agent
 * @param guardrails The ARN of the guardrails to apply
 * @returns An IAM Role configured with Bedrock Agent permissions
 */
export function createBedrockAgentRole(scope: Construct, id: string, agentAliasId: string, guardrails: string): iam.Role {

  // Bedrock Agent Role
  const role = new iam.Role(scope, id, {
    description: `Amazon Bedrock Execution Role`,
    assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
  });

  // Guardrails policy
  role.addToPolicy(
    new iam.PolicyStatement({
      sid: 'GuardrailPolicy',
      effect: iam.Effect.ALLOW,
      actions: [
        "bedrock:GetGuardrail",
        "bedrock:ApplyGuardrail",
        "bedrock:UpdateGuardrail",
      ],
      resources: [ guardrails ],
    })
  );

  // Foundation Model policy
  role.addToPolicy(
    new iam.PolicyStatement({
      sid: 'FoundationModelPolicy',
      effect: iam.Effect.ALLOW,
      actions: [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
      ],
      resources: [
        `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/*`,
      ],
    })
  );

  // Inference Profile policy
  role.addToPolicy(
    new iam.PolicyStatement({
      sid: 'CrossRegionInferenceProfilePolicy',
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
  );

  return role;
}

/**
 * Creates a IAM permissions for Bedrock agent collaboration
 * @param agentAliasId The id of the Bedrock agent alias
 * @returns An IAM Role configured with Bedrock Agent permissions
 */
export function createAgentCollaborationPolicy(agentAliasId: string): iam.PolicyStatement {
  return new iam.PolicyStatement({
    sid: 'AgentCollaborationPolicy', 
    effect: iam.Effect.ALLOW,
    actions: [
      'bedrock:GetAgentAlias',
      'bedrock:InvokeAgent',
    ],
    resources: [
      `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:agent-alias/${agentAliasId}`,
    ]
  });
}

/**
 * Creates an IAM role for a Lambda function with appropriate permissions for CloudWatch Logs and VPC networking
 * @param scope The CDK construct scope in which to create the role
 * @param id The unique identifier for the role construct
 * @param lambdaName The name of the Lambda function this role is for
 * @param vpcId The ID of the VPC where the Lambda function will run
 * @returns An IAM Role configured with Lambda execution permissions
 */
export function createLambdaExecRole(scope: Construct, id: string, lambdaName: string, vpcId?: string): iam.Role {
  const role = new iam.Role(scope, id, {
    description: `Panoptic Lambda Execution Role`,
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  });

  // Add CloudWatch Logs permissions with resource restrictions
  role.addToPolicy(new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ],
    resources: [
      `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/panoptic/${lambdaName}`,
      `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/panoptic/${lambdaName}:*`,
    ],
  }));

  // Add EC2 networking permissions
  role.addToPolicy(new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      "ec2:CreateNetworkInterface",
      "ec2:DescribeNetworkInterfaces",
      "ec2:DescribeSubnets",
      "ec2:DeleteNetworkInterface",
      "ec2:AssignPrivateIpAddresses",
      "ec2:UnassignPrivateIpAddresses"
    ],
    resources: [`*`],
  }));    

  role.addToPolicy(new iam.PolicyStatement({
      sid: 'CrossRegionInferenceProfilePolicy',
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
  );

  return role;
}

 /**
 * Creates an IAM policy statement with permissions for DynamoDB table operations
 * @param tableArn The ARN of the DynamoDB table to grant access to
 * @returns An IAM PolicyStatement object with DynamoDB permissions
 */
export function createDynamoDBPolicy(tableName: string): iam.PolicyStatement {
  return new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      "dynamodb:Query",
      "dynamodb:Scan", 
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
    ],
    resources: [`arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/${tableName}`],
  });
}

/**
 * Creates an IAM policy statement with permissions for S3 bucket operations
 * @param bucketArn The ARN of the S3 bucket to grant access to
 * @returns An IAM PolicyStatement object with S3 permissions
 */
export function createS3Policy(bucketName: string): iam.PolicyStatement {
  return new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      "s3:PutObject",
      "s3:GetObject",
      "s3:ListBucket",
    ],
    resources: [
      `arn:aws:s3:::${bucketName}`,
      `arn:aws:s3:::${bucketName}/*`
    ],  
  });
}

/**
 * Creates an IAM policy statement with permissions for Neptune database operations
 * @returns An IAM PolicyStatement object with Neptune permissions
 */
export function createNeptunePolicy(): iam.PolicyStatement {
  return new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      "neptune-db:GetGraphSummary",
      "neptune-db:DeleteDataViaQuery",
      "neptune-db:ReadDataViaQuery",
      "neptune-db:WriteDataViaQuery"
    ],
    resources: [`arn:aws:neptune-db:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:cluster-*/*`]
  });
}
