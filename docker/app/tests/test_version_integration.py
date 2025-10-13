"""Integration tests for version functionality."""
import pytest
import json
import os
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_version_integration_flow():
    """Test complete version flow from script to API."""
    # Test that version endpoint works
    response = client.get("/version")
    assert response.status_code == 200
    
    data = response.json()
    assert "version" in data
    assert "build_date" in data
    assert "git_commit" in data
    
    # If version.json exists, verify it matches API response
    version_file = os.path.join(os.path.dirname(__file__), '..', 'version.json')
    if os.path.exists(version_file):
        with open(version_file, 'r') as f:
            file_data = json.load(f)
        
        assert data["version"] == file_data["version"]
        assert data["build_date"] == file_data["build_date"]
        assert data["git_commit"] == file_data["git_commit"]

def test_health_and_version_endpoints():
    """Test that both health and version endpoints work."""
    health_response = client.get("/health")
    version_response = client.get("/version")
    
    assert health_response.status_code == 200
    assert version_response.status_code == 200
    
    assert health_response.json() == {"status": "healthy"}
    
    version_data = version_response.json()
    assert isinstance(version_data["version"], str)
    assert isinstance(version_data["build_date"], str)
    assert isinstance(version_data["git_commit"], str)