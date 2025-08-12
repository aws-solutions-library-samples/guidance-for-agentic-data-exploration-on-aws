import boto3
import os

client = boto3.client('bedrock-agent')


def lambda_handler(event, context):

    response = client.start_ingestion_job(
        dataSourceId=os.environ['KB_DATA_SOURCE_ID'],
        knowledgeBaseId=os.environ['KB_ID']
    )

    print(response)