import boto3
import json
import datetime
from datetime import datetime
from defusedcsv import csv
import io
import re
import time
import os
import logging

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DDB client
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['SCHEMA_TRANSLATOR_LOG_TABLE'])

# handler function
def lambda_handler(event, context):
    logger.info(f"Event: {event}")    
    region = os.environ.get('AWS_REGION')

    agent = event['agent']
    actionGroup = event['actionGroup']
    function = event['function']
    parameters = event.get('parameters', [])

    # Get schema from params
    schemaData = ''
    originalInput = ''
    for param in parameters:
        if param.get("name") == "schemaData":
            schemaData = param.get("value")
            logger.info(f"Results: {schemaData}")
        elif param.get("name") == "originalInput":
            originalInput = param.get("value")
            logger.info(f"Input: {originalInput}")

    try:
        # save results to a dynamodb table
        table.put_item(Item={
            'id': context.aws_request_id,
            'timestamp': str(datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")),
            'results': schemaData,
            'input': originalInput,
        })
    except Exception as e:
        logger.error(f"Error saving to DynamoDB for request {context.aws_request_id}: {str(e)}")

    responseBody =  {
        "TEXT": {
            "body": json.dumps(schemaData)
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
