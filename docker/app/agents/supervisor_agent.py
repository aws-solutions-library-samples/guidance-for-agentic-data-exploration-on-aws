import os
import sys
import logging
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from strands import Agent
from telemetry_config import setup_tracing
from .general_assistant import general_assistant
from .supply_chain_assistant import supply_chain_assistant
from .schema_assistant import schema_translator, data_analyzer
from .graph_assistant import neptune_database_statistics, neptune_cypher_query, neptune_bulk_load_status, neptune_bulk_load
from .help_assistant import help_assistant
from .data_visualizer_assistant import data_visualizer_assistant
from .tariff_assistant import tariff_assistant
from .image_assistant import image_assistant
from .product_analyst import product_analyst
from chart_result_hook import ChartResultProcessor
from memory_hooks import get_memory_hook
from datetime import datetime

# Setup logging
logger = logging.getLogger(__name__)

# Setup tracing
setup_tracing()

SUPERVISOR_SYSTEM_PROMPT = """
You are an intelligent supervisor agent designed to coordinate specialized assistants. Your role is to:

1. Analyze incoming queries and determine the most appropriate specialized agent:
   - Products Knowledge Base: For product information, catalogs, specifications, and product-related documentation
   - Supply Chain Assistant: For manufacturing supply chain operations, weather forecasts, conditions, meteorological information, UV index data, and supply chain network analysis
   - Tariff Assistant: For US Harmonized Tariff Schedule, HTS codes, duty rates, and trade regulations
   - Data Analyzer: For analyzing sample data and generating database schemas
   - Data Visualizer Agent: For creating charts, graphs, word clouds, and maps from data
   - Graph Agent: For querying graph databases using Cypher, exploring graph relationships, and Neptune database statistics
   - Graph Assistant Tool: For data relationship modeling and graph analysis
   - Schema Translator: For converting database schemas to graph models
   - Image Assistant: For processing and analyzing images, and generating images from text prompts
   - Help Agent: For questions about the AI Data Explorer application itself (setup, usage, troubleshooting, features)
   - General Assistant: For all other topics outside these specialized domains

2. Key Responsibilities:
   - Accurately classify queries by subject area
   - Route requests to the appropriate specialized agent
   - Maintain context and coordinate multi-step problems
   - Ensure cohesive responses when multiple agents are needed

3. Decision Protocol:
   - If query involves products, product catalogs, product specifications, warranty, reviews → Products Knowledge Base
   - If query involves supply chain operations, manufacturing, inventory management, production planning, supplier performance, demand forecasting, logistics, BOM analysis, purchase orders, warehouse operations, sustainability tracking → Supply Chain Assistant
   - If query involves weather/forecast/meteorology/UV index/environmental conditions → Supply Chain Assistant
   - If query involves tariffs, HTS codes, duty rates, trade regulations, customs procedures → Tariff Assistant
   - If query involves analyzing sample data to generate schemas → Data Analyzer
   - If query involves creating charts, graphs, visualizations, word clouds, or maps → Data Visualizer Agent
   - If query involves graph database queries/Cypher/graph exploration/Neptune statistics → Graph Agent
   - If query involves data relationships, data modeling, or data graph analysis → Graph Assistant Tool
   - If query involves database schemas/SQL DDL/graph models → Schema Translator
   - If query involves image analysis, image processing, or generating images from text → Image Assistant
   - If query involves the AI Data Explorer application (how to use, setup, deploy, configure, troubleshoot) → Help Agent
   - If query is outside these specialized areas → General Assistant

Always provide direct, helpful responses by routing to the appropriate specialist.
"""

# Define tools list once to avoid repetition
SUPERVISOR_TOOLS = [
    help_assistant, product_analyst, supply_chain_assistant, 
    schema_translator, data_analyzer, neptune_database_statistics, neptune_cypher_query, 
    neptune_bulk_load_status, neptune_bulk_load, data_visualizer_assistant, 
    tariff_assistant, image_assistant, general_assistant
]

def create_supervisor_agent(user_id: str = None, session_id: str = None, model: str = None):
    """Create supervisor agent with optional guardrails and memory"""
    
    logger.info(f"🏗️ Creating supervisor agent for user_id={user_id}, session_id={session_id}")
    
    # Generate unique identifiers for memory (AWS compliant)
    actor_id = (user_id or 'default').replace('@', '_').replace('.', '_')
    
    # Use provided session_id or fall back to date-based for local dev
    if session_id:
        # Use provided session ID (from Cognito/Flask session)
        agent_session_id = f"session-{session_id}"
    else:
        # Use date-based session for local development
        agent_session_id = f"session-{datetime.now().strftime('%Y%m%d')}"
    
    logger.info(f"🆔 Using actor_id={actor_id}, agent_session_id={agent_session_id}")
    
    # Common trace attributes
    trace_attributes = {
        "agent.name": "supervisor",
        "service.name": "ai-data-explorer",
        "environment": os.getenv("ENVIRONMENT", "local"),
        "actor.id": actor_id,
        "session.id": agent_session_id
    }
    
    # Initialize hooks list
    hooks = [ChartResultProcessor()]
    
    # Add memory hook if enabled
    memory_hook = get_memory_hook(actor_id, agent_session_id, user_id or 'local@dev')
    if memory_hook:
        hooks.append(memory_hook)
    
    try:
        # Try to use Bedrock guardrails if configured
        if os.getenv("BEDROCK_GUARDRAIL_ID"):
            import sys
            sys.path.append(os.path.dirname(os.path.dirname(__file__)))
            from guardrails import BedrockGuardrailConfig, NotifyOnlyGuardrailsHook
            
            config = BedrockGuardrailConfig()
            
            # Use passed model or get from environment/app
            if model:
                model_to_use = model
                logger.info(f"🎯 GUARDRAILS: Using passed model: {model_to_use}")
            else:
                env_model = os.getenv("AGENT_MODEL")
                if env_model:
                    model_to_use = env_model
                    logger.info(f"🎯 GUARDRAILS: Using AGENT_MODEL env var: {model_to_use}")
                else:
                    # Use current_chat_model from app for UI
                    try:
                        from app import current_chat_model
                        model_to_use = current_chat_model
                        logger.info(f"🎯 GUARDRAILS: Using current_chat_model from app: {model_to_use}")
                    except ImportError as ie:
                        model_to_use = "us.anthropic.claude-sonnet-4-20250514-v1:0"  # Explicit fallback
                        logger.warning(f"🎯 GUARDRAILS: Import failed ({ie}), using fallback: {model_to_use}")
            
            if os.getenv("GUARDRAIL_MODE") == "enforce":
                # Direct enforcement mode - pass model explicitly to avoid circular imports
                logger.info(f"🛡️ GUARDRAILS: Creating protected model with: {model_to_use}")
                protected_model = config.create_protected_model(model_to_use)
                logger.info(f"🛡️ GUARDRAILS: Protected model created: {protected_model}")
                agent = Agent(
                    system_prompt=SUPERVISOR_SYSTEM_PROMPT,
                    model=protected_model,
                    tools=SUPERVISOR_TOOLS,
                    trace_attributes=trace_attributes
                )
                
                # Register hooks after agent creation
                for hook in hooks:
                    if hasattr(hook, 'register_hooks'):
                        hook.register_hooks(agent.hooks)
            else:
                # Shadow mode (default) - add guardrail hook
                logger.info(f"🛡️ GUARDRAILS: Shadow mode - using model directly: {model_to_use}")
                guardrail_hook = NotifyOnlyGuardrailsHook(
                    config.guardrail_id, 
                    config.guardrail_version, 
                    config.region
                )
                hooks.append(guardrail_hook)
                
                agent = Agent(
                    system_prompt=SUPERVISOR_SYSTEM_PROMPT,
                    model=model_to_use,
                    tools=SUPERVISOR_TOOLS,
                    trace_attributes=trace_attributes
                )
                
                # Register hooks after agent creation
                for hook in hooks:
                    if hasattr(hook, 'register_hooks'):
                        hook.register_hooks(agent.hooks)
        else:
            # Use passed model or get from environment/app
            if model:
                model_to_use = model
            else:
                env_model = os.getenv("AGENT_MODEL")
                if env_model:
                    model_to_use = env_model
                else:
                    # Use current_chat_model from app for UI
                    try:
                        from app import current_chat_model
                        model_to_use = current_chat_model
                    except ImportError:
                        model_to_use = None  # Let strands use default
            
            # Fallback to standard agent
            agent = Agent(
                system_prompt=SUPERVISOR_SYSTEM_PROMPT,
                model=model_to_use,
                tools=SUPERVISOR_TOOLS,
                trace_attributes=trace_attributes
            )
            
            # Register hooks after agent creation
            for hook in hooks:
                if hasattr(hook, 'register_hooks'):
                    hook.register_hooks(agent.hooks)
    except Exception as e:
        print(f"Guardrails not configured: {e}")
        
        # Use passed model or get from environment/app for fallback
        if model:
            model_to_use = model
        else:
            env_model = os.getenv("AGENT_MODEL")
            if env_model:
                model_to_use = env_model
            else:
                # Use current_chat_model from app for UI
                try:
                    from app import current_chat_model
                    model_to_use = current_chat_model
                except ImportError:
                    model_to_use = None  # Let strands use default
        
        # Fallback to standard agent
        agent = Agent(
            system_prompt=SUPERVISOR_SYSTEM_PROMPT,
            model=model_to_use,
            tools=SUPERVISOR_TOOLS,
            trace_attributes=trace_attributes
        )
        
        # Register hooks after agent creation
        for hook in hooks:
            if hasattr(hook, 'register_hooks'):
                hook.register_hooks(agent.hooks)
        
    return agent

# User-specific agent cache
_supervisor_agents = {}
_last_model_id = None

def get_supervisor_agent(user_id: str = None, session_id: str = None):
    """Get supervisor agent with model switching support"""
    global _supervisor_agents, _last_model_id
    
    logger.info(f"🤖 Getting supervisor agent for user_id={user_id}, session_id={session_id}")
    
    # Get current model
    try:
        from app import current_chat_model
        current_model = current_chat_model
    except ImportError:
        current_model = os.getenv("AGENT_MODEL", "us.anthropic.claude-sonnet-4-20250514-v1:0")
    
    logger.info(f"🎯 Using model: {current_model}")
    
    # Recreate agent if model changed
    if _last_model_id != current_model:
        logger.info(f"🔄 Model changed from {_last_model_id} to {current_model}, clearing cache")
        _supervisor_agents.clear()  # Clear all cached agents when model changes
        _last_model_id = current_model
    
    # Always create fresh agent (no user-specific caching)
    agent = create_supervisor_agent(user_id, session_id, current_model)
    logger.info(f"✅ Supervisor agent created successfully")
    return agent

# For backward compatibility
class SupervisorAgentProxy:
    def __call__(self, *args, **kwargs):
        return get_supervisor_agent()(*args, **kwargs)
    
    def __getattr__(self, name):
        return getattr(get_supervisor_agent(), name)
    
    def __setattr__(self, name, value):
        return setattr(get_supervisor_agent(), name, value)
    
    def __iter__(self):
        return iter(get_supervisor_agent())
    
    def __next__(self):
        return next(get_supervisor_agent())

supervisor_agent = SupervisorAgentProxy()

def get_supervisor_for_user(user_id: str):
    """Get supervisor agent instance for a specific user"""
    return get_supervisor_agent(user_id)
