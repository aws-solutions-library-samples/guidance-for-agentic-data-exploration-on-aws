import os
import boto3
from strands import Agent, tool

try:
    from .graph_assistant import neptune_database_statistics, neptune_cypher_query
except ImportError:
    from graph_assistant import neptune_database_statistics, neptune_cypher_query

PRODUCT_ANALYST_SYSTEM_PROMPT = """You are a Product Analyst specialized in analyzing product information and creating data models. You are an expert on:

1. **Product Analysis**: Understanding product catalogs, specifications, pricing, and relationships
2. **Data Modeling**: Creating graph models and schemas for product data
3. **Product Insights**: Analyzing product performance, trends, and relationships
4. **Graph Database Operations**: Using graph databases to explore product relationships and hierarchies

You have access to:
- A comprehensive products knowledge base with product information, catalogs, and documentation
- Graph database tools for creating and querying product relationship models
- Data visualization capabilities for product analytics

When answering questions:
- Query the products knowledge base for specific product information
- Use graph tools to model product relationships and hierarchies
- Provide actionable insights about products and their connections
- Suggest data models that capture product relationships effectively
- Combine product knowledge with graph analysis for comprehensive answers

Always be specific, data-driven, and focused on practical product analysis and modeling.
"""

@tool
def products_knowledge_base(query: str) -> str:
    """
    Query the products knowledge base for information about products, catalogs, specifications, and related documentation.
    
    Args:
        query: A question about products, product catalogs, specifications, or product-related information
        
    Returns:
        Relevant product information from the knowledge base
    """
    try:
        print("Querying Products Knowledge Base")
        
        # Get Products Knowledge Base ID from environment
        kb_id = os.getenv("PRODUCTS_KB_ID")
        print(f"Products Knowledge Base ID from environment: {kb_id}")
        
        if not kb_id or kb_id == "placeholder-products-kb-id":
            print("Products knowledge base not available, using fallback")
            return "Products knowledge base is not currently available. Please ensure the products knowledge base is properly configured and deployed."
        
        # Create Bedrock agent client for Knowledge Base queries
        bedrock_agent = boto3.client('bedrock-agent-runtime', region_name=os.getenv('AWS_REGION', 'us-east-1'))
        
        # Query the Products Knowledge Base
        kb_response = bedrock_agent.retrieve(
            knowledgeBaseId=kb_id,
            retrievalQuery={
                'text': query
            },
            retrievalConfiguration={
                'vectorSearchConfiguration': {
                    'numberOfResults': 5
                }
            }
        )
        
        # Extract relevant context from KB results
        context_chunks = []
        for result in kb_response.get('retrievalResults', []):
            content = result.get('content', {}).get('text', '')
            if content:
                # Add source information if available
                source = result.get('location', {}).get('s3Location', {}).get('uri', 'Product Documentation')
                context_chunks.append(f"From {source}:\n{content}")
        
        if not context_chunks:
            return f"No relevant product information found for query: {query}"
        
        # Combine context
        return "\n\n---\n\n".join(context_chunks)
        
    except Exception as e:
        print(f"Error in Products Knowledge Base query: {e}")
        return f"Error querying products knowledge base: {str(e)}"

@tool
def graph_assistant_tool(query: str) -> str:
    """
    Use the graph assistant to analyze data relationships, create graph models, or query graph databases.
    This tool provides access to Neptune graph database operations and schema modeling.
    
    Args:
        query: A question about graph modeling, database relationships, or Neptune operations
        
    Returns:
        Graph analysis, model suggestions, or database query results
    """
    try:
        print("Calling Graph Assistant Tool")
        
        # Determine which graph tool to use based on query content
        query_lower = query.lower()
        
        if any(keyword in query_lower for keyword in ['statistics', 'schema', 'overview', 'summary']):
            # Use Neptune statistics for schema/overview queries
            return neptune_database_statistics()
        elif any(keyword in query_lower for keyword in ['query', 'find', 'search', 'cypher', 'match']):
            # Use Neptune query for specific queries
            return neptune_cypher_query(query)
        else:
            # Default to statistics for general graph questions
            return neptune_database_statistics()
        
    except Exception as e:
        print(f"Error in Graph Assistant Tool: {e}")
        return f"Error using graph assistant: {str(e)}"

def create_product_analyst_agent():
    """Create and return a Product Analyst agent with all necessary tools"""
    return Agent(
        system_prompt=PRODUCT_ANALYST_SYSTEM_PROMPT,
        tools=[products_knowledge_base, graph_assistant_tool]
    )

@tool
def product_analyst(query: str) -> str:
    """
    Analyze products, product catalogs, product relationships, and create product data models.
    Use this for questions about products, product specifications, product analysis, or product data modeling.
    
    Args:
        query: A question about products, product catalogs, or product analysis
        
    Returns:
        Product analysis and insights combining knowledge base and graph analysis
    """
    try:
        print("Routed to Product Analyst")
        
        # Call both tools and combine results
        kb_result = products_knowledge_base(query)
        graph_result = graph_assistant_tool(query)
        
        # Combine results
        return f"Product Knowledge Base Results:\n{kb_result}\n\nGraph Analysis Results:\n{graph_result}"
        
    except Exception as e:
        print(f"Error in Product Analyst: {e}")
        return f"Error in product analysis: {str(e)}"
