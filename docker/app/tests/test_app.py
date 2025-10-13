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

def test_version_endpoint():
    """Test version endpoint returns version information."""
    response = client.get("/version")
    assert response.status_code == 200
    
    data = response.json()
    assert "version" in data
    assert "build_date" in data
    assert "git_commit" in data
    
    # Should have valid version format or 'unknown'
    assert isinstance(data["version"], str)
    assert isinstance(data["build_date"], str)
    assert isinstance(data["git_commit"], str)

@patch('builtins.open')
@patch('os.path.exists')
def test_version_endpoint_with_file(mock_exists, mock_open):
    """Test version endpoint when version.json exists."""
    mock_exists.return_value = True
    mock_open.return_value.__enter__.return_value.read.return_value = '{"version": "2.0.3", "build_date": "2023-01-01T00:00:00Z", "git_commit": "abc123"}'
    
    response = client.get("/version")
    assert response.status_code == 200
    
    data = response.json()
    assert data["version"] == "2.0.3"
    assert data["build_date"] == "2023-01-01T00:00:00Z"
    assert data["git_commit"] == "abc123"

@patch('os.path.exists')
def test_version_endpoint_no_file(mock_exists):
    """Test version endpoint when version.json doesn't exist."""
    mock_exists.return_value = False
    
    response = client.get("/version")
    assert response.status_code == 200
    
    data = response.json()
    assert data["version"] == "unknown"
    assert data["build_date"] == "unknown"
    assert data["git_commit"] == "unknown"

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
