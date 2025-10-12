import boto3
import botocore.exceptions
import json
import csv
import datetime
import re
import os
from datetime import datetime
from io import StringIO
import logging
from urllib import parse
import time
import random

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Get environment variables
QUEUE_URL = os.environ.get('QUEUE_URL')
DATA_LOADER_BUCKET = os.environ.get('S3_LOADER_BUCKET')
MAX_RETRIES = int(os.environ.get('MAX_RETRIES', '8'))
BASE_BACKOFF_SECONDS = float(os.environ.get('BASE_BACKOFF_SECONDS', '10.0'))
MAX_BACKOFF_SECONDS = float(os.environ.get('MAX_BACKOFF_SECONDS', '100.0'))
JITTER_FACTOR = float(os.environ.get('JITTER_FACTOR', '0.25'))
VISIBILITY_TIMEOUT = int(os.environ.get('VISIBILITY_TIMEOUT', '30'))
MSG_DELAY = int(os.environ.get('MSG_DELAY', '0'))  # Removed delay
MAX_MESSAGES = int(os.environ.get('MAX_MESSAGES', '10'))  # Process more messages per batch
WAIT_TIME_SECONDS = int(os.environ.get('WAIT_TIME_SECONDS', '1'))  # Reduce long polling wait

s3 = boto3.client('s3')     
sqs = boto3.client('sqs')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['ETL_LOG_TABLE'])

# handler function
def lambda_handler(event, context):
    logger.info(f"Event: {event}")

    try:
        # Process messages with backoff
        processed_messages = receive_messages_with_backoff()
        
        # Return results
        return {
            'statusCode': 200,
            'body': json.dumps({
                'processed_message_count': len(processed_messages),
                'message_ids': [msg['MessageId'] for msg in processed_messages]
            })
        }
        
    except Exception as e:
        logger.error(f"Unhandled exception: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }


def identify_and_format_dates(csv_record: dict) -> dict:
    """
    Identifies date fields in a CSV record and reformats them to ISO-8601 format.
    If a field is identified as a date column but contains invalid date data, sets value to NULL.
    
    Args:
        csv_record (dict): A dictionary representing one record from a CSV file
        
    Returns:
        dict: The record with dates reformatted to ISO-8601 and invalid dates set to NULL
    """
    
    # Common date patterns to check
    date_patterns = [
        # MM/DD/YYYY or DD/MM/YYYY
        r'^\d{1,2}/\d{1,2}/\d{2,4}$',
        # YYYY/MM/DD
        r'^\d{4}/\d{1,2}/\d{1,2}$',
        # DD-MM-YYYY or MM-DD-YYYY or YYYY-MM-DD
        r'^\d{1,2}-\d{1,2}-\d{4}$',
        r'^\d{4}-\d{1,2}-\d{1,2}$',
        # Datetime patterns
        r'^\d{4}-\d{1,2}-\d{1,2}[T\s]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?([+-]\d{2}:?\d{2}|Z)?$',
        r'^\d{1,2}/\d{1,2}/\d{2,4}\s+\d{1,2}:\d{2}(:\d{2})?(\s*[AaPp][Mm])?$',
        r'^\d{1,2}-\d{1,2}-\d{4}\s+\d{1,2}:\d{2}(:\d{2})?$'
    ]
    
    # Date-indicating keywords in field headers
    date_keywords = ['date', 'dt', 'time', 'created', 'modified', 'timestamp']
    
    # Compile patterns for better performance
    compiled_patterns = [re.compile(pattern) for pattern in date_patterns]
    
    # Common date formats to try parsing
    date_formats = [
        ('%m/%d/%Y', 'date'),
        ('%m/%d/%y', 'date'),
        ('%d/%m/%Y', 'date'),
        ('%d/%m/%y', 'date'),
        ('%Y-%m-%d', 'date'),
        ('%m-%d-%Y', 'date'),
        ('%d-%m-%Y', 'date'),
        ('%Y/%m/%d', 'date'),
        ('%m/%d/%Y %I:%M %p', 'datetime'),
        ('%m/%d/%Y %H:%M', 'datetime'),
        ('%m/%d/%Y %H:%M:%S', 'datetime'),
        ('%Y-%m-%d %H:%M:%S', 'datetime'),
        ('%Y-%m-%dT%H:%M:%S', 'datetime'),
        ('%Y-%m-%dT%H:%M:%SZ', 'datetime'),
        ('%d-%m-%Y %H:%M:%S', 'datetime')
    ]
    
    def is_date(value: str) -> bool:
        """Check if a string matches any date pattern"""
        return any(pattern.match(str(value)) for pattern in compiled_patterns)
    
    def is_date_column(column_name: str) -> bool:
        """Check if the column name indicates it contains dates"""
        return any(keyword in column_name.lower() for keyword in date_keywords)
    
    def parse_and_format_date(value: str) -> str:
        """
        Try to parse a string as a date and format it to ISO-8601.
        Returns None if parsing fails.
        """
        value = value.strip()
        
        for fmt, type_ in date_formats:
            try:
                parsed_date = datetime.strptime(value, fmt)
                # If it's a datetime format or contains time components
                if type_ == 'datetime' or 'T' in value or ':' in value:
                    return parsed_date.strftime('%Y-%m-%dT%H:%M:%S')
                return parsed_date.strftime('%Y-%m-%d')
            except ValueError:
                continue
        return None

    # Process the record
    formatted_record = {}
    for key, value in csv_record.items():
        if value and isinstance(value, str):
            # If it's a date column based on header
            if is_date_column(key):
                formatted_value = parse_and_format_date(value.strip())
                formatted_record[key] = formatted_value if formatted_value else None
            # If it matches a date pattern
            elif is_date(value.strip()):
                formatted_record[key] = parse_and_format_date(value.strip())
            else:
                formatted_record[key] = value
        else:
            formatted_record[key] = value
            
    return formatted_record

# Process an individual SQS message
def process_message(message):

    # Ignore s3 test events
    if 'Event' in message['Body'] and 's3:TestEvent' in message['Body']:
        logger.info("Ignoring s3:TestEvent")
        return True

    # Extract message body
    message_body = message['Body']
    message_id = message['MessageId']
    logger.info(f"Processing message {message_id}")
    
    # Parse JSON to get bucket/key
    payload = json.loads(message_body)
    logger.info(f"S3 Event payload: {payload}")
    key = payload['Records'][0]['s3']['object']['key']
    logger.info(f"Processing File: {key}")
    response = s3.get_object(Bucket=DATA_LOADER_BUCKET, Key=parse.unquote_plus(key))

    # get contents of file
    file_content = response['Body'].read().decode('utf-8')

    # Maintain line breaks - get first 50 lines
    lines = file_content.splitlines(keepends=True)[:50]
    processed_content = ''.join(lines)

    # get the file name from the key
    file_name = key.split('/')[-1]

    # Create JSON object and store processed content
    user_input = {
        "records": processed_content,
        "file_name": file_name,
        "graph_schema": "public/schema/graph.txt"
    }

    # Invoke Bedrock flow 
    flowIdentifier = os.environ['FLOW_IDENTIFIER']
    flowAliasIdentifier = os.environ['FLOW_ALIAS_IDENTIFIER']
    logger.info(f"Invoking flow: {flowIdentifier} | {flowAliasIdentifier}")
    logger.info(f"User input: {user_input}")

    client_runtime = boto3.client('bedrock-agent-runtime')
    try:
        response = client_runtime.invoke_flow(
            flowIdentifier=flowIdentifier,
            flowAliasIdentifier=flowAliasIdentifier,
            inputs=[{
                "content": {
                    "document": user_input
                },
                "nodeName": "FlowInput",
                "nodeOutputName": "document"
            }]
        )
    except Exception as e:
        logger.error(f"[ERROR] Error invoking flow: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps('[ERROR] Error invoking flow | ' + str(e))
        }
    
    # Response
    flow_failed = False
    try:
        result = {}
        output = {}
        for event in response.get("responseStream"):
            chunk = event
            if 'flowOutputEvent' in chunk:
                output_event = chunk['flowOutputEvent']
                node_name = output_event['nodeName']
                output_content = output_event['content']
                output[node_name] = output_content
          
            result.update(chunk)
        logger.info(output)

        if result['flowCompletionEvent']['completionReason'] == 'SUCCESS':
            logger.info("Flow invocation was successful!")
            flowresult = output['HeadersOutput']['document']
            flowresult = json.loads(flowresult)
            logger.debug(flowresult)

            original_headers = flowresult['originalHeaders']
            new_headers = flowresult['transformedHeaders']
            node_label = flowresult['nodeLabel']
            node_unique_id = flowresult['uniqueIdentifier']
            edgesresult = output['EdgesOutput']['document']

            # Create StringIO objects for processing
            input_csv = StringIO(file_content)
            output_csv = StringIO()

            # Read the CSV content
            csv_reader = csv.reader(input_csv)
            csv_writer = csv.writer(output_csv)

            # Skip the original header
            next(csv_reader)
            
            # Write new header
            csv_writer.writerow(new_headers)

            # Process each row, format dates, and add the new Label field
            for row in csv_reader:
                if not row:   # Skip blank rows
                    continue

                # Identify and format dates in the row
                formatted_row = identify_and_format_dates({original_headers[i]: value for i, value in enumerate(row)})
                # convert dict to csv row
                updated_row = [formatted_row[header] for header in original_headers]
                # write row with new field
                csv_writer.writerow(updated_row + [node_label])

            # Upload processed file to destination bucket
            row_count = len(output_csv.getvalue().splitlines()) - 1
            output_key = f"output/v/v_{node_label}_{str(row_count)}.csv"
            
            # Put the object on S3
            s3.put_object(
                Bucket=DATA_LOADER_BUCKET,
                Key=output_key,
                Body=output_csv.getvalue()
            )
            
            result_msg = f"Vertices: {output_key}\n"

            edgesresult = output['EdgesOutput']['document']
            logger.info(f"Possible Edges: {edgesresult}")
            
            # create another csv writer
            edge_csv = StringIO()
            csv_writer = csv.writer(edge_csv)
            # write the header
            csv_writer.writerow([':START_ID',':TYPE',':END_ID'])

            # Reset the cursor position to the beginning
            input_csv.seek(0)

            # Get original CSV input and convert to dictionary
            v_reader = csv.DictReader(input_csv)
            dict_list = list(v_reader)

            # get edge definitions
            edge = json.loads(edgesresult)
            edge_def = edge['edge_definitions']

            # Iterate through the original csv file
            for row in dict_list:
                # logger.info(f"Row: {row}")
                # iterate through edge_def
                for e in edge_def:
                    # logger.info(f"Edge: {e}")
                    source_id, relationship, target_id = e.split(',')
                    
                    # Check if these are valid indices
                    if source_id not in row or target_id not in row:
                        # logger.info(f"Invalid index: source={source_id}, target={target_id}")
                        continue
                    else:
                        edge_record = [row[source_id],relationship,row[target_id]]
                        # logger.info(edge_record)
                        csv_writer.writerow(edge_record)

            # Upload processed file to destination bucket
            edge_count = len(edge_csv.getvalue().splitlines()) - 1
            edge_output_key = ""
            
            # Put the object on S3
            if edge_count > 0:
                edge_output_key = f"output-edges/e_{node_label}_{str(edge_count)}.csv"
                s3.put_object(
                    Bucket=DATA_LOADER_BUCKET,
                    Key=edge_output_key,
                    Body=edge_csv.getvalue()
                )

                result_msg = result_msg + f" | Edges: {edge_output_key}\n"
                
            logger.info(result_msg)    

            # save flow results to a dynamodb table
            table.put_item(Item={
                'id': message_id,
                'timestamp': str(datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")),
                'file_name': file_name,
                'original_headers': original_headers,
                'node_label': node_label,
                'unique_id': node_unique_id,
                'new_headers': new_headers,
                'edges': edgesresult,
                'output_key': output_key,
                'row_count': row_count,
                'edge_output_key': edge_output_key,
                'edge_count': edge_count,
                'status_code': '200',
                'status_message': result_msg
            })

            return True

        else:
            logger.error(f"The invocation completed because of the following reason: {result['flowCompletionEvent']['completionReason']}")
            return False
            
    except botocore.exceptions.ClientError as e:

        flow_failed = True

        if e.response['Error']['Code'] == 'dependencyFailedException' and '429' in str(e):
            # Handling Bedrock throttling
            err_msg = f"[ERROR] Bedrock API rate limit exceeded (429)."
            err_code = 429
            logger.error(err_msg)
            return False
        else:
            # handle other ClientErrors
            err_msg = f"[ERROR] AWS Client Error: {str(e)}"
            err_code = 500
            logger.error(err_msg)
            return False            
    except Exception as e:
        flow_failed = True
        err_msg = f"[ERROR] Error processing response: {str(e)}"
        err_code = 500
        logger.error(err_msg)

        return False
    finally:
        if flow_failed:
            # save flow failure to a dynamodb table
            table.put_item(Item={
                'id': f"{message_id}-{int(time.time())}",                
                'timestamp': str(datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")),
                'file_name': file_name,
                'status_message': err_msg,
                'status_code': err_code
            })

# Receive messages from SQS with exponential backoff for retries
def receive_messages_with_backoff():
    retry_count = 0
    processed_messages = []
    
    while retry_count <= MAX_RETRIES:
        try:
            # Receive messages from SQS queue
            response = sqs.receive_message(
                QueueUrl=QUEUE_URL,
                AttributeNames=['All'],
                MessageAttributeNames=['All'],
                MaxNumberOfMessages=MAX_MESSAGES,
                VisibilityTimeout=VISIBILITY_TIMEOUT,
                WaitTimeSeconds=WAIT_TIME_SECONDS
            )
            
            # Reset retry count on successful API call
            retry_count = 0
            
            # Check if any messages were received
            if 'Messages' not in response:
                logger.info("No messages available in the queue")
                return processed_messages
            
            messages = response['Messages']
            logger.info(f"Received {len(messages)} messages")
            
            # Process each message
            for message in messages:
                if process_message(message):
                    # Delete message from queue if processing was successful
                    if delete_message(message['ReceiptHandle']):
                        processed_messages.append(message)
                    else:
                        logger.warning(f"Failed to delete message {message['MessageId']}")
                else:
                    logger.warning(f"Failed to process message {message['MessageId']}")
                    # Note: We don't delete failed messages, allowing them to return to the queue
                    # after the visibility timeout expires
                
            # Return processed messages
            return processed_messages
            
        except botocore.exceptions.ClientError as e:
            retry_count += 1
            error_code = e.response.get('Error', {}).get('Code')
            
            # Handle specific error types differently
            if error_code == 'ThrottlingException':
                logger.warning(f"Request throttled, retry {retry_count} of {MAX_RETRIES}")
            elif error_code == 'RequestThrottled':
                logger.warning(f"Request throttled, retry {retry_count} of {MAX_RETRIES}")
            else:
                logger.error(f"Error receiving messages: {str(e)}, retry {retry_count} of {MAX_RETRIES}")
            
            # If we've reached max retries, give up
            if retry_count > MAX_RETRIES:
                logger.error(f"Maximum retries ({MAX_RETRIES}) reached, giving up")
                return processed_messages
            
            # Calculate and apply backoff
            backoff_time = calculate_backoff(retry_count)
            logger.info(f"Backing off for {backoff_time:.2f} seconds before retry")
            time.sleep(backoff_time)
    
    return processed_messages

# Calculate backoff time with exponential growth and jitter
def calculate_backoff(retry_count):
    # Calculate exponential backoff
    backoff = min(MAX_BACKOFF_SECONDS, BASE_BACKOFF_SECONDS * (2 ** (retry_count - 1)))
    
    # Add jitter to avoid thundering herd problem
    jitter = backoff * JITTER_FACTOR * random.random() # nosec B311
    
    logger.info(f"Backoff time: {backoff} + jitter: {jitter}")
    # Return backoff with jitter
    return backoff + jitter

# Delete a message from the queue after successful processing
def delete_message(receipt_handle):
    try:
        sqs.delete_message(
            QueueUrl=QUEUE_URL,
            ReceiptHandle=receipt_handle
        )
        return True
    except botocore.exceptions.ClientError as e:
        logger.error(f"Error deleting message: {str(e)}")
        return False
