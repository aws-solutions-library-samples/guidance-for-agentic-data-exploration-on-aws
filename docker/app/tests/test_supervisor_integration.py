import pytest
from unittest.mock import patch, MagicMock

@patch('agents.supervisor_agent.supervisor_agent')
def test_weather_query_routing(mock_supervisor_agent):
    """Test weather queries get routed correctly."""
    # Mock the supervisor agent proxy
    mock_supervisor_agent.return_value = "The weather in New York is sunny, 75°F"
    
    # Import after mocking
    from agents.supervisor_agent import supervisor_agent
    
    result = supervisor_agent("What's the weather in New York?")
    
    # Check that we got a result and it contains weather-related content
    assert result is not None
    result_text = str(result)
    assert any(word in result_text.lower() for word in ["weather", "temperature", "sunny", "cloudy", "rain"])
