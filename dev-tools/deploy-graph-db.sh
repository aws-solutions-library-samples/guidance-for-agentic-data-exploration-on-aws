#!/bin/bash

# Deploy Graph Database Stack
# Usage: ./deploy-graph-db.sh [OPTIONS]

set -e

# Disable AWS CLI pager
export AWS_PAGER=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
AWS_PROFILE=""
AWS_REGION=""
VPC_ID=""
DRY_RUN=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --profile)
      AWS_PROFILE="$2"
      shift 2
      ;;
    --region)
      AWS_REGION="$2"
      shift 2
      ;;
    --vpc-id)
      VPC_ID="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help|-h)
      echo -e "${BLUE}Deploy Graph Database Stack${NC}"
      echo ""
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --profile PROFILE       AWS CLI profile to use"
      echo "  --region REGION         AWS region (e.g., us-east-1)"
      echo "  --vpc-id ID             Existing VPC ID (optional - creates new VPC if not provided)"
      echo "  --dry-run               Show what would be deployed without deploying"
      echo "  --help, -h              Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0 --region us-east-1                    # Deploy with new VPC"
      echo "  $0 --region us-east-1 --vpc-id vpc-123   # Deploy with existing VPC"
      echo "  $0 --profile prod --region us-east-1    # Deploy with specific profile"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}📊 Deploying Graph Database Stack...${NC}"

# Set AWS profile if provided
if [ -n "$AWS_PROFILE" ]; then
    export AWS_PROFILE
    echo -e "${YELLOW}Using AWS Profile: $AWS_PROFILE${NC}"
fi

# Set AWS region
if [ -n "$AWS_REGION" ]; then
    export AWS_REGION
    export AWS_DEFAULT_REGION="$AWS_REGION"
    export CDK_DEFAULT_REGION="$AWS_REGION"
else
    AWS_REGION="${AWS_DEFAULT_REGION:-$(aws configure get region 2>/dev/null || echo "")}"
    if [ -z "$AWS_REGION" ]; then
        echo -e "${RED}Error: AWS region not specified${NC}"
        echo "Please provide --region or set AWS_DEFAULT_REGION"
        exit 1
    fi
    export AWS_REGION
    export CDK_DEFAULT_REGION="$AWS_REGION"
fi
echo -e "${YELLOW}Using AWS Region: $AWS_REGION${NC}"

# Get AWS account ID
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
if [ -z "$AWS_ACCOUNT" ]; then
    echo -e "${RED}Error: Could not determine AWS account ID${NC}"
    exit 1
fi
export CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT"
echo -e "${YELLOW}Using AWS Account: $AWS_ACCOUNT${NC}"

# Create output directory
mkdir -p /tmp/graph-db-outputs

# Build CDK deploy command
CDK_COMMAND="CDK_DOCKER=podman npx cdk deploy DataExplorerGraphDbStack --app \"npx tsx bin/graph-db-app.ts\""

# Add VPC context if provided
if [ -n "$VPC_ID" ]; then
  echo -e "${YELLOW}Deploying to VPC: $VPC_ID${NC}"
  CDK_COMMAND="$CDK_COMMAND --context vpcId=$VPC_ID"
else
  echo -e "${YELLOW}Deploying with new VPC${NC}"
fi

CDK_COMMAND="$CDK_COMMAND --require-approval never"

# Execute deployment
if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}[DRY RUN] Would execute:${NC}"
    echo "$CDK_COMMAND"
else
    eval $CDK_COMMAND

    # Get deployment outputs
    NEPTUNE_CLUSTER_ID=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneClusterId'].OutputValue" --output text 2>/dev/null || echo "Not available")
    NEPTUNE_ENDPOINT=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneEndpoint'].OutputValue" --output text 2>/dev/null || echo "Not available")
    NEPTUNE_SG_ID=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneSecurityGroupId'].OutputValue" --output text 2>/dev/null || echo "Not available")
    VPC_ID_OUTPUT=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbVpcId'].OutputValue" --output text 2>/dev/null || echo "Not available")

    echo ""
    echo -e "${GREEN}🎉 Graph Database Stack Deployment Complete!${NC}"
    echo "=============================================="
    echo "  📊 Neptune Cluster ID: $NEPTUNE_CLUSTER_ID"
    echo "  🌐 Neptune Endpoint: $NEPTUNE_ENDPOINT"
    echo "  🔒 Neptune Security Group: $NEPTUNE_SG_ID"
    echo "  🏠 VPC ID: $VPC_ID_OUTPUT"
    echo ""

    # Save outputs to files for main deployment script
    echo -n "$NEPTUNE_CLUSTER_ID" > /tmp/graph-db-outputs/neptune-cluster-id.txt
    echo -n "$NEPTUNE_ENDPOINT" > /tmp/graph-db-outputs/neptune-endpoint.txt
    echo -n "$NEPTUNE_SG_ID" > /tmp/graph-db-outputs/neptune-sg-id.txt
    echo -n "$VPC_ID_OUTPUT" > /tmp/graph-db-outputs/vpc-id.txt

    echo "Graph DB outputs saved to /tmp/graph-db-outputs/"
fi
