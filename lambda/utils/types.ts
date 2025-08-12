interface Parameter {
    name: string;
    type: string;
    value: string;
}

interface ContentTypeProperties {
    name: string;
    type: string;
    value: string;
}

interface RequestBodyContent {
    [contentType: string]: {
        properties: ContentTypeProperties[];
    };
}

interface RequestBody {
    content: RequestBodyContent;
}

interface BedrockAgentType {
    name: string;
    id: string;
    alias: string;
    version: string;
}

//from https://docs.aws.amazon.com/bedrock/latest/userguide/agents-lambda.html
export interface BedrockAgentApiRequest {
    messageVersion: string;
    agent: BedrockAgentType;
    inputText: string;
    sessionId: string;
    memoryId: string;
    actionGroup: string;
    apiPath: string;
    httpMethod: string;
    parameters: Parameter[];
    requestBody: RequestBody;
    sessionAttributes: {
        [key: string]: string;
    };
    promptSessionAttributes: {
        [key: string]: string;
    };
}

interface RetrievalFilter {
    // You might want to expand this based on the actual filter structure
    [key: string]: any;
}

interface VectorSearchConfiguration {
    numberOfResults: number;
    overrideSearchType: 'HYBRID' | 'SEMANTIC';
    filter?: RetrievalFilter;
}

interface RetrievalConfiguration {
    vectorSearchConfiguration: VectorSearchConfiguration;
}

interface KnowledgeBaseConfig {
    knowledgeBaseId: string;
    retrievalConfiguration: RetrievalConfiguration;
}

interface ResponseBody {
    [contentType: string]: {
        body: string; // JSON-formatted string
    };
}

export interface BedrockAgentApiInlineResponse {
    actionGroup: string;
    apiPath: string;
    httpMethod: string;
    httpStatusCode: number;
    responseBody: ResponseBody;
}

export interface BedrockAgentApiResponse {
    messageVersion: string;
    response: BedrockAgentApiInlineResponse;
    sessionAttributes?: {
        [key: string]: string;
    };
    promptSessionAttributes?: {
        [key: string]: string;
    };
    knowledgeBasesConfiguration?: KnowledgeBaseConfig[];
}

