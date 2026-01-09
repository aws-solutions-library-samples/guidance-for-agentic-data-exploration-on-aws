import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
from app import app

client = TestClient(app)

def test_health_check():
    """Test health endpoint returns 200."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_conversation_endpoint():
    """Test conversation history endpoint"""
    response = client.get("/conversation")
    assert response.status_code == 200
    data = response.json()
    assert "messages" in data
    assert "total" in data
    assert isinstance(data["messages"], list)
    assert isinstance(data["total"], int)

def test_clear_conversation_endpoint():
    """Test clear conversation endpoint"""
    response = client.post("/clear-conversation")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "message" in data

# def test_conversation_after_clear():
#     """Test that conversation is empty after clearing"""
#     # Clear conversation first
#     client.post("/clear-conversation")
    
#     # Check conversation is empty
#     response = client.get("/conversation")
#     assert response.status_code == 200
#     data = response.json()
#     assert data["total"] == 0
#     assert len(data["messages"]) == 0

def test_suggestions_config_structure():
    """Test that suggestions config file has correct structure"""
    import os
    import json
    
    # Look for suggestions.json in UI static directory
    config_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'ui', 'static', 'suggestions.json')
    
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            data = json.load(f)
        
        assert 'suggestions' in data
        assert isinstance(data['suggestions'], list)
        assert len(data['suggestions']) > 0
        
        # Validate each suggestion has required fields
        for suggestion in data['suggestions']:
            assert 'text' in suggestion
            assert 'category' in suggestion
            assert len(suggestion['text'].strip()) > 0
            assert len(suggestion['category'].strip()) > 0

def test_query_endpoint_validation():
    """Test query endpoint validation."""
    # Missing prompt
    response = client.post("/query-streaming-with-events", json={})
    assert response.status_code == 422
    
    # Empty prompt
    response = client.post("/query-streaming-with-events", json={"prompt": ""})
    assert response.status_code == 400

def test_streaming_endpoint_validation():
    """Test streaming endpoint validation."""
    # Missing prompt
    response = client.post("/query-streaming-with-events", json={})
    assert response.status_code == 422

@patch('app.supervisor_agent')
def test_query_endpoint_mock_success(mock_supervisor):
    """Test successful query with mocked supervisor."""
    # Mock the streaming response
    async def mock_stream_async(prompt):
        yield "Mocked response"
    
    mock_supervisor.stream_async = mock_stream_async
    mock_supervisor.callback_handler = None
    
    response = client.post("/query-streaming-with-events", json={"prompt": "test query"})
    
    assert response.status_code == 200
    # For streaming responses, check that we get some content
    assert len(response.content) > 0

@patch('agents.supervisor_agent.get_supervisor_agent')
def test_query_endpoint_mock_error(mock_get_supervisor):
    """Test query endpoint error handling."""
    # Create a mock supervisor instance
    mock_supervisor = MagicMock()
    mock_get_supervisor.return_value = mock_supervisor
    
    # Mock the streaming response to raise an error
    async def mock_stream_async_error(prompt):
        raise Exception("Test error")
        yield  # This won't be reached but makes it a generator
    
    mock_supervisor.stream_async = mock_stream_async_error
    mock_supervisor.callback_handler = None
    
    response = client.post("/query-streaming-with-events", json={"prompt": "test"})
    
    # The endpoint handles errors gracefully and still returns 200 with error message
    assert response.status_code == 200
    # Check that a generic error message appears (not the raw exception for security)
    assert "An error occurred while processing your request" in response.text

def test_prompt_request_model():
    """Test PromptRequest model validation."""
    from app import PromptRequest
    
    # Valid prompt
    request = PromptRequest(prompt="test")
    assert request.prompt == "test"
    
    # Test that prompt is required
    with pytest.raises(ValueError):
        PromptRequest()

def test_supervisor_system_prompt_structure():
    """Test supervisor system prompt contains expected sections."""
    from agents.supervisor_agent import SUPERVISOR_SYSTEM_PROMPT
    
    expected_agents = [
        "Supply Chain Assistant",
        "Schema Translator",
        "Data Analyzer",
        "Graph Agent",
        "Data Visualizer Agent",
        "General Assistant"
    ]
    
    for agent in expected_agents:
        assert agent in SUPERVISOR_SYSTEM_PROMPT
    
    # Check for key routing instructions
    assert "analyze incoming queries" in SUPERVISOR_SYSTEM_PROMPT.lower()
    assert "route" in SUPERVISOR_SYSTEM_PROMPT.lower()

@patch('agents.schema_assistant.Agent')
def test_schema_translator_basic_functionality(mock_agent_class):
    """Test schema translator basic functionality with mocked agent."""
    from agents.schema_assistant import schema_translator
    
    # Mock the agent response
    mock_agent = MagicMock()
    mock_agent.return_value = "[Order] —(PLACED_BY)→ [Customer]"
    mock_agent_class.return_value = mock_agent
    
    # Test basic schema conversion
    result = schema_translator("CREATE TABLE orders (id INT, customer_id INT, FOREIGN KEY (customer_id) REFERENCES customers(id));")
    
    assert "[Order] —(PLACED_BY)→ [Customer]" in result
    mock_agent_class.assert_called_once()

@patch('agents.schema_assistant.Agent')
def test_data_analyzer_basic_functionality(mock_agent_class):
    """Test data analyzer basic functionality with mocked agent."""
    from agents.schema_assistant import data_analyzer
    
    # Mock the agent response
    mock_agent = MagicMock()
    mock_agent.return_value = "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));"
    mock_agent_class.return_value = mock_agent
    
    # Test data analysis
    result = data_analyzer("Sample CSV data: id,name\n1,John\n2,Jane")
    
    assert "CREATE TABLE" in result
    mock_agent_class.assert_called_once()

def test_schema_translator_error_handling():
    """Test schema translator error handling."""
    from agents.schema_assistant import schema_translator
    
    with patch('agents.schema_assistant.Agent') as mock_agent_class:
        mock_agent_class.side_effect = Exception("Test error")
        
        result = schema_translator("invalid schema")
        
        assert "Error processing schema conversion" in result
        assert "Test error" in result

def test_data_analyzer_error_handling():
    """Test data analyzer error handling."""
    from agents.schema_assistant import data_analyzer
    
    with patch('agents.schema_assistant.Agent') as mock_agent_class:
        mock_agent_class.side_effect = Exception("Test error")
        
        result = data_analyzer("invalid data")
        
        assert "Error analyzing data" in result
        assert "Test error" in result

def test_schema_translator_system_prompt():
    """Test schema translator system prompt contains required elements."""
    from agents.schema_assistant import SCHEMA_TRANSLATOR_SYSTEM_PROMPT
    
    required_elements = [
        "conversion specialist",
        "relational schemas to graph schemas",
        "FK table → referenced table",
        "[Vertex] —(edge)→ [Vertex]"
    ]
    
    for element in required_elements:
        assert element in SCHEMA_TRANSLATOR_SYSTEM_PROMPT

def test_data_analyzer_system_prompt():
    """Test data analyzer system prompt contains required elements."""
    from agents.schema_assistant import DATA_ANALYZER_SYSTEM_PROMPT
    
    required_elements = [
        "schema analyst",
        "sample data",
        "CREATE TABLE",
        "data types"
    ]
    
    for element in required_elements:
        assert element in DATA_ANALYZER_SYSTEM_PROMPT
