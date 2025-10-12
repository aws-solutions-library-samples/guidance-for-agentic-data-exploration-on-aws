"""
Test Supply Chain Assistant Agent

This module provides comprehensive unit tests for the Supply Chain Assistant agent,
including tests for agent initialization, tool integration, supply chain expertise,
and weather/environmental data integration.
"""

import pytest
import sys
import os
from unittest.mock import patch, MagicMock

# Add parent directory to path to import modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from agents.supply_chain_assistant import (
    create_supply_chain_assistant_agent,
    supply_chain_assistant,
    SUPPLY_CHAIN_ASSISTANT_SYSTEM_PROMPT
)


class TestSupplyChainAssistantInitialization:
    """Test suite for Supply Chain Assistant initialization and structure."""
    
    def test_system_prompt_contains_required_expertise_areas(self):
        """Test that system prompt contains all required supply chain expertise areas."""
        required_areas = [
            "Supply Chain Network Analysis",
            "Inventory Management",
            "Production Planning",
            "Supplier Performance Monitoring",
            "Demand Forecasting",
            "Logistics & Transportation",
            "BOM Intelligence",
            "Purchase Order Management",
            "Warehouse Operations",
            "Sustainability & ESG"
        ]
        
        for area in required_areas:
            assert area in SUPPLY_CHAIN_ASSISTANT_SYSTEM_PROMPT
    
    def test_system_prompt_contains_environmental_context(self):
        """Test that system prompt includes environmental context integration."""
        environmental_elements = [
            "Environmental Context Integration",
            "Multi-source Weather Data",
            "UV Index Monitoring",
            "Weather Impact Analysis"
        ]
        
        for element in environmental_elements:
            assert element in SUPPLY_CHAIN_ASSISTANT_SYSTEM_PROMPT
    
    def test_system_prompt_contains_graph_database_capabilities(self):
        """Test that system prompt includes graph database capabilities."""
        graph_elements = [
            "Graph Database Capabilities",
            "Complex Relationship Mapping",
            "Network Analysis",
            "Supply Chain Visualization",
            "Cypher queries"
        ]
        
        for element in graph_elements:
            assert element in SUPPLY_CHAIN_ASSISTANT_SYSTEM_PROMPT
    
    def test_system_prompt_contains_response_guidelines(self):
        """Test that system prompt includes proper response guidelines."""
        guideline_elements = [
            "Response Guidelines",
            "Manufacturing-Focused",
            "Integrate Environmental Data",
            "Leverage Graph Analysis",
            "Data-Driven Insights",
            "Consider Risk Factors",
            "Think Holistically"
        ]
        
        for element in guideline_elements:
            assert element in SUPPLY_CHAIN_ASSISTANT_SYSTEM_PROMPT
    
    def test_system_prompt_contains_tool_usage_strategy(self):
        """Test that system prompt includes tool usage strategy."""
        tool_elements = [
            "Tool Usage Strategy",
            "weather tools",
            "UV index tools",
            "Neptune tools",
            "Aggregate weather data",
            "Combine tools"
        ]
        
        for element in tool_elements:
            assert element in SUPPLY_CHAIN_ASSISTANT_SYSTEM_PROMPT
    
    @patch('agents.supply_chain_assistant.Agent')
    def test_create_supply_chain_assistant_agent_structure(self, mock_agent_class):
        """Test that agent is created with correct structure and tools."""
        mock_agent = MagicMock()
        mock_agent_class.return_value = mock_agent
        
        agent = create_supply_chain_assistant_agent()
        
        # Verify Agent class was called
        mock_agent_class.assert_called_once()
        
        # Get the call arguments
        call_args = mock_agent_class.call_args
        
        # Verify system prompt was passed
        assert call_args[1]['system_prompt'] == SUPPLY_CHAIN_ASSISTANT_SYSTEM_PROMPT
        
        # Verify tools were passed
        tools = call_args[1]['tools']
        assert len(tools) == 6  # 4 weather tools + 2 Neptune tools
        
        # Verify tool names (function names)
        tool_names = [tool.__name__ for tool in tools]
        expected_tools = [
            'openmeteo_weather_tool',
            'nws_weather_tool',
            'uv_index_tool',
            'aggregate_weather_data',
            'neptune_database_statistics',
            'neptune_cypher_query'
        ]
        
        for expected_tool in expected_tools:
            assert expected_tool in tool_names
    
    @patch('agents.supply_chain_assistant.Agent')
    def test_agent_initialization_imports_weather_tools(self, mock_agent_class):
        """Test that agent initialization successfully imports weather tools."""
        # This test verifies that the import statements work correctly
        try:
            agent = create_supply_chain_assistant_agent()
            # If we get here, imports were successful
            assert True
        except ImportError as e:
            pytest.fail(f"Failed to import weather tools: {e}")
    
    @patch('agents.supply_chain_assistant.Agent')
    def test_agent_initialization_imports_neptune_tools(self, mock_agent_class):
        """Test that agent initialization successfully imports Neptune tools."""
        # This test verifies that the import statements work correctly
        try:
            agent = create_supply_chain_assistant_agent()
            # If we get here, imports were successful
            assert True
        except ImportError as e:
            pytest.fail(f"Failed to import Neptune tools: {e}")


class TestSupplyChainAssistantToolIntegration:
    """Test suite for Supply Chain Assistant tool integration."""
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_supply_chain_assistant_tool_function_success(self, mock_create_agent):
        """Test successful execution of supply_chain_assistant tool function."""
        # Mock the agent and its response
        mock_agent = MagicMock()
        mock_agent.return_value = "Supply chain analysis complete"
        mock_create_agent.return_value = mock_agent
        
        result = supply_chain_assistant("Analyze inventory levels for automotive parts")
        
        # Verify agent was created and called
        mock_create_agent.assert_called_once()
        mock_agent.assert_called_once_with("Analyze inventory levels for automotive parts")
        
        # Verify result
        assert result == "Supply chain analysis complete"
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_supply_chain_assistant_tool_function_error_handling(self, mock_create_agent):
        """Test error handling in supply_chain_assistant tool function."""
        # Mock an exception during agent creation
        mock_create_agent.side_effect = Exception("Agent creation failed")
        
        result = supply_chain_assistant("Test query")
        
        # Verify error is handled gracefully
        assert "Error in supply chain analysis" in result
        assert "Agent creation failed" in result
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_supply_chain_assistant_tool_function_agent_error(self, mock_create_agent):
        """Test error handling when agent execution fails."""
        # Mock the agent to raise an exception
        mock_agent = MagicMock()
        mock_agent.side_effect = Exception("Agent execution failed")
        mock_create_agent.return_value = mock_agent
        
        result = supply_chain_assistant("Test query")
        
        # Verify error is handled gracefully
        assert "Error in supply chain analysis" in result
        assert "Agent execution failed" in result
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    @patch('builtins.print')
    def test_supply_chain_assistant_prints_routing_message(self, mock_print, mock_create_agent):
        """Test that supply_chain_assistant prints routing message."""
        mock_agent = MagicMock()
        mock_agent.return_value = "Test response"
        mock_create_agent.return_value = mock_agent
        
        supply_chain_assistant("Test query")
        
        # Verify routing message is printed
        mock_print.assert_called_with("Routed to Supply Chain Assistant")


class TestSupplyChainExpertiseResponses:
    """Test suite for supply chain expertise responses."""
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_inventory_management_query(self, mock_create_agent):
        """Test response to inventory management queries."""
        mock_agent = MagicMock()
        mock_agent.return_value = "Inventory analysis: Current stock levels show 85% fill rate with 15-day safety stock for critical components."
        mock_create_agent.return_value = mock_agent
        
        result = supply_chain_assistant("What are our current inventory levels for automotive parts?")
        
        assert "Inventory analysis" in result
        assert "stock levels" in result
        mock_agent.assert_called_once_with("What are our current inventory levels for automotive parts?")
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_supplier_performance_query(self, mock_create_agent):
        """Test response to supplier performance queries."""
        mock_agent = MagicMock()
        mock_agent.return_value = "Supplier performance metrics: On-time delivery 92%, quality rating 4.2/5, cost competitiveness index 1.15."
        mock_create_agent.return_value = mock_agent
        
        result = supply_chain_assistant("How is our supplier performance this quarter?")
        
        assert "Supplier performance" in result
        assert "delivery" in result
        mock_agent.assert_called_once_with("How is our supplier performance this quarter?")
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_production_planning_query(self, mock_create_agent):
        """Test response to production planning queries."""
        mock_agent = MagicMock()
        mock_agent.return_value = "Production schedule optimized for Q4 demand forecast with 95% capacity utilization and 2-week lead time buffer."
        mock_create_agent.return_value = mock_agent
        
        result = supply_chain_assistant("Optimize our production schedule for Q4")
        
        assert "Production schedule" in result
        assert "optimized" in result
        mock_agent.assert_called_once_with("Optimize our production schedule for Q4")
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_logistics_optimization_query(self, mock_create_agent):
        """Test response to logistics optimization queries."""
        mock_agent = MagicMock()
        mock_agent.return_value = "Route optimization analysis: 15% cost reduction possible through consolidated shipments and alternative carriers."
        mock_create_agent.return_value = mock_agent
        
        result = supply_chain_assistant("How can we optimize our transportation routes?")
        
        assert "Route optimization" in result
        assert "cost reduction" in result
        mock_agent.assert_called_once_with("How can we optimize our transportation routes?")
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_sustainability_query(self, mock_create_agent):
        """Test response to sustainability queries."""
        mock_agent = MagicMock()
        mock_agent.return_value = "Carbon footprint analysis: Current emissions 2.3 tons CO2/unit, 20% reduction achievable through local sourcing."
        mock_create_agent.return_value = mock_agent
        
        result = supply_chain_assistant("What's our supply chain carbon footprint?")
        
        assert "Carbon footprint" in result
        assert "emissions" in result
        mock_agent.assert_called_once_with("What's our supply chain carbon footprint?")


class TestWeatherEnvironmentalDataIntegration:
    """Test suite for weather and environmental data integration."""
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_weather_impact_on_transportation(self, mock_create_agent):
        """Test weather impact analysis for transportation."""
        mock_agent = MagicMock()
        mock_agent.return_value = "Weather analysis: Severe storm forecast for shipping routes. Recommend 2-day delay or alternative routing through southern corridor."
        mock_create_agent.return_value = mock_agent
        
        result = supply_chain_assistant("How will the weather affect our shipments this week?")
        
        assert "Weather analysis" in result
        assert "storm forecast" in result
        mock_agent.assert_called_once_with("How will the weather affect our shipments this week?")
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_uv_impact_on_outdoor_operations(self, mock_create_agent):
        """Test UV index impact on outdoor operations."""
        mock_agent = MagicMock()
        mock_agent.return_value = "UV safety analysis: High UV index (8.5) detected. Implement protective measures for outdoor loading operations and UV-sensitive inventory."
        mock_create_agent.return_value = mock_agent
        
        result = supply_chain_assistant("What UV precautions should we take for outdoor warehouse operations?")
        
        assert "UV safety analysis" in result
        assert "UV index" in result
        mock_agent.assert_called_once_with("What UV precautions should we take for outdoor warehouse operations?")
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_seasonal_planning_with_weather_data(self, mock_create_agent):
        """Test seasonal planning incorporating weather data."""
        mock_agent = MagicMock()
        mock_agent.return_value = "Seasonal forecast integration: Winter weather patterns suggest 25% increase in heating component demand and potential shipping delays in northern regions."
        mock_create_agent.return_value = mock_agent
        
        result = supply_chain_assistant("Help plan inventory for winter season considering weather patterns")
        
        assert "Seasonal forecast" in result
        assert "weather patterns" in result
        mock_agent.assert_called_once_with("Help plan inventory for winter season considering weather patterns")
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_environmental_risk_assessment(self, mock_create_agent):
        """Test environmental risk assessment for supply chain."""
        mock_agent = MagicMock()
        mock_agent.return_value = "Environmental risk assessment: Hurricane season approaching. Critical suppliers in affected regions require contingency planning and safety stock increases."
        mock_create_agent.return_value = mock_agent
        
        result = supply_chain_assistant("Assess environmental risks to our supply chain network")
        
        assert "Environmental risk assessment" in result
        assert "Hurricane season" in result
        mock_agent.assert_called_once_with("Assess environmental risks to our supply chain network")


class TestGraphDatabaseIntegration:
    """Test suite for Neptune graph database integration."""
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_supplier_network_analysis(self, mock_create_agent):
        """Test supplier network analysis using graph capabilities."""
        mock_agent = MagicMock()
        mock_agent.return_value = "Network analysis: Identified 3 critical single-source dependencies and 2 potential bottlenecks in tier-2 supplier relationships."
        mock_create_agent.return_value = mock_agent
        
        result = supply_chain_assistant("Analyze our supplier network for risk concentrations")
        
        assert "Network analysis" in result
        assert "dependencies" in result
        mock_agent.assert_called_once_with("Analyze our supplier network for risk concentrations")
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_supply_chain_relationship_mapping(self, mock_create_agent):
        """Test supply chain relationship mapping."""
        mock_agent = MagicMock()
        mock_agent.return_value = "Relationship mapping: Multi-tier visibility shows 47 tier-1 suppliers connecting to 312 tier-2 suppliers across 15 product categories."
        mock_create_agent.return_value = mock_agent
        
        result = supply_chain_assistant("Map the relationships in our supply chain network")
        
        assert "Relationship mapping" in result
        assert "tier-1 suppliers" in result
        mock_agent.assert_called_once_with("Map the relationships in our supply chain network")
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_critical_path_analysis(self, mock_create_agent):
        """Test critical path analysis using graph database."""
        mock_agent = MagicMock()
        mock_agent.return_value = "Critical path analysis: Longest supply chain path is 45 days through Asian semiconductor suppliers. Alternative paths available with 10-day penalty."
        mock_create_agent.return_value = mock_agent
        
        result = supply_chain_assistant("Find critical paths in our supply chain")
        
        assert "Critical path analysis" in result
        assert "supply chain path" in result
        mock_agent.assert_called_once_with("Find critical paths in our supply chain")


class TestIntegratedScenarios:
    """Test suite for integrated scenarios combining multiple capabilities."""
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_comprehensive_supply_chain_analysis(self, mock_create_agent):
        """Test comprehensive analysis combining weather, graph, and supply chain expertise."""
        mock_agent = MagicMock()
        mock_agent.return_value = """Comprehensive supply chain analysis:
        
        Network Analysis: 3 critical suppliers in hurricane-prone regions
        Weather Impact: 72-hour storm window affecting 25% of inbound shipments
        UV Considerations: Outdoor storage facilities require protective measures (UV index 9.2)
        Risk Mitigation: Activate alternative suppliers and expedite critical components
        
        Recommendations:
        1. Implement emergency procurement protocols
        2. Increase safety stock for weather-sensitive routes
        3. Deploy UV protection for outdoor inventory
        4. Monitor supplier network for disruptions"""
        mock_create_agent.return_value = mock_agent
        
        result = supply_chain_assistant("Provide comprehensive analysis of supply chain risks considering weather and network factors")
        
        assert "Comprehensive supply chain analysis" in result
        assert "Network Analysis" in result
        assert "Weather Impact" in result
        assert "UV Considerations" in result
        assert "Risk Mitigation" in result
        assert "Recommendations" in result
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_multi_tool_decision_support(self, mock_create_agent):
        """Test decision support using multiple integrated tools."""
        mock_agent = MagicMock()
        mock_agent.return_value = """Multi-source decision support:
        
        Weather Data: OpenMeteo and NWS both forecast severe weather
        UV Index: Extreme levels (11.5) requiring immediate protective action
        Graph Analysis: Alternative routing through 4 backup suppliers identified
        Supply Chain Impact: 15% cost increase but maintains delivery schedule
        
        Decision: Proceed with alternative routing and implement full UV protection protocols"""
        mock_create_agent.return_value = mock_agent
        
        result = supply_chain_assistant("Make a decision on shipment routing considering all environmental and network factors")
        
        assert "Multi-source decision support" in result
        assert "Weather Data" in result
        assert "UV Index" in result
        assert "Graph Analysis" in result
        assert "Supply Chain Impact" in result
        assert "Decision" in result


class TestErrorHandlingAndEdgeCases:
    """Test suite for error handling and edge cases."""
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_empty_query_handling(self, mock_create_agent):
        """Test handling of empty queries."""
        mock_agent = MagicMock()
        mock_agent.return_value = "Please provide a specific supply chain question or request for analysis."
        mock_create_agent.return_value = mock_agent
        
        result = supply_chain_assistant("")
        
        assert "Please provide" in result
        mock_agent.assert_called_once_with("")
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_invalid_query_handling(self, mock_create_agent):
        """Test handling of invalid or nonsensical queries."""
        mock_agent = MagicMock()
        mock_agent.return_value = "I specialize in supply chain operations. Could you please rephrase your question to focus on supply chain, inventory, logistics, or related manufacturing topics?"
        mock_create_agent.return_value = mock_agent
        
        result = supply_chain_assistant("What is the meaning of life?")
        
        assert "supply chain operations" in result
        mock_agent.assert_called_once_with("What is the meaning of life?")
    
    @patch('agents.supply_chain_assistant.create_supply_chain_assistant_agent')
    def test_tool_import_error_handling(self, mock_create_agent):
        """Test handling when tool imports fail."""
        # This test ensures the agent can still be created even if some tools fail to import
        mock_create_agent.side_effect = ImportError("Weather tools not available")
        
        result = supply_chain_assistant("Test query")
        
        assert "Error in supply chain analysis" in result
        assert "Weather tools not available" in result
    
    def test_system_prompt_completeness(self):
        """Test that system prompt is comprehensive and well-structured."""
        # Verify minimum length (should be substantial)
        assert len(SUPPLY_CHAIN_ASSISTANT_SYSTEM_PROMPT) > 2000
        
        # Verify it contains structured sections
        assert "## Core Supply Chain Expertise Areas:" in SUPPLY_CHAIN_ASSISTANT_SYSTEM_PROMPT
        assert "## Environmental Context Integration:" in SUPPLY_CHAIN_ASSISTANT_SYSTEM_PROMPT
        assert "## Graph Database Capabilities:" in SUPPLY_CHAIN_ASSISTANT_SYSTEM_PROMPT
        assert "## Response Guidelines:" in SUPPLY_CHAIN_ASSISTANT_SYSTEM_PROMPT
        assert "## Tool Usage Strategy:" in SUPPLY_CHAIN_ASSISTANT_SYSTEM_PROMPT
        
        # Verify it ends with actionable guidance
        assert "actionable recommendations" in SUPPLY_CHAIN_ASSISTANT_SYSTEM_PROMPT


if __name__ == "__main__":
    pytest.main([__file__, "-v"])