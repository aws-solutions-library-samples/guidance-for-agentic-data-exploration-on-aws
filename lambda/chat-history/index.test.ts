import { APIGatewayProxyEvent } from 'aws-lambda';
import { jest, expect, describe, it, beforeEach } from '@jest/globals';
import { handler } from './index';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

// Mock DynamoDB client
jest.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: jest.fn().mockReturnThis(),
        send: jest.fn()
    },
    PutCommand: jest.fn()
}));

interface MockPutCommand {
    TableName: string;
    Item: {
        userId: string;
        timestamp: string;
        data: string;
        [key: string]: any;
    };
}

describe('Data Store Lambda Handler', () => {
    const mockEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        body: JSON.stringify({
            data: 'test data',
            timestamp: '2023-01-01T00:00:00Z'
        }),
        requestContext: {
            accountId: '123456789012',
            apiId: 'test-api',
            authorizer: {
                claims: {
                    sub: 'test-user-id'
                }
            },
            protocol: 'HTTP/1.1',
            httpMethod: 'POST',
            identity: {
                accessKey: null,
                accountId: null,
                apiKey: null,
                apiKeyId: null,
                caller: null,
                clientCert: null,
                cognitoAuthenticationProvider: null,
                cognitoAuthenticationType: null,
                cognitoIdentityId: null,
                cognitoIdentityPoolId: null,
                principalOrgId: null,
                sourceIp: '127.0.0.1',
                user: null,
                userAgent: null,
                userArn: null
            },
            path: '/data',
            stage: 'test',
            requestId: 'test-request-id',
            requestTimeEpoch: 1234567890,
            resourceId: 'test-resource',
            resourcePath: '/data'
        }
    };

    beforeEach(() => {
        process.env.TABLE_NAME = 'test-table';
        jest.clearAllMocks();
        const mockDDBClient = DynamoDBDocumentClient.from as jest.Mock;
        mockDDBClient.mockReturnValue({
            send: jest.fn().mockResolvedValue({} as any)
        });
    });

    it('should successfully store data', async () => {
        const response = await handler(mockEvent as APIGatewayProxyEvent);
        
        expect(response.statusCode).toBe(200);
        expect(PutCommand).toHaveBeenCalledWith({
            TableName: 'test-table',
            Item: {
                userId: 'test-user-id',
                timestamp: '2023-01-01T00:00:00Z',
                data: 'test data'
            }
        });
    });

    it('should return 401 when user is not authenticated', async () => {
        const unauthEvent = {
            ...mockEvent,
            requestContext: {
                ...mockEvent.requestContext!,
                authorizer: {}
            }
        };

        const response = await handler(unauthEvent as APIGatewayProxyEvent);
        expect(response.statusCode).toBe(401);
    });

    it('should return 400 when body is missing', async () => {
        const noBodyEvent = {
            ...mockEvent,
            body: null
        };

        const response = await handler(noBodyEvent as APIGatewayProxyEvent);
        expect(response.statusCode).toBe(400);
    });

    it('should return 405 for non-POST requests', async () => {
        const getEvent = {
            ...mockEvent,
            httpMethod: 'GET'
        };

        const response = await handler(getEvent as APIGatewayProxyEvent);
        expect(response.statusCode).toBe(405);
    });

    it('should generate timestamp if not provided', async () => {
        const noTimestampEvent = {
            ...mockEvent,
            body: JSON.stringify({
                data: 'test data'
            })
        };

        const response = await handler(noTimestampEvent as APIGatewayProxyEvent);
        expect(response.statusCode).toBe(200);
        
        const putCommand = ((PutCommand as unknown) as jest.Mock).mock.calls[0][0] as MockPutCommand;
        expect(putCommand.Item.timestamp).toBeDefined();
        const timestamp = new Date(putCommand.Item.timestamp).getTime();
        expect(isNaN(timestamp)).toBe(false);
    });
});