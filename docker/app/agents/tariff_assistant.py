import os
import boto3
from strands import Agent, tool
from strands_tools import calculator
from .model_utils import get_current_model

TARIFF_ASSISTANT_SYSTEM_PROMPT = """You are a Tariff Assistant specialized in the United States Harmonized Tariff Schedule (HTS). You are an expert on:

1. **HTS Classification**: Determining correct tariff codes for products and commodities
2. **Tariff Rates**: Understanding duty rates, trade preferences, and special programs
3. **Trade Regulations**: Import/export requirements, restrictions, and compliance
4. **Customs Procedures**: Documentation, valuation, and classification processes

You have access to:
- A comprehensive tariffs knowledge base with HTS codes, rates, and regulations
- A calculator tool for computing tariff amounts, duties, and trade-related calculations

When answering questions:
- Query the tariffs knowledge base for relevant information
- Use the calculator for duty calculations, cost analysis, and trade computations
- Provide specific HTS codes when applicable
- Explain duty rates and any applicable trade programs
- Focus on practical tariff classification and trade compliance guidance

Always be precise and focus on practical tariff classification and trade compliance guidance.
"""

@tool
def tariffs_knowledge_base(query: str) -> str:
    """
    Query the tariffs knowledge base for information about HTS codes, tariff rates, trade regulations, and customs procedures.
    
    Args:
        query: A question about tariffs, HTS codes, duty rates, or trade regulations
        
    Returns:
        Relevant tariff information from the knowledge base
    """
    try:
        print("Querying Tariffs Knowledge Base")
        
        # Get Tariffs Knowledge Base ID from environment
        kb_id = os.getenv("TARIFFS_KB_ID")
        print(f"Tariffs Knowledge Base ID from environment: {kb_id}")
        
        if not kb_id or kb_id == "placeholder-tariffs-kb-id":
            print("Tariffs knowledge base not available, using fallback")
            return "Tariffs knowledge base is not currently available. Please ensure the tariffs knowledge base is properly configured and deployed."
        
        # Create Bedrock agent client for Knowledge Base queries
        bedrock_agent = boto3.client('bedrock-agent-runtime', region_name=os.getenv('AWS_REGION', 'us-east-1'))
        
        # Query the Tariffs Knowledge Base
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
                source = result.get('location', {}).get('s3Location', {}).get('uri', 'Tariff Documentation')
                context_chunks.append(f"From {source}:\n{content}")
        
        if not context_chunks:
            return f"No relevant tariff information found for query: {query}"
        
        # Combine context
        return "\n\n---\n\n".join(context_chunks)
        
    except Exception as e:
        print(f"Error in Tariffs Knowledge Base query: {e}")
        return f"Error querying tariffs knowledge base: {str(e)}"

@tool
def tariff_assistant(query: str) -> str:
    """
    Analyze tariffs, HTS codes, duty rates, and trade regulations for the United States Harmonized Tariff Schedule.
    Use this for questions about tariff classification, duty rates, trade compliance, or customs procedures.
    
    Args:
        query: A question about tariffs, HTS codes, or trade regulations
        
    Returns:
        Tariff analysis and guidance combining knowledge base and current web information
    """
    try:
        print("Routed to Tariff Assistant")
        
        # Create tariff agent with access to knowledge base and calculator
        tariff_agent = Agent(
            system_prompt=TARIFF_ASSISTANT_SYSTEM_PROMPT,
            model=get_current_model(),
            tools=[tariffs_knowledge_base, calculator],
        )
        
        # Enhance query with instruction to use calculator for computations
        enhanced_query = f"""
        {query}
        
        Please:
        1. Query the tariffs knowledge base for relevant information
        2. Use the calculator tool for any duty calculations, cost analysis, or trade computations
        3. Provide specific HTS codes and duty rates when applicable
        """
        
        agent_response = tariff_agent(enhanced_query)
        text_response = str(agent_response)

        if len(text_response) > 0:
            return text_response

        return "I apologize, but I couldn't retrieve tariff information. Please check your query or try rephrasing it."
        
    except Exception as e:
        print(f"Error in Tariff Assistant: {e}")
        return f"Error in tariff analysis: {str(e)}"
