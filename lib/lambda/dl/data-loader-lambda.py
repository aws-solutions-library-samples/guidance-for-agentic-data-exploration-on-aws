import json
import urllib3
import boto3
import os
import base64
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from datetime import datetime
import time
import logging
from urllib import parse
from decimal import Decimal
from boto3.dynamodb.types import Binary

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def calculate_payload_size_kb(payload):
    """
    Calculate the approximate size of a payload in KB
    """
    if not payload:
        return 0
    try:
        payload_json = json.dumps(payload, indent=2)
        return len(payload_json.encode('utf-8')) / 1024
    except Exception as e:
        logger.error(f"Error calculating payload size: {str(e)}")
        return 0

def truncate_errors_in_payload(payload, max_errors=10):
    """
    Truncate errors in the payload to reduce size
    """

    total_truncated = 0
    
    if 'errors' in payload and isinstance(payload['errors']['errorLogs'], list):
        original_count = len(payload['errors']['errorLogs'])
        if original_count > max_errors:
            nErrors = payload['errors']['errorLogs'][:max_errors]
            nErrors.append({
                'errorMessage': f'... and {original_count - max_errors} more errors (truncated for storage)',
                'errorCode': 'TRUNCATED',
                'fileName': 'SYSTEM_MESSAGE'
            })
            payload['originalErrorCount'] = original_count
            payload['errors']['errorLogs'] = nErrors
            total_truncated += (original_count - max_errors)
    
    if total_truncated > 0:
        logger.info(f"Truncated {total_truncated} errors from payload")
    
    return payload

def make_neptune_request(method, url, payload=None, credentials=None, region=None):
    """
    Make a signed request to Neptune endpoint
    """
    request = AWSRequest(method=method, url=url, data=json.dumps(payload) if payload else None)
    SigV4Auth(credentials, 'neptune-db', region).add_auth(request)
    
    http = urllib3.PoolManager()
    request.headers['Content-Type'] = 'application/json'
    
    response = http.request(
        method,
        request.url,
        body=request.data,
        headers=dict(request.headers)
    )
    
    return response

def get_load_status(neptune_endpoint, load_id, credentials, region):
    """
    Check the status of a bulk load job
    """
    response = make_neptune_request(
        'GET',
        f"{neptune_endpoint}/{load_id}?details=true&errors=true&page=1&errorsPerPage=1000",
        credentials=credentials,
        region=region
    )
    
    load = json.loads(response.data.decode("utf-8"))['payload']
    return {
        'status': load['overallStatus']['status'],
        'total_records': load['overallStatus']['totalRecords'],
        'time_spent': load['overallStatus']['totalTimeSpent'],
        'full_payload': load
    }

def update_load_log(table, load_id, status, records, time_spent, prefix, payload=None):
    """
    Update the DynamoDB load log with size-aware payload handling
    """
    
    payload_to_store = payload
    
    # Check payload size and truncate if necessary
    if payload:
        original_size = calculate_payload_size_kb(payload)
        logger.info(f"Original payload size: {original_size:.2f} KB")
        
        # DynamoDB item size limit is 400KB, but we'll be conservative and limit to 350KB
        # to account for other attributes in the item
        if original_size > 250:
            logger.warning(f"Payload size ({original_size:.2f} KB) exceeds limit, truncating errors")
            
            # Try truncating with 10 errors first
            payload_to_store = truncate_errors_in_payload(payload, max_errors=10)
            new_size = calculate_payload_size_kb(payload_to_store)
            logger.info(f"Payload size after truncation (10 errors): {new_size:.2f} KB")
            
            # If still too large, truncate more aggressively
            if new_size > 250:
                logger.warning("Still too large, truncating to 3 errors per source")
                payload_to_store = truncate_errors_in_payload(payload, max_errors=3)
                final_size = calculate_payload_size_kb(payload_to_store)
                logger.info(f"Final payload size after aggressive truncation: {final_size:.2f} KB")

    # Flatten and encode the payload 
    loader_response = json.dumps(payload_to_store, indent=2) if payload_to_store else "{}"
    loader_response = str(loader_response).encode('utf-8')

    update_params = {
        'Key': {'loadId': load_id},
        'UpdateExpression': 'SET loadStatus = :status, totalRecords = :totalRecords, timeSpent = :timeSpent, sourcePath = :sourcePath, payload = :payload, loaderResponse = :loaderResponse',
        'ExpressionAttributeValues': {
            ':status': status,
            ':totalRecords': records,
            ':timeSpent': time_spent,
            ':sourcePath': prefix,
            ':payload': payload_to_store,
            ':loaderResponse': loader_response
        }
    }

    return table.update_item(**update_params)

def lambda_handler(event, context):
    logger.info(f"Event: {json.dumps(event)}")
    foundPrefix = False
    isAgent = False
    prefix = ''

    # Determine if this is an Agent or S3 event
    if 'agent' in event:
        isAgent = True
        agent = event['agent']
        actionGroup = event['actionGroup']
        function = event['function']
        parameters = event.get('parameters', [])

        # Get prefix from params or event
        for param in parameters:
            if param.get("name") == "prefix":
                prefix = param.get("value")
                foundPrefix = True
    else:
        agent = None
        actionGroup = None 
        function = None
        parameters = []

    # Environment variables
    neptune_host = os.environ['NEPTUNE_HOST']
    neptune_port = os.environ.get('NEPTUNE_PORT', '8182')    
    loader_role = os.environ['S3_LOADER_ROLE']
    loader_bucket = os.environ['S3_LOADER_BUCKET']
    bulk_log_table = os.environ['BULK_LOAD_LOG']
    region = os.environ.get('AWS_REGION')
    neptune_endpoint = f"https://{neptune_host}:{neptune_port}/loader"

    if foundPrefix:
        logger.info(f"Agent | Prefix: {prefix}")
    elif event.get('Records'):
        prefix = parse.unquote_plus(event['Records'][0]['s3']['object']['key'])
        logger.info(f"S3 | Prefix: {prefix}")
    else:
        logger.error("Prefix parameter is required")
        return {
            'response': {
                'actionGroup': actionGroup,
                'function': function,
                'functionResponse': {
                    'responseBody': {
                        'TEXT': {
                            "body": json.dumps('Prefix parameter is required')
                        }
                    }
                }
            }, 
            'messageVersion': event['messageVersion']
        }

    source_path = f"s3://{loader_bucket}/{prefix}"
    logger.info(f"Load from path: {source_path}")

    # Prepare bulk load request
    payload = {
        'source': source_path,
        'format': 'opencypher',
        'iamRoleArn': loader_role,
        'region': region,
        'failOnError': 'FALSE',
        'queueRequest': 'TRUE',
        'parallelism': 'MEDIUM',
        'userProvidedEdgeIds': 'FALSE',
    }
    
    # Get AWS credentials
    session = boto3.Session()
    credentials = session.get_credentials()

    # Start bulk load
    response = make_neptune_request('POST', neptune_endpoint, payload, credentials, region)

    # Initialize DynamoDB (moved up to handle both success and failure cases)
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(bulk_log_table)

    if response.status != 200:
        error_message = response.data.decode("utf-8")
        logger.error(f'Error: {error_message}')
        
        # Log the failed operation to DynamoDB
        try:
            # Generate a unique load ID for failed operations
            import uuid
            failed_load_id = str(uuid.uuid4())
            
            table.put_item(
                Item={
                    'loadId': failed_load_id,
                    'startTime': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    'sourcePath': prefix,
                    'loadStatus': 'LOAD_FAILED_INVALID_REQUEST',
                    'totalRecords': 0,
                    'timeSpent': 0,
                    'loaderResponse': error_message.encode('utf-8'),
                    'payload': {
                        'overallStatus': {
                            'status': 'LOAD_FAILED_INVALID_REQUEST',
                            'totalRecords': 0,
                            'totalTimeSpent': 0,
                            'fullUri': source_path
                        },
                        'errors': {
                            'loadId': failed_load_id,
                            'errorLogs': [{
                                'errorCode': 'INVALID_REQUEST',
                                'errorMessage': error_message,
                                'fileName': prefix
                            }]
                        }
                    }
                }
            )
            logger.info(f"Logged failed operation with ID: {failed_load_id}")
        except Exception as log_error:
            logger.error(f"Failed to log error to DynamoDB: {str(log_error)}")
        
        return {
            'response': {
                'actionGroup': actionGroup,
                'function': function,
                'functionResponse': {
                    'responseBody': {
                        'TEXT': {
                            "body": json.dumps(f'Error: {error_message}')
                        }
                    }
                }
            }, 
            'messageVersion': event['messageVersion']
        }

    load_id = json.loads(response.data.decode('utf-8'))['payload']['loadId']
    logger.info(f'Bulk load job started. Load ID: {load_id}')
    
    # Create initial log entry
    table.put_item(
        Item={
            'loadId': load_id,
            'startTime': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'sourcePath': prefix,
            'loadStatus': 'LOAD_IN_PROGRESS'
        }
    )

    # Check load status
    load_info = get_load_status(neptune_endpoint, load_id, credentials, region)
    logger.info(f'Load Status: {load_info["status"]} | Total Records: {load_info["total_records"]}')
    
    while load_info['status'] in ['LOAD_IN_PROGRESS', 'LOAD_NOT_STARTED']:
        # INTENTIONAL: Sleep required to poll Neptune Bulk Loader which doesn't publish events
        time.sleep(5)  # nosemgrep: arbitrary-sleep
        # Check load status
        load_info = get_load_status(neptune_endpoint, load_id, credentials, region)
        logger.info(f'Load Status: {load_info["status"]} | Total Records: {load_info["total_records"]}')

    # Update final status in DynamoDB
    try:
        update_load_log(
            table, 
            load_id, 
            load_info['status'],
            load_info['total_records'],
            load_info['time_spent'],
            prefix,
            load_info['full_payload']
        )
    except Exception as e:
        logger.error(f"Failed to update load log: {str(e)}")
        
        # If it's a DynamoDB size limit error, try with a minimal payload
        if "Item size has exceeded" in str(e) or "ValidationException" in str(e):
            logger.warning("Attempting to save minimal payload due to size constraints")
            try:
                minimal_payload = {
                    'overallStatus': load_info['full_payload'].get('overallStatus', {}),
                    'loadDetails': [{
                        'source': detail.get('source', ''),
                        'status': detail.get('status', ''),
                        'totalRecords': detail.get('totalRecords', 0),
                        'errorCount': len(detail.get('errors', [])) if detail.get('errors') else 0,
                        'errors': detail.get('errors', [])[:3] if detail.get('errors') else []  # Keep only first 3 errors
                    } for detail in load_info['full_payload'].get('loadDetails', [])]
                }
                
                update_load_log(
                    table, 
                    load_id, 
                    load_info['status'],
                    load_info['total_records'],
                    load_info['time_spent'],
                    prefix,
                    minimal_payload
                )
                logger.info("Successfully saved minimal payload")
            except Exception as e2:
                logger.error(f"Failed to save even minimal payload: {str(e2)}")
                # As a last resort, save without any payload
                try:
                    update_load_log(
                        table, 
                        load_id, 
                        load_info['status'],
                        load_info['total_records'],
                        load_info['time_spent'],
                        prefix,
                        None
                    )
                    logger.info("Successfully saved without payload")
                except Exception as e3:
                    logger.error(f"Failed to save without payload: {str(e3)}")

    results = f'Bulk Load ID: {load_id} | Status: {load_info["status"]} | Total Records: {load_info["total_records"]} | Time Spent: {load_info["time_spent"]}'
    logger.info(f"Results: {results}")

    if isAgent:
        # Create the full response first
        response_body = {
            "response": json.dumps({
                'loadId': load_id,
                'status': load_info['status'],
                'totalRecords': load_info['total_records'],
                'timeSpent': load_info['time_spent'],
                'sourcePath': prefix,
                'fullPayload': load_info['full_payload']
            })
        }
        serialized_body = json.dumps(response_body, ensure_ascii=True)
        
        # Check the size of the serialized response
        response_size_kb = len(serialized_body) / 1024
        logger.info(f"Response size: {response_size_kb} KB")
        
        if response_size_kb > 25:
            # Create a simplified response if the full response is too large
            simplified_message = (
                f"Return this information to the user. The bulk load job details exceed the size limit (25KB). "
                f"Summary information:\n\n"
                f"- Load ID: {load_id}\n\n"
                f"- File Path: {prefix}\n\n"
                f"- Status: {load_info['status']}\n\n"
                f"- Total Records: {load_info['total_records']}\n\n"
                f"- Time Spent: {load_info['time_spent']}\n\n"
                # nosemgrep: python.aws-lambda.security.tainted-html-string.tainted-html-string
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
            results = f'Bulk Load ID: {load_id} | Status: {load_info["status"]} | Total Records: {load_info["total_records"]} | Time Spent: {load_info["time_spent"]}'
            responseBody = {
                "TEXT": {
                    "body": results
                }
            }
            logger.info("Response body: %s", results)

        action_response = {
            'actionGroup': actionGroup,
            'function': function,
            'functionResponse': {
                'responseBody': responseBody
            }
        }        

        agent_response = {'response': action_response, 'messageVersion': event['messageVersion']}
        print("Response: {}".format(function))
    else:
        agent_response = f'Bulk Load ID: {load_id} | Status: {load_info["status"]} | Total Records: {load_info["total_records"]} | Time Spent: {load_info["time_spent"]}'

    return agent_response
