#!/bin/bash

# UI Integration Test Runner
echo "Starting UI Integration Tests..."

# Change to ui directory (parent of tests)
cd "$(dirname "$0")/.."

# Install test dependencies
pip install -r tests/test-requirements.txt

# Set environment variables for testing
export FLASK_ENV=testing
export AGENT_SERVICE_URL=http://mock-agent-service.com

# Run the tests
python -m pytest tests/test_ui_integration.py -v --tb=short

UI_EXIT_CODE=$?

if [ $UI_EXIT_CODE -eq 0 ]; then
    echo "✅ UI Integration Tests: PASSED"
else
    echo "❌ UI Integration Tests: FAILED"
fi

echo "UI Integration Tests Complete!"

exit $UI_EXIT_CODE
