"""Utility functions for agent model configuration"""

def get_current_model():
    """Get the current model from app or environment"""
    try:
        from app import current_chat_model
        return current_chat_model
    except ImportError:
        import os
        return os.getenv("AGENT_MODEL", None)
