from strands import tool

try:
    from .neptune_tools import get_neptune_statistics, execute_neptune_query, get_bulk_load_status, start_bulk_load
except ImportError:
    from neptune_tools import get_neptune_statistics, execute_neptune_query, get_bulk_load_status, start_bulk_load

GRAPH_ASSISTANT_SYSTEM_PROMPT = """
You are a graph database specialist that helps users with Neptune graph database operations.
You have access to multiple Neptune tools for querying, statistics, and bulk loading.

The Neptune query tool uses an enhanced QA chain with:
- Automatic schema retrieval and context
- Optimized Cypher query generation with domain-specific rules
- Structured response formatting with intermediate steps
"""

@tool
def neptune_database_statistics() -> str:
    """
    Get Neptune property graph statistics including details on nodes and edges.
    Use this tool to determine the overall database schema and summary.
    
    Returns:
        Database statistics with node types, edge types, and counts
    """
    try:
        return get_neptune_statistics()
    except Exception as e:
        return f"Error retrieving Neptune statistics: {str(e)}"

@tool
def neptune_cypher_query(query: str) -> str:
    """
    Execute Cypher queries against Neptune graph database.
    
    Args:
        query: Natural language question to convert to Cypher and execute
        
    Returns:
        Query results with explanations
    """
    try:
        return execute_neptune_query(query)
    except Exception as e:
        return f"Error executing Neptune query: {str(e)}"

@tool
def neptune_bulk_load_status(load_id: str = None) -> str:
    """
    Check the status of Neptune bulk load operations.
    
    Args:
        load_id: Optional specific load ID to check. If not provided, shows recent loads.
        
    Returns:
        Bulk load status information
    """
    try:
        return get_bulk_load_status(load_id)
    except Exception as e:
        return f"Error retrieving bulk load status: {str(e)}"

@tool
def neptune_bulk_load(source_s3_prefix: str) -> str:
    """
    Start a Neptune bulk load operation from S3.
    
    Args:
        source_s3_prefix: S3 path to the data files (e.g., path/)
        
    Returns:
        Bulk load job information and status
    """
    try:
        return start_bulk_load(source_s3_prefix)
    except Exception as e:
        return f"Error starting bulk load: {str(e)}"
