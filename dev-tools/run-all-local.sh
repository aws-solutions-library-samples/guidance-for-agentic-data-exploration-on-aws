#!/bin/bash

# Run local agent service with guardrails for testing
# Usage: ./run-local-with-guardrails.sh [mode] [port]

set -e

GUARDRAIL_MODE=${1:-"enforce"}
PORT=${2:-"8000"}

# Check if port is in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Port $PORT is already in use. Trying port $((PORT + 1))..."
    PORT=$((PORT + 1))
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "Port $PORT is also in use. Please specify a different port or stop the existing service."
        echo "To kill existing service on port 8000: lsof -ti:8000 | xargs kill"
        exit 1
    fi
fi

echo "Starting local agent service with guardrails:"
echo "  Mode: $GUARDRAIL_MODE"
echo "  Port: $PORT"
echo ""

# Try to get guardrail ID from deployed stack
echo "Looking for deployed guardrail..."
GUARDRAIL_ID=$(aws bedrock list-guardrails --query 'guardrails[?name==`ai-data-explorer-guardrails`].id' --output text 2>/dev/null || echo "")

if [ -n "$GUARDRAIL_ID" ]; then
    echo "Found guardrail: $GUARDRAIL_ID"
    export BEDROCK_GUARDRAIL_ID="$GUARDRAIL_ID"
    export BEDROCK_GUARDRAIL_VERSION="1"
else
    echo "No guardrail found - running without guardrails"
    export BEDROCK_GUARDRAIL_ID=""
    export BEDROCK_GUARDRAIL_VERSION="1"
fi

# Set environment variables
export GUARDRAIL_MODE="$GUARDRAIL_MODE"
export LOG_LEVEL="INFO"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export PORT="$PORT"
export BYPASS_TOOL_CONSENT=true
export PYTHON_REPL_TIMEOUT=120
export PYTHONUNBUFFERED=1
export PYTHONIOENCODING=utf-8

# Set knowledge base IDs from deployment files
export TARIFFS_KB_ID=$(cat /tmp/kb-outputs/tariffs-kb-id.txt 2>/dev/null || echo "")
export PRODUCTS_KB_ID=$(cat /tmp/kb-outputs/products-kb-id.txt 2>/dev/null || echo "")
export KNOWLEDGE_BASE_ID=$(cat /tmp/kb-outputs/help-kb-id.txt 2>/dev/null || echo "")

# Install dependencies if needed
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

source .venv/bin/activate
pip install -r ./docker/requirements.txt
pip install -r ./ui/requirements.txt

echo ""
echo "Starting agent service on http://127.0.0.1:$PORT"
echo ""

# Start agent service in background
cd docker/app
python app.py &
AGENT_PID=$!

# Wait for agent service to start
echo "Waiting for agent service to start..."
sleep 3

# Check if agent service is running
if ! kill -0 $AGENT_PID 2>/dev/null; then
    echo "Failed to start agent service"
    exit 1
fi

echo "Agent service started successfully!"
echo ""

# Start UI service
cd ../../ui
export AGENT_SERVICE_URL="http://127.0.0.1:$PORT"
echo "Starting UI on http://127.0.0.1:5000"
echo "Agent service URL: $AGENT_SERVICE_URL"
echo ""
echo "Press Ctrl+C to stop both services"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $AGENT_PID 2>/dev/null || true
    exit 0
}

# Set trap to cleanup on exit
trap cleanup SIGINT SIGTERM

# Start UI (this will block)
python app.py
