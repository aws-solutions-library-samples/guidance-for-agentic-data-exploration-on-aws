import { S3Client, PutObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { Logger } from '@aws-lambda-powertools/logger';
import { BedrockAgentApiRequest, BedrockAgentApiResponse, BedrockAgentApiInlineResponse } from '../utils/types'
import { env } from 'node:process'
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
// Define interfaces for request and response

interface ChartResponse {
    message: string;
    s3_location: string;
    public_url?: string;
    memory_id: string;
    session_id: string;
}

// Initialize clients
const s3Client = new S3Client();
const logger = new Logger();
const bedrockClient = new BedrockAgentRuntimeClient({
    region: env.AWS_REGION
});
const dataVisTool = env.VISUAL_TOOL_NAME
const dataVisToolAlias = env.VISUAL_TOOL_ALIAS
export const handler = async (event: BedrockAgentApiRequest): Promise<BedrockAgentApiResponse> => {
    const { actionGroup, sessionId, apiPath, httpMethod, sessionAttributes, promptSessionAttributes, inputText } = event;

    let retVal:Partial<BedrockAgentApiResponse> = {
        messageVersion: '1.0',
        sessionAttributes,
        promptSessionAttributes,
    }
    const returnError = (statuscode:number, error:any)  => {
        return {
            actionGroup,
            apiPath,
            httpMethod,
            httpStatusCode: statuscode,
            responseBody: {
                "application/json": {
                    body: error
                }
            },
        } as BedrockAgentApiInlineResponse
    }

    const getParameterValue = (p:string):string => {
        const m = event.parameters.findIndex(x=>x.name===p);
        if (m===-1) {
            throw returnError(400, `parameter ${p} is required`);
        }
        return event.parameters[m].value!;
    }

    try {
        if (!(event && event.parameters)) {
            throw returnError(400, 'Malformed Event');
        }

        const memoryId = event.memoryId ?? getParameterValue('x-bedrock-memory-id');
        //const file_name = getParameterValue('chart-type');
        //const data = event.requestBody.content['application/json']

        const codeResponse = await bedrockClient.send(new InvokeAgentCommand(
            {
                agentId: dataVisTool,
                agentAliasId: dataVisToolAlias,
                sessionId,
                memoryId,
                inputText,
                enableTrace: true,
                sessionState: {
                    sessionAttributes,
                    promptSessionAttributes
                }

            }
        ))

        let resp=[] as ChartResponse[];
        for await (const chunkEvent of codeResponse.completion!) {
            if (chunkEvent.chunk) {
                const { chunk } = chunkEvent;
                logger.info(new TextDecoder().decode(chunk.bytes))
            }
            if (chunkEvent.files && chunkEvent.files.files) {
                const fileList = chunkEvent.files.files;    
                fileList.forEach(async ({name, type, bytes})=> {
                        const filename = name;
                        const fileContent = bytes;
                        const s3Bucket = process.env.S3_BUCKET_NAME || 'your-chart-bucket-name';
                        const s3Key = `${memoryId}/${sessionId}/${crypto.randomUUID()}/${filename}`;

                        await s3Client.send(new PutObjectCommand({
                            Bucket: s3Bucket,
                            Key: s3Key,
                            Body: fileContent,
                            ContentType: type,
                            Metadata: {
                                'memory-id': memoryId,
                                'session-id': sessionId,
                            }
                        }));

                        resp.push({
                            message: 'Chart generated and stored successfully',
                            memory_id: memoryId,
                            session_id: sessionId,
                            s3_location: `s3://${s3Bucket}/${s3Key}`
                        })
                    })
                }
            }
        retVal.response = {
            actionGroup,
            apiPath,
            httpMethod,
            httpStatusCode: 200,
            responseBody: {
                "application/json": {
                    body: JSON.stringify(resp)
                }
            },
        }
    } catch (error) {
        logger.error(error as any);
        if (error instanceof Error)
            retVal.response = returnError(500, error.message);
        else
            retVal.response = error as BedrockAgentApiInlineResponse;
    } finally {
        logger.info('response',JSON.stringify(retVal, null, 2));
        return retVal as BedrockAgentApiResponse;
    }
}
