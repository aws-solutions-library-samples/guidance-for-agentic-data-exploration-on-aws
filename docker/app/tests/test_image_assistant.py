"""
Tests for the Image Assistant agent.
"""
import pytest
import tempfile
import os
import time
from unittest.mock import Mock, patch
from agents.image_assistant import image_assistant, IMAGE_ASSISTANT_SYSTEM_PROMPT, cleanup_old_images


class TestImageAssistant:
    """Test cases for the Image Assistant agent."""

    def test_image_assistant_function_exists(self):
        """Test that the image assistant function exists and is callable."""
        assert image_assistant is not None
        assert callable(image_assistant)

    def test_image_assistant_system_prompt(self):
        """Test that the image assistant has appropriate system prompt."""
        assert "ImageAssist" in IMAGE_ASSISTANT_SYSTEM_PROMPT
        assert "image" in IMAGE_ASSISTANT_SYSTEM_PROMPT.lower()
        assert "analysis" in IMAGE_ASSISTANT_SYSTEM_PROMPT.lower()
        assert "generation" in IMAGE_ASSISTANT_SYSTEM_PROMPT.lower()

    @patch('agents.image_assistant.Agent')
    @patch('agents.image_assistant.image_reader')
    @patch('agents.image_assistant.generate_image')
    def test_image_assistant_creates_agent_with_tools(self, mock_generate_image, mock_image_reader, mock_agent_class):
        """Test that image assistant creates an agent with the correct tools."""
        # Mock the agent instance
        mock_agent_instance = Mock()
        mock_agent_instance.return_value = "Mock response"
        mock_agent_class.return_value = mock_agent_instance
        
        # Call the image assistant function
        result = image_assistant("Generate an image of a cat")
        
        # Verify Agent was created with correct parameters
        mock_agent_class.assert_called_once()
        call_args = mock_agent_class.call_args
        
        # Check system prompt (should contain the base prompt)
        assert IMAGE_ASSISTANT_SYSTEM_PROMPT in call_args[1]['system_prompt']
        
        # Check tools are included
        tools = call_args[1]['tools']
        assert mock_image_reader in tools
        assert mock_generate_image in tools

    @patch('agents.image_assistant.Agent')
    def test_image_assistant_handles_file_path(self, mock_agent_class):
        """Test that image assistant handles file path extraction correctly."""
        mock_agent_instance = Mock()
        mock_agent_instance.return_value = "Mock response"
        mock_agent_class.return_value = mock_agent_instance
        
        # Test query with file path
        query_with_path = "Analyze this image The image file path is: /path/to/image.jpg"
        
        result = image_assistant(query_with_path)
        
        # Verify the agent was called with modified query
        mock_agent_instance.assert_called_once()
        called_query = mock_agent_instance.call_args[0][0]
        
        # Should contain the image_reader instruction
        assert "image_reader tool" in called_query
        assert "/path/to/image.jpg" in called_query

    def test_cleanup_old_images(self):
        """Test that old images are properly cleaned up."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create test image files
            old_file = os.path.join(temp_dir, "old_image.png")
            new_file = os.path.join(temp_dir, "new_image.png")
            
            # Create files
            with open(old_file, 'w') as f:
                f.write("old")
            with open(new_file, 'w') as f:
                f.write("new")
            
            # Make old file actually old (modify timestamp)
            old_time = time.time() - (25 * 3600)  # 25 hours ago
            os.utime(old_file, (old_time, old_time))
            
            # Run cleanup (max age 24 hours)
            cleanup_old_images(temp_dir, max_age_hours=24)
            
            # Check results
            assert not os.path.exists(old_file), "Old file should be deleted"
            assert os.path.exists(new_file), "New file should remain"

    def test_cleanup_nonexistent_directory(self):
        """Test cleanup handles non-existent directory gracefully."""
        # Should not raise exception
        cleanup_old_images("/nonexistent/directory")
