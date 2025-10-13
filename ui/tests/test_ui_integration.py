import pytest
import responses
import json
from unittest.mock import patch
from app import app

# Mock agent service URL
AGENT_SERVICE_URL = "http://mock-agent-service.com"

@pytest.fixture
def client():
    """Create Flask test client."""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

class TestUIIntegration:
    """Integration tests for UI service communication with agent service."""
    
    @patch('app.AGENT_SERVICE_URL', AGENT_SERVICE_URL)
    @responses.activate
    def test_simple_chat_message(self, client):
        """Test that simple chat messages send correct format to agent service."""
        # Mock agent service streaming response
        responses.add(
            responses.POST,
            f"{AGENT_SERVICE_URL}/query-streaming-with-events",
            body="data: Hello! How can I help you?\n\n",
            status=200,
            content_type="text/plain"
        )
        
        # Send request to UI
        response = client.post(
            '/explorer',
            json={"prompt": "Hello"},
            headers={"Content-Type": "application/json"}
        )
        
        # Verify UI responds successfully
        assert response.status_code == 200
        
        # Verify UI sent correct format to agent service
        assert len(responses.calls) == 1
        agent_request = json.loads(responses.calls[0].request.body)
        
        # This would have caught the bug - only prompt should be sent
        assert agent_request == {"prompt": "Hello"}
        assert "file_content" not in agent_request
        assert "file_name" not in agent_request

    def test_version_endpoint(self, client):
        """Test version endpoint returns version information."""
        response = client.get('/version')
        assert response.status_code == 200
        
        data = response.get_json()
        assert "version" in data
        assert "build_date" in data
        assert "git_commit" in data

    @patch('builtins.open')
    @patch('os.path.exists')
    def test_version_endpoint_with_file(self, mock_exists, mock_open, client):
        """Test version endpoint when version.json exists."""
        mock_exists.return_value = True
        mock_open.return_value.__enter__.return_value.read.return_value = '{"version": "2.0.3", "build_date": "2023-01-01T00:00:00Z", "git_commit": "abc123"}'
        
        response = client.get('/version')
        assert response.status_code == 200
        
        data = response.get_json()
        assert data["version"] == "2.0.3"
        assert data["build_date"] == "2023-01-01T00:00:00Z"
        assert data["git_commit"] == "abc123"

    @patch('os.path.exists')
    def test_version_endpoint_no_file(self, mock_exists, client):
        """Test version endpoint when version.json doesn't exist."""
        mock_exists.return_value = False
        
        response = client.get('/version')
        assert response.status_code == 200
        
        data = response.get_json()
        assert data["version"] == "unknown"
        assert data["build_date"] == "unknown"
        assert data["git_commit"] == "unknown"

    @patch('builtins.open')
    @patch('os.path.exists')
    def test_version_context_processor(self, mock_exists, mock_open, client):
        """Test that version is available in template context."""
        mock_exists.return_value = True
        mock_open.return_value.__enter__.return_value.read.return_value = '{"version": "2.0.3"}'
        
        # Test that version is injected into templates
        with client.application.test_request_context():
            from app import inject_globals
            context = inject_globals()
            assert "app_version" in context
            assert context["app_version"] == "2.0.3"

    # FILE UPLOAD TESTS
    @patch('app.AGENT_SERVICE_URL', AGENT_SERVICE_URL)
    @responses.activate
    def test_text_file_upload_sql(self, client):
        """Test SQL file upload merges content into prompt."""
        responses.add(
            responses.POST,
            f"{AGENT_SERVICE_URL}/query-streaming-with-events",
            body="data: SQL analyzed\n\n",
            status=200
        )
        
        response = client.post('/explorer', json={
            "prompt": "Analyze this SQL",
            "file_content": "SELECT * FROM users WHERE active = 1;",
            "file_name": "query.sql",
            "file_type": "text"
        })
        
        assert response.status_code == 200
        agent_request = json.loads(responses.calls[0].request.body)
        
        # Content should be merged into prompt
        assert "Analyze this SQL" in agent_request["prompt"]
        assert "query.sql" in agent_request["prompt"]
        assert "SELECT * FROM users WHERE active = 1;" in agent_request["prompt"]
        
        # Text files don't include separate file fields
        assert "file_content" not in agent_request
        assert "file_name" not in agent_request
        assert "file_type" not in agent_request

    @patch('app.AGENT_SERVICE_URL', AGENT_SERVICE_URL)
    @responses.activate
    def test_text_file_upload_csv(self, client):
        """Test CSV file upload merges content into prompt."""
        responses.add(
            responses.POST,
            f"{AGENT_SERVICE_URL}/query-streaming-with-events",
            body="data: CSV analyzed\n\n",
            status=200
        )
        
        csv_content = "name,age,city\nJohn,25,NYC\nJane,30,LA"
        response = client.post('/explorer', json={
            "prompt": "What patterns do you see?",
            "file_content": csv_content,
            "file_name": "data.csv",
            "file_type": "text"
        })
        
        assert response.status_code == 200
        agent_request = json.loads(responses.calls[0].request.body)
        
        assert "What patterns do you see?" in agent_request["prompt"]
        assert "data.csv" in agent_request["prompt"]
        assert csv_content in agent_request["prompt"]
        assert "file_content" not in agent_request

    @patch('app.AGENT_SERVICE_URL', AGENT_SERVICE_URL)
    @responses.activate
    def test_image_file_upload_full_structure(self, client):
        """Test image upload sends full file data structure."""
        responses.add(
            responses.POST,
            f"{AGENT_SERVICE_URL}/query-streaming-with-events",
            body="data: Image analyzed\n\n",
            status=200
        )
        
        response = client.post('/explorer', json={
            "prompt": "What's in this image?",
            "file_content": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
            "file_name": "test.png",
            "file_type": "image",
            "mime_type": "image/png"
        })
        
        assert response.status_code == 200
        agent_request = json.loads(responses.calls[0].request.body)
        
        # Image uploads should include full file structure
        assert "What's in this image?" in agent_request["prompt"]
        assert "[Image uploaded: test.png]" in agent_request["prompt"]
        assert agent_request["file_content"] == "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        assert agent_request["file_name"] == "test.png"
        assert agent_request["file_type"] == "image"
        assert agent_request["mime_type"] == "image/png"

    @patch('app.AGENT_SERVICE_URL', AGENT_SERVICE_URL)
    @responses.activate
    def test_file_upload_without_prompt(self, client):
        """Test file upload without accompanying text prompt."""
        responses.add(
            responses.POST,
            f"{AGENT_SERVICE_URL}/query-streaming-with-events",
            body="data: File processed\n\n",
            status=200
        )
        
        response = client.post('/explorer', json={
            "file_content": "CREATE TABLE users (id INT, name VARCHAR(50));",
            "file_name": "schema.sql",
            "file_type": "text"
        })
        
        assert response.status_code == 200
        agent_request = json.loads(responses.calls[0].request.body)
        
        # Should create prompt from file info
        assert "schema.sql" in agent_request["prompt"]
        assert "CREATE TABLE users" in agent_request["prompt"]

    # AGENT SERVICE COMMUNICATION TESTS
    @patch('app.AGENT_SERVICE_URL', AGENT_SERVICE_URL)
    @responses.activate
    def test_agent_service_timeout(self, client):
        """Test UI handles agent service timeouts gracefully."""
        responses.add(
            responses.POST,
            f"{AGENT_SERVICE_URL}/query-streaming-with-events",
            body=responses.ConnectionError("Connection timeout")
        )
        
        response = client.post('/explorer', json={"prompt": "Hello"})
        
        # UI should handle timeout gracefully
        assert response.status_code == 200

    @patch('app.AGENT_SERVICE_URL', AGENT_SERVICE_URL)
    @responses.activate
    def test_agent_service_500_error(self, client):
        """Test UI handles agent service 500 errors."""
        responses.add(
            responses.POST,
            f"{AGENT_SERVICE_URL}/query-streaming-with-events",
            json={"error": "Internal server error"},
            status=500
        )
        
        response = client.post('/explorer', json={"prompt": "Hello"})
        
        # UI should handle server errors gracefully
        assert response.status_code == 200

    @patch('app.AGENT_SERVICE_URL', AGENT_SERVICE_URL)
    @responses.activate
    def test_streaming_response_parsing(self, client):
        """Test UI correctly handles streaming responses."""
        # Mock streaming response with multiple chunks
        streaming_response = "data: First chunk\n\ndata: Second chunk\n\ndata: [DONE]\n\n"
        responses.add(
            responses.POST,
            f"{AGENT_SERVICE_URL}/query-streaming-with-events",
            body=streaming_response,
            status=200,
            content_type="text/plain"
        )
        
        response = client.post('/query-streaming-with-events', json={"prompt": "Tell me a story"})
        
        assert response.status_code == 200
        # Verify streaming endpoint was called
        assert responses.calls[0].request.url.endswith("/query-streaming-with-events")

    @patch('app.AGENT_SERVICE_URL', AGENT_SERVICE_URL)
    @responses.activate
    def test_fallback_to_non_streaming(self, client):
        """Test UI falls back to non-streaming endpoint on streaming failure."""
        # Mock streaming endpoint that starts but then fails during streaming
        responses.add(
            responses.POST,
            f"{AGENT_SERVICE_URL}/query-streaming-with-events",
            body="data: partial response",  # Starts successfully but incomplete
            status=200,
            content_type="text/plain"
        )
        
        # Mock successful non-streaming response for fallback
        responses.add(
            responses.POST,
            f"{AGENT_SERVICE_URL}/query",
            json={"response": "Non-streaming fallback response"},
            status=200
        )
        
        response = client.post('/query-streaming-with-events', json={"prompt": "Hello"})
        
        assert response.status_code == 200
        # Should have tried streaming endpoint
        assert len(responses.calls) >= 1
        assert responses.calls[0].request.url.endswith("/query-streaming-with-events")

    @patch('app.AGENT_SERVICE_URL', AGENT_SERVICE_URL)
    @responses.activate
    def test_connection_error_handling(self, client):
        """Test UI handles initial connection errors gracefully."""
        # Mock complete connection failure
        responses.add(
            responses.POST,
            f"{AGENT_SERVICE_URL}/query-streaming-with-events",
            body=responses.ConnectionError("Connection failed")
        )
        
        response = client.post('/explorer', json={"prompt": "Hello"})
        
        # UI should handle connection errors gracefully
        assert response.status_code == 200
        assert len(responses.calls) == 1

    @patch('app.AGENT_SERVICE_URL', AGENT_SERVICE_URL)
    @responses.activate
    def test_malformed_agent_response(self, client):
        """Test UI handles malformed agent responses."""
        responses.add(
            responses.POST,
            f"{AGENT_SERVICE_URL}/query-streaming-with-events",
            body="invalid json response",
            status=200,
            content_type="text/plain"
        )
        
        response = client.post('/explorer', json={"prompt": "Hello"})
        
        # UI should handle malformed responses gracefully
        assert response.status_code == 200

    # VALIDATION TESTS
    def test_ui_validation(self, client):
        """Test UI input validation."""
        # Empty request
        response = client.post('/explorer', json={})
        assert response.status_code == 400
        
        # No prompt or file
        response = client.post('/explorer', json={"prompt": ""})
        assert response.status_code == 400

    def test_ui_home_page(self, client):
        """Test UI home page loads."""
        response = client.get('/')
        assert response.status_code == 200
        assert b"AI Data Explorer" in response.data

    def test_suggestions_config_file_exists(self, client):
        """Test that suggestions config file exists and is valid JSON"""
        import os
        import json
        
        config_path = os.path.join(os.path.dirname(__file__), '..', 'static', 'suggestions.json')
        assert os.path.exists(config_path), "Suggestions config file should exist"
        
        with open(config_path, 'r') as f:
            data = json.load(f)
        
        assert 'suggestions' in data, "Config should have 'suggestions' key"
        assert isinstance(data['suggestions'], list), "Suggestions should be a list"
        
        # Test structure of suggestions
        for suggestion in data['suggestions']:
            assert 'text' in suggestion, "Each suggestion should have 'text'"
            assert 'category' in suggestion, "Each suggestion should have 'category'"
            assert isinstance(suggestion['text'], str), "Suggestion text should be string"
            assert isinstance(suggestion['category'], str), "Suggestion category should be string"

    def test_suggestions_endpoint_accessible(self, client):
        """Test that suggestions config is accessible via static file serving"""
        response = client.get('/static/suggestions.json')
        assert response.status_code == 200
        
        # Should be valid JSON
        import json
        data = json.loads(response.data)
        assert 'suggestions' in data

    @patch('app.require_auth', lambda f: f)  # Mock auth decorator
    def test_ui_contains_conversation_features(self, client):
        """Test that UI contains conversation history and debug features"""
        response = client.get('/explorer')
        assert response.status_code == 200
        html_content = response.data.decode('utf-8')
        
        # Check for conversation history button
        assert 'toggleHistory()' in html_content
        assert 'data-hint="Show conversation history"' in html_content
        
        # Check for debug toggle button  
        assert 'toggleDebug()' in html_content
        assert 'data-hint="Toggle debug information"' in html_content
        
        # Check for clear history button
        assert 'clearHistory()' in html_content
        assert 'data-hint="Clear conversation history"' in html_content
        
        # Check for suggestions button
        assert 'toggleSuggestions()' in html_content
        assert 'data-hint="Show prompt suggestions"' in html_content

        # Check for select llm model button
        assert 'toggleLLMSelector()' in html_content
        assert 'data-hint="Select LLM models"' in html_content

        # Check for file upload button
        assert 'document.getElementById(\'fileInput\').click()' in html_content
        assert 'data-hint="Upload files"' in html_content

    @patch('app.require_auth', lambda f: f)  # Mock auth decorator
    def test_ui_contains_download_functionality(self, client):
        """Test that UI contains download conversation functionality"""
        response = client.get('/explorer')
        assert response.status_code == 200
        html_content = response.data.decode('utf-8')
        
        # Check for download function
        assert 'downloadConversation()' in html_content
        assert 'title="Download conversation"' in html_content

    @patch('app.require_auth', lambda f: f)  # Mock auth decorator
    def test_ui_javascript_functions_defined(self, client):
        """Test that required JavaScript functions are defined in UI"""
        response = client.get('/explorer')
        assert response.status_code == 200
        html_content = response.data.decode('utf-8')
        
        # Check for function definitions (more flexible matching)
        assert 'toggleHistory' in html_content
        assert 'toggleDebug' in html_content  
        assert 'clearHistory' in html_content
        assert 'toggleSuggestions' in html_content
        assert 'downloadConversation' in html_content
        assert 'selectSuggestion' in html_content

    def test_ui_static_file_serving(self, client):
        """Test that UI serves static files correctly"""
        # Test CSS file
        response = client.get('/static/style.css')
        assert response.status_code == 200
        
        # Test suggestions config
        response = client.get('/static/suggestions.json')
        assert response.status_code == 200

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
