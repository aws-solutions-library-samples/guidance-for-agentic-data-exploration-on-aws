"""
Test Neptune Integration in Supply Chain Assistant

This module tests the Neptune graph database integration in the Supply Chain Assistant.
Tests include validation of Cypher query execution, database statistics access, and supply chain network analysis.
"""

import pytest
import json
import sys
import os
from unittest.mock import patch, MagicMock

# Add parent directory to path to import modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from agents.supply_chain_assistant import supply_chain_assistant, create_supply_chain_assistant_agent


class TestNeptuneIntegration:
    """Test suite for Neptune integration in Supply Chain Assistant."""
    
    def test_supply_chain_assistant_has_neptune_tools(self):
        """Test that Supply Chain Assistant includes Neptune tools."""
        # Test that the agent can be created successfully with Neptune tools
        try:
            agent = create_supply_chain_assistant_agent()
            assert agent is not None
            
            # Verify the system prompt includes Neptune capabilities
            assert "Graph Database Capabilities" in agent.system_prompt
            assert "Neptune" in agent.system_prompt
            assert "Cypher queries" in agent.system_prompt
        except Exception as e:
            pytest.fail(f"Failed to create Supply Chain Assistant with Neptune tools: {e}")
    
    def test_neptune_database_statistics_success(self):
        """Test successful Neptune database statistics retrieval."""
        mock_stats = """
        Neptune Database Statistics:
        - Total Nodes: 15,432
        - Total Edges: 28,901
        - Node Types: Supplier, Product, Facility, Order
        - Edge Types: SUPPLIES, PRODUCES, LOCATED_AT, CONTAINS
        """
        
        with patch('agents.graph_assistant.get_neptune_statistics') as mock_stats_func:
            mock_stats_func.return_value = mock_stats
            
            # Test through the supply chain assistant
            query = "What is the structure of our supply chain database?"
            
            with patch('agents.supply_chain_assistant.Agent') as mock_agent_class:
                mock_agent = MagicMock()
                mock_agent.run.return_value = f"Based on the database statistics:\n{mock_stats}\n\nThe supply chain network contains suppliers, products, facilities, and orders with their relationships."
                mock_agent_class.return_value = mock_agent
                
                result = supply_chain_assistant(query)
                
                assert "supply chain network" in result.lower()
                assert "suppliers" in result.lower()
                assert mock_agent.run.called
    
    def test_neptune_database_statistics_error(self):
        """Test Neptune database statistics error handling."""
        with patch('agents.graph_assistant.get_neptune_statistics') as mock_stats_func:
            mock_stats_func.side_effect = Exception("Neptune connection failed")
            
            from agents.graph_assistant import neptune_database_statistics
            
            result = neptune_database_statistics()
            
            assert "Error retrieving Neptune statistics" in result
            assert "Neptune connection failed" in result
    
    def test_neptune_cypher_query_success(self):
        """Test successful Neptune Cypher query execution."""
        mock_query_result = """
        Query: MATCH (s:Supplier)-[:SUPPLIES]->(p:Product) RETURN s.name, p.name LIMIT 10
        
        Results:
        1. Supplier: ACME Corp, Product: Widget A
        2. Supplier: Global Parts, Product: Component B
        3. Supplier: Tech Solutions, Product: Module C
        
        Analysis: Found 3 supplier-product relationships showing direct supply connections.
        """
        
        with patch('agents.graph_assistant.execute_neptune_query') as mock_query_func:
            mock_query_func.return_value = mock_query_result
            
            query = "Show me the top suppliers and what products they supply"
            
            with patch('agents.supply_chain_assistant.Agent') as mock_agent_class:
                mock_agent = MagicMock()
                mock_agent.run.return_value = f"Supply Chain Analysis:\n{mock_query_result}\n\nThese relationships show your key supplier dependencies."
                mock_agent_class.return_value = mock_agent
                
                result = supply_chain_assistant(query)
                
                assert "supply chain" in result.lower()
                assert "supplier" in result.lower()
                assert mock_agent.run.called
    
    def test_neptune_cypher_query_error(self):
        """Test Neptune Cypher query error handling."""
        with patch('agents.graph_assistant.execute_neptune_query') as mock_query_func:
            mock_query_func.side_effect = Exception("Invalid Cypher syntax")
            
            from agents.graph_assistant import neptune_cypher_query
            
            result = neptune_cypher_query("invalid query")
            
            assert "Error executing Neptune query" in result
            assert "Invalid Cypher syntax" in result
    
    def test_supply_chain_network_analysis_query(self):
        """Test supply chain network analysis using Neptune queries."""
        mock_network_analysis = """
        Network Analysis Results:
        
        Critical Suppliers (high dependency):
        - Supplier A: Supplies 45% of components
        - Supplier B: Supplies 32% of raw materials
        
        Risk Assessment:
        - Single points of failure: 3 suppliers
        - Geographic concentration: 67% in Region X
        
        Recommendations:
        - Diversify supplier base for critical components
        - Establish backup suppliers in different regions
        """
        
        with patch('agents.graph_assistant.execute_neptune_query') as mock_query_func:
            mock_query_func.return_value = mock_network_analysis
            
            query = "Analyze our supply chain network for risks and dependencies"
            
            with patch('agents.supply_chain_assistant.Agent') as mock_agent_class:
                mock_agent = MagicMock()
                mock_agent.run.return_value = f"Supply Chain Risk Analysis:\n{mock_network_analysis}\n\nImmediate actions needed to reduce supply chain risk."
                mock_agent_class.return_value = mock_agent
                
                result = supply_chain_assistant(query)
                
                assert "risk" in result.lower()
                assert "supplier" in result.lower()
                assert "recommendations" in result.lower()
    
    def test_multi_tier_supplier_analysis(self):
        """Test multi-tier supplier relationship analysis."""
        mock_multi_tier_analysis = """
        Multi-Tier Supplier Analysis:
        
        Tier 1 Suppliers: 25 direct suppliers
        Tier 2 Suppliers: 78 sub-suppliers  
        Tier 3 Suppliers: 156 sub-sub-suppliers
        
        Critical Paths:
        1. Raw Material A → Supplier X → Component Y → Final Product
        2. Raw Material B → Supplier Z → Assembly W → Final Product
        
        Visibility Gaps:
        - Limited visibility beyond Tier 2 for 40% of supply paths
        - Missing supplier information for critical components
        """
        
        with patch('agents.graph_assistant.execute_neptune_query') as mock_query_func:
            mock_query_func.return_value = mock_multi_tier_analysis
            
            query = "Map our multi-tier supplier relationships and identify visibility gaps"
            
            with patch('agents.supply_chain_assistant.Agent') as mock_agent_class:
                mock_agent = MagicMock()
                mock_agent.run.return_value = f"Multi-Tier Supply Chain Mapping:\n{mock_multi_tier_analysis}\n\nFocus on improving Tier 3+ visibility."
                mock_agent_class.return_value = mock_agent
                
                result = supply_chain_assistant(query)
                
                assert "tier" in result.lower()
                assert "visibility" in result.lower()
                assert "supplier" in result.lower()
    
    def test_supply_chain_assistant_exception_handling(self):
        """Test Supply Chain Assistant exception handling."""
        with patch('agents.supply_chain_assistant.Agent') as mock_agent_class:
            mock_agent_class.side_effect = Exception("Agent initialization failed")
            
            result = supply_chain_assistant("test query")
            
            assert "Error in supply chain analysis" in result
            assert "Agent initialization failed" in result
    
    def test_supply_chain_assistant_tool_integration(self):
        """Test that Supply Chain Assistant properly integrates all tools."""
        agent = create_supply_chain_assistant_agent()
        
        # Verify system prompt includes all expected capabilities
        system_prompt = agent.system_prompt
        
        # Weather capabilities
        assert "weather" in system_prompt.lower()
        assert "uv index" in system_prompt.lower()
        assert "environmental" in system_prompt.lower()
        
        # Neptune capabilities
        assert "Graph Database Capabilities" in system_prompt
        assert "Neptune" in system_prompt
        assert "Cypher queries" in system_prompt
        assert "Complex Relationship Mapping" in system_prompt
        
        # Supply chain expertise
        assert "Supply Chain Network Analysis" in system_prompt
        assert "Inventory Management" in system_prompt
        assert "Production Planning" in system_prompt


class TestSupplyChainNetworkQueries:
    """Test suite for supply chain specific Neptune queries."""
    
    def test_supplier_performance_analysis(self):
        """Test supplier performance analysis using Neptune."""
        mock_performance_data = """
        Supplier Performance Analysis:
        
        Top Performers (On-time delivery > 95%):
        - Reliable Parts Inc: 98.5% on-time, 99.2% quality
        - Quality Components: 97.8% on-time, 98.9% quality
        
        Underperformers (On-time delivery < 90%):
        - Budget Supplies: 87.3% on-time, 94.1% quality
        - Quick Parts: 85.9% on-time, 91.7% quality
        
        Recommendations:
        - Consider increasing orders from top performers
        - Implement improvement plans for underperformers
        """
        
        with patch('agents.graph_assistant.execute_neptune_query') as mock_query_func:
            mock_query_func.return_value = mock_performance_data
            
            from agents.graph_assistant import neptune_cypher_query
            
            result = neptune_cypher_query("Analyze supplier performance metrics")
            
            assert "Supplier Performance Analysis" in result
            assert "Top Performers" in result
            assert "Underperformers" in result
    
    def test_inventory_flow_analysis(self):
        """Test inventory flow analysis through Neptune."""
        mock_inventory_flow = """
        Inventory Flow Analysis:
        
        Material Flow Paths:
        1. Warehouse A → Production Line 1 → Finished Goods
        2. Warehouse B → Production Line 2 → Finished Goods
        3. Supplier Direct → Production Line 3 → Finished Goods
        
        Bottlenecks Identified:
        - Production Line 2: 85% capacity utilization
        - Warehouse B: Limited storage capacity
        
        Optimization Opportunities:
        - Redistribute load from Line 2 to Line 1
        - Increase Warehouse B capacity or use alternative routing
        """
        
        with patch('agents.graph_assistant.execute_neptune_query') as mock_query_func:
            mock_query_func.return_value = mock_inventory_flow
            
            from agents.graph_assistant import neptune_cypher_query
            
            result = neptune_cypher_query("Analyze inventory flow and identify bottlenecks")
            
            assert "Inventory Flow Analysis" in result
            assert "Bottlenecks" in result
            assert "Optimization" in result
    
    def test_product_bom_analysis(self):
        """Test Bill of Materials analysis using Neptune."""
        mock_bom_analysis = """
        BOM Analysis Results:
        
        Product: Manufacturing Widget v2.1
        Total Components: 47
        Critical Components: 8
        
        Component Dependencies:
        - Component A: Used in 12 different products
        - Component B: Single source supplier (risk)
        - Component C: Long lead time (45 days)
        
        Alternative Parts Available:
        - Component B: 2 alternative suppliers identified
        - Component C: 1 alternative with shorter lead time
        
        Cost Optimization:
        - Potential 12% cost reduction with alternative sourcing
        """
        
        with patch('agents.graph_assistant.execute_neptune_query') as mock_query_func:
            mock_query_func.return_value = mock_bom_analysis
            
            from agents.graph_assistant import neptune_cypher_query
            
            result = neptune_cypher_query("Analyze BOM for Manufacturing Widget v2.1")
            
            assert "BOM Analysis" in result
            assert "Component Dependencies" in result
            assert "Alternative Parts" in result
    
    def test_supply_chain_risk_assessment(self):
        """Test supply chain risk assessment using Neptune."""
        mock_risk_assessment = """
        Supply Chain Risk Assessment:
        
        High Risk Areas:
        1. Single source suppliers: 15% of critical components
        2. Geographic concentration: 60% suppliers in Region A
        3. Long lead times: 8 components with >30 day lead times
        
        Risk Mitigation Status:
        - Backup suppliers identified: 70% coverage
        - Safety stock levels: Adequate for 85% of components
        - Alternative transportation routes: 3 options available
        
        Action Items:
        - Qualify backup suppliers for remaining 30%
        - Increase safety stock for high-risk components
        - Diversify supplier geographic distribution
        """
        
        with patch('agents.graph_assistant.execute_neptune_query') as mock_query_func:
            mock_query_func.return_value = mock_risk_assessment
            
            from agents.graph_assistant import neptune_cypher_query
            
            result = neptune_cypher_query("Perform comprehensive supply chain risk assessment")
            
            assert "Risk Assessment" in result
            assert "High Risk Areas" in result
            assert "Action Items" in result


class TestNeptuneToolsAvailability:
    """Test suite for Neptune tools availability and error handling."""
    
    def test_neptune_tools_import_success(self):
        """Test successful import of Neptune tools."""
        try:
            from agents.graph_assistant import neptune_database_statistics, neptune_cypher_query
            # If we get here, imports were successful
            assert True
        except ImportError as e:
            pytest.fail(f"Failed to import Neptune tools: {e}")
    
    def test_neptune_tools_callable(self):
        """Test that Neptune tools are callable."""
        from agents.graph_assistant import neptune_database_statistics, neptune_cypher_query
        
        # Test that functions are callable (don't actually call them to avoid Neptune dependency)
        assert callable(neptune_database_statistics)
        assert callable(neptune_cypher_query)
    
    def test_supply_chain_assistant_neptune_integration(self):
        """Test that Supply Chain Assistant properly integrates Neptune tools."""
        # Test agent creation doesn't fail
        try:
            agent = create_supply_chain_assistant_agent()
            assert agent is not None
            
            # Verify Neptune integration in system prompt
            assert "neptune_cypher_query" in agent.system_prompt or "Neptune" in agent.system_prompt
            assert "graph database" in agent.system_prompt.lower()
        except Exception as e:
            pytest.fail(f"Failed to create Supply Chain Assistant with Neptune tools: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])