"""
Integration tests for multi-agent system functionality
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
import sys
import os

# Add parent directory to path to import app
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from app import app

client = TestClient(app)

def test_streaming_endpoint_integration():
    """Test that streaming endpoint works with real agent routing."""
    response = client.post("/query-streaming-with-events", json={"prompt": "Hello, test message"})
    
    assert response.status_code == 200
    assert response.headers.get("content-type") == "text/plain; charset=utf-8"
    
    # Read the streaming response
    content = response.text
    assert len(content) > 0  # Should have some response content
