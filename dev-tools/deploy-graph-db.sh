#!/bin/bash

# Deploy Graph Database Stack
# Usage: ./deploy-graph-db.sh [--vpc-id vpc-xxxxx]

set -e

# Default values
VPC_ID=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --vpc-id)
      VPC_ID="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --vpc-id ID             Existing VPC ID (optional - creates new VPC if not provided)"
      echo "  --help, -h              Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                      # Deploy with new VPC"
      echo "  $0 --vpc-id vpc-123     # Deploy with existing VPC"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "📊 Deploying Graph Database Stack..."

# Set CDK environment variables
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=$(aws configure get region)

# Create output directory
mkdir -p /tmp/graph-db-outputs

# Build CDK deploy command
CDK_COMMAND="CDK_DOCKER=podman npx cdk deploy DataExplorerGraphDbStack --app \"npx tsx bin/graph-db-app.ts\""

# Add VPC context if provided
if [ -n "$VPC_ID" ]; then
  echo "** Deploying with existing VPC: $VPC_ID"
  CDK_COMMAND="$CDK_COMMAND --context vpcId=$VPC_ID"
else
  echo "** Deploying with new VPC"
fi

CDK_COMMAND="$CDK_COMMAND --require-approval never"

# Execute deployment
eval $CDK_COMMAND

# Get deployment outputs
NEPTUNE_CLUSTER_ID=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneClusterId'].OutputValue" --output text 2>/dev/null || echo "Not available")
NEPTUNE_ENDPOINT=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneEndpoint'].OutputValue" --output text 2>/dev/null || echo "Not available")
NEPTUNE_SG_ID=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneSecurityGroupId'].OutputValue" --output text 2>/dev/null || echo "Not available")

echo ""
echo "🎉 Graph Database Stack Deployment Complete!"
echo "=============================================="
echo "  📊 Neptune Cluster ID: $NEPTUNE_CLUSTER_ID"
echo "  🌐 Neptune Endpoint: $NEPTUNE_ENDPOINT"
echo "  🔒 Neptune Security Group: $NEPTUNE_SG_ID"
echo ""

# Save outputs to files for main deployment script
echo -n "$NEPTUNE_CLUSTER_ID" > /tmp/graph-db-outputs/neptune-cluster-id.txt
echo -n "$NEPTUNE_ENDPOINT" > /tmp/graph-db-outputs/neptune-endpoint.txt
echo -n "$NEPTUNE_SG_ID" > /tmp/graph-db-outputs/neptune-sg-id.txt

echo "Graph DB outputs saved to /tmp/graph-db-outputs/"
