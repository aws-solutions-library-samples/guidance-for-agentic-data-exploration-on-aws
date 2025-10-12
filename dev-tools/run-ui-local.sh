#!/bin/bash

# Check for AWS flag
USE_AWS=false
if [[ "$1" == "--aws" ]]; then
    USE_AWS=true
fi

# Activate virtual environment
source ../.venv/bin/activate

# Install dependencies
pip install -r ../docker/requirements.txt
pip install -r ../ui/requirements.txt

if [[ "$USE_AWS" == "true" ]]; then
    # Use deployed AWS service
    FULL_URL=$(aws cloudformation describe-stacks --stack-name DataExplorerAgentsStack --query "Stacks[0].Outputs[?ExportName=='AgentAPIEndpoint'].OutputValue" --output text)
    export AGENT_SERVICE_URL=${FULL_URL%/query}
    echo "Using AWS backend service: $AGENT_SERVICE_URL"
else
    # Start local agent service
    echo "Starting local agent service..."
    cd ../docker/app
    nohup python app.py > agent.log 2>&1 &
    AGENT_PID=$!
    cd ../../dev-tools
    
    # Wait for agent service to start
    sleep 3
    if curl -s http://127.0.0.1:8000/health > /dev/null; then
        echo "Local agent service started on http://127.0.0.1:8000"
        echo "(Agent Service PID: $AGENT_PID)"
        export AGENT_SERVICE_URL="http://127.0.0.1:8000"
    else
        echo "Failed to start local agent service"
        kill $AGENT_PID 2>/dev/null
        exit 1
    fi
fi

# Run the UI in development mode
cd ../ui
export FLASK_ENV=development
export FLASK_DEBUG=1
echo "Starting UI on http://127.0.0.1:5000"
python app.py
