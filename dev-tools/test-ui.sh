#!/bin/bash

if [[ -z "$VIRTUAL_ENV" ]]; then
    echo "No virtual environment is active"
else
    echo "Virtual environment is active: $VIRTUAL_ENV"
fi

# UI Integration Test Runner
echo "Starting UI Integration Tests..."

# Change to ui directory from dev-tools
cd "$(dirname "$0")/../ui"

# Install test dependencies
pip install -r tests/test-requirements.txt

# Set environment variables for testing
export FLASK_ENV=testing
export AGENT_SERVICE_URL=http://mock-agent-service.com

# Run the tests
python -m pytest tests/test_ui_integration.py -v --tb=short

echo "UI Integration Tests Complete!"
