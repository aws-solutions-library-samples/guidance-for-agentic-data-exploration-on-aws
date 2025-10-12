"""
Tests for the Data Visualizer Assistant agent with chart, wordcloud, table, and heatmap tools.
"""
import pytest
import tempfile
import os
import time
from unittest.mock import Mock, patch
from agents.data_visualizer_assistant import (
    data_visualizer_assistant, 
    DATA_VISUALIZER_SYSTEM_PROMPT, 
    cleanup_old_charts,
    chart_tool,
    wordcloud_tool,
    table_tool
)


class TestDataVisualizerAssistant:
    """Test cases for the Data Visualizer Assistant agent."""

    def test_data_visualizer_function_exists(self):
        """Test that the data visualizer function exists and is callable."""
        assert data_visualizer_assistant is not None
        assert callable(data_visualizer_assistant)

    def test_data_visualizer_system_prompt(self):
        """Test that the data visualizer has appropriate system prompt."""
        assert "visualization" in DATA_VISUALIZER_SYSTEM_PROMPT.lower()
        assert "chart_tool" in DATA_VISUALIZER_SYSTEM_PROMPT
        assert "wordcloud_tool" in DATA_VISUALIZER_SYSTEM_PROMPT
        assert "table_tool" in DATA_VISUALIZER_SYSTEM_PROMPT
        assert "heatmap_tool" not in DATA_VISUALIZER_SYSTEM_PROMPT

    def test_individual_tools_exist(self):
        """Test that all tools exist and are callable."""
        assert callable(chart_tool)
        assert callable(wordcloud_tool)
        assert callable(table_tool)

    @patch('agents.data_visualizer_assistant.Agent')
    def test_data_visualizer_creates_agent_with_tools(self, mock_agent_class):
        """Test that data visualizer creates an agent with all four tools."""
        # Mock the agent instance
        mock_agent_instance = Mock()
        mock_agent_instance.return_value = "Chart created successfully and saved as: chart_20240830_120000.png"
        mock_agent_class.return_value = mock_agent_instance
        
        # Call the data visualizer function
        result = data_visualizer_assistant("Create a bar chart")
        
        # Verify Agent was created with correct parameters
        mock_agent_class.assert_called_once()
        call_args = mock_agent_class.call_args
        
        # Check system prompt
        assert call_args[1]['system_prompt'] == DATA_VISUALIZER_SYSTEM_PROMPT
        
        # Check all five tools are included
        tools = call_args[1]['tools']
        assert len(tools) == 5
        # Tools should be the actual functions
        tool_names = [tool.__name__ for tool in tools]
        assert 'chart_tool' in tool_names
        assert 'wordcloud_tool' in tool_names
        assert 'table_tool' in tool_names
        assert 'strands_tools.calculator' in tool_names
        assert 'table_tool' in tool_names

    @patch('agents.data_visualizer_assistant.Agent')
    @patch('agents.data_visualizer_assistant.os.path.exists')
    @patch('agents.data_visualizer_assistant.os.listdir')
    @patch('agents.data_visualizer_assistant.os.path.getmtime')
    def test_data_visualizer_handles_chart_output(self, mock_getmtime, mock_listdir, mock_exists, mock_agent_class):
        """Test that data visualizer handles visualization file output correctly."""
        mock_agent_instance = Mock()
        mock_agent_instance.return_value = "Chart created successfully."
        mock_agent_class.return_value = mock_agent_instance
        
        # Mock file system calls - ensure timestamp is recent
        mock_exists.return_value = True
        mock_listdir.return_value = ["chart_20240830_120000.png", "other_file.txt"]
        mock_getmtime.return_value = time.time() + 1  # Future timestamp to ensure it's after start_time
        
        result = data_visualizer_assistant("Create a pie chart")
        
        # Should contain the chart marker for UI processing
        assert "[Generated chart: chart_20240830_120000.png]" in result

    def test_cleanup_old_visualizations(self):
        """Test that old visualization files are properly cleaned up."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create test visualization files
            old_chart = os.path.join(temp_dir, "chart_20240829_120000.png")
            old_wordcloud = os.path.join(temp_dir, "wordcloud_20240829_120000.png")
            old_table = os.path.join(temp_dir, "table_20240829_120000.png")
            new_chart = os.path.join(temp_dir, "chart_20240830_120000.png")
            non_viz = os.path.join(temp_dir, "other_file.png")
            
            # Create files
            for file_path in [old_chart, old_wordcloud, old_table, new_chart, non_viz]:
                with open(file_path, 'w') as f:
                    f.write("test")
            
            # Make old files actually old (modify timestamp)
            old_time = time.time() - (25 * 3600)  # 25 hours ago
            for old_file in [old_chart, old_wordcloud, old_table]:
                os.utime(old_file, (old_time, old_time))
            
            # Run cleanup (max age 24 hours)
            cleanup_old_charts(temp_dir, max_age_hours=24)
            
            # Check results
            assert not os.path.exists(old_chart), "Old chart should be deleted"
            assert not os.path.exists(old_wordcloud), "Old wordcloud should be deleted"
            assert not os.path.exists(old_table), "Old table should be deleted"
            assert os.path.exists(new_chart), "New chart should remain"
            assert os.path.exists(non_viz), "Non-visualization file should remain"

    def test_cleanup_nonexistent_directory(self):
        """Test cleanup handles non-existent directory gracefully."""
        # Should not raise exception
        cleanup_old_charts("/nonexistent/directory")
