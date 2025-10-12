import os
import boto3
from strands.models import BedrockModel
from strands.hooks import HookProvider, HookRegistry, MessageAddedEvent, AfterInvocationEvent

class BedrockGuardrailConfig:
    """Configuration for Bedrock guardrails"""
    
    def __init__(self):
        self.guardrail_id = os.getenv("BEDROCK_GUARDRAIL_ID")
        self.guardrail_version = os.getenv("BEDROCK_GUARDRAIL_VERSION", "1")
        self.region = os.getenv("AWS_REGION", "us-east-1")
        
        if not self.guardrail_id:
            raise ValueError("BEDROCK_GUARDRAIL_ID environment variable is required")

    def create_protected_model(self, model_id: str = None):
        """Create a BedrockModel with guardrails enabled"""
        if model_id is None:
            # Always check environment variable first (for evaluation override)
            env_model = os.getenv("AGENT_MODEL")
            if env_model:
                model_id = env_model
                print(f"🛡️ GUARDRAILS: Using AGENT_MODEL env var: {model_id}")
            else:
                # Final fallback - don't try to import from app to avoid circular imports
                model_id = "us.anthropic.claude-sonnet-4-20250514-v1:0"
                print(f"🛡️ GUARDRAILS: Using fallback: {model_id}")
        else:
            print(f"🛡️ GUARDRAILS: Using model: {model_id}")
        
        return BedrockModel(
            model_id=model_id,
            guardrail_id=self.guardrail_id,
            guardrail_version=self.guardrail_version,
            guardrail_trace="enabled",
        )

class NotifyOnlyGuardrailsHook(HookProvider):
    """Hook for shadow mode guardrail monitoring"""
    
    def __init__(self, guardrail_id: str, guardrail_version: str, region: str = "us-east-1"):
        self.guardrail_id = guardrail_id
        self.guardrail_version = guardrail_version
        self.bedrock_client = boto3.client("bedrock-runtime", region)

    def register_hooks(self, registry: HookRegistry) -> None:
        registry.add_callback(MessageAddedEvent, self.check_user_input)
        registry.add_callback(AfterInvocationEvent, self.check_assistant_response)

    def evaluate_content(self, content: str, source: str = "INPUT"):
        """Evaluate content using Bedrock ApplyGuardrail API in shadow mode"""
        try:
            response = self.bedrock_client.apply_guardrail(
                guardrailIdentifier=self.guardrail_id,
                guardrailVersion=self.guardrail_version,
                source=source,
                content=[{"text": {"text": content}}]
            )

            if response.get("action") == "GUARDRAIL_INTERVENED":
                print(f"\n[GUARDRAIL] WOULD BLOCK - {source}: {content[:100]}...")
                for assessment in response.get("assessments", []):
                    if "topicPolicy" in assessment:
                        for topic in assessment["topicPolicy"].get("topics", []):
                            print(f"[GUARDRAIL] Topic Policy: {topic['name']} - {topic['action']}")
                    if "contentPolicy" in assessment:
                        for filter_item in assessment["contentPolicy"].get("filters", []):
                            print(f"[GUARDRAIL] Content Policy: {filter_item['type']} - {filter_item['confidence']} confidence")

        except Exception as e:
            print(f"[GUARDRAIL] Evaluation failed: {e}")

    def check_user_input(self, event: MessageAddedEvent) -> None:
        """Check user input before model invocation"""
        if event.message.get("role") == "user":
            content = "".join(block.get("text", "") for block in event.message.get("content", []))
            if content:
                self.evaluate_content(content, "INPUT")

    def check_assistant_response(self, event: AfterInvocationEvent) -> None:
        """Check assistant response after model invocation"""
        if event.agent.messages and event.agent.messages[-1].get("role") == "assistant":
            assistant_message = event.agent.messages[-1]
            content = "".join(block.get("text", "") for block in assistant_message.get("content", []))
            if content:
                self.evaluate_content(content, "OUTPUT")
