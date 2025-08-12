import { Construct } from 'constructs';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { ApiGatewayToDynamoDB, ApiGatewayToDynamoDBProps } from '@aws-solutions-constructs/aws-apigateway-dynamodb';
import { addProxyMethodToApiResource } from '@aws-solutions-constructs/core';
import { IntegrationResponse } from 'aws-cdk-lib/aws-apigateway';

export type ApiDynamoConstructProps = ApiGatewayToDynamoDBProps & {
    allowScanOperation?: boolean;
    scanProjectionExpression?: string;
    scanExpressionAttributeNames?: Record<string, string>;
};

export class ApiDynamoConstruct extends ApiGatewayToDynamoDB {

    constructor(scope: Construct, id: string, props:ApiDynamoConstructProps ) {
        const scanIntegrationResponse:IntegrationResponse[] = [
            {
                statusCode: '200',
                responseParameters: {
                    'method.response.header.Access-Control-Allow-Origin': "'*'"
                },
                responseTemplates: {
                'application/json': `
                    #set($items = $input.path('$.Items'))
                    {
                        "items": [
                            #foreach($item in $items)
                            #set($resultMap = {})
                            #set($listMap={})
                            #foreach($key in $item.keySet())
                                #if($!item.get($key).S != "")
                                #set($dummy = $resultMap.put($key, $util.escapeJavaScript($item.get($key).S)))
                                #end
                                #if($!item.get($key).B != "")
                                #set($dummy = $resultMap.put($key, $item.get($key).B))
                                #end
                                #if($!item.get($key).N != "")
                                #set($dummy = $resultMap.put($key, $item.get($key).N))
                                #end
                                #if($!item.get($key).L != "")
                                #set($listValue = [])
                                #foreach($listItem in $item.get($key).L)
                                    #if($!listItem.S != "")
                                        #set($dummy = $listValue.add($util.escapeJavaScript($listItem.S)))
                                    #elseif($!listItem.N != "")
                                        #set($dummy = $listValue.add($listItem.N))
                                    #end
                                #end
                                #set($dummy = $listMap.put($key, $listValue))
                                #end
                              #end
                            {
                            #foreach($key in $resultMap.keySet())
                            "$key": "$resultMap.get($key)"
                            #if($foreach.hasNext()),#end
                            #end
                            #foreach($key in $listMap.keySet())
                            ,"$key": [
                                #foreach($listItem in $listMap.get($key))
                                    "$listItem"#if($foreach.hasNext()),#end 
                                #end
                            ]
                            #end
                            }#if($foreach.hasNext()),#end
                            #end
                        ]
                        #if($!input.path('$.LastEvaluatedKey') != "")
                         ,"nextToken": "$input.path('$.LastEvaluatedKey')"
                        #end
                    }
                    `
                }
            },
            {
                statusCode: '400',
                responseParameters: {
                    'method.response.header.Access-Control-Allow-Origin': "'*'"
                },
            },
            {
                statusCode: '500',
                responseParameters: {
                    'method.response.header.Access-Control-Allow-Origin': "'*'"
                },
            }
        ]

        const readMethodResponses = [
            {
                   responseParameters: {
                       'method.response.header.Access-Control-Allow-Origin': true
                   },
                   statusCode: '200'
               },
               {
                   responseParameters: {
                       'method.response.header.Access-Control-Allow-Origin': true
                   },
                   statusCode: '400'
               },
               {
                   responseParameters: {
                       'method.response.header.Access-Control-Allow-Origin': true
                   },
                   statusCode: '500'
               }
           ]
        super(scope, id, {
            ...props,
            readIntegrationResponses: scanIntegrationResponse,
            readMethodResponses
        });

        if (props.allowScanOperation) {
            const scanRequestTemplate = `
                {
                    "TableName": "${this.dynamoTable.tableName}",
                    "Limit": $input.params('limit')
                    #if($!input.params('nextToken')!="")
                    ,"ExclusiveStartKey": {
                        "S": "$input.params('nextToken')"
                    }
                    #end
                    ${props.scanProjectionExpression ? `,"ProjectionExpression": "${props.scanProjectionExpression}"` : ''}
                    ${props.scanExpressionAttributeNames ? `,"ExpressionAttributeNames": ${JSON.stringify(props.scanExpressionAttributeNames)}` : ''}
                    #if($!input.params('sortKey')!="")
                    ,"IndexName": "$input.params('sortKey')-index"
                    #if($!input.params('sortOrder')!="")
                    #if($input.params('sortOrder') == 'desc')
                    ,"ScanIndexForward": false
                    #else
                    ,"ScanIndexForward": true
                    #end
                    #end
                    #end
                }
                `
            this._addActionToPolicy("dynamodb:Scan");
            addProxyMethodToApiResource({
                service: 'dynamodb',
                action: 'Scan',
                path: '',
                apiGatewayRole: this.apiGatewayRole,
                apiMethod: 'GET',
                apiResource: this.apiGateway.root,
                requestTemplate: scanRequestTemplate,
                integrationResponses: scanIntegrationResponse,
                methodOptions: {
                    requestParameters: {
                        'method.request.querystring.limit': false,
                        'method.request.querystring.nextToken': false,
                        'method.request.querystring.sortKey': false,
                        'method.request.querystring.sortOrder': false
                    },
                    methodResponses: readMethodResponses
                }
            });
        }
    }

    private _addActionToPolicy(action: string) {
        this.apiGatewayRole.addToPolicy(new PolicyStatement({
          resources: [
            this.dynamoTable.tableArn
          ],
          actions: [`${action}`]
        }));
      }
  }



