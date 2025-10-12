import os
import json
import urllib3
import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
import logging

logger = logging.getLogger(__name__)

# Module level variables for connection caching
_graph_connection = None
_qa_chain = None

# Enhanced Cypher template with better rules and structure
CYPHER_CUSTOM_TEMPLATE = """<Instructions>
Generate the query in openCypher format and follow these rules:
1. Use undirected relationship for MATCH query.
2. Do not use `NONE`, `ALL` or `ANY` predicate functions, rather use list comprehensions.
3. Do not use `REDUCE` function. Rather use a combination of list comprehension and the `UNWIND` clause.
4. Do not use `FOREACH` clause. Rather use a combination of `WITH` and `UNWIND` clauses.
5. Use only the provided relationship types and properties in the schema.
6. Do not use any other relationship types or properties that are not provided.
7. Do not use new line.
</Instructions>

<schema>
{schema}
</schema>

Note: Do not include any explanations or apologies in your responses.
Do not respond to any questions that might ask anything else than for you to construct a Cypher statement.
Do not include any text except the generated Cypher statement.

The question is:
{question}
"""

CUSTOM_QA_TEMPLATE = """You are an assistant that helps to form nice and human understandable answers.
The information part contains the provided information that you must use to construct an answer.
The provided information is authoritative, you must never doubt it or try to use your internal knowledge to correct it.
Make the answer sound as a response to the question. 
Construct the text based on the information and result. Respond concisely using data tables or lists to present information when possible.

Information:
{context}

Question: {question}
Helpful Answer:"""

def get_graph_connection():
    """Initialize and return a Neptune graph connection with caching."""
    global _graph_connection
    
    if _graph_connection is None:
        neptune_host = os.environ.get('NEPTUNE_HOST')
        if not neptune_host:
            raise ValueError("Neptune host not configured. Set NEPTUNE_HOST environment variable.")
        
        neptune_port = int(os.environ.get('NEPTUNE_PORT', '8182'))
        
        logger.info(f'Initializing Neptune graph connection to {neptune_host}:{neptune_port}')
        
        try:
            from langchain_community.graphs import NeptuneGraph
            _graph_connection = NeptuneGraph(
                host=neptune_host,
                port=neptune_port,
                use_https=True,
                region_name=os.environ.get('AWS_REGION', 'us-east-1')
            )
            logger.info("Neptune connection established successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Neptune connection: {str(e)}")
            raise
    
    return _graph_connection

def get_qa_chain():
    """Initialize and return a QA chain with caching."""
    global _qa_chain
    
    if _qa_chain is None:
        logger.info('Initializing Neptune QA chain')
        
        try:
            from langchain_aws import ChatBedrockConverse
            from langchain.chains import NeptuneOpenCypherQAChain
            from langchain_core.prompts import PromptTemplate
            
            # Use dynamic Neptune model from app configuration
            try:
                from app import current_neptune_model
                llm_model = current_neptune_model
            except ImportError:
                # Fallback if import fails
                llm_model = os.environ.get('AGENT_MODEL', 'us.anthropic.claude-sonnet-4-20250514-v1:0')
            
            llm = ChatBedrockConverse(
                model=llm_model,
                temperature=0.01,  # Lower temperature for consistency
                max_tokens=4096,
                region_name=os.environ.get('AWS_REGION', 'us-east-1')
            )
            logger.info(f"LLM initialized with model: {llm_model}")

            # Get graph connection
            graph = get_graph_connection()
            
            # Create prompts
            qa_prompt = PromptTemplate(input_variables=["context", "question"], template=CUSTOM_QA_TEMPLATE)
            cypher_prompt = PromptTemplate(input_variables=["schema", "question"], template=CYPHER_CUSTOM_TEMPLATE)

            # Create the QA chain
            _qa_chain = NeptuneOpenCypherQAChain.from_llm(
                llm=llm,
                graph=graph,
                qa_prompt=qa_prompt,
                cypher_prompt=cypher_prompt,
                verbose=True,
                top_K=10,
                return_intermediate_steps=True,
                return_direct=False,
                allow_dangerous_requests=True
            )
            logger.info("Neptune QA chain successfully created")
            
        except Exception as e:
            logger.error(f"Failed to initialize QA chain: {str(e)}")
            raise
    
    return _qa_chain

def get_neptune_statistics():
    """
    Get Neptune property graph statistics including node and edge details.
    Returns database schema and summary information.
    """
    try:
        neptune_host = os.environ.get('NEPTUNE_HOST')
        if not neptune_host:
            return "Neptune host not configured. Set NEPTUNE_HOST environment variable."
        
        neptune_port = os.environ.get('NEPTUNE_PORT', '8182')
        region = os.environ.get('AWS_REGION', 'us-east-1')
        
        neptune_endpoint = f"https://{neptune_host}:{neptune_port}/propertygraph/statistics/summary?mode=basic"
        
        # Create a signed request
        session = boto3.Session()
        credentials = session.get_credentials()
        request = AWSRequest(method='GET', url=neptune_endpoint)
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
        
        if response.status == 200:
            resp = json.loads(response.data.decode('utf-8'))
            graph_summary = resp['payload']['graphSummary']
            last_updated = resp['payload']['lastStatisticsComputationTime']
            
            return f"""**Neptune Database Statistics**

**Last Updated:** {last_updated}

**Graph Summary:**
```json
{json.dumps(graph_summary, indent=2)}
```

**Status:** ✅ Successfully retrieved Neptune statistics"""
        
        else:
            error_msg = response.data.decode('utf-8')
            return f"Error retrieving Neptune statistics (HTTP {response.status}): {error_msg}"
            
    except Exception as e:
        logger.error(f"Neptune statistics error: {e}")
        return f"Error retrieving Neptune statistics: {str(e)}"

def execute_neptune_query(query: str):
    """
    Execute Cypher queries against Neptune using enhanced QA chain.
    """
    try:
        logger.info("Executing Neptune query with QA chain")
        
        # Get cached QA chain
        qa_chain = get_qa_chain()
        
        # Execute the query
        logger.info(f"Processing query: {query}")
        output = qa_chain.invoke(query)
        
        # Extract results and intermediate steps
        if 'intermediate_steps' in output and output['intermediate_steps']:
            cypher_query = output['intermediate_steps'][0].get('query', 'Query not available')
            result = output.get('result', 'No result available')
            
            return f"""**Generated Cypher Query:**
```cypher
{cypher_query}
```

**Query Results:**
{result}

**Status:** ✅ Successfully executed against Neptune cluster"""
        else:
            return f"""**Query Results:**
{output.get('result', 'No result available')}

**Status:** ✅ Successfully executed against Neptune cluster"""
        
    except Exception as e:
        logger.error(f"Neptune query execution error: {e}")
        
        # Fallback to direct query method
        try:
            from langchain_aws import ChatBedrockConverse
            
            # Use dynamic Neptune model from app configuration
            try:
                from app import current_neptune_model
                model_id = current_neptune_model
            except ImportError:
                # Fallback if import fails
                model_id = os.environ.get('AGENT_MODEL', 'us.anthropic.claude-sonnet-4-20250514-v1:0')
            
            llm = ChatBedrockConverse(
                model=model_id,
                temperature=0.01,
                region_name=os.environ.get('AWS_REGION', 'us-east-1')
            )
            
            cypher_prompt = f"""
            Convert this natural language question to a Cypher query for Neptune:
            Question: {query}
            
            Return only the Cypher query, no explanations.
            """
            
            cypher_query = llm.invoke(cypher_prompt).content.strip()
            
            # Clean the query - remove markdown code blocks
            cypher_query = cypher_query.replace('```cypher', '').replace('```', '').strip()
            
            logger.info(f"Generated fallback query: {cypher_query}")
            
            # Execute with direct graph connection
            graph = get_graph_connection()
            result = graph.query(cypher_query)
            
            return f"""**Generated Cypher Query:**
```cypher
{cypher_query}
```

**Query Results:**
```
{result}
```

**Status:** ✅ Successfully executed against Neptune cluster (fallback mode)"""
            
        except Exception as fallback_error:
            logger.error(f"Fallback query execution failed: {fallback_error}")
            return f"Error executing Neptune query: {str(e)}"

def get_bulk_load_status(load_id: str = None):
    """
    Check the status of Neptune bulk load operations.
    """
    try:
        neptune_host = os.environ.get('NEPTUNE_HOST')
        if not neptune_host:
            return "Neptune host not configured. Set NEPTUNE_HOST environment variable."
        
        neptune_port = os.environ.get('NEPTUNE_PORT', '8182')
        region = os.environ.get('AWS_REGION', 'us-east-1')
        
        if load_id:
            endpoint = f"https://{neptune_host}:{neptune_port}/loader/{load_id}?details=true&errors=true&page=1&errorsPerPage=1000"
        else:
            endpoint = f"https://{neptune_host}:{neptune_port}/loader"
        
        # Create a signed request
        session = boto3.Session()
        credentials = session.get_credentials()
        request = AWSRequest(method='GET', url=endpoint)
        SigV4Auth(credentials, 'neptune-db', region).add_auth(request)
        
        # Send the request
        http = urllib3.PoolManager()
        response = http.request(
            'GET',
            request.url,
            headers=dict(request.headers)
        )
        
        if response.status == 200:
            resp = json.loads(response.data.decode('utf-8'))
            return f"""**Neptune Bulk Load Status**

```json
{json.dumps(resp, indent=2)}
```

**Status:** ✅ Successfully retrieved bulk load status"""
        else:
            error_msg = response.data.decode('utf-8')
            return f"Error retrieving bulk load status (HTTP {response.status}): {error_msg}"
            
    except Exception as e:
        logger.error(f"Bulk load status error: {e}")
        return f"Error retrieving bulk load status: {str(e)}"

def start_bulk_load(source_s3_prefix: str):
    """
    Start a Neptune bulk load operation from S3 via Lambda function.
    
    Args:
        source_s3_prefix: The S3 prefix/folder to load data from (e.g., "processed/2024-01-01/")
    """
    try:
        # Call the Lambda function instead of directly calling Neptune
        lambda_client = boto3.client('lambda')
        lambda_function_name = 'AI-Data-Explorer-Data-Loader'
        
        # Create agent-style payload for the Lambda
        payload = {
            'agent': 'graph-assistant',
            'actionGroup': 'neptune-tools',
            'function': 'start_bulk_load',
            'parameters': [
                {
                    'name': 'prefix',
                    'value': source_s3_prefix.strip('/')
                }
            ],
            'messageVersion': '1.0'
        }
        
        response = lambda_client.invoke(
            FunctionName=lambda_function_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(payload)
        )
        
        if response['StatusCode'] == 200:
            result = json.loads(response['Payload'].read())
            
            # Extract the actual response from the Lambda response structure
            if isinstance(result, dict) and 'response' in result:
                lambda_response = result['response']
                if 'functionResponse' in lambda_response and 'responseBody' in lambda_response['functionResponse']:
                    response_body = lambda_response['functionResponse']['responseBody']
                    if 'TEXT' in response_body:
                        return response_body['TEXT']['body']
            
            # Fallback to raw result if structure is different
            return str(result)
        else:
            return f"Error calling Lambda function: HTTP {response['StatusCode']}"
            
    except Exception as e:
        logger.error(f"Bulk load Lambda call error: {e}")
        return f"Error starting bulk load via Lambda: {str(e)}"
