#!/bin/bash

# Script to run UI locally with option to connect to AWS backend
# Usage (run from project root): 
#   ./dev-tools/run-ui-local.sh           # Run with local backend
#   ./dev-tools/run-ui-local.sh --aws     # Run with AWS backend

set -e  # Exit on any error

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "📁 Project root: $PROJECT_ROOT"

# Change to project root directory
cd "$PROJECT_ROOT"

# Check for AWS flag
USE_AWS=false
if [[ "$1" == "--aws" ]]; then
    USE_AWS=true
    echo "🌐 Running UI locally with AWS backend services"
else
    echo "🏠 Running UI locally with local backend services"
fi

# Check if virtual environment exists
if [[ ! -d ".venv" ]]; then
    echo "❌ Virtual environment not found. Please run: python -m venv .venv"
    exit 1
fi

# Activate virtual environment
echo "📦 Activating virtual environment..."
source .venv/bin/activate

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r ./docker/requirements.txt
pip install -r ./ui/requirements.txt

if [[ "$USE_AWS" == "true" ]]; then
    # Use deployed AWS service
    echo "🔍 Looking up AWS backend service URL..."
    
    # Check if AWS CLI is configured
    if ! aws sts get-caller-identity > /dev/null 2>&1; then
        echo "❌ AWS CLI not configured. Please run: aws configure"
        exit 1
    fi
    
    # Get the CloudFront URL from CloudFormation (HTTPS)
    FULL_URL=$(aws cloudformation describe-stacks \
        --stack-name DataExplorerAgentsStack \
        --query "Stacks[0].Outputs[?ExportName=='ApplicationUrl'].OutputValue" \
        --output text 2>/dev/null)
    
    if [[ -z "$FULL_URL" || "$FULL_URL" == "None" ]]; then
        echo "❌ Could not find deployed stack 'DataExplorerAgentsStack'"
        echo "   Make sure you've deployed with: ./dev-tools/deploy.sh"
        exit 1
    fi
    
    # The CloudFront URL is the base URL for both UI and agent services
    export AGENT_SERVICE_URL="$FULL_URL"
    
    # Test connection to AWS service
    echo "🧪 Testing connection to AWS backend..."
    if curl -s --max-time 10 "$AGENT_SERVICE_URL/health" > /dev/null; then
        echo "✅ AWS backend service is accessible: $AGENT_SERVICE_URL (via CloudFront)"
        
        # Get additional AWS environment variables for full functionality
        echo "🔧 Setting up AWS environment variables..."
        
        # Get Neptune ETL bucket if available (for graph DB functionality)
        NEPTUNE_BUCKET=$(aws cloudformation describe-stacks \
            --stack-name DataExplorerGraphDbStack \
            --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneEtlBucketName'].OutputValue" \
            --output text 2>/dev/null || echo "")
        
        if [[ -n "$NEPTUNE_BUCKET" && "$NEPTUNE_BUCKET" != "None" ]]; then
            export NEPTUNE_ETL_BUCKET="$NEPTUNE_BUCKET"
            echo "📊 Graph DB functionality enabled with bucket: $NEPTUNE_BUCKET"
        else
            echo "ℹ️  Graph DB not deployed (use --with-graph-db to enable)"
        fi
        
        # Get Knowledge Base configuration if available
        KB_BUCKET=$(aws cloudformation describe-stacks \
            --stack-name DataExplorerAgentsStack \
            --query "Stacks[0].Outputs[?ExportName=='KnowledgeBaseBucket'].OutputValue" \
            --output text 2>/dev/null || echo "")
        
        if [[ -n "$KB_BUCKET" && "$KB_BUCKET" != "None" ]]; then
            export KB_S3_BUCKET_NAME="$KB_BUCKET"
            echo "📚 Knowledge Base functionality enabled with bucket: $KB_BUCKET"
        fi
        
    else
        echo "❌ Cannot connect to AWS backend service: $AGENT_SERVICE_URL"
        echo "   Check if the service is deployed and healthy"
        exit 1
    fi
    
else
    # Start local agent service
    echo "🚀 Starting local agent service..."
    cd "$PROJECT_ROOT/docker/app"
    
    # Kill any existing agent service
    pkill -f "python app.py" 2>/dev/null || true
    
    # Start agent service in background
    nohup python app.py > agent.log 2>&1 &
    AGENT_PID=$!
    cd "$PROJECT_ROOT"
    
    # Wait for agent service to start
    echo "⏳ Waiting for local agent service to start..."
    for i in {1..10}; do
        if curl -s http://127.0.0.1:8000/health > /dev/null; then
            echo "✅ Local agent service started on http://127.0.0.1:8000"
            echo "   (Agent Service PID: $AGENT_PID)"
            export AGENT_SERVICE_URL="http://127.0.0.1:8000"
            break
        fi
        if [[ $i -eq 10 ]]; then
            echo "❌ Failed to start local agent service after 10 attempts"
            echo "   Check $PROJECT_ROOT/docker/app/agent.log for errors"
            kill $AGENT_PID 2>/dev/null || true
            exit 1
        fi
        sleep 1
    done
fi

# Set up cleanup function
cleanup() {
    echo "🧹 Cleaning up..."
    if [[ "$USE_AWS" != "true" && -n "$AGENT_PID" ]]; then
        kill $AGENT_PID 2>/dev/null || true
        echo "   Stopped local agent service"
    fi
}
trap cleanup EXIT

# Run the UI in development mode
cd "$PROJECT_ROOT/ui"
export FLASK_ENV=development
export FLASK_DEBUG=1

echo ""
echo "🎉 Starting UI server..."
echo "   UI: http://127.0.0.1:5000"
echo "   Backend: $AGENT_SERVICE_URL"
if [[ "$USE_AWS" == "true" ]]; then
    echo "   Mode: Local UI + AWS Backend"
    echo "   Graph DB: ${NEPTUNE_ETL_BUCKET:+Enabled}${NEPTUNE_ETL_BUCKET:-Disabled}"
    echo "   Knowledge Base: ${KB_S3_BUCKET_NAME:+Enabled}${KB_S3_BUCKET_NAME:-Disabled}"
else
    echo "   Mode: Full Local Development"
fi
echo ""
echo "Press Ctrl+C to stop"

python app.py
