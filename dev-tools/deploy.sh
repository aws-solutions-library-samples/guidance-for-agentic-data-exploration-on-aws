#!/bin/bash

# Deploy AI Data Explorer with optional VPC/Neptune and Bedrock Guardrails
# Usage: ./deploy.sh [OPTIONS]

set -e

# Configuration
# Required s3vectors support was added in this version
MIN_AWS_CLI_VERSION="2.27.51"


# Function to compare version numbers
version_compare() {
    local version1=$1
    local version2=$2
    
    # Split versions into arrays
    IFS='.' read -ra V1 <<< "$version1"
    IFS='.' read -ra V2 <<< "$version2"
    
    # Compare each part
    for i in {0..2}; do
        local v1_part=${V1[i]:-0}
        local v2_part=${V2[i]:-0}
        
        if (( v1_part > v2_part )); then
            return 0  # version1 > version2
        elif (( v1_part < v2_part )); then
            return 1  # version1 < version2
        fi
    done
    
    return 0  # versions are equal
}

# Preflight check: AWS CLI version
echo "Checking AWS CLI version..."
if ! command -v aws &> /dev/null; then
    echo "❌ Error: AWS CLI is not installed or not in PATH"
    echo "📣 Please install AWS CLI version $MIN_AWS_CLI_VERSION or later"
    exit 1
fi

AWS_VERSION=$(aws --version 2>&1 | cut -d/ -f2 | cut -d' ' -f1)
echo "Found AWS CLI version: $AWS_VERSION"

if ! version_compare "$AWS_VERSION" "$MIN_AWS_CLI_VERSION"; then
    echo "❌ Error: AWS CLI version $AWS_VERSION is below minimum required version $MIN_AWS_CLI_VERSION"
    echo "📣 Please upgrade your AWS CLI to version $MIN_AWS_CLI_VERSION or later"
    echo "⚙️  Visit: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

echo "✓ AWS CLI version check passed"

# Update version information before deployment
echo "Updating version information..."
npm run version:update

# Default values
VPC_ID=""
NEPTUNE_SG=""
NEPTUNE_HOST=""
GUARDRAIL_MODE=""
DEPLOY_GRAPH_DB=false

# Knowledge Base configuration
export APP_NAME="ai-data-explorer"
export EMBEDDING_MODEL="arn:aws:bedrock:${AWS_REGION}::foundation-model/amazon.titan-embed-text-v2:0"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --vpc-id)
      VPC_ID="$2"
      shift 2
      ;;
    --neptune-sg)
      NEPTUNE_SG="$2"
      shift 2
      ;;
    --neptune-host)
      NEPTUNE_HOST="$2"
      shift 2
      ;;
    --guardrail-mode)
      GUARDRAIL_MODE="$2"
      shift 2
      ;;
    --with-graph-db)
      DEPLOY_GRAPH_DB=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "VPC/Neptune Options:"
      echo "  --vpc-id ID             Existing VPC ID (optional - creates new VPC if not provided)"
      echo "  --neptune-sg ID         Neptune security group ID (required if using existing VPC)"
      echo "  --neptune-host HOST     Neptune cluster endpoint (required if using existing VPC)"
      echo ""
      echo "Guardrails Options:"
      echo "  --guardrail-mode MODE   'shadow' (monitor) or 'enforce' (block) - default: shadow"
      echo ""
      echo "Graph Database Options:"
      echo "  --with-graph-db         Deploy Neptune graph database stack"
      echo ""
      echo "General Options:"
      echo "  --help, -h              Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                                    # Deploy with new VPC, shadow guardrails"
      echo "  $0 --guardrail-mode enforce          # Deploy with new VPC, enforcing guardrails"
      echo "  $0 --vpc-id vpc-123 --neptune-sg sg-456 --neptune-host cluster.neptune.amazonaws.com"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Validate Neptune configuration
if [ -n "$NEPTUNE_HOST" ]; then
  if [ -z "$NEPTUNE_SG" ]; then
    echo "Error: When using Neptune host, --neptune-sg is also required"
    echo "Use --help for usage information"
    exit 1
  fi
fi

# Build CDK deploy command (stay in project root)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Deploy Graph Database Stack if requested
if [ "$DEPLOY_GRAPH_DB" = true ]; then
  if [ -n "$VPC_ID" ]; then
    ./dev-tools/deploy-graph-db.sh --vpc-id "$VPC_ID"
  else
    ./dev-tools/deploy-graph-db.sh
  fi
  
  # Read Neptune outputs for main deployment
  if [ -f "/tmp/graph-db-outputs/neptune-endpoint.txt" ] && [ -f "/tmp/graph-db-outputs/neptune-sg-id.txt" ]; then
    NEPTUNE_HOST=$(cat /tmp/graph-db-outputs/neptune-endpoint.txt)
    NEPTUNE_SG=$(cat /tmp/graph-db-outputs/neptune-sg-id.txt)
    
    # Read VPC ID if not already set and file exists
    if [ -z "$VPC_ID" ] && [ -f "/tmp/graph-db-outputs/vpc-id.txt" ]; then
      VPC_ID=$(cat /tmp/graph-db-outputs/vpc-id.txt)
      echo "Using deployed VPC: $VPC_ID"
    fi
    
    echo "Using deployed Neptune: $NEPTUNE_HOST (SG: $NEPTUNE_SG)"
  fi
fi

# Check for existing Neptune stack 
if [ -z "$NEPTUNE_HOST" ] && [ -z "$NEPTUNE_SG" ]; then
  echo "Checking for existing Neptune stack..."
  EXISTING_NEPTUNE_HOST=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneEndpoint'].OutputValue" --output text 2>/dev/null || echo "")
  EXISTING_NEPTUNE_SG=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneSecurityGroupId'].OutputValue" --output text 2>/dev/null || echo "")
  EXISTING_VPC_ID=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbVpcId'].OutputValue" --output text 2>/dev/null || echo "")
  
  if [[ -n "$EXISTING_NEPTUNE_HOST" && -n "$EXISTING_NEPTUNE_SG" ]]; then
    NEPTUNE_HOST="$EXISTING_NEPTUNE_HOST"
    NEPTUNE_SG="$EXISTING_NEPTUNE_SG"
    if [ -z "$VPC_ID" ] && [ -n "$EXISTING_VPC_ID" ]; then
      VPC_ID="$EXISTING_VPC_ID"
    fi
    echo "Found existing Neptune stack:"
    echo "  Neptune endpoint: $NEPTUNE_HOST"
    echo "  Neptune security group: $NEPTUNE_SG"
    echo "  VPC ID: $VPC_ID"
  fi
fi

# Create Knowledge Base first
echo "Creating Bedrock Knowledge Base..."

# Run knowledge base creation script
./scripts/kb-create.sh

# Get the created knowledge base details
HELP_KB_ID=$(cat /tmp/kb-outputs/help-kb-id.txt 2>/dev/null || echo "")
HELP_KB_ARN=$(cat /tmp/kb-outputs/help-kb-arn.txt 2>/dev/null || echo "")
PRODUCTS_KB_ID=$(cat /tmp/kb-outputs/products-kb-id.txt 2>/dev/null || echo "")
PRODUCTS_KB_ARN=$(cat /tmp/kb-outputs/products-kb-arn.txt 2>/dev/null || echo "")
TARIFFS_KB_ID=$(cat /tmp/kb-outputs/tariffs-kb-id.txt 2>/dev/null || echo "")
TARIFFS_KB_ARN=$(cat /tmp/kb-outputs/tariffs-kb-arn.txt 2>/dev/null || echo "")

if [[ -n "$HELP_KB_ID" ]]; then
  echo "Help Knowledge Base created with ID: $HELP_KB_ID"
else
  echo "Warning: Could not retrieve Help Knowledge Base ID"
fi

if [[ -n "$PRODUCTS_KB_ID" ]]; then
  echo "Products Knowledge Base created with ID: $PRODUCTS_KB_ID"
else
  echo "Warning: Could not retrieve Products Knowledge Base ID"
fi

if [[ -n "$TARIFFS_KB_ID" ]]; then
  echo "Tariffs Knowledge Base created with ID: $TARIFFS_KB_ID"
else
  echo "Warning: Could not retrieve Tariffs Knowledge Base ID"
fi

CDK_COMMAND="CDK_DOCKER=podman npx cdk deploy --app \"npx tsx bin/cdk-app.ts\""

# Add VPC context if provided
if [ -n "$VPC_ID" ]; then
  echo "** Deploying with existing VPC"
  CDK_COMMAND="$CDK_COMMAND --context vpcId=$VPC_ID"
else
  echo "Deploying with new VPC"
fi

# Add Neptune/Graph database context if available
if [ -n "$NEPTUNE_HOST" ]; then
  echo "** Deploying with Graph Database integration"
  CDK_COMMAND="$CDK_COMMAND \
    --context withGraphDb=true \
    --context neptuneHost=$NEPTUNE_HOST \
    --context neptuneSgId=$NEPTUNE_SG"
fi

# Add guardrails context (always enabled now)
echo "** Deploying with Bedrock Guardrails"

CDK_COMMAND="$CDK_COMMAND \
  --context guardrailMode=$GUARDRAIL_MODE"

CDK_COMMAND="$CDK_COMMAND --require-approval never"

# Execute deployment
eval $CDK_COMMAND


# Show configuration summary
if [ -n "$VPC_ID" ]; then
  echo ""
  echo "VPC Configuration:"
  echo "  Used existing VPC: $VPC_ID"
fi

if [ -n "$NEPTUNE_HOST" ]; then
  echo ""
  echo "Neptune Configuration:"
  echo "  Neptune endpoint: $NEPTUNE_HOST"
  echo "  Neptune security group: $NEPTUNE_SG"
fi

echo ""
echo "Guardrail Configuration:"
echo "  Mode: $GUARDRAIL_MODE"
if [ "$GUARDRAIL_MODE" = "shadow" ]; then
  echo "  - Content will NOT be blocked"
  echo "  - Violations will be logged for monitoring"
  echo "  - Check container logs for [GUARDRAIL] messages"
else
  echo "  - Content WILL be blocked if it violates policies"
  echo "  - Blocked content will be replaced with safe messages"
fi

# Get deployment URLs
ALB_URL=$(aws cloudformation describe-stacks --stack-name DataExplorerAgentsStack --query "Stacks[0].Outputs[?ExportName=='ALBEndpoint'].OutputValue" --output text 2>/dev/null || echo "Not available")
CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name DataExplorerAgentsStack --query "Stacks[0].Outputs[?ExportName=='ApplicationUrl'].OutputValue" --output text 2>/dev/null || echo "Not available")

echo ""
echo "Deployment Complete!"
echo "======================="
echo "  CloudFront URL (HTTPS): $CLOUDFRONT_URL"
echo "  Direct ALB URL (HTTP): $ALB_URL"
echo ""