import boto3
import json
import os
import logging
import traceback
from datetime import datetime
from botocore.exceptions import ClientError

# Set up logging with more detailed format
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DDB client
dynamodb = boto3.resource('dynamodb')
try:
    table_name = os.environ['DATA_ANALYZER_LOG_TABLE']
    table = dynamodb.Table(table_name)
    logger.debug(f"Successfully initialized DynamoDB table: {table_name}")
except KeyError:
    logger.critical("Environment variable DATA_ANALYZER_LOG_TABLE is not set")
    table = None
except Exception as e:
    logger.critical(f"Failed to initialize DynamoDB: {str(e)}")
    table = None

def create_error_response(action_group, function_name, message, status_code=400):
    """Helper function to create standardized error responses"""
    logger.error(f"Error response: {message}, status code: {status_code}")
    return {
        'actionGroup': action_group,
        'function': function_name,
        'functionResponse': {
            'responseBody': {
                'TEXT': {
                    "body": json.dumps({'error': message, 'status': status_code})
                }
            }
        }
    }

def lambda_handler(event, context):
    """Main Lambda handler function with comprehensive error handling and logging"""
    request_id = context.aws_request_id if context else "unknown"
    logger.info(f"Request ID: {request_id}")
    
    try:
        # Log the incoming event and context
        logger.info(f"Event: {json.dumps(event)}")
        
        # Extract required fields with validation
        try:
            agent = event.get('agent')
            action_group = event.get('actionGroup')
            function = event.get('function')
            message_version = event.get('messageVersion')
            parameters = event.get('parameters', [])
            
            # Extract required attributes from promptSessionAttributes
            prompt_session_attributes = event.get('promptSessionAttributes', {})
            file_name = prompt_session_attributes.get('file_name')
            batch_id = prompt_session_attributes.get('batch_id')
            data_content = prompt_session_attributes.get('data_content')
            
            # Validate file_name from promptSessionAttributes
            if not file_name:
                logger.error("file_name not found in promptSessionAttributes")
                return create_error_response(action_group, function, 
                                            "file_name is required in promptSessionAttributes", 400)
            
            # Validate batch_id from promptSessionAttributes
            if not batch_id:
                logger.error("batch_id not found in promptSessionAttributes")
                return create_error_response(action_group, function, 
                                            "batch_id is required in promptSessionAttributes", 400)
            
            logger.info(f"Found file_name: {file_name} from promptSessionAttributes")
            logger.info(f"Found batch_id: {batch_id} from promptSessionAttributes")
            
            # Validate required fields
            if not all([action_group, function, message_version]):
                missing_fields = [field for field, value in 
                                 {'actionGroup': action_group, 'function': function, 
                                  'messageVersion': message_version}.items() 
                                 if not value]
                raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")
                
        except (KeyError, TypeError) as e:
            logger.error(f"Invalid event structure: {str(e)}")
            return create_error_response("DataAnalyzer", "SaveSchema", 
                                        f"Invalid event structure: {str(e)}", 400)
        
        # Process parameters
        found_schema = False
        generated_schema = None
        
        # Extract schema from parameters
        for param in parameters:
            if param.get("name") == "generated_schema":
                generated_schema = param.get("value")
                found_schema = True
                logger.info(f"Found schema parameter")
                logger.info(f"Schema: {generated_schema}")

        # Validate schema parameter
        if not found_schema:
            logger.error("generated_schema parameter is required but not found")
            return create_error_response(action_group, function, 
                                        "generated_schema parameter is required", 400)
                                        
        # Update existing record in DynamoDB
        if table:
            try:
                # First check if the record exists
                timestamp = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
                
                logger.info(f"Checking for existing record with batch ID: {batch_id} and file_name: {file_name}")
                response = table.get_item(
                    Key={
                        'id': batch_id,
                        'file_name': file_name
                    }
                )
                
                # Update the record if it exists, otherwise return an error
                if 'Item' in response:
                    logger.info(f"Found existing record with batch ID: {batch_id} and file_name: {file_name}, updating schema only...")
                    
                    # Update only the schema field of the existing record
                    update_response = table.update_item(
                        Key={
                            'id': batch_id,
                            'file_name': file_name
                        },
                        UpdateExpression="SET #schema = :schema, #analyzed_data = :analyzed_data",
                        ExpressionAttributeNames={
                            '#schema': 'schema',
                            '#analyzed_data': 'analyzed_data'
                        },
                        ExpressionAttributeValues={
                            ':schema': generated_schema,
                            ':analyzed_data': data_content if data_content else "No data content available"
                        },
                        ReturnValues="UPDATED_NEW"
                    )
                    
                    logger.info(f"Successfully updated schema for record with batch ID: {batch_id} and file_name: {file_name}")
                    
                    # Prepare success response
                    response_body = {
                        "TEXT": {
                            "body": json.dumps({
                                "message": "Schema added to existing record successfully",
                                "batch_id": batch_id,
                                "file_name": file_name
                            })
                        }
                    }
                else:
                    # Record not found - log error and return error response
                    error_message = f"No record found with batch ID: {batch_id} and file_name: {file_name}"
                    logger.error(error_message)
                    return create_error_response(action_group, function, 
                                               error_message, 404)
                
            except ClientError as e:
                error_code = e.response['Error']['Code']
                error_message = e.response['Error']['Message']
                logger.error(f"DynamoDB ClientError: {error_code} - {error_message}")
                return create_error_response(action_group, function, 
                                           f"Database error: {error_code}", 500)
            except Exception as e:
                logger.error(f"Error saving to DynamoDB: {str(e)}")
                logger.error(traceback.format_exc())
                return create_error_response(action_group, function, 
                                           "Failed to save schema data", 500)
        else:
            logger.warning("DynamoDB table not initialized, skipping save operation")
            response_body = {
                "TEXT": {
                    "body": json.dumps({
                        "message": "Schema processed but not saved (database unavailable)",
                        "batch_id": batch_id
                    })
                }
            }
        
        # Create successful response
        action_response = {
            'actionGroup': action_group,
            'function': function,
            'functionResponse': {
                'responseBody': response_body
            }
        }
        
        agent_response = {'response': action_response, 'messageVersion': message_version}
        logger.info(f"Successfully processed request {request_id}")
        
        return agent_response
        
    except Exception as e:
        # Catch-all for any unhandled exceptions
        logger.critical(f"Unhandled exception: {str(e)}")
        logger.critical(traceback.format_exc())
        
        # Return a generic error response if we can't extract action_group and function
        action_group = event.get('actionGroup', 'DataAnalyzer')
        function = event.get('function', 'SaveSchema')
        message_version = event.get('messageVersion', '1.0')
        
        error_response = create_error_response(action_group, function, 
                                             "Internal server error", 500)
        
        return {'response': error_response, 'messageVersion': message_version}