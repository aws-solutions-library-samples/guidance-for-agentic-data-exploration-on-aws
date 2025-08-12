import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ logLevel: 'INFO' });
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Verify authentication
        if (!event.requestContext.authorizer?.claims?.sub) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: 'Unauthorized - Missing user ID' })
            };
        }

        const userId = event.requestContext.authorizer.claims.sub;

        const key = event.path.split('/').pop();
        if (!key?.startsWith(userId)) {
            return {
                statusCode: 403,
                body: JSON.stringify({ message: 'Forbidden - Invalid user ID in path' })
            };
        }
        if (event.httpMethod == 'POST' && event.body) {
            const requestBody = JSON.parse(event.body);
            const timestamp = requestBody.timestamp || Date.now();

            // Store in DynamoDB
            const putParams = {
                TableName: process.env.TABLE_NAME,
                Item: {
                    id: key,           // partition key
                    timestamp: timestamp,     // sort key
                    ...requestBody           // rest of the data
                }
            };

            await docClient.send(new PutCommand(putParams));
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Data stored successfully' })
            };
        } else if (event.httpMethod == 'GET') {
            const limit = Number.isInteger(event.queryStringParameters?.['limit']) ?
            Number.parseInt(event.queryStringParameters?.['limit']!)
            : 100
            const desc = event.queryStringParameters?.['desc'] === 'true'
            const cursor = event.queryStringParameters?.['cursor']
            // Retrieve from DynamoDB
            let queryParams:QueryCommandInput = {
                TableName: process.env.TABLE_NAME,
                ExpressionAttributeValues: { ':id': key },
                KeyConditionExpression: 'id = :id',
                Limit: limit,
                ScanIndexForward: !desc
            };
            
            if (cursor) {
                queryParams['ExclusiveStartKey'] = JSON.parse(cursor);
            }

            const response = await docClient.send(new QueryCommand(queryParams));
            return {
                statusCode: 200,
                body: JSON.stringify({
                    items: response.Items || [],
                    cursor: response.LastEvaluatedKey || ''}
                )
            };
        } else {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Invalid request' })
            };
        }
    } catch (error) {
        logger.error('server error', error as Error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Internal server error',
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
}