import os
import json
import urllib3
import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from time import sleep
import logging

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    logger.info(f"Event: {json.dumps(event)}")

    agent = event['agent']
    actionGroup = event['actionGroup']
    function = event['function']
    parameters = event.get('parameters', [])

    neptune_host = os.environ['NEPTUNE_HOST']
    neptune_port = os.environ.get('NEPTUNE_PORT', '8182')    
    region = os.environ.get('AWS_REGION')

    neptune_endpoint = f"https://{neptune_host}:{neptune_port}/propertygraph/statistics/summary?mode=basic"

    # Create a signed request
    session = boto3.Session()
    credentials = session.get_credentials()
    request = AWSRequest(method='POST', url=neptune_endpoint)
    SigV4Auth(credentials, 'neptune-db', region).add_auth(request)
    
    # Send the request with urllib3
    http = urllib3.PoolManager()
    request.headers['Content-Type'] = 'application/json'
    response = http.request(
        'GET',
        request.url,
        body=request.data,
        headers=dict(request.headers)
    )

    # Check the response
    if response.status == 200:
        resp = json.loads(response.data.decode('utf-8'))
        logger.info(f'Status: {resp['status']}')
        logger.info(f'Stats Last Refreshed: {resp['payload']['lastStatisticsComputationTime']}')
        # logger.info(f'Graph Summary: {json.dumps(resp['payload']['graphSummary'], indent=2)}')

        responseBody =  {
            "TEXT": {
                "body": json.dumps(resp['payload']['graphSummary'], indent=2)
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
        logger.error(f'Error: {response.data.decode("utf-8")}')        
        return {
            'actionGroup': actionGroup,
            'function': function,
            'functionResponse': {
                'responseBody': {
                    'TEXT': {
                        "body": response.data.decode("utf-8")
                    }
                }
            }
        }   
