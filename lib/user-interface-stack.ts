import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from "node:path";
import * as fs from "node:fs";
import {
  ExecSyncOptionsWithBufferEncoding,
  execSync,
} from "node:child_process";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as cognitoIdentityPool from "aws-cdk-lib/aws-cognito-identitypool";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs_lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as cloudfront_origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import * as apigw from "aws-cdk-lib/aws-apigateway"
import { ApiGatewayToLambda } from '@aws-solutions-constructs/aws-apigateway-lambda';
import { ApiDynamoConstruct } from './apigw-to-dynamodb-construct';
import { NagSuppressions } from 'cdk-nag';

interface UserInterfaceProps extends cdk.StackProps{
  etlLogTable: dynamodb.Table
  bulkLoadLogTable: dynamodb.Table
  dataAnalyzerLogTable: dynamodb.Table
  schemaTranslatorLogTable: dynamodb.Table
  accessLogsBucket: s3.Bucket
 }

export class UserInterfaceStack extends cdk.Stack {
    public distribution: cf.Distribution;
    public behaviorOptions: cf.AddBehaviorOptions;
    public authFunction: cf.experimental.EdgeFunction;

    constructor(scope: Construct, id: string, props: UserInterfaceProps ) {
      super(scope, id, props);
    const appPath = path.join(__dirname, "../ui");
    const buildPath = path.join(appPath, "dist");
 
    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      bucketName: "panoptic-web-ui" + cdk.Aws.ACCOUNT_ID + "-" + cdk.Aws.REGION,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      serverAccessLogsBucket: props.accessLogsBucket,
      serverAccessLogsPrefix: 'websiteBucketLogs/',   
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicPolicy: true,
        blockPublicAcls: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    const hostingOrigin = new cloudfront_origins.S3Origin(websiteBucket);

    const myResponseHeadersPolicy = new cf.ResponseHeadersPolicy(
      this,
      "ResponseHeadersPolicy",
      {
        responseHeadersPolicyName:
          "ResponseHeadersPolicy" + cdk.Aws.STACK_NAME + "-" + cdk.Aws.REGION,
        comment: "ResponseHeadersPolicy" + cdk.Aws.STACK_NAME + "-" + cdk.Aws.REGION,
        securityHeadersBehavior: {
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cf.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy:
              cf.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: false,
          },
          strictTransportSecurity: {
            accessControlMaxAge: cdk.Duration.seconds(31536000),
            includeSubdomains: true,
            override: true,
          },
          xssProtection: { protection: true, modeBlock: true, override: true },
        },
      }
    );
    
    // Create the auth function and its version before the distribution
    this.authFunction = new cf.experimental.EdgeFunction(
      this, `PanopticAuthAtEdge`,
      {
        description: `Panoptic AuthFunctionAtEdge`,
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/auth"))
      },
    );
    
    // Create a version of the auth function to ensure it's fully deployed
    const authFunctionVersion = this.authFunction.currentVersion;

    this.authFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          `arn:aws:secretsmanager:${cdk.Stack.of(this).region}:${
            cdk.Stack.of(this).account
          }:secret:UserPoolSecret*`,
        ],
      })
    );

    this.distribution = new cf.Distribution(
      this,
      "Distribution",
      {
        comment: "Panoptic App",
        defaultRootObject: "index.html",
        httpVersion: cf.HttpVersion.HTTP2_AND_3,
        minimumProtocolVersion: cf.SecurityPolicyProtocol.TLS_V1_2_2021,
        enableLogging: true,
        logBucket: props.accessLogsBucket,
        logIncludesCookies: true,
        defaultBehavior:{
          origin: hostingOrigin,
          responseHeadersPolicy: myResponseHeadersPolicy,
          cachePolicy: cf.CachePolicy.CACHING_DISABLED,
          allowedMethods: cf.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        }
      }
    );
    
    // Add explicit dependency between CloudFront and the auth function
    this.distribution.node.addDependency(authFunctionVersion);

    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName:  "Panoptic_User_Pool",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: false,
      autoVerify: { email: true, phone: true },
      signInAliases: {
        email: true,
      },
    });

    const userPoolClient = userPool.addClient("UserPoolClient", {
      userPoolClientName: "Panoptic_User_Pool_Client",
      generateSecret: false,
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
        userSrp: true,
      },
    });

    const cognitoUp = new cognitoIdentityPool.UserPoolAuthenticationProvider({
      userPool,
      userPoolClient,
    });

    const identityPool = new cognitoIdentityPool.IdentityPool(
      this, "IdentityPool",
      {
        identityPoolName: "Panoptic_Identity_Pool",
        authenticationProviders: {
          userPools: [ cognitoUp ],
        },
      }
    );

    identityPool.authenticatedRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["cloudwatch:PutMetricData"],
      resources: ["*"]
    }))


    const supAgentArn = ssm.StringParameter.valueForStringParameter(this, '/panoptic/supervisor/agentArn');
    const supAliasArn = ssm.StringParameter.valueForStringParameter(this, '/panoptic/supervisor/agentAliasArn');
    const supAgentId = ssm.StringParameter.valueForStringParameter(this, '/panoptic/supervisor/agentId');
    const supAliasId = ssm.StringParameter.valueForStringParameter(this, '/panoptic/supervisor/agentAliasId');

    const bedrockInfo = new ssm.StringListParameter(this, 'BedrockInfoParameter', {
      parameterName: '/panoptic/bedrock-info',
      stringListValue: [ supAgentId, supAliasId ],
    })

    identityPool.authenticatedRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["bedrock:Invoke*", "bedrock:GetAgentMemory"],
      resources: [ supAgentArn, supAliasArn ]
    }))
    bedrockInfo.grantRead(identityPool.authenticatedRole);
    
    const secret = new secretsmanager.Secret(this, "UserPoolSecret", {
      secretName: "UserPoolSecretConfig",
      secretObjectValue: {
        ClientID: cdk.SecretValue.unsafePlainText(
          userPoolClient.userPoolClientId
        ),
        UserPoolID: cdk.SecretValue.unsafePlainText(userPool.userPoolId),
      },
    });

    const etlBucketName = ssm.StringParameter.valueForStringParameter(this, '/panoptic/etlBucket');
    const etlBucket = s3.Bucket.fromBucketName(this, 'ImportedEtlBucket', etlBucketName)
    etlBucket.grantReadWrite(identityPool.authenticatedRole);
    
    const cachePolicy = new cf.CachePolicy(
      this,
      "CachingDisabledButWithAuth",
      {
        defaultTtl: cdk.Duration.minutes(0),
        minTtl: cdk.Duration.minutes(0),
        maxTtl: cdk.Duration.minutes(1),
        headerBehavior: cf.CacheHeaderBehavior.allowList("Authorization"),
      }
    );

    const commonBehaviorOptions: cf.AddBehaviorOptions = {
      viewerProtocolPolicy: cf.ViewerProtocolPolicy.HTTPS_ONLY,
      cachePolicy: cachePolicy,
      originRequestPolicy: cf.OriginRequestPolicy.CORS_CUSTOM_ORIGIN,
      responseHeadersPolicy:
        cf.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT_AND_SECURITY_HEADERS,
    };

    this.behaviorOptions = {
      ...commonBehaviorOptions,
      edgeLambdas: [
        {
          functionVersion: authFunctionVersion,
          eventType: cf.LambdaEdgeEventType.ORIGIN_REQUEST,
          includeBody: true,
        },
      ],
      allowedMethods: cf.AllowedMethods.ALLOW_ALL,
    };

    const apiGwToDdb = new ApiDynamoConstruct(this, 'api-gateway-to-data-classifier-table', {
      existingTableObj: props.etlLogTable,
      allowCreateOperation: true,
      allowReadOperation: true,
      allowUpdateOperation: true,
      allowDeleteOperation: false,
      allowScanOperation: true,
      apiGatewayProps: {
        restApiName: 'data-classifier',
        endpointConfiguration: {
          types: [apigw.EndpointType.REGIONAL]
        },
        defaultMethodOptions: {
          authorizer: new apigw.CognitoUserPoolsAuthorizer(this, 'etlLoaderTableAuthorizer', {
            cognitoUserPools: [userPool]
          }),
          authorizationType: apigw.AuthorizationType.COGNITO,
          authorizationScopes: ["aws.cognito.signin.user.admin"]
        },
        defaultCorsPreflightOptions: {
          allowOrigins: apigw.Cors.ALL_ORIGINS,
          allowMethods: apigw.Cors.ALL_METHODS,
          allowHeaders: apigw.Cors.DEFAULT_HEADERS
        },
      }
    })

    const apiGwToDdBulk = new ApiDynamoConstruct(this, 'api-gateway-to-bulk-log-table', {
      existingTableObj: props.bulkLoadLogTable,
      allowCreateOperation: true,
      allowReadOperation: true,
      allowUpdateOperation: true,
      allowDeleteOperation: false,
      allowScanOperation: true,
      apiGatewayProps: {
        restApiName: 'data-loader',
        endpointConfiguration: {
          types: [apigw.EndpointType.REGIONAL]
        },
        defaultMethodOptions: {
          authorizer: new apigw.CognitoUserPoolsAuthorizer(this, 'dataLoaderTableAuthorizer', {
            cognitoUserPools: [userPool]
          }),
          authorizationType: apigw.AuthorizationType.COGNITO,
          authorizationScopes: ["aws.cognito.signin.user.admin"]
        },
        defaultCorsPreflightOptions: {
          allowOrigins: apigw.Cors.ALL_ORIGINS,
          allowMethods: apigw.Cors.ALL_METHODS,
          allowHeaders: apigw.Cors.DEFAULT_HEADERS
        },
      }
    })

    const apiGwToDdbAnalysis = new ApiDynamoConstruct(this, 'api-gateway-to-data-analyzer-table', {
      existingTableObj: props.dataAnalyzerLogTable,
      allowCreateOperation: true,
      allowReadOperation: true,
      allowUpdateOperation: true,
      allowDeleteOperation: false,
      allowScanOperation: true,
      scanProjectionExpression: "id, #ts, file_name, file_count",
      scanExpressionAttributeNames: {
        "#ts": "timestamp"
      },
      apiGatewayProps: {
        restApiName: 'data-analyzer',
        endpointConfiguration: {
          types: [apigw.EndpointType.REGIONAL]
        },
        defaultMethodOptions: {
          authorizer: new apigw.CognitoUserPoolsAuthorizer(this, 'dataAnalyzerTableAuthorizer', {
            cognitoUserPools: [userPool]
          }),
          authorizationType: apigw.AuthorizationType.COGNITO,
          authorizationScopes: ["aws.cognito.signin.user.admin"]
        },
        defaultCorsPreflightOptions: {
          allowOrigins: apigw.Cors.ALL_ORIGINS,
          allowMethods: apigw.Cors.ALL_METHODS,
          allowHeaders: apigw.Cors.DEFAULT_HEADERS
        },
      }
    })    

    const apiGwToDdbSchemaTx = new ApiDynamoConstruct(this, 'api-gateway-to-schema-translator-table', {
      existingTableObj: props.schemaTranslatorLogTable,
      allowCreateOperation: true,
      allowReadOperation: true,
      allowUpdateOperation: true,
      allowDeleteOperation: false,
      allowScanOperation: true,
      apiGatewayProps: {
        restApiName: 'schema-translator',
        endpointConfiguration: {
          types: [apigw.EndpointType.REGIONAL]
        },
        defaultMethodOptions: {
          authorizer: new apigw.CognitoUserPoolsAuthorizer(this, 'schemaTranslatorTableAuthorizer', {
            cognitoUserPools: [userPool]
          }),
          authorizationType: apigw.AuthorizationType.COGNITO,
          authorizationScopes: ["aws.cognito.signin.user.admin"]
        },
        defaultCorsPreflightOptions: {
          allowOrigins: apigw.Cors.ALL_ORIGINS,
          allowMethods: apigw.Cors.ALL_METHODS,
          allowHeaders: apigw.Cors.DEFAULT_HEADERS
        },
      }
    })    


    const chatHistoryTable = new dynamodb.TableV2(this, 'chat-history-table', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER
      },
      timeToLiveAttribute: "expires"
    });

      // Create a Layer with Powertools for AWS Lambda (TypeScript)
      const powertoolsLayer = lambda.LayerVersion.fromLayerVersionArn(
        this,
        'PowertoolsLayer',
        `arn:aws:lambda:${cdk.Stack.of(this).region}:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:24`
      );
    

    const chatHistoryLambda = new nodejs_lambda.NodejsFunction(this, 'chat-history-lambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/chat-history/index.ts'),
      environment: {
        TABLE_NAME: chatHistoryTable.tableName,
        POWERTOOLS_SERVICE_NAME: 'chat-history'
      },
      layers: [powertoolsLayer],
      tracing: lambda.Tracing.ACTIVE,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      bundling: {
        externalModules: ['@aws-sdk/*', '@aws-lambda-powertools/*']
      }
    })
    
    // Create a version of the Lambda to ensure it's fully deployed before CloudFront references it
    const chatHistoryLambdaVersion = chatHistoryLambda.currentVersion;

    chatHistoryTable.grantReadWriteData(chatHistoryLambda.role!);
    
    const chatHistory = new ApiGatewayToLambda(this, 'api-gateway-chat-persistence', {
      existingLambdaObj: chatHistoryLambda,
      apiGatewayProps: {
        restApiName: 'chat-history',
        endpointConfiguration: {
          types: [apigw.EndpointType.REGIONAL]
        },
        defaultMethodOptions: {
          authorizer: new apigw.CognitoUserPoolsAuthorizer(this, 'chatHistoryAuthorizer', {
            cognitoUserPools: [userPool]
          }),
          authorizationType: apigw.AuthorizationType.COGNITO
        },
        defaultCorsPreflightOptions: {
          allowOrigins: apigw.Cors.ALL_ORIGINS,
          allowMethods: apigw.Cors.ALL_METHODS,
          allowHeaders: apigw.Cors.DEFAULT_HEADERS
        },
        deployOptions: {
          stageName: 'chat-history'
        },
      }
    })

    const myRestApis =  [ apiGwToDdb.apiGateway , apiGwToDdBulk.apiGateway , apiGwToDdbAnalysis.apiGateway, apiGwToDdbSchemaTx.apiGateway ];
    
    //see https://github.com/aws/aws-cdk/issues/19257
    const userDataBucketName = ssm.StringParameter.valueForStringParameter(this, '/panoptic/user-bucket-name');
    const userDataBucket = s3.Bucket.fromBucketName(this, 'ImportedUserDataBucket', userDataBucketName)
    userDataBucket.grantReadWrite(identityPool.authenticatedRole);

    const exportsAsset = s3deploy.Source.jsonData("aws-exports.json", {
      region: cdk.Aws.REGION,
      domainName: "https://" + this.distribution.domainName,
      Auth: {
        Cognito: {
          userPoolClientId: userPoolClient.userPoolClientId,
          userPoolId: userPool.userPoolId,
          identityPoolId: identityPool.identityPoolId,
          authRoleArn: identityPool.authenticatedRole.roleArn,
          unauthRoleArn: identityPool.unauthenticatedRole.roleArn
        },
      },
      Storage: {
        S3: {
          region: cdk.Aws.REGION,
          bucket: userDataBucketName,
          buckets: {
            'userDataBucket': {
              bucketName: userDataBucketName,
              region: cdk.Aws.REGION
            },
            'dataLoaderBucket': {
              bucketName: etlBucketName,
              region: cdk.Aws.REGION
            }
          }
        },
      },
      API: {
        REST: Object.fromEntries(
          myRestApis.map(myRestApi => [
            myRestApi.restApiName,
            {
              endpoint: myRestApi.url,
              region: cdk.Aws.REGION,
              apiName: myRestApi.restApiName
            }
          ])
        )
      }
    });

    const asset = s3deploy.Source.asset(appPath, {
      bundling: {
        image: cdk.DockerImage.fromRegistry(
          "public.ecr.aws/sam/build-nodejs20.x:latest"
        ),
        command: [
          "sh",
          "-c",
          [
            "npm i corepack",
            "pnpm -C /tmp/.npm install",
            "pnpm -C /tmp/.npm run build",
            "cp -aur /asset-input/build/* /asset-output/",
          ].join(" && "),
        ],
        local: {
          tryBundle(outputDir: string) {
            try {
              const options: ExecSyncOptionsWithBufferEncoding = {
                stdio: "inherit",
                env: {
                  ...process.env,
                },
              };

              execSync(`pnpm --silent --force --prefix "${appPath}" install`, options);
              execSync(`pnpm --silent --prefix "${appPath}" run build`, options);
              UiUtils.copyDirRecursive(buildPath, outputDir);
            } catch (e) {
              console.error(e);
              return false;
            }

            return true;
          },
        },
      },
      exclude: ["node_modules", "dist", "build", "cdk.out", "lambda", "ui"],
    });

    const distribution = this.distribution;

    new s3deploy.BucketDeployment(this, "UserInterfaceDeployment", {
      prune: false,
      memoryLimit: 1024,
      sources: [asset, exportsAsset],
      destinationBucket: websiteBucket,
      distribution,
    });

    this.distribution.addBehavior(
      "/chat-history/*",
      new cloudfront_origins.RestApiOrigin(chatHistory.apiGateway, {
        originPath: '/'
      }),
      {
        ...commonBehaviorOptions,
        cachePolicy: cf.CachePolicy.CACHING_DISABLED,
        cachedMethods: cf.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        allowedMethods: cf.AllowedMethods.ALLOW_ALL,
        originRequestPolicy: cf.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
      }
    );
    
    // Add explicit dependency between CloudFront and the Lambda function
    this.distribution.node.addDependency(chatHistoryLambdaVersion);
    this.distribution.node.addDependency(chatHistory.apiGateway);

    // ###################################################
    // Outputs
    // ###################################################
    new cdk.CfnOutput(this, "UserInterfaceDomainName", {
      value: `https://${this.distribution.distributionDomainName}`,
    });

    new cdk.CfnOutput(this, "CognitoUserPool", {
      value: `${userPool.userPoolId}`,
    });
    
    // Add stack-level suppressions for CDK-NAG warnings that can be safely ignored
    NagSuppressions.addStackSuppressions(
      this,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'IAM wildcards are required for Bedrock, S3, and CloudWatch Logs access in this demo application',
        },
        {
          id: 'AwsSolutions-IAM4',
          reason: 'AWS managed policies are used for standard Lambda execution roles in this demo application',
        },
        {
          id: 'AwsSolutions-L1',
          reason: 'CDK-generated Lambda functions use specific runtime versions',
        },
        {
          id: 'AwsSolutions-SMG4',
          reason: 'Secret rotation not required for this demo application',
        },
        {
          id: 'AwsSolutions-APIG2',
          reason: 'API Gateway request validation not required for this demo application',
        }
      ],
      true
    );
    
    // Add specific suppressions for S3 and CloudFront resources
    NagSuppressions.addResourceSuppressions(
      this.distribution,
      [
        {
          id: 'AwsSolutions-CFR4',
          reason: 'TLS configuration is appropriate for this demo application',
        },
        {
          id: 'AwsSolutions-CFR7',
          reason: 'Origin access control not required for this demo application',
        }
      ],
      true
    );
    
    // Add specific suppressions for Cognito resources
    NagSuppressions.addResourceSuppressions(
      userPool,
      [
        {
          id: 'AwsSolutions-COG1',
          reason: 'Simplified password policy is acceptable for this demo application',
        },
        {
          id: 'AwsSolutions-COG3',
          reason: 'Advanced security mode not required for this demo application',
        }
      ],
      true
    );
  }
}

abstract class UiUtils {
  static copyDirRecursive(sourceDir: string, targetDir: string): void {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir);
    }

    const files = fs.readdirSync(sourceDir);

    for (const file of files) {
      const sourceFilePath = path.join(sourceDir, file);
      const targetFilePath = path.join(targetDir, file);
      const stats = fs.statSync(sourceFilePath);

      if (stats.isDirectory()) {
        UiUtils.copyDirRecursive(sourceFilePath, targetFilePath);
      } else {
        fs.copyFileSync(sourceFilePath, targetFilePath);
      }
    }
  }
}