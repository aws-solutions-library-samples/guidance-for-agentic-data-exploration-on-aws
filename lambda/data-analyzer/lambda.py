import boto3
import json
import os
import logging
from datetime import datetime

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize S3 client
s3 = boto3.client('s3')

# Initialize DDB client
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['DATA_ANALYZER_LOG_TABLE'])

def lambda_handler(event, context):
    logger.info(f"Event: {event}")

    agent = event['agent']
    actionGroup = event['actionGroup']
    function = event['function']
    parameters = event.get('parameters', [])
    foundPrefix = False
    prefix = ''

    # Get prefix from params
    for param in parameters:
        if param.get("name") == "prefix":
            prefix = param.get("value")
            foundPrefix = True
            logger.info(f"Prefix: {prefix}")

    # Get the user query from the event
    if not foundPrefix: 
        logger.error("Prefix parameter is required")
        return {
            'actionGroup': actionGroup,
            'function': function,
            'functionResponse': {
                'responseBody': {
                    'TEXT': {
                        "body": json.dumps('Prefix parameter is required')
                    }
                }
            }
        }

    # Initial byte range to fetch
    INITIAL_BYTES = 2048

    # Environment variables
    bucket = os.environ['S3_LOADER_BUCKET']

    results = []
    paginator = s3.get_paginator('list_objects_v2')
    pages = paginator.paginate(Bucket=bucket, Prefix=prefix)
    
    try:
        for page in pages:
            if 'Contents' in page:
                for obj in page['Contents']:
                    file_name = obj['Key']
                    file_size = obj['Size']
                    
                    try:
                        # If file is empty, skip it
                        if file_size == 0:
                            continue
                            
                        # If file is smaller than INITIAL_BYTES, just get the whole file
                        if file_size <= INITIAL_BYTES:
                            response = s3.get_object(
                                Bucket=bucket,
                                Key=file_name
                            )
                        else:
                            response = s3.get_object(
                                Bucket=bucket,
                                Key=file_name,
                                Range=f'bytes=0-{INITIAL_BYTES-1}'  # Range is 0-based
                            )
                        
                        content = response['Body'].read().decode('utf-8-sig')  # Remove BOM if present
                        lines = content.split('\n')
                        
                        # If we need more lines and the file is bigger
                        if len(lines) < 11 and file_size > INITIAL_BYTES:
                            # Try with a larger chunk
                            larger_chunk = min(file_size, INITIAL_BYTES * 4)
                            response = s3.get_object(
                                Bucket=bucket,
                                Key=file_name,
                                Range=f'bytes=0-{larger_chunk-1}'
                            )
                            content = response['Body'].read().decode('utf-8-sig')  # Remove BOM if present
                            lines = content.split('\n')
                        
                        # Get first 11 lines or all lines if file is shorter
                        first_11_lines = '\n'.join(lines[:11])
                        
                        # Add file as an object with file_name and data properties
                        results.append({
                            "file_name": file_name,
                            "data": first_11_lines
                        })
                        
                    except Exception as file_error:
                        # Log error for this specific file but continue processing others
                        logger.error(f"Error processing file {file_name}: {str(file_error)}")
                        results.append({
                            "file_name": file_name,
                            "error": str(file_error)
                        })
        
        # logger.info(f"Results: {results}")

        # Calculate the total size of all files and determine how much data we can include per file
        total_files = len(results)
        max_response_size = 8 * 1024  # 8KB limit to stay well under token limits
        
        # First, calculate the size of fixed content (headers, batch ID, etc.)
        fixed_content = f"Here are the {total_files} files gathered for analysis:\n\n\n\nBatch ID: {context.aws_request_id}"
        fixed_content_size = len(fixed_content.encode('utf-8'))
        
        # Calculate available size for file data
        available_size = max_response_size - fixed_content_size
        logger.info(f"Available size for file data: {available_size} bytes")
        
        # If we have multiple files, allocate space proportionally
        if total_files > 0:
            # For large datasets, we need to be more aggressive with limiting data
            if total_files > 5:
                # For many files, just include headers and 1-2 sample rows per file
                max_lines_per_file = 3
                logger.info(f"Large dataset detected ({total_files} files). Limiting to {max_lines_per_file} lines per file.")
            else:
                # For fewer files, we can include more data per file
                bytes_per_file = available_size // total_files
                max_lines_per_file = 10
                logger.info(f"Small dataset detected ({total_files} files). Target bytes per file: {bytes_per_file}")
            
            # Process each file to fit within its allocation
            results_str = ""
            for result in results:
                file_name = result['file_name']
                data_lines = result['data'].split('\n')
                
                # Start with header for this file
                file_header = f"File: {file_name}\r\n"
                
                # Always include the first line (headers)
                processed_data = ""
                if len(data_lines) > 0:
                    processed_data += data_lines[0] + "\r\n"
                
                # Add a limited number of data rows
                lines_to_include = min(len(data_lines) - 1, max_lines_per_file - 1)
                for i in range(1, lines_to_include + 1):
                    processed_data += data_lines[i] + "\r\n"
                
                # Add error if present
                error_data = ""
                if 'error' in result:
                    error_data = f"Error: {result['error']}\r\n"
                
                # Combine all parts
                file_content = file_header + processed_data + error_data + "\r\n"
                results_str += file_content
                
                # Log the size of this file's content
                file_size = len(file_content.encode('utf-8'))
                logger.info(f"File {file_name}: {file_size} bytes, {lines_to_include + 1} of {len(data_lines)} lines included")
        
        # Log the final size of the results string
        final_size = len(results_str.encode('utf-8'))
        logger.info(f"Final results_str size: {final_size} bytes for {total_files} files")

        try:
            # save analysis results to a dynamodb table
            table.put_item(Item={
                'id': context.aws_request_id,
                'timestamp': str(datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")),
                'file_name': prefix,
                'file_count': len(results),
                'results': results_str,
            })
        except Exception as e:
            logger.error(f"Error saving to DynamoDB for request {context.aws_request_id}: {str(e)}")

        # Include the actual data content in the response for the agent to analyze
        response_body_str = f"There are the {len(results)} files gathered for analysis (showing headers and sample rows for each):\n\n{results_str}\n\nBatch ID: {context.aws_request_id}"
        response_body_size = len(response_body_str.encode('utf-8'))
        logger.info(f"Response body size: {response_body_size} bytes")
        
        responseBody = {
            "TEXT": {
                "body": response_body_str
            }
        }

        action_response = {
            'actionGroup': actionGroup,
            'function': function,
            'functionResponse': {
                'responseBody': responseBody
            }
        }        

        # Store a summary in promptSessionAttributes if the data is too large
        prompt_session_data = results_str
        prompt_session_data_size = len(prompt_session_data.encode('utf-8'))
        
        logger.info(f"Prompt session data size: {prompt_session_data_size} bytes")
        
        # Since we've already optimized the data to fit within size constraints,
        # we can use the same data for promptSessionAttributes
        agent_response = {
            'response': action_response, 
            'messageVersion': event['messageVersion'],
            'promptSessionAttributes': {
                'batch_id': context.aws_request_id,
                'file_name': prefix,
                'data_content': prompt_session_data
            }
        }
        print("Response: {}".format(function))

        return agent_response
        
    except Exception as e:
        msg = f'Error processing files: {str(e)}'
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
            'messageVersion': event['messageVersion'],
            'promptSessionAttributes': {
                'error': 'true'
            }
        }        
