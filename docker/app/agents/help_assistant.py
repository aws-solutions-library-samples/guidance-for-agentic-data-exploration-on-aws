import os
import boto3
from strands import Agent, tool
from .model_utils import get_current_model

HELP_ASSISTANT_SYSTEM_PROMPT = """You are a Help assistant specialized in the AI Data Explorer application. You are an expert on:

1. **Setup and Deployment**: How to install, configure, and deploy the AI Data Explorer
2. **Usage Instructions**: How to use the web UI, REST API, and various features
3. **Architecture**: Understanding the multi-agent system, containerized services, and AWS infrastructure
4. **Configuration**: VPC setup, Neptune integration, Bedrock Guardrails, and environment variables
5. **Troubleshooting**: Common issues, error resolution, and debugging techniques
6. **Local Development**: Running services locally, testing, and development workflows

You have access to comprehensive documentation about the AI Data Explorer through your knowledge base. When answering questions:

- Provide specific, actionable instructions
- Include relevant code examples and commands when helpful
- Reference specific documentation sections when appropriate
- Explain both the "what" and "why" behind recommendations
- Suggest related topics or next steps when relevant

Always be helpful, accurate, and focused on the AI Data Explorer application specifically.
"""

@tool
def help_assistant(query: str) -> str:
    """
    Get help and information about the AI Data Explorer application, including setup, usage, and troubleshooting.
    
    Args:
        query: A question about the AI Data Explorer application
        
    Returns:
        Helpful information and guidance about the AI Data Explorer
    """
    try:
        print("Routed to Help Assistant")
        
        # Get Knowledge Base ID from environment
        kb_id = os.getenv("KNOWLEDGE_BASE_ID")
        print(f"Knowledge Base ID from environment: {kb_id}")
        
        if not kb_id or kb_id == "placeholder-kb-id":
            print("Knowledge base not available, using fallback")
            # Fallback to basic help without KB
            basic_agent = Agent(
                system_prompt=HELP_ASSISTANT_SYSTEM_PROMPT + "\n\nNote: Knowledge base is not available, providing general guidance based on training data.",
                model=get_current_model(),
            )
            response = basic_agent(query)
            return str(response)
        
        # Create Bedrock agent client for Knowledge Base queries
        bedrock_agent = boto3.client('bedrock-agent-runtime', region_name=os.getenv('AWS_REGION', 'us-east-1'))
        
        # Query the Knowledge Base
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
                source = result.get('location', {}).get('s3Location', {}).get('uri', 'Documentation')
                context_chunks.append(f"From {source}:\n{content}")
        
        # Combine context for the agent
        kb_context = "\n\n---\n\n".join(context_chunks) if context_chunks else ""
        
        # Create enhanced system prompt with KB context
        enhanced_prompt = HELP_ASSISTANT_SYSTEM_PROMPT
        if kb_context:
            enhanced_prompt += f"\n\nRelevant documentation context:\n\n{kb_context}\n\nUse this context to provide accurate, specific answers about the AI Data Explorer."
        
        # Create agent with enhanced context
        help_agent = Agent(
            system_prompt=enhanced_prompt,
            model=get_current_model(),
        )
        
        response = help_agent(query)
        return str(response)
        
    except Exception as e:
        print(f"Error in Help Assistant: {e}")
        # Fallback to basic help
        basic_agent = Agent(
            system_prompt=HELP_ASSISTANT_SYSTEM_PROMPT + f"\n\nNote: Knowledge base query failed ({str(e)}), providing general guidance.",
            model=get_current_model(),
        )
        response = basic_agent(query)
        return str(response)
