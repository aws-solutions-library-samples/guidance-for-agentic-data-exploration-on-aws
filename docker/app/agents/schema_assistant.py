from strands import Agent, tool
from .model_utils import get_current_model
import boto3
import uuid
from datetime import datetime, timezone
import os

SCHEMA_TRANSLATOR_SYSTEM_PROMPT = """
You are a database schema conversion specialist that converts relational schemas to graph schemas, focusing solely on relationships between entities.

WORKFLOW:
1. Analyze the relational schema to identify tables and foreign keys
2. Convert each table to a vertex and each foreign key to an edge
3. Follow exact edge direction rules: FK table → referenced table
4. Output in exact format: [Vertex] —(edge)→ [Vertex]

CONVERSION RULES:
- Each table becomes a vertex (node)
- Each foreign key becomes an edge
- Edge direction: FROM entity containing FK TO referenced entity
- Example: If Products has component_id FK referencing Components:
  CORRECT: [Product] —(CONTAINS)→ [Component]
- Ignore all properties, data types, constraints
- Generate only relationships, no explanations

OUTPUT FORMAT:
[Vertex] —(edge)→ [Vertex]
[Vertex] —(edge)→ [Vertex]

Generate only the graph model with no additional text.
"""

DATA_ANALYZER_SYSTEM_PROMPT = """
You are a database schema analyst that generates complete relational database schemas based on sample data analysis.

ANALYSIS STEPS:
1. Examine sample data to identify distinct entities (tables)
2. For each entity, determine fields, data types, and primary keys
3. Identify relationships and foreign keys between entities
4. Generate complete SQL CREATE TABLE schema

REQUIREMENTS:
- Include only tables/fields present in sample data
- Use appropriate data types (VARCHAR, INTEGER, DATETIME, DECIMAL, etc.)
- Define primary keys and foreign key relationships
- Match source data structure and naming conventions
- Handle nullable fields appropriately

Return the complete generated schema in SQL CREATE TABLE format.
"""

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')

# Get table names from environment variables
DATA_ANALYZER_LOG_TABLE = os.environ.get('DATA_ANALYZER_LOG_TABLE', 'AI-Data-Explorer-Data-Analyzer-Log')
SCHEMA_TRANSLATOR_LOG_TABLE = os.environ.get('SCHEMA_TRANSLATOR_LOG_TABLE', 'AI-Data-Explorer-Schema-Translator-Log')

def log_to_dynamodb(table_name: str, log_data: dict):
    """Log operation results to DynamoDB table"""
    try:
        table = dynamodb.Table(table_name)
        table.put_item(Item=log_data)
    except Exception as e:
        print(f"Failed to log to DynamoDB: {str(e)}")

@tool
def schema_translator(query: str) -> str:
    """
    Convert relational database schema to graph model with specific edge direction rules.
    
    Args:
        query: SQL DDL script or schema description
        
    Returns:
        Graph model in format: [Vertex] —(edge)→ [Vertex]
    """
    formatted_query = f"Convert this relational schema to graph model following the exact rules. Output only the relationships in the specified format with no explanations:\n\n{query}"
    
    try:
        print("Routed to Schema Translator")
        schema_agent = Agent(
            system_prompt=SCHEMA_TRANSLATOR_SYSTEM_PROMPT,
            model=get_current_model(),
        )
        agent_response = schema_agent(formatted_query)
        response_str = str(agent_response)
        
        # Log to DynamoDB
        log_data = {
            'id': str(uuid.uuid4()),
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'input_query': query,
            'output_result': response_str,
            'status': 'success'
        }
        log_to_dynamodb(SCHEMA_TRANSLATOR_LOG_TABLE, log_data)
        
        return response_str
    except Exception as e:
        error_msg = f"Error processing schema conversion: {str(e)}"
        
        # Log error to DynamoDB
        log_data = {
            'id': str(uuid.uuid4()),
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'input_query': query,
            'output_result': error_msg,
            'status': 'error'
        }
        log_to_dynamodb(SCHEMA_TRANSLATOR_LOG_TABLE, log_data)
        
        return error_msg

@tool
def data_analyzer(sample_data: str) -> str:
    """
    Analyze sample data and generate a complete relational database schema.
    
    Args:
        sample_data: Sample data files or data descriptions to analyze
        
    Returns:
        Complete SQL schema with CREATE TABLE statements
    """
    formatted_query = f"Analyze this sample data and generate a complete relational database schema:\n\n{sample_data}"
    
    try:
        print("Routed to Data Analyzer")
        analyzer_agent = Agent(
            system_prompt=DATA_ANALYZER_SYSTEM_PROMPT,
            model=get_current_model(),
        )
        agent_response = analyzer_agent(formatted_query)
        response_str = str(agent_response)
        
        # Generate file details instead of trying to extract filename
        line_count = len(sample_data.split('\n'))
        char_count = len(sample_data)
        size_kb = round(char_count / 1024, 1) if char_count > 1024 else char_count
        size_unit = "KB" if char_count > 1024 else "bytes"
        file_details = f"{line_count} lines, {size_kb} {size_unit}"
        
        # Log to DynamoDB
        log_data = {
            'id': str(uuid.uuid4()),
            'file_name': file_details,
            'input_data': sample_data,  
            'output_schema': response_str, 
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'status': 'success'
        }
        log_to_dynamodb(DATA_ANALYZER_LOG_TABLE, log_data)
        
        return response_str
    except Exception as e:
        error_msg = f"Error analyzing data: {str(e)}"
        
        # Log error to DynamoDB
        log_data = {
            'id': str(uuid.uuid4()),
            'file_name': file_details if 'file_details' in locals() else "N/A",
            'input_data': sample_data,
            'output_schema': error_msg,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'status': 'error'
        }
        log_to_dynamodb(DATA_ANALYZER_LOG_TABLE, log_data)
        
        return error_msg
