import requests
import json
import boto3
import os
from botocore.exceptions import ClientError

def get_secret():
    """
    Retrieve secret from AWS Secrets Manager using environment variable
    """
    secret_name = os.environ.get('SECRET_NAME')
    
    # Create a Secrets Manager client
    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager'
    )
    
    try:
        get_secret_value_response = client.get_secret_value(
            SecretId=secret_name
        )
        
        # Decode and return the secret
        if 'SecretString' in get_secret_value_response:
            return json.loads(get_secret_value_response['SecretString'])
        else:
            return None
            
    except ClientError as e:
        print(f"Error retrieving secret: {e}")
        return None
#To Be Removed
def test():
    secret_data = get_secret("sap_api_credentials") 
    if not secret_data:
        return {
            'statusCode': 500,
            'body': json.dumps({'message': 'Failed to retrieve API credentials'})
        }
        
    # Extract credentials from secret
    sales_order_url = secret_data.get('sales_order_url')
    username = secret_data.get('username')
    password = secret_data.get('password')
    return(username)

def order_status(sales_order_id, sales_order_url, username, password):
    """
    Get sales order status using SAP OData Service
    """
    base_url = sales_order_url.rstrip('/')
    order_url = f"{base_url}/A_SalesOrder('{sales_order_id}')?$format=json"
    
    headers = {
        "Content-Type": "application/json",
        "x-Requested-With": 'X'
    }
    payload = {
        "SalesOrder": sales_order_id
    }
  
    # Make the GET request to fetch the sales order
    response = requests.get(
        order_url, 
        headers=headers,
        json=payload,
        timeout=30,
        auth=(username, password) if username and password else None
    )
    response.raise_for_status()
    
    print(f"Request URL: {order_url}")
    print(f"Request Headers: {headers}")
    print(f"Response Status Code: {response.status_code}")
    
    # Check the response and return result
    if response.status_code == 200:
        return response.text  # Return successful response
    else:
        return json.dumps({
            "status": "failure",
            "status_code": response.status_code,
            "error": "Failed to get order",
            "response_text": response.text
        })

def lambda_handler(event, context):
    """
    AWS Lambda function to get sales order status.
    
    Parameters:
    event (dict): The event containing sales order ID
    context (object): Lambda context object
    
    Returns:
    dict: API response with status code and body
    """
    try:
        # Get sales order ID from the event
        #sales_order_id = event.get('salesOrderId')
        sales_order_id = None
        for param in event['parameters']:
            if param['name'] == 'salesOrderId':
                sales_order_id = param['value']
                break
        print('sales order id given',sales_order_id)
        print(event)
        if not sales_order_id:
            return {
                'statusCode': 400,
                'body': json.dumps({'message': 'Sales Order ID is required'})
            }
            
        # Get credentials from AWS Secrets Manager
        secret_data = get_secret()
        
        if not secret_data:
            return {
                'statusCode': 500,
                'body': json.dumps({'message': 'Failed to retrieve API credentials'})
            }
            
        # Extract credentials from secret
        sales_order_url = secret_data.get('sales_order_url')
        username = secret_data.get('username')
        password = secret_data.get('password')
           
        # Get order status
        response = order_status(sales_order_id, sales_order_url, username, password)
        responsej=json.loads(response)
        print(responsej["d"])
        return {
            "messageVersion": "1.0",
            "response": {
                "actionGroup": event["actionGroup"],
                'function': event["function"],
                "functionResponse": {
            
            "responseBody": {
                "TEXT": { 
                    "body": json.dumps(responsej["d"])
                }
            }
            }
            }
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'message': f'Error processing request: {str(e)}'})
        }