import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from 'aws-cdk-lib/aws-bedrock'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as genai from '@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock';
import { DATA_VIZ_AGENT_PROMPT } from './agent-prompts';
import { NagSuppressions } from 'cdk-nag';
import { createLambdaExecRole } from './bedrock-utils';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class DataVisualizationStack extends cdk.Stack {
    public readonly dataVisualizationAgent: genai.Agent;

    constructor(scope: cdk.App, id: string, props: cdk.StackProps) {
        super(scope, id, props);

        const s3BucketName = ssm.StringParameter.valueForStringParameter(this, '/panoptic/user-bucket-name');        

        const crossRegionIP = genai.CrossRegionInferenceProfile.fromConfig({
            geoRegion: genai.CrossRegionInferenceProfileRegion.US,
            model: genai.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_SONNET_V1_0,
        });
        
        const haiku3InferenceProfile = genai.CrossRegionInferenceProfile.fromConfig({
            geoRegion: genai.CrossRegionInferenceProfileRegion.US,
            model: genai.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_5_HAIKU_V1_0,
        })
        
        const powertoolsLayer = lambda.LayerVersion.fromLayerVersionArn(
            this,
            'PowertoolsLayer',
            `arn:aws:lambda:${cdk.Stack.of(this).region}:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:24`
        );
        // Create Lambda function

        // ──────────────────────────────────────────────────────────────────────────
        // START > Data Visualization Agent + Alias
        // ─────────────────────────────────────────────
        // ─────────────────────────────
        const dataVizName = 'Panoptic-DataVisualizer';
        const dataVizAgent = new genai.Agent(this, 'DataVizAgent', {
            name: dataVizName,
            description: 'Generates visualizations like charts, graphs, and word clouds based on the provided content',
            foundationModel: haiku3InferenceProfile,
            instruction: DATA_VIZ_AGENT_PROMPT,
            userInputEnabled: true,
            codeInterpreterEnabled: true,
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
        
        // Add CDK-NAG suppressions for DataVizAgent
        NagSuppressions.addResourceSuppressions(
            dataVizAgent,
            [
                {
                    id: 'AwsSolutions-IAM5',
                    reason: 'Bedrock agents require wildcard permissions to invoke foundation models',
                    appliesTo: [
                        'Action::bedrock:InvokeModel*',
                        'Resource::arn:<AWS::Partition>:bedrock:*::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0'
                    ]
                }
            ],
            true
        );
        
        const dataVizAgentAlias = new bedrock.CfnAgentAlias(this, 'DataVizAgentAlias', {
            agentAliasName: 'test',
            description: 'Test Alias',
            agentId: dataVizAgent.agentId,
        })
        dataVizAgentAlias.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
        
        const name = 'DataVisualizationFunction'
        const POST_PROCESSING_PROMPT = `

        If you successfully generate the visualization, return only the s3_location of the file created on a single line, enclosed by the xml element <storage-image></storage-image>.
        
        Example valid return would be:

        <storage-image>s3://path/to/file</storage-image>
        `

        const dataVizFn = 'Panoptic-Data_Visualizer';
        // Create Log Group
        const dataVizLogGroup = new cdk.aws_logs.LogGroup(this, `DataVizLambdaLogGroup`, {
            logGroupName: `/aws/lambda/panoptic/${dataVizFn}`,
            retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Create Lambda Role
        const dataVizLambdaRole = createLambdaExecRole(this, `${dataVizFn}-Lambda`, dataVizFn);
        const lambdaFunction = new NodejsFunction(this, name, {
            functionName: dataVizFn,
            role: dataVizLambdaRole,
            logGroup: dataVizLogGroup,
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'handler',
            entry: 'lambda/data-viz2/index.ts',
            environment: {
                S3_BUCKET_NAME: s3BucketName,
                POWERTOOLS_SERVICE_NAME: name,
                POWERTOOLS_LOG_LEVEL: 'INFO',
                VISUAL_TOOL_NAME: dataVizAgent.agentId,
                VISUAL_TOOL_ALIAS: dataVizAgentAlias.attrAgentAliasId
            },
            layers: [powertoolsLayer],
            tracing: lambda.Tracing.ACTIVE,
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            bundling: {
                externalModules: ['@aws-sdk/*', '@aws-lambda-powertools/*']
            }

        });

        // Add S3 PutObject permissions to Lambda role
        dataVizLambdaRole.addToPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['s3:PutObject'],
                resources: [`arn:aws:s3:::${s3BucketName}/*`]
            })
        );

        dataVizLambdaRole.addToPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['bedrock:Invoke*'],
                resources: ['*']
            })
        );
        
        // Add CDK-NAG suppressions for the Lambda function's role
        NagSuppressions.addResourceSuppressions(
            [lambdaFunction.role!,dataVizLambdaRole],
            [
                {
                    id: 'AwsSolutions-IAM5',
                    reason: 'Lambda function requires permissions to write logs and invoke Bedrock models',
                }
            ],
            true
        );
                
        const apiSchema = genai.ApiSchema.fromInline(JSON.stringify({
            openapi: '3.0.0',  // Be specific with the version
            info: {
                title: 'Data Visualization API',
                version: '1.0.0'
            },
            paths: {
                '/render/{chart-type}': {
                    post: {
                        description: "Build a visualization and persist it to an S3 bucket",
                        operationId: 'process',
                        parameters: [
                            {
                                name: 'x-bedrock-memory-id',
                                description: 'the bedrock memory id',
                                in: 'header',
                                required: true,
                                schema: {
                                    type: 'string'
                                }
                            },
                            {
                                name: 'chart-type',
                                description: 'visualization type',
                                in: 'path',
                                required: true,
                                schema: {
                                    type: 'string'
                                }
                            }
                        ],
                        requestBody: {
                            required: true,
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        required: ['data'],  
                                        properties: {
                                            data: { 
                                                type: 'object',
                                                description: 'Data to be used to render the visualization. This could be unstructured text for wordcloud or more structured data for plotting. As a helpful assistant, you might consider formatting the user input so it will be easier to use in the code interpreter tool that will build the plots.'
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            '200': {
                                description: 'Success',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            required: ['message', 's3_location'], 
                                            properties: {
                                                message: { 
                                                    type: 'string',
                                                    description: 'Response message'
                                                },
                                                s3_location: { 
                                                    type: 'string',
                                                    description: 'S3 location of the generated visualization'
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            '400': {  // Add error responses
                                description: 'Bad Request',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                error: {
                                                    type: 'string'
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }));
        
        const agentGroup = new genai.AgentActionGroup({
            name: 'gen-image-and-save',
            executor: genai.ActionGroupExecutor.fromlambdaFunction(lambdaFunction),
            apiSchema
        });

      this.dataVisualizationAgent = new genai.Agent(this, 'DataVisualization', {
            name: 'Panoptic-DataVisualizationAgent',
            instruction: DATA_VIZ_AGENT_PROMPT+POST_PROCESSING_PROMPT,
            foundationModel: crossRegionIP,
            codeInterpreterEnabled: false,
            shouldPrepareAgent: true, 
            actionGroups: [ agentGroup ],
            memory: genai.Memory.sessionSummary({
                maxRecentSessions: 10,
                memoryDurationDays: 30
            }),
        });
        
        // Add CDK-NAG suppressions for DataVisualization agent
        NagSuppressions.addResourceSuppressions(
            this.dataVisualizationAgent,
            [
                {
                    id: 'AwsSolutions-IAM5',
                    reason: 'Bedrock agents require wildcard permissions to invoke foundation models and lambda functions',
                    appliesTo: [
                        'Resource::<DataVisualizationFunction690E4D8A.Arn>:*',
                        'Action::bedrock:InvokeModel*',
                        'Resource::arn:<AWS::Partition>:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0'
                    ]
                }
            ],
            true
        );

        // Grant Bedrock permission to invoke Lambda
        lambdaFunction.grantInvoke(new iam.ServicePrincipal('bedrock.amazonaws.com'));
    }
}
