import os
import json
import boto3
import base64
from decimal import Decimal
import logging
from boto3.dynamodb.types import Binary

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
bulk_log_table = os.environ['BULK_LOAD_LOG']
table = dynamodb.Table(bulk_log_table)

class CustomEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, set):
            return list(obj)
        if isinstance(obj, Binary):
            return base64.b64encode(obj.value).decode('utf-8')
        if isinstance(obj, bytes):
            return base64.b64encode(obj).decode('utf-8')
        return super(CustomEncoder, self).default(obj)

def lambda_handler(event, context):
    logger.info(f"Event: {json.dumps(event)}")

    agent = event['agent']
    actionGroup = event['actionGroup']
    function = event['function']
    parameters = event.get('parameters', [])
    foundLoadId = False
    load_id = ''

    # Get LOAD_ID from params
    for param in parameters:
        if param.get("name") == "bulk_load_job_id":
            load_id = param.get("value")
            foundLoadId = True
            logger.info(f"Load ID: {load_id}")

    # Get the user query from the event
    if not foundLoadId: 
        logger.error("Bulk Load Job ID parameter is required")
        return {
            'actionGroup': actionGroup,
            'function': function,
            'functionResponse': {
                'responseBody': {
                    'TEXT': {
                        "body": json.dumps('Bulk Load Job ID parameter is required')
                    }
                }
            }
        }

    try:
        response = table.get_item(Key={'loadId': load_id})

        if 'Item' in response:
            item = response['Item']
            
            # Check if the item contains status and filePath
            status = item.get('loadStatus', 'Unknown')
            time_spent = item.get('timeSpent', 'Unknown')
            file_path = item.get('sourcePath', 'Unknown')
            
            # Create the full response first
            response_body = {
                "response": json.dumps(item, cls=CustomEncoder)
            }
            serialized_body = json.dumps(response_body, ensure_ascii=True)
            
            # Check the size of the serialized response
            response_size_kb = len(serialized_body) / 1024
            logger.info(f"Response size: {response_size_kb} KB")
            
            if response_size_kb > 25:
                # Create a simplified response if the full response is too large
                simplified_message = (
                    f"The bulk load job details exceed the size limit (25KB). "
                    f"Summary information:\n\n"
                    f"- Load ID: {load_id}\n\n"
                    f"- File Path: {file_path}\n\n"
                    f"- Status: {status}\n\n"
                    f"- Time: {time_spent}\n\n"
                    f'Check the <a href="/#/data-loader/{load_id}">Data Loader Report</a> for complete details.'
                )
                
                responseBody = {
                    "TEXT": {
                        "body": simplified_message
                    }
                }
                logger.info("Returning simplified response due to size limit")
            else:
                # Return the full response if it's within the size limit
                logger.info("Response body: %s", serialized_body)
                responseBody = {
                    "TEXT": {
                        "body": serialized_body
                    }
                }

            action_response = {
                'actionGroup': actionGroup,
                'function': function,
                'functionResponse': {
                    'responseBody': responseBody
                }
            }        

            agent_response = {'response': action_response, 'messageVersion': event['messageVersion']}
            print("Response: {}".format(function))

            return agent_response

        else:
            msg = f'Load ID: {load_id} not found'
            return {
                'response': {
                    'actionGroup': actionGroup,
                    'function': function,
                    'functionResponse': {
                        'responseBody': {
                            'TEXT': {
                                "body": msg
                            }
                        }
                    }
                }, 
                'messageVersion': event['messageVersion']
            }

    except Exception as e:
        msg = f"Error: {str(e)}"
        return {
            'response': {
                'actionGroup': actionGroup,
                'function': function,
                'functionResponse': {
                    'responseBody': {
                        'TEXT': {
                            "body": msg
                        }
                    }
                }
            }, 
            'messageVersion': event['messageVersion']
        }        
