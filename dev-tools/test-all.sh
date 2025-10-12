#!/bin/bash

if [[ -z "$VIRTUAL_ENV" ]]; then
    echo "No virtual environment is active"
else
    echo "Virtual environment is active: $VIRTUAL_ENV"
fi

# Run All Tests - Agent Service and UI Service
echo "=========================================="
echo "Running All AI Data Explorer Tests"
echo "=========================================="

# Get the directory where this script is located
SCRIPT_DIR="$(dirname "$0")"

# Run Agent Service Tests
echo ""
echo "1. Running Agent Service Tests..."
echo "------------------------------------------"
"$SCRIPT_DIR/test-agent.sh" --all

AGENT_EXIT_CODE=$?

# Run UI Service Tests
echo ""
echo "2. Running UI Service Tests..."
echo "------------------------------------------"
"$SCRIPT_DIR/test-ui.sh"

UI_EXIT_CODE=$?

# Summary
echo ""
echo "=========================================="
echo "Test Summary:"
echo "=========================================="

if [ $AGENT_EXIT_CODE -eq 0 ]; then
    echo "✅ Agent Service Tests: PASSED"
else
    echo "❌ Agent Service Tests: FAILED"
fi

if [ $UI_EXIT_CODE -eq 0 ]; then
    echo "✅ UI Service Tests: PASSED"
else
    echo "❌ UI Service Tests: FAILED"
fi

# Exit with error if any tests failed
if [ $AGENT_EXIT_CODE -ne 0 ] || [ $UI_EXIT_CODE -ne 0 ]; then
    echo ""
    echo "❌ Some tests failed. Please check the output above."
    exit 1
else
    echo ""
    echo "🎉 All tests passed!"
    exit 0
fi
