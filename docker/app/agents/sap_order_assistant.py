from strands import Agent, tool
import requests
import json
import boto3
import os
from botocore.exceptions import ClientError

SAP_ORDER_SYSTEM_PROMPT = """You are an AI assistant specialized in retrieving and displaying SAP sales order information.

Your primary function is to read and provide information from SAP order data queries. You can view sales order details, delivery status, and billing information, but cannot create, modify, or delete any data.

You help users by accessing and explaining existing sales order information and checking order status. You understand SAP terminology and status codes but explain these to the user in business language.

For any modifications or new entries, politely decline and ask them to reach out to the SAP team."""

def get_secret():
    """Retrieve secret from AWS Secrets Manager"""
    secret_name = os.environ.get('SECRET_NAME', 'sap_api_credentials')
    
    session = boto3.session.Session()
    client = session.client(service_name='secretsmanager')
    
    try:
        response = client.get_secret_value(SecretId=secret_name)
        if 'SecretString' in response:
            return json.loads(response['SecretString'])
        return None
    except ClientError as e:
        print(f"Error retrieving secret: {e}")
        return None

def get_order_status(sales_order_id):
    """Get sales order status using SAP OData Service"""
    try:
        # Get credentials from AWS Secrets Manager
        secret_data = get_secret()
        if not secret_data:
            return "Failed to retrieve API credentials"
            
        sales_order_url = secret_data.get('sales_order_url')
        username = secret_data.get('username')
        password = secret_data.get('password')
        
        if not all([sales_order_url, username, password]):
            return "Missing required API credentials"
        
        # Build request
        base_url = sales_order_url.rstrip('/')
        order_url = f"{base_url}/A_SalesOrder('{sales_order_id}')?$format=json"
        
        headers = {
            "Content-Type": "application/json",
            "x-Requested-With": 'X'
        }
        
        # Make the request
        response = requests.get(
            order_url,
            headers=headers,
            timeout=30,
            auth=(username, password)
        )
        response.raise_for_status()
        
        if response.status_code == 200:
            data = response.json()
            return json.dumps(data.get('d', {}), indent=2)
        else:
            return f"Failed to get order. Status code: {response.status_code}"
            
    except Exception as e:
        return f"Error processing request: {str(e)}"

@tool
def sap_order_assistant(query: str) -> str:
    """SAP Order assistant for retrieving sales order information and status."""
    try:
        agent = Agent(
            system_prompt=SAP_ORDER_SYSTEM_PROMPT,
            tools=[get_order_status]
        )
        return agent(query)
    except Exception as e:
        return f"Error processing SAP order request: {str(e)}"
