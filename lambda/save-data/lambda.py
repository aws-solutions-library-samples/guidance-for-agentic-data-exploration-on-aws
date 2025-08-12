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

# handler function
def lambda_handler(event, context):
    logger.info(f"Event: {event}")
    
    loader_bucket = os.environ['S3_LOADER_BUCKET']
    region = os.environ.get('AWS_REGION')

    agent = event['agent']
    actionGroup = event['actionGroup']
    function = event['function']
    parameters = event.get('parameters', [])

    # Get the user query from the event
    if 'inputText' not in event: 
        logger.error("Input is required")
        return {
            'actionGroup': actionGroup,
            'function': function,
            'functionResponse': {
                'responseBody': {
                    'TEXT': {
                        "body": json.dumps('Input is required')
                    }
                }
            }
        }
    
    # Get SynthData from params
    generatedData = ''
    for param in parameters:
        if param.get("name") == "synthData":
            generatedData = param.get("value")
            logger.info(f"Data: {generatedData}")

    # split the generatedData string into lines
    lines = generatedData.split('\n')
    #strip lines with ```
    lines = [line for line in lines if not line.strip().startswith('```')]

    # Initialize the JSON object to store the data
    json_data = {}
    files_created = []

    # iterate through the lines
    i = 0
    while i < len(lines):
        csv_data = io.StringIO()
        csv_writer = csv.writer(csv_data)

        if lines[i].endswith('.csv'):
            csv_name = lines[i].strip().lstrip('# ')            

            # get the next row of columns headers
            header_row = lines[i+1].strip()
            i += 2  # move to the first data row

            # Write the data rows
            while i < len(lines) and lines[i].strip() != '':
                # data = lines[i].strip().split(',')
                data = next(csv.reader([lines[i].strip()]))
                csv_writer.writerow(data)
                i += 1

            # Replace \r\n with actual carriage returns and line breaks
            csv_string = re.sub(r'\\r\\n', '\r\n', header_row + '\r\n' + csv_data.getvalue())

            # Store the CSV data in the JSON object
            json_data[csv_name] = csv_string
            
        else:
            i += 1

        csv_data.close()

    time_now = datetime.datetime.now().strftime("%Y-%m-%d_%H:%M:%S")

    # iterate through the json_data and save files to S3
    logger.info(json_data)
    for key, value in json_data.items():
        # save to value to s3 using file name as key
        s3 = boto3.client('s3')

        # is it a vertex or edge?
        file_prefix = key[0].lower()  # Gets 'v' or 'e'
        filekey = f"synthetic/{time_now}/{file_prefix}/{key}"
        s3.put_object(Bucket=loader_bucket, Key=filekey, Body=value)

        files_created.append(f"Saved {loader_bucket}/{filekey}\n")
    
    file_list = ('\n'.join(files_created))
    logger.info(file_list)

    # combine data and file output
    results = f"## Files generated:\n\n {file_list}  {generatedData}"

    responseBody =  {
        "TEXT": {
            "body": json.dumps(results)
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
