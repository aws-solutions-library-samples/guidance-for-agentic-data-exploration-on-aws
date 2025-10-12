import time
from typing import Dict, Any, Optional
import logging
logger = logging.getLogger(__name__)

class StreamingCallbackHandler:
    """Callback handler that captures Strands events for streaming to UI"""
    
    def __init__(self, event_callback: Optional[callable] = None, agent_name: str = "unknown"):
        self.event_callback = event_callback
        self.events = []
        self.current_tool_use = None  # Track current tool use for consolidation
        self.agent_name = agent_name
        
    def __call__(self, **kwargs):
        """Handle callback events from Strands agents"""
        timestamp = time.time()
        
        # Create event object
        event = {
            "timestamp": timestamp,
            "agent": self.agent_name,
            "type": self._get_event_type(kwargs),
            "data": self._format_event_data(kwargs)
        }
        
        # print(f"Event captured: {event['type']} at {timestamp}")


        # Filter out contentBlockDelta and text_generation events
        if event["type"] != "contentBlockDelta" and event["type"] != "📟 text_generation":
            # Print event to console
            print(f"Event: {event['type']}")
            print(f"Agent: {event['agent']}")
            print(f"Data: {event['data']}")
            print("---")


        # Log unknown events to help debug what we're missing
        if event["type"] == "unknown":
            print(f"Unknown event kwargs: {kwargs}")
        
        # Filter out unknown events with empty data
        if event["type"] == "unknown" and not event["data"]:
            return
            
        # Filter out contentBlockDelta raw events (too noisy)
        if (event["type"] == "raw_event" and 
            event["data"].get("raw_event", "").startswith("{'contentBlockDelta'")):
            return
            
        # Filter out contentBlockDelta events by type name
        if event["type"] == "contentBlockDelta":
            return
            
        # Special handling for tool use events - consolidate incremental updates
        if event["type"].startswith("🔧 tool_use"):
            tool_name = kwargs["current_tool_use"].get("name", "unknown")
            tool_input = kwargs["current_tool_use"].get("input", "")
            
            # Only show if input looks complete (has both opening and closing braces)
            if tool_input and "{" in tool_input and "}" in tool_input:
                # Remove any previous incomplete tool use events for this tool
                self.events = [e for e in self.events if not (
                    e["type"].startswith("🔧 tool_use") and 
                    e["data"].get("tool") == tool_name
                )]
                # Continue to show this complete event
            else:
                # Skip incomplete tool use events
                return
        
        # Special handling for metadata events - don't treat as raw_event
        if (event["type"] == "raw_event" and 
            "event" in kwargs and 
            isinstance(kwargs["event"], dict) and 
            "metadata" in kwargs["event"]):
            event["type"] = "📊 usage"
        
        self.events.append(event)
        
        # Stream event if callback provided
        if self.event_callback:
            self.event_callback(event)
    
    def _get_event_type(self, kwargs: Dict[str, Any]) -> str:
        """Determine event type from kwargs"""
        if kwargs.get("init_event_loop"):
            return "🔄 init_event_loop"
        elif kwargs.get("start_event_loop"):
            return "▶️ start_event_loop"
        elif kwargs.get("start"):
            return "📝 start"
        elif "message" in kwargs:
            role = kwargs["message"].get("role", "unknown")
            # Check if assistant message contains thinking content
            if role == "assistant":
                content = kwargs["message"].get("content", [])
                if isinstance(content, list) and len(content) > 0:
                    for item in content:
                        if isinstance(item, dict) and "text" in item:
                            text = item["text"]
                            if text.strip().startswith("<thinking>"):
                                return "🧠 thinking"
            return f"📬 message ({role})"
        elif kwargs.get("complete"):
            return "✅ complete"
        elif kwargs.get("force_stop"):
            return "🛑 force_stop"
        elif "current_tool_use" in kwargs:
            tool_name = kwargs["current_tool_use"].get("name", "unknown")
            return f"🔧 tool_use ({tool_name})"
        elif "data" in kwargs:
            return "📟 text_generation"
        elif kwargs.get("reasoning"):
            return "🧠 reasoning"
        elif "metadata" in kwargs:
            return "📊 usage"
        elif "event" in kwargs:
            # Check if event contains metadata
            event = kwargs["event"]
            if isinstance(event, dict) and "metadata" in event:
                return "📊 usage"  # Use "usage" as the title for metadata events
            # Extract event type from raw event string
            event_str = str(event)
            if "'" in event_str and ":" in event_str:
                try:
                    # Extract the first key from the event dict string
                    start = event_str.find("'") + 1
                    end = event_str.find("'", start)
                    if start > 0 and end > start:
                        event_type = event_str[start:end]
                        # Add emojis for common event types
                        if event_type == "messageStart":
                            return "🚀 messageStart"
                        elif event_type == "messageStop":
                            return "🏁 messageStop"
                        elif event_type == "contentBlockStart":
                            return "📄 contentBlockStart"
                        elif event_type == "contentBlockStop":
                            return "📄 contentBlockStop"
                        else:
                            return event_type
                except Exception:
                    logger.debug("Event parsing failed")
            return "raw_event"
        elif "result" in kwargs:
            return "🎯 result"
        elif "delta" in kwargs:
            return "📝 delta"
        else:
            return "❓ unknown"
    
    def _format_event_data(self, kwargs: Dict[str, Any]) -> Dict[str, Any]:
        """Format event data for UI display"""
        data = {}
        
        # Text generation - show just the text, not the delta
        if "data" in kwargs:
            data["text"] = kwargs["data"]
        
        # Delta content - skip if we already have text
        if "delta" in kwargs and "data" not in kwargs:
            data["delta"] = kwargs["delta"]
        
        # Tool usage - format cleanly
        if "current_tool_use" in kwargs:
            tool_use = kwargs["current_tool_use"]
            if tool_use.get("name"):
                data["tool"] = tool_use["name"]
            if tool_use.get("input"):
                # Try to parse and format tool input
                try:
                    import json
                    if isinstance(tool_use["input"], str):
                        parsed = json.loads(tool_use["input"])
                        if isinstance(parsed, dict) and len(parsed) == 1:
                            key, value = list(parsed.items())[0]
                            data["query"] = value
                        else:
                            data["input"] = tool_use["input"]
                    else:
                        data["input"] = str(tool_use["input"])
                except:
                    data["input"] = tool_use["input"]
        
        # Messages - format content cleanly
        if "message" in kwargs:
            message = kwargs["message"]
            data["role"] = message.get("role")
            
            # Format message content
            content = message.get("content", [])
            if isinstance(content, list) and len(content) > 0:
                # Extract text and tool info
                text_parts = []
                tools = []
                found_image_url = None  # Track if we find an image in tool results
                found_image_urls = []  # Track all images found in tool results
                
                for item in content:
                    if isinstance(item, dict):
                        if "text" in item:
                            main_text = item["text"]
                            # Only truncate if no images
                            text_parts.append(main_text[:100] + "..." if len(main_text) > 100 else main_text)
                        elif "toolUse" in item:
                            tool_info = item["toolUse"]
                            tool_name = tool_info.get('name', 'unknown')
                            tools.append(tool_name)
                            # Store tool name for next toolResult
                            self._last_tool_name = tool_name
                        elif "toolResult" in item:
                            tool_result = item["toolResult"]
                            if "content" in tool_result:
                                # Extract tool result content
                                result_content = tool_result["content"]
                                if isinstance(result_content, list) and len(result_content) > 0:
                                    # Check for image content first
                                    has_image = any(isinstance(item, dict) and "image" in item for item in result_content)
                                    if has_image:
                                        # Convert image to HTML format for UI display
                                        for item in result_content:
                                            if isinstance(item, dict) and "image" in item:
                                                import base64
                                                image_data = item["image"]
                                                if "source" in image_data and "bytes" in image_data["source"]:
                                                    # Convert bytes to base64 string
                                                    image_bytes = image_data["source"]["bytes"]
                                                    if isinstance(image_bytes, bytes):
                                                        b64_string = base64.b64encode(image_bytes).decode('utf-8')
                                                    else:
                                                        b64_string = image_bytes  # Already base64 string
                                                    
                                                    image_format = image_data.get("format", "png")
                                                    image_html = f'<img src="data:image/{image_format};base64,{b64_string}" style="max-width: 500px; height: auto; border-radius: 8px; margin: 10px 0;">'
                                                    text_parts.append(image_html)
                                    
                                    # Also extract text content
                                    result_text = result_content[0].get("text", "")
                                    
                                    if result_text and len(result_text) > 50:  # Only capture substantial results
                                        # Check for image generation markers and add to events
                                        import re
                                        import os
                                        import base64
                                        
                                        if '[Generated image:' in result_text or '[Generated chart:' in result_text:
                                            
                                            def collect_image_marker(match):
                                                nonlocal found_image_urls
                                                filename = match.group(1).strip()
                                                output_dir = os.path.join(os.getcwd(), 'output')
                                                image_path = os.path.join(output_dir, filename)
                                                
                                                try:
                                                    if os.path.exists(image_path):
                                                        # Use relative URL that works with both HTTP and HTTPS
                                                        image_url = f"/query-get-image/{filename}"
                                                        found_image_urls.append(image_url)
                                                        
                                                        # Return empty string to remove marker from tool result text
                                                        return ""
                                                except Exception as e:
                                                    print(f"Error loading image {filename}: {e}")
                                                
                                                return f"[Generated image: {filename}]"
                                            
                                            # First pass: collect all image URLs and remove markers
                                            result_text = re.sub(r'\[Generated (?:image|chart):\s*([^\]]+)\]', collect_image_marker, result_text)
                                            
                                            # Store the last image URL for backward compatibility
                                            if found_image_urls:
                                                found_image_url = found_image_urls[-1]
                                            
                                            # Add all collected images to the main text response
                                            if found_image_urls:
                                                image_html_parts = []
                                                for image_url in found_image_urls:
                                                    # Use single quotes to avoid JSON escaping issues
                                                    image_html_parts.append(f"<img src='{image_url}' style='max-width: 300px; height: auto; border-radius: 8px; margin: 10px 0;'>")
                                                
                                                # Add all images to the result text
                                                result_text += '\\n\\n' + '\\n\\n'.join(image_html_parts)
                                        
                                        # Clean text for JSON safety - replace problematic chars
                                        safe_text = result_text.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n').replace('\r', '\\r')
                                        text_parts.append(safe_text)
                            tools.append("tool_result")
                            # Add tool name if available from previous toolUse
                            if hasattr(self, '_last_tool_name'):
                                data["tool_name"] = self._last_tool_name
                
                if text_parts:
                    main_content = " ".join(text_parts)
                    
                    # Check if this is thinking content for assistant role
                    if data.get("role") == "assistant" and main_content.strip().startswith("<thinking>"):
                        data["content"] = main_content  # Full thinking content for events panel
                        data["user_display"] = "Thinking..."  # Simplified text for user conversation
                    else:
                        data["content"] = main_content
                    
                    # If we found images and the tool was image_assistant or data_visualizer_assistant, create a separate message
                    if found_image_urls and hasattr(self, '_last_tool_name') and self._last_tool_name in ['image_assistant', 'data_visualizer_assistant']:
                        # Send a separate assistant message with all images
                        import time
                        all_images_html = []
                        for image_url in found_image_urls:
                            all_images_html.append(f'<img src="{image_url}" style="width:100%;max-width:300px;height:auto;border-radius:8px;margin:10px 0" alt="Generated visualization">')
                        
                        image_message = {
                            "timestamp": time.time(),
                            "type": "assistant_message",
                            "content": '\n\n'.join(all_images_html),
                            "role": "assistant"
                        }
                        if self.event_callback:
                            self.event_callback(image_message)
                if tools:
                    data["tools"] = ", ".join(tools)
            elif isinstance(content, str):
                data["content"] = content[:100] + "..." if len(content) > 100 else content
        
        # Reasoning
        if kwargs.get("reasoning"):
            data["reasoning_text"] = kwargs.get("reasoningText", "")[:100] + "..." if len(kwargs.get("reasoningText", "")) > 100 else kwargs.get("reasoningText", "")
        
        # Raw events - already handled by _get_event_type extraction
        if "event" in kwargs:
            # Skip if this is a metadata event
            if isinstance(kwargs["event"], dict) and "metadata" in kwargs["event"]:
                pass  # Skip raw event processing for metadata
            else:
                event_str = str(kwargs["event"])
                try:
                    import ast
                    event_dict = ast.literal_eval(event_str)
                    if isinstance(event_dict, dict) and len(event_dict) == 1:
                        inner_content = list(event_dict.values())[0]
                        if isinstance(inner_content, dict):
                            # Format as key: value pairs
                            formatted_pairs = []
                            for k, v in inner_content.items():
                                formatted_pairs.append(f"{k}: {v}")
                            data["formatted_content"] = "\n".join(formatted_pairs)
                        else:
                            data["formatted_content"] = str(inner_content)
                    else:
                        data["raw_event"] = event_str[:100] + "..." if len(event_str) > 100 else event_str
                except:
                    data["raw_event"] = event_str[:100] + "..." if len(event_str) > 100 else event_str
        
        # Results - show truncated result
        if "result" in kwargs:
            result_str = str(kwargs["result"])
            data["result"] = result_str[:250] + "..." if len(result_str) > 250 else result_str
        
        # Metadata - format usage and metrics nicely
        metadata = None
        if "metadata" in kwargs:
            metadata = kwargs["metadata"]
        elif "event" in kwargs and isinstance(kwargs["event"], dict) and "metadata" in kwargs["event"]:
            metadata = kwargs["event"]["metadata"]
            
        if metadata and isinstance(metadata, dict):
            if "usage" in metadata:
                usage = metadata["usage"]
                data["tokens"] = f"<strong>tokens in:</strong> {usage.get('inputTokens', 0)} &nbsp; <strong>tokens out:</strong> {usage.get('outputTokens', 0)} &nbsp; <strong>total tokens:</strong> {usage.get('totalTokens', 0)}"
            if "metrics" in metadata:
                metrics = metadata["metrics"]
                data["latency"] = f"<strong>latency:</strong> {metrics.get('latencyMs', 0)}ms<br/>"
        
        # Lifecycle events
        if kwargs.get("force_stop_reason"):
            data["stop_reason"] = kwargs["force_stop_reason"]
        
        return data
    
    def get_events(self):
        """Get all captured events"""
        return self.events
    
    def clear_events(self):
        """Clear captured events"""
        self.events = []
