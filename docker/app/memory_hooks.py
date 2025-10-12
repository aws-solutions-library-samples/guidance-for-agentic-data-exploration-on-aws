"""
Memory integration hooks for the AI Data Explorer multi-agent system.
Integrates AWS AgentCore Memory with existing guardrails functionality.
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional
from strands.hooks import HookProvider, HookRegistry, MessageAddedEvent, BeforeInvocationEvent
from strands.experimental.hooks import AfterModelInvocationEvent

logger = logging.getLogger(__name__)

class SharedMemoryHook(HookProvider):
    """Hook provider that integrates shared memory with guardrails validation"""
    
    def __init__(self, memory_client, memory_id: str, actor_id: str, session_id: str):
        self.memory_client = memory_client
        self.memory_id = memory_id
        self.actor_id = actor_id
        self.session_id = session_id
        self.blocked_outputs = set()  # Track blocked assistant messages
        self.history_loaded = False  # Track if we've loaded history for this session
        
    def after_model_invocation(self, event: AfterModelInvocationEvent):
        """Track model outputs that fail guardrail checks"""
        if event.exception is not None or event.stop_response is None:
            return
            
        message = event.stop_response.message
        if isinstance(message.get("content"), list):
            content = "".join(block.get("text", "") for block in message.get("content", []))
        else:
            content = str(message.get("content", ""))
        
        content_id = hash(content)
        
        # Check if this is a guardrail intervention (simplified check)
        if "cannot provide" in content.lower() or "violate" in content.lower():
            self.blocked_outputs.add(content_id)
            logger.info(f"⛔ Marked assistant message as blocked for {self.actor_id}")
    
    def on_message_added(self, event: MessageAddedEvent):
        """Store messages in memory only if they pass guardrail checks"""
        logger.debug(f"🔧 MEMORY DEBUG: Message added event triggered for {self.actor_id}")
        
        message = event.message
        if not message:
            print(f"❌ MEMORY DEBUG: No message in event")
            return
            
        if isinstance(message.get("content"), list):
            content = "".join(block.get("text", "") for block in message.get("content", []))
        else:
            content = str(message.get("content", ""))
        
        role = message.get("role", "")
        content_id = hash(content)
        
        logger.debug(f"💾 MEMORY DEBUG: Processing {role} message: {content[:100]}...")
        
        # Skip empty content
        if not content or not content.strip():
            logger.debug(f"⏭️ MEMORY DEBUG: Skipping empty message")
            return
        
        # Filter out <thinking> content from assistant messages
        if role == "assistant" and "<thinking>" in content:
            import re
            # Remove everything between <thinking> and </thinking> tags
            content = re.sub(r'<thinking>.*?</thinking>\s*', '', content, flags=re.DOTALL)
            # Skip if nothing left after removing thinking content
            if not content.strip():
                logger.debug(f"⏭️ MEMORY DEBUG: Skipping message with only thinking content")
                return
            logger.debug(f"🧠 MEMORY DEBUG: Filtered out thinking content, storing: {content[:100]}...")
        
        # Skip system messages
        if role == "system":
            logger.debug(f"⏭️ MEMORY DEBUG: Skipping system message")
            return
        
        # Skip tool messages and internal prompts
        is_tool = ('toolUse' in content and '{' in content) or \
                  ('toolResult' in content and '{' in content) or \
                  (content.startswith('```json') and ('toolUse' in content or 'toolResult' in content)) or \
                  content.startswith('Answer this general knowledge question') or \
                  'remembering to start by acknowledging' in content
        if is_tool:
            logger.debug(f"⏭️ MEMORY DEBUG: Skipping tool/internal message")
            return
            
        # Skip blocked assistant messages
        if role == "assistant" and content_id in self.blocked_outputs:
            logger.debug(f"⛔ MEMORY DEBUG: Skipping blocked assistant message")
            return
        
        # Store the message in memory
        try:
            self.memory_client.create_event(
                memory_id=self.memory_id,
                actor_id=self.actor_id,
                session_id=self.session_id,
                messages=[(content, role)]
            )
            logger.debug(f"✅ MEMORY DEBUG: Successfully stored {role} message")
        except Exception as e:
            print(f"❌ MEMORY DEBUG: Failed to store message: {e}")
    
    def load_conversation_history(self, agent):
        """Load recent conversation history into agent's system prompt"""
        logger.debug(f"🔧 MEMORY DEBUG: Loading conversation history for {self.actor_id}")
        try:
            recent_turns = self.memory_client.get_last_k_turns(
                memory_id=self.memory_id,
                actor_id=self.actor_id,
                session_id=self.session_id,
                k=10,  # Get more history
                branch_name="main"
            )
            
            if recent_turns:
                logger.debug(f"💾 MEMORY DEBUG: Found {len(recent_turns)} turns in memory")
                context_messages = []
                message_count = 0
                for turn in recent_turns:
                    for message in turn:
                        message_count += 1
                        role = message['role'].lower()
                        content = message['content']['text']
                        context_messages.append(f"{role.title()}: {content}")
                        logger.debug(f"📝 MEMORY DEBUG: Message {message_count} ({role}): {content[:100]}...")
                
                context = "\n".join(context_messages)
                
                # Reset system prompt and add fresh context
                original_prompt = agent.system_prompt.split('\n\nPrevious conversation:')[0]
                agent.system_prompt = f"{original_prompt}\n\nPrevious conversation:\n{context}\n\nUse this conversation history to answer questions about what was discussed previously."
                print(f"✅ MEMORY DEBUG: Added {len(context_messages)} messages to system prompt")
            else:
                print(f"💾 MEMORY DEBUG: No conversation history found")
                
        except Exception as e:
            print(f"❌ MEMORY DEBUG: Failed to load conversation history: {e}")
            import traceback
            traceback.print_exc()
    
    def register_hooks(self, registry: HookRegistry):
        """Register all hooks with the registry"""
        logger.info(f"🔧 Registering memory hooks for {self.actor_id}")
        registry.add_callback(BeforeInvocationEvent, self.before_invocation)
        registry.add_callback(AfterModelInvocationEvent, self.after_model_invocation)
        registry.add_callback(MessageAddedEvent, self.on_message_added)
        logger.info(f"✅ Memory hooks registered for {self.actor_id}")
    
    def before_invocation(self, event: BeforeInvocationEvent):
        """Load conversation history before agent starts processing"""
        print(f"🔧 MEMORY DEBUG: Loading conversation history BEFORE invocation for {self.actor_id}")
        self.load_conversation_history(event.agent)


def create_memory_resource(memory_client, memory_name: str) -> Optional[str]:
    """Create or retrieve existing memory resource"""
    try:
        # First try to find existing memory (AWS adds suffix to names)
        memories = memory_client.list_memories()
        for memory in memories:
            # Check if memory id starts with our prefix (AWS adds unique suffix)
            memory_id = memory.get('id', '')
            if memory_id.startswith(memory_name):
                logger.info(f"✅ Using existing memory resource: {memory_id}")
                return memory_id
        
        # If not found, create new memory
        memory = memory_client.create_memory_and_wait(
            name=memory_name,
            description="AI Data Explorer shared memory",
            strategies=[],  # Short-term memory only
            event_expiry_days=7,
            max_wait=300,
            poll_interval=10
        )
        memory_id = memory['id']
        logger.info(f"✅ Created new memory resource: {memory_id}")
        return memory_id
        
    except Exception as e:
        logger.error(f"Failed to create/find memory resource: {e}")
        return None


def get_memory_hook(actor_id: str, session_id: str, user_id: str = "default") -> Optional[SharedMemoryHook]:
    """Get memory hook for an agent if memory is enabled"""
    if not os.getenv("MEMORY_ENABLED", "true").lower() == "true":
        return None
        
    try:
        from bedrock_agentcore.memory import MemoryClient
        
        memory_client = MemoryClient(region_name=os.getenv("AWS_REGION", "us-east-1"))
        safe_user_id = user_id.replace('@', '_').replace('.', '_')
        memory_name = "AIDataExplorer_STM"
        
        memory_id = create_memory_resource(memory_client, memory_name)
        if not memory_id:
            return None
            
        return SharedMemoryHook(memory_client, memory_id, actor_id, session_id)
        
    except ImportError:
        logger.warning("bedrock-agentcore not available, memory disabled")
        return None
    except Exception as e:
        logger.error(f"Failed to initialize memory hook: {e}")
        return None
