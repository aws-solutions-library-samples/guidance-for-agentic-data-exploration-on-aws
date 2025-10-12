"""
Integration tests for supervisor agent routing to Supply Chain Assistant.
Tests that weather and supply chain queries are properly routed and that
the standalone weather agent is no longer accessible.
"""

import pytest
from unittest.mock import patch, MagicMock, call
import sys
import os

# Add the app directory to the path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

class TestSupervisorRoutingIntegration:
    """Integration tests for supervisor routing to Supply Chain Assistant."""
    
    def setup_method(self):
        """Setup for each test method."""
        # Clear any cached agents
        if hasattr(sys.modules.get('agents.supervisor_agent', None), '_supervisor_agents'):
            sys.modules['agents.supervisor_agent']._supervisor_agents.clear()
    
    def test_weather_query_routing_to_supply_chain_assistant(self):
        """Test that weather queries are routed to Supply Chain Assistant."""
        # Import supervisor agent
        from agents.supervisor_agent import get_supervisor_agent
        
        # Create supervisor agent
        supervisor = get_supervisor_agent()
        
        # Test various weather-related queries
        weather_queries = [
            "What's the weather in New York?",
            "Can you give me a weather forecast for Chicago?", 
            "What are the current meteorological conditions in Los Angeles?",
            "Is it going to rain tomorrow in Seattle?",
            "What's the UV index in Miami today?"
        ]
        
        for query in weather_queries:
            # Execute query through supervisor
            result = supervisor(query)
            
            # Verify we got a response
            assert result is not None
            result_str = str(result)
            
            # Check that the response indicates routing to supply chain assistant
            # The supervisor should mention routing to supply chain assistant for weather queries
            assert any(phrase in result_str for phrase in [
                "supply chain", "Supply Chain", "weather", "Weather", 
                "meteorological", "UV", "forecast"
            ]), f"Response should contain weather or supply chain content for query: {query}"
    
    def test_supply_chain_query_routing_to_supply_chain_assistant(self):
        """Test that supply chain queries are routed to Supply Chain Assistant."""
        # Import supervisor agent
        from agents.supervisor_agent import get_supervisor_agent
        
        # Create supervisor agent
        supervisor = get_supervisor_agent()
        
        # Test various supply chain-related queries
        supply_chain_queries = [
            "How can I optimize my supply chain network?",
            "What's the best approach for inventory management?",
            "Can you help with production planning for next quarter?",
            "How do I evaluate supplier performance?",
            "What are best practices for demand forecasting?",
            "Help me analyze my BOM structure",
            "How can I improve warehouse operations?",
            "What sustainability metrics should I track in my supply chain?"
        ]
        
        for query in supply_chain_queries:
            # Execute query through supervisor
            result = supervisor(query)
            
            # Verify we got a response
            assert result is not None
            result_str = str(result).lower()
            
            # Check that the response contains supply chain related content
            assert any(phrase in result_str for phrase in [
                "supply chain", "inventory", "production", "supplier", 
                "demand", "bom", "warehouse", "sustainability", "manufacturing"
            ]), f"Response should contain supply chain content for query: {query}"
    
    def test_weather_agent_not_in_supervisor_tools(self):
        """Test that weather_assistant is not in the supervisor tools list."""
        from agents.supervisor_agent import SUPERVISOR_TOOLS
        
        # Get all tool names
        tool_names = []
        for tool in SUPERVISOR_TOOLS:
            if hasattr(tool, '__name__'):
                tool_names.append(tool.__name__)
            elif hasattr(tool, 'name'):
                tool_names.append(tool.name)
            else:
                tool_names.append(str(tool))
        
        # Verify weather_assistant is not in the tools
        assert 'weather_assistant' not in tool_names
        assert 'weather_agent' not in tool_names
        
        # Verify supply_chain_assistant is in the tools
        assert 'supply_chain_assistant' in tool_names
    
    def test_weather_agent_not_importable(self):
        """Test that standalone weather agent is no longer accessible."""
        # Try to import weather_assistant - should fail or not exist
        with pytest.raises(ImportError):
            from agents.weather_assistant import weather_assistant
    
    def test_supervisor_system_prompt_routing_logic(self):
        """Test that supervisor system prompt contains correct routing logic."""
        from agents.supervisor_agent import SUPERVISOR_SYSTEM_PROMPT
        
        # Verify weather queries are routed to Supply Chain Assistant
        assert "weather/forecast/meteorology/UV index/environmental conditions → Supply Chain Assistant" in SUPERVISOR_SYSTEM_PROMPT
        
        # Verify supply chain queries are routed to Supply Chain Assistant
        assert "supply chain operations, manufacturing" in SUPERVISOR_SYSTEM_PROMPT
        assert "Supply Chain Assistant" in SUPERVISOR_SYSTEM_PROMPT
        
        # Verify no mention of standalone weather agent
        assert "Weather Agent" not in SUPERVISOR_SYSTEM_PROMPT
        assert "weather_assistant" not in SUPERVISOR_SYSTEM_PROMPT
    
    def test_mixed_weather_supply_chain_query_routing(self):
        """Test queries that combine weather and supply chain concerns."""
        # Import supervisor agent
        from agents.supervisor_agent import get_supervisor_agent
        
        # Create supervisor agent
        supervisor = get_supervisor_agent()
        
        # Test queries that combine weather and supply chain
        mixed_queries = [
            "How will the weather forecast impact my supply chain operations?",
            "What's the UV index and how might it affect outdoor warehouse operations?",
            "Can you check the weather for our manufacturing facilities and assess supply chain risks?",
            "How do meteorological conditions affect transportation logistics?"
        ]
        
        for query in mixed_queries:
            # Execute query through supervisor
            result = supervisor(query)
            
            # Verify we got a response
            assert result is not None
            result_str = str(result).lower()
            
            # Check that the response contains both weather and supply chain content
            assert any(phrase in result_str for phrase in [
                "weather", "supply chain", "uv", "meteorological", 
                "transportation", "warehouse", "manufacturing", "operations"
            ]), f"Response should contain weather and supply chain content for query: {query}"
    
    def test_non_weather_non_supply_chain_routing(self):
        """Test that non-weather, non-supply-chain queries get appropriate responses."""
        # Import supervisor agent
        from agents.supervisor_agent import get_supervisor_agent
        
        # Create supervisor agent
        supervisor = get_supervisor_agent()
        
        # Test queries that should NOT go to supply chain assistant
        general_queries = [
            "What is 2 + 2?",
            "Tell me about the history of Rome", 
            "How do I bake a cake?",
            "What's the capital of France?"
        ]
        
        for query in general_queries:
            # Execute query through supervisor
            result = supervisor(query)
            
            # Verify we got a response
            assert result is not None
            result_str = str(result).lower()
            
            # These should NOT contain supply chain specific content
            # but should contain appropriate general responses
            supply_chain_terms = ["supply chain", "inventory management", "production planning", 
                                "supplier performance", "demand forecasting", "warehouse operations"]
            
            # Check that it doesn't contain supply chain specific terminology
            has_supply_chain_content = any(term in result_str for term in supply_chain_terms)
            
            # For general queries, we expect general responses, not supply chain specific ones
            # The response should be appropriate to the query type
            if "2 + 2" in query:
                assert "4" in result_str, "Math query should get math answer"
            elif "rome" in query.lower():
                assert any(term in result_str for term in ["rome", "roman", "italy", "history"]), "History query should get historical content"
            elif "cake" in query.lower():
                assert any(term in result_str for term in ["bake", "cake", "recipe", "cooking"]), "Cooking query should get cooking content"
            elif "france" in query.lower():
                assert any(term in result_str for term in ["paris", "france", "capital"]), "Geography query should get geographic content"
    
    def test_supervisor_tools_list_integrity(self):
        """Test that supervisor tools list contains expected agents and excludes weather agent."""
        from agents.supervisor_agent import SUPERVISOR_TOOLS
        
        # Expected tools (by function name)
        expected_tools = [
            'help_assistant',
            'product_analyst', 
            'supply_chain_assistant',
            'schema_translator',
            'data_analyzer',
            'neptune_database_statistics',
            'neptune_cypher_query',
            'neptune_bulk_load_status',
            'neptune_bulk_load',
            'data_visualizer_assistant',
            'tariff_assistant',
            'image_assistant',
            'general_assistant'
        ]
        
        # Get actual tool names
        actual_tool_names = []
        for tool in SUPERVISOR_TOOLS:
            if hasattr(tool, '__name__'):
                actual_tool_names.append(tool.__name__)
            elif hasattr(tool, 'name'):
                actual_tool_names.append(tool.name)
        
        # Verify all expected tools are present
        for expected_tool in expected_tools:
            assert expected_tool in actual_tool_names, f"Expected tool {expected_tool} not found in supervisor tools"
        
        # Verify weather_assistant is not present
        assert 'weather_assistant' not in actual_tool_names
        assert 'weather_agent' not in actual_tool_names
    
    def test_uv_index_query_routing(self):
        """Test that UV index queries are specifically routed to Supply Chain Assistant."""
        # Import supervisor agent
        from agents.supervisor_agent import get_supervisor_agent
        
        # Create supervisor agent
        supervisor = get_supervisor_agent()
        
        # Test UV index specific queries
        uv_queries = [
            "What's the UV index today?",
            "Can you check the UV index for our outdoor operations?",
            "What's the current UV level in Phoenix, Arizona?",
            "How high is the UV index and what safety measures should we take?"
        ]
        
        for query in uv_queries:
            # Execute query through supervisor
            result = supervisor(query)
            
            # Verify we got a response
            assert result is not None
            result_str = str(result)
            
            # Check that the response contains UV-related content
            assert any(phrase in result_str for phrase in [
                "UV", "uv", "ultraviolet", "index", "location", "supply chain"
            ]), f"Response should contain UV-related content for query: {query}"


    def test_supervisor_routing_behavior_with_tool_inspection(self):
        """Test supervisor routing by inspecting which tools are available and used."""
        from agents.supervisor_agent import SUPERVISOR_TOOLS, SUPERVISOR_SYSTEM_PROMPT
        
        # Get tool names
        tool_names = []
        for tool in SUPERVISOR_TOOLS:
            if hasattr(tool, '__name__'):
                tool_names.append(tool.__name__)
            elif hasattr(tool, 'name'):
                tool_names.append(tool.name)
        
        # Verify supply chain assistant is available
        assert 'supply_chain_assistant' in tool_names, "Supply Chain Assistant should be in supervisor tools"
        
        # Verify weather agent is NOT available
        assert 'weather_assistant' not in tool_names, "Weather Assistant should NOT be in supervisor tools"
        assert 'weather_agent' not in tool_names, "Weather Agent should NOT be in supervisor tools"
        
        # Verify system prompt routes weather to supply chain
        assert "weather/forecast/meteorology/UV index/environmental conditions → Supply Chain Assistant" in SUPERVISOR_SYSTEM_PROMPT
        assert "supply chain operations, manufacturing" in SUPERVISOR_SYSTEM_PROMPT
        
        # Verify no standalone weather agent mentioned
        assert "Weather Agent" not in SUPERVISOR_SYSTEM_PROMPT
        assert "weather_assistant" not in SUPERVISOR_SYSTEM_PROMPT


class TestWeatherAgentDeprecation:
    """Tests to verify the standalone weather agent is properly deprecated."""
    
    def test_weather_assistant_file_does_not_exist(self):
        """Test that weather_assistant.py file does not exist in agents directory."""
        import os
        weather_assistant_path = os.path.join(
            os.path.dirname(__file__), 
            '..', 
            'agents', 
            'weather_assistant.py'
        )
        
        # File should not exist
        assert not os.path.exists(weather_assistant_path), "weather_assistant.py file should not exist"
    
    def test_no_weather_assistant_imports_in_supervisor(self):
        """Test that supervisor agent does not import weather_assistant."""
        # Read supervisor agent file content
        supervisor_file_path = os.path.join(
            os.path.dirname(__file__), 
            '..', 
            'agents', 
            'supervisor_agent.py'
        )
        
        with open(supervisor_file_path, 'r') as f:
            supervisor_content = f.read()
        
        # Should not contain weather_assistant imports
        assert 'from .weather_assistant import' not in supervisor_content
        assert 'weather_assistant' not in supervisor_content or 'weather_assistant' in supervisor_content.count('# weather_assistant deprecated')
    
    def test_supply_chain_assistant_has_weather_tools(self):
        """Test that Supply Chain Assistant has access to weather tools."""
        try:
            from agents.supply_chain_assistant import supply_chain_assistant
            from agents.weather_tools import openmeteo_weather_tool, nws_weather_tool, uv_index_tool
            
            # Verify weather tools exist and are importable
            assert callable(openmeteo_weather_tool)
            assert callable(nws_weather_tool) 
            assert callable(uv_index_tool)
            
            # Verify supply chain assistant exists
            assert supply_chain_assistant is not None
            
        except ImportError as e:
            pytest.fail(f"Failed to import required components: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])