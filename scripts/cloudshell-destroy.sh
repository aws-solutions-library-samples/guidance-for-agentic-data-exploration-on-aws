#!/bin/bash

# AI Data Explorer - CloudShell Destroy Script
# Removes all deployed resources in reverse order of deployment
set -e

# disable the use of a pager that requires user interaction
export AWS_PAGER=""

# Default values
DESTROY_GRAPH_DB=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --with-graph-db)
      DESTROY_GRAPH_DB=true
      shift
      ;;
    --help|-h)
      echo "========================================="
      echo "🗑️  AI Data Explorer - CloudShell Destroy"
      echo "========================================="
      echo ""
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --with-graph-db         Also destroy Neptune graph database stack"
      echo "  --help, -h              Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                      # Destroy main application only"
      echo "  $0 --with-graph-db      # Destroy everything including Neptune"
      echo ""
      exit 0
      ;;
    *)
      echo "❌ Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo "========================================="
echo "🗑️  AI Data Explorer - CloudShell Destroy"
echo "========================================="

# Step 1: Destroy Main Application Stack
echo "🏗️  Destroying Main Application Stack..."
if aws cloudformation describe-stacks --stack-name DataExplorerAgentsStack --region ${AWS_REGION:-us-west-2} >/dev/null 2>&1; then
    echo "📦 Found DataExplorerAgentsStack, destroying..."
    npx cdk destroy DataExplorerAgentsStack --force
    echo "✅ Main application stack destroyed"
else
    echo "ℹ️  DataExplorerAgentsStack not found, skipping"
fi

# Step 2: Destroy Knowledge Bases
echo "🧠 Destroying Bedrock Knowledge Bases..."
if [ -f "./scripts/kb-destroy.sh" ]; then
    ./scripts/kb-destroy.sh
    echo "✅ Knowledge bases destroyed"
else
    echo "⚠️  kb-destroy.sh not found, skipping knowledge base cleanup"
fi

# Step 3: Destroy Graph Database Stack (if requested)
if [ "$DESTROY_GRAPH_DB" = true ]; then
    echo "📊 Destroying Graph Database Stack..."
    if aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --region ${AWS_REGION:-us-west-2} >/dev/null 2>&1; then
        echo "📦 Found DataExplorerGraphDbStack, destroying..."
        npx cdk destroy DataExplorerGraphDbStack --app "npx tsx bin/graph-db-app.ts" --force
        echo "✅ Graph database stack destroyed"
    else
        echo "ℹ️  DataExplorerGraphDbStack not found, skipping"
    fi
else
    echo "ℹ️  Skipping Graph Database stack (use --with-graph-db to destroy)"
fi

# Step 4: Clean up temporary files
echo "🧹 Cleaning up temporary files..."
rm -rf /tmp/kb-outputs/
rm -rf /tmp/graph-db-outputs/
rm -f /tmp/trust-policy.json
rm -f /tmp/role-policy.json
echo "✅ Temporary files cleaned"

# Step 5: Show completion summary
echo ""
echo "==================="
echo "🎉 Destroy Complete!"
echo "==================="
echo ""

if [ "$DESTROY_GRAPH_DB" = true ]; then
    echo "✅ Destroyed:"
    echo "   - Main Application Stack"
    echo "   - Bedrock Knowledge Bases"
    echo "   - Neptune Graph Database Stack"
    echo "   - Temporary files"
else
    echo "✅ Destroyed:"
    echo "   - Main Application Stack"
    echo "   - Bedrock Knowledge Bases"
    echo "   - Temporary files"
    echo ""
    echo "ℹ️  Neptune Graph Database Stack preserved"
    echo "   Use --with-graph-db to destroy everything"
fi

echo ""
echo "🔍 Verify cleanup:"
echo "   aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query \"StackSummaries[?contains(StackName, 'DataExplorer')].StackName\""
echo ""

echo "✅ CloudShell destroy completed successfully!"
