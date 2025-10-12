import pytest
import os
from unittest.mock import patch, MagicMock
from agents.help_assistant import help_assistant

def test_help_assistant_without_kb():
    """Test Help assistant without Knowledge Base"""
    # Ensure no KB ID is set
    with patch.dict(os.environ, {}, clear=True):
        with patch('agents.help_assistant.Agent') as mock_agent_class:
            # Mock the agent to avoid AWS calls
            mock_agent_instance = MagicMock()
            mock_agent_instance.__call__ = MagicMock(return_value="AI Data Explorer deployment help without KB")
            mock_agent_class.return_value = mock_agent_instance
            
            response = help_assistant("How do I deploy the AI Data Explorer?")
            
            assert isinstance(response, str)
            assert len(response) > 0
            # Verify agent was created (fallback path)
            mock_agent_class.assert_called_once()

def test_help_assistant_with_kb_error():
    """Test Help assistant with KB error (fallback behavior)"""
    with patch.dict(os.environ, {"KNOWLEDGE_BASE_ID": "test-kb-id", "AWS_REGION": "us-east-1"}):
        with patch('boto3.client') as mock_boto3:
            # Mock boto3 client to raise an exception
            mock_client = MagicMock()
            mock_client.retrieve.side_effect = Exception("KB not available")
            mock_boto3.return_value = mock_client
            
            response = help_assistant("How do I setup the AI Data Explorer?")
            
            assert isinstance(response, str)
            assert len(response) > 0
            # Should fall back to basic help
            assert "Knowledge base query failed" in response or "AI Data Explorer" in response

def test_help_assistant_with_kb_success():
    """Test Help assistant with successful KB query"""
    with patch.dict(os.environ, {"KNOWLEDGE_BASE_ID": "test-kb-id", "AWS_REGION": "us-east-1"}):
        with patch('boto3.client') as mock_boto3:
            # Mock successful KB response
            mock_client = MagicMock()
            mock_client.retrieve.return_value = {
                'retrievalResults': [
                    {
                        'content': {'text': 'To deploy the AI Data Explorer, run ./dev-tools/deploy.sh'},
                        'location': {'s3Location': {'uri': 'README.md'}}
                    }
                ]
            }
            mock_boto3.return_value = mock_client
            
            with patch('agents.help_assistant.Agent') as mock_agent_class:
                # Mock the agent instance and its call
                mock_agent_instance = MagicMock()
                mock_agent_instance.__call__ = MagicMock(return_value="Based on the documentation, to deploy the AI Data Explorer, run ./dev-tools/deploy.sh")
                mock_agent_class.return_value = mock_agent_instance
                
                response = help_assistant("How do I deploy the AI Data Explorer?")
                
                assert isinstance(response, str)
                assert len(response) > 0
                # Verify KB was queried
                mock_client.retrieve.assert_called_once()
                # Verify agent was created with KB context
                mock_agent_class.assert_called_once()

def test_help_assistant_routing():
    """Test that Help assistant handles help-related queries"""
    # Test help-related queries directly with the help assistant
    help_queries = [
        "How do I setup the AI Data Explorer?",
        "What is the AI Data Explorer?", 
        "How do I deploy this application?",
        "How do I configure guardrails?",
        "What are the available agents?",
    ]
    
    for query in help_queries:
        # Call help assistant directly to avoid supervisor routing complexity
        response = help_assistant(query)
        assert isinstance(response, str)
        assert len(response) > 0
