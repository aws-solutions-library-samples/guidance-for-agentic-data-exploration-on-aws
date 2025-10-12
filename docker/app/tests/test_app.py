import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app import app

client = TestClient(app)

def test_health_check():
    """Test health endpoint returns 200."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_query_streaming_endpoint_missing_prompt():
    """Test streaming endpoint with missing prompt."""
    response = client.post("/query-streaming-with-events", json={})
    assert response.status_code == 422  # Validation error

@patch('app.supervisor_agent')
def test_streaming_endpoint_success(mock_supervisor):
    """Test successful streaming response."""
    mock_stream = MagicMock()
    mock_stream.stream_async.return_value = [
        {"data": "Hello "},
        {"data": "world!"}
    ]
    mock_supervisor.return_value = mock_stream
    
    with patch('app.supervisor_agent', mock_stream):
        response = client.post("/query-streaming-with-events", json={"prompt": "test"})
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/plain; charset=utf-8"
