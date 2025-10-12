import unittest
from unittest.mock import patch, MagicMock
import sys
import os

# Add the parent directory to the path so we can import the agents
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class TestGraphAssistant(unittest.TestCase):
    """Test cases for the Graph Assistant Neptune tools."""

    @patch('agents.graph_assistant.execute_neptune_query')
    def test_successful_query_execution(self, mock_execute):
        """Test successful query generation and execution."""
        from agents.graph_assistant import neptune_cypher_query
        
        mock_execute.return_value = "Query executed successfully with results: [{'name': 'John', 'age': 30}]"
        
        result = neptune_cypher_query("Find all users named John")
        
        self.assertIn("Query executed successfully", result)
        mock_execute.assert_called_once_with("Find all users named John")

    @patch('agents.graph_assistant.execute_neptune_query')
    def test_bedrock_error_handling(self, mock_execute):
        """Test error handling when Neptune query fails."""
        from agents.graph_assistant import neptune_cypher_query
        
        mock_execute.side_effect = Exception("Bedrock connection failed")
        
        result = neptune_cypher_query("Find all users")
        
        self.assertIn("Error executing Neptune query", result)
        self.assertIn("Bedrock connection failed", result)

    @patch('agents.graph_assistant.execute_neptune_query')
    def test_neptune_connection_error(self, mock_execute):
        """Test Neptune connection error handling."""
        from agents.graph_assistant import neptune_cypher_query
        
        mock_execute.side_effect = Exception("Neptune connection timeout")
        
        result = neptune_cypher_query("MATCH (n) RETURN n LIMIT 10")
        
        self.assertIn("Error executing Neptune query", result)
        self.assertIn("Neptune connection timeout", result)

    @patch('agents.graph_assistant.execute_neptune_query')
    def test_neptune_query_error(self, mock_execute):
        """Test Neptune query execution error."""
        from agents.graph_assistant import neptune_cypher_query
        
        mock_execute.side_effect = Exception("Invalid Cypher syntax")
        
        result = neptune_cypher_query("INVALID CYPHER QUERY")
        
        self.assertIn("Error executing Neptune query", result)
        self.assertIn("Invalid Cypher syntax", result)

    @patch('agents.graph_assistant.execute_neptune_query')
    def test_neptune_timeout_handling(self, mock_execute):
        """Test Neptune query timeout handling."""
        from agents.graph_assistant import neptune_cypher_query
        
        mock_execute.side_effect = Exception("Query timeout after 30 seconds")
        
        result = neptune_cypher_query("Complex query that times out")
        
        self.assertIn("Error executing Neptune query", result)
        self.assertIn("Query timeout", result)

    @patch('agents.graph_assistant.execute_neptune_query')
    def test_empty_query_results(self, mock_execute):
        """Test handling of empty query results."""
        from agents.graph_assistant import neptune_cypher_query
        
        mock_execute.return_value = "No results found for the query."
        
        result = neptune_cypher_query("Find non-existent data")
        
        self.assertEqual(result, "No results found for the query.")
        mock_execute.assert_called_once_with("Find non-existent data")

    def test_general_exception_handling(self):
        """Test general exception handling."""
        from agents.graph_assistant import neptune_cypher_query
        
        with patch('agents.graph_assistant.execute_neptune_query') as mock_execute:
            mock_execute.side_effect = RuntimeError("Unexpected error")
            
            result = neptune_cypher_query("Any query")
            
            self.assertIn("Error executing Neptune query", result)
            self.assertIn("Unexpected error", result)

    @patch('agents.graph_assistant.execute_neptune_query')
    def test_cypher_query_generation_prompt(self, mock_execute):
        """Test that the correct query is passed to Neptune execution."""
        from agents.graph_assistant import neptune_cypher_query
        
        mock_execute.return_value = "Mocked response"
        
        test_query = "Find all products with price greater than 100"
        result = neptune_cypher_query(test_query)
        
        mock_execute.assert_called_once_with(test_query)
        self.assertEqual(result, "Mocked response")

    def test_neptune_statistics_tool(self):
        """Test Neptune statistics tool."""
        from agents.graph_assistant import neptune_database_statistics
        
        with patch('agents.graph_assistant.get_neptune_statistics') as mock_stats:
            mock_stats.return_value = "Database contains 1000 nodes and 2000 edges"
            
            result = neptune_database_statistics()
            
            self.assertEqual(result, "Database contains 1000 nodes and 2000 edges")
            mock_stats.assert_called_once()

    def test_neptune_statistics_error(self):
        """Test Neptune statistics error handling."""
        from agents.graph_assistant import neptune_database_statistics
        
        with patch('agents.graph_assistant.get_neptune_statistics') as mock_stats:
            mock_stats.side_effect = Exception("Statistics unavailable")
            
            result = neptune_database_statistics()
            
            self.assertIn("Error retrieving Neptune statistics", result)
            self.assertIn("Statistics unavailable", result)

    def test_bulk_load_status_tool(self):
        """Test Neptune bulk load status tool."""
        from agents.graph_assistant import neptune_bulk_load_status
        
        with patch('agents.graph_assistant.get_bulk_load_status') as mock_status:
            mock_status.return_value = "Load job 123 is COMPLETED"
            
            result = neptune_bulk_load_status("123")
            
            self.assertEqual(result, "Load job 123 is COMPLETED")
            mock_status.assert_called_once_with("123")

    def test_bulk_load_start_tool(self):
        """Test Neptune bulk load start tool."""
        from agents.graph_assistant import neptune_bulk_load
        
        with patch('agents.graph_assistant.start_bulk_load') as mock_load:
            mock_load.return_value = "Bulk load started with ID: load-456"
            
            result = neptune_bulk_load("/load-from-prefix")
            
            self.assertEqual(result, "Bulk load started with ID: load-456")
            mock_load.assert_called_once_with("/load-from-prefix")

    def test_tool_decorator(self):
        """Test that Neptune tools are properly decorated as tools."""
        from agents.graph_assistant import neptune_cypher_query, neptune_database_statistics
        
        # Check that functions have the tool decorator attributes
        self.assertTrue(hasattr(neptune_cypher_query, '__wrapped__'))
        self.assertTrue(hasattr(neptune_database_statistics, '__wrapped__'))

if __name__ == '__main__':
    unittest.main()
