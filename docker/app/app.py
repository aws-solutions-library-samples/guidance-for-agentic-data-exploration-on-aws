import sys
import os
import json
import logging
sys.path.append(os.path.join(os.path.dirname(__file__), 'agents'))

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Filter out health check logs
class HealthCheckFilter(logging.Filter):
    def filter(self, record):
        return "/health" not in record.getMessage()

# Apply filter to uvicorn access logger
logging.getLogger("uvicorn.access").addFilter(HealthCheckFilter())

from agents.supervisor_agent import supervisor_agent
from streaming_callback_handler import StreamingCallbackHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Multi-Agent Explorer")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:5000,http://127.0.0.1:5000").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

class PromptRequest(BaseModel):
    prompt: str
    user_id: str = None
    user_role: str = None
    user_email: str = None
    session_id: str = None

@app.get('/health')
def health_check():
    """Health check endpoint for the load balancer."""
    return {"status": "healthy"}

# Global model configuration
current_chat_model = os.getenv("AGENT_MODEL", "us.anthropic.claude-sonnet-4-20250514-v1:0")
current_neptune_model = "us.anthropic.claude-sonnet-4-20250514-v1:0"
current_image_model = "stability.stable-image-core-v1:1"

def get_model_display_name(model_id):
    """Get display name for a model ID from llm-config.json"""
    try:
        import json
        import os
        
        # Load config - try local copy first, then UI directory for local dev
        config_path = os.path.join(os.path.dirname(__file__), 'llm-config.json')
        if not os.path.exists(config_path):
            # For local development, access from UI directory
            config_path = os.path.join(os.path.dirname(__file__), '../../ui/static/llm-config.json')
        
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        # Check regular models
        for model in config.get('models', []):
            if model['id'] == model_id:
                return model['name']
        
        # Check image models
        for model in config.get('image_models', []):
            if model['id'] == model_id:
                return model['name']
        
        # Fallback to model_id if not found
        return model_id
    except Exception as e:
        print(f"Error loading model config: {e}")
        return model_id

@app.post('/set-models')
async def set_models(request: dict):
    """Set multiple models in a single call."""
    global current_chat_model, current_neptune_model, current_image_model
    
    if 'chat_model' in request:
        current_chat_model = request['chat_model']
        os.environ['AGENT_MODEL'] = current_chat_model  # Update environment variable
        try:
            supervisor_agent.messages.clear()
            # Clear supervisor agent cache to force recreation with new model
            from agents.supervisor_agent import _supervisor_agents
            _supervisor_agents.clear()
        except:
            pass
        logger.debug(f"Using current_chat_model: {current_chat_model}")
    
    if 'neptune_model' in request:
        current_neptune_model = request['neptune_model']
        logger.debug(f"Using current_neptune_model: {current_neptune_model}")
    
    if 'image_model' in request:
        current_image_model = request['image_model']
        logger.debug(f"Using current_image_model: {current_image_model}")
    
    return {"status": "success"}

@app.get('/get-models')
def get_current_models():
    """Get current model configuration."""
    return {
        "chat_model": current_chat_model,
        "neptune_model": current_neptune_model,
        "image_model": current_image_model
    }

def get_memory_conversation_history(user_id: str = "local@dev"):
    """Get conversation history from memory system if available"""
    if not os.getenv("MEMORY_ENABLED", "true").lower() == "true":
        return None
        
    try:
        from bedrock_agentcore.memory import MemoryClient
        from datetime import datetime
        
        memory_client = MemoryClient(region_name=os.getenv("AWS_REGION", "us-east-1"))
        safe_user_id = user_id.replace('@', '_').replace('.', '_')
        memory_name = "AIDataExplorer_STM"
        
        # Find existing memory (AWS adds suffix to names)
        memories = memory_client.list_memories()
        memory_id = None
        for memory in memories:
            if memory.get('id', '').startswith(memory_name):
                memory_id = memory['id']
                break
                
        if not memory_id:
            return None
            
        # Get conversation history - use same actor_id format as supervisor agent
        session_id = f"session-{datetime.now().strftime('%Y%m%d')}"
        actor_id = safe_user_id  # Match supervisor agent format (not "supervisor-" prefix)
        recent_turns = memory_client.get_last_k_turns(
            memory_id=memory_id,
            actor_id=actor_id,
            session_id=session_id,
            k=20,  # Get more history for UI
            branch_name="main"
        )
        
        messages = []
        if recent_turns:
            for turn in recent_turns:
                for message in turn:
                    messages.append({
                        "role": message['role'].lower(),
                        "content": message['content']['text']
                    })
        
        return messages
        
    except Exception as e:
        print(f"Error getting memory conversation history: {e}")
        return None

@app.get('/conversation')
def get_conversation_history(user_id: str = "local@dev"):
    """Get conversation history directly from memory system"""
    safe_user_id = user_id.replace('@', '_').replace('.', '_')
    print(f"🔍 DEBUG: Conversation endpoint called with user_id: {user_id} / safe_user_id: {safe_user_id}")
    try:
        memory_messages = get_memory_conversation_history(user_id)
        print(f"🔍 DEBUG: Memory returned {len(memory_messages) if memory_messages else 0} messages")
        if memory_messages is not None:
            return {"messages": memory_messages, "total": len(memory_messages), "source": "memory"}
        else:
            return {"messages": [], "total": 0, "source": "no_memory"}
    except Exception as e:
        print(f"🔍 DEBUG: Error in conversation endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel

class ClearRequest(BaseModel):
    user_id: str = "local@dev"

@app.post('/clear-conversation')
def clear_conversation(request: ClearRequest = None):
    """Clear the conversation history for specific user."""
    try:
        # Get user_id from request body
        user_id = request.user_id if request else "local@dev"
        
        # Clear any cached agents - next request will get fresh timestamp-based session
        from agents.supervisor_agent import _supervisor_agents
        _supervisor_agents.clear()
        
        print(f"Cleared agent cache for user {user_id} - next request will start fresh session")
        
        return {"status": "success", "message": "Conversation cleared"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/query-streaming-with-events")
async def query_streaming_with_events(request: PromptRequest, http_request: Request):
    """Stream response with callback events for debugging."""
    # Use user_id and session_id from request body (sent by UI)
    actual_user_id = request.user_id or "local@dev"
    actual_session_id = request.session_id
    
    prompt = request.prompt.strip()
    logger.info(f"🔍 Query received: user_id={actual_user_id}, session_id={actual_session_id}, prompt='{prompt[:100]}...'")
    
    if not prompt:
        logger.error("❌ Empty prompt provided")
        raise HTTPException(status_code=400, detail="No prompt provided")

    async def generate_with_events():
        events = []
        used_tools = set()   # Track which tools were used
        
        def event_callback(event):
            events.append(event)
            # Log events but filter out verbose delta messages
            if isinstance(event, dict) and not str(event).startswith("Data: {'delta':"):
                logger.debug(f"📡 Event: {event}")
            # Track tool usage
            if isinstance(event, dict) and event.get('type', '').startswith('🔧 tool_use'):
                tool_name = event.get('data', {}).get('tool', '')
                if tool_name:
                    used_tools.add(tool_name)
                    logger.info(f"🔧 Tool used: {tool_name}")
        
        callback_handler = StreamingCallbackHandler(event_callback, "supervisor")
        
        try:
            logger.info("🚀 Starting supervisor agent processing")
            # Get user-specific supervisor agent
            from agents.supervisor_agent import get_supervisor_agent
            user_supervisor = get_supervisor_agent(actual_user_id, actual_session_id)
            user_supervisor.callback_handler = callback_handler
            
            message_ended = False
            
            async for chunk in user_supervisor.stream_async(prompt):
                # Send regular content
                if isinstance(chunk, dict) and "data" in chunk:
                    content = chunk["data"]
                    if not (content.startswith("Tool #") or content.startswith("Routed to")):
                        # Add line breaks after message ends
                        if message_ended:
                            content = "\n\n" + content
                            message_ended = False
                        yield f"data: {json.dumps({'type': 'content', 'data': content}, ensure_ascii=False)}\n\n"
                elif isinstance(chunk, str):
                    if not (chunk.startswith("Tool #") or chunk.startswith("Routed to")):
                        # Add line breaks after message ends
                        if message_ended:
                            chunk = "\n\n" + chunk
                            message_ended = False
                        yield f"data: {json.dumps({'type': 'content', 'data': chunk}, ensure_ascii=False)}\n\n"
                
                # Send any new callback events and check for messageStop
                while len(events) > 0:
                    event = events.pop(0)
                    if "messageStop" in str(event):
                        message_ended = True
                    
                    # Add model info to usage events
                    if isinstance(event, dict) and event.get('type') == '📊 usage':
                        # Get model display names
                        chat_model_name = get_model_display_name(current_chat_model)
                        neptune_model_name = get_model_display_name(current_neptune_model)
                        image_model_name = get_model_display_name(current_image_model)
                        
                        # Build model list based on tools that were actually used
                        used_models = []
                        
                        # Always include chat model as supervisor uses it
                        used_models.append(f"<strong>Chat LLM:</strong> {chat_model_name}")
                        
                        # Check if graph/neptune tools were used
                        if any('schema' in tool.lower() or 'neptune' in tool.lower() for tool in used_tools):
                            used_models.append(f"<strong>Graph Query LLM:</strong> {neptune_model_name}")
                        
                        # Check if image tools were used
                        if any('image' in tool.lower() or 'visualizer' in tool.lower() for tool in used_tools):
                            used_models.append(f"<strong>Image Gen LLM:</strong> {image_model_name}")
                        
                        # Add model info to existing data
                        event['data']['models'] = " &nbsp; ".join(used_models)
                    
                    yield f"data: {json.dumps({'type': 'event', 'event': event}, ensure_ascii=False)}\n\n"
            
            # Send any remaining events
            while len(events) > 0:
                event = events.pop(0)
                yield f"data: {json.dumps({'type': 'event', 'event': event}, ensure_ascii=False)}\n\n"
                
        except Exception as e:
            logger.error(f"❌ Error in query processing: {str(e)}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"

    logger.info("✅ Query processing completed")
    return StreamingResponse(generate_with_events(), media_type="text/plain")


@app.get("/get-image/{filename}")
async def get_image(filename: str):
    """Serve generated images from output directory"""
    try:
        from fastapi.responses import FileResponse
        import os
        
        output_dir = os.path.join(os.getcwd(), 'output')
        
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        image_path = os.path.join(output_dir, filename)
        
        if os.path.exists(image_path):
            # Determine media type
            if filename.lower().endswith('.png'):
                media_type = 'image/png'
            elif filename.lower().endswith(('.jpg', '.jpeg')):
                media_type = 'image/jpeg'
            elif filename.lower().endswith('.gif'):
                media_type = 'image/gif'
            else:
                media_type = 'application/octet-stream'
            
            return FileResponse(
                path=image_path,
                media_type=media_type,
                filename=filename
            )
        else:
            print(f"Image not found: {image_path}")
            print(f"Directory contents: {os.listdir(output_dir) if os.path.exists(output_dir) else 'Directory does not exist'}")
            raise HTTPException(status_code=404, detail="Image not found")
            
    except Exception as e:
        print(f"Error serving image {filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/query-get-image/{filename}")
async def query_get_image(filename: str):
    """Alternative endpoint for UI service using /query* routing"""
    return await get_image(filename)


if __name__ == '__main__':
    # Get port from environment variable or default to 8000
    port = int(os.environ.get('PORT', 8000))
    # Enable reload for local development
    reload_enabled = os.environ.get('RELOAD', 'false').lower() == 'true'
    uvicorn.run("app:app", host='0.0.0.0', port=port, reload=reload_enabled) # nosec B104
