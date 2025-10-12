#!/bin/bash

# AI Data Explorer - CloudShell Deployment Script
# Combined deployment script for CloudShell environment
set -e

# disable the use of a pager that requires user interaction
export AWS_PAGER=""

# set AWS_REGION if not already set
if [ -z "$AWS_REGION" ]; then
  AWS_REGION=$(aws configure get region)
  export AWS_REGION
fi

# Default values
VPC_ID=""
NEPTUNE_SG=""
NEPTUNE_HOST=""
GUARDRAIL_MODE="shadow"
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
      echo "🚀 AI Data Explorer - CloudShell Deployment"
      echo "============================================"
      echo ""
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
      echo "  $0 --with-graph-db                   # Deploy with new VPC and Neptune"
      echo "  $0 --guardrail-mode enforce          # Deploy with enforcing guardrails"
      echo "  $0 --vpc-id vpc-123 --neptune-sg sg-456 --neptune-host cluster.neptune.amazonaws.com"
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

echo "============================================"
echo "🚀 AI Data Explorer - CloudShell Deployment"
echo "============================================"

# Validate Neptune configuration
if [ -n "$NEPTUNE_HOST" ]; then
  if [ -z "$NEPTUNE_SG" ]; then
    echo "❌ Error: When using Neptune host, --neptune-sg is also required"
    echo "Use --help for usage information"
    exit 1
  fi
fi

# Ensure CDK is bootstrapped
echo "🏗️  Checking CDK bootstrap status..."
if ! npx cdk bootstrap --show-template > /dev/null 2>&1; then
  echo "📦 Bootstrapping CDK environment..."
  npx cdk bootstrap
  echo "✅ CDK bootstrap completed"
else
  echo "✅ CDK already bootstrapped"
fi

# Deploy Graph Database Stack if requested
if [ "$DEPLOY_GRAPH_DB" = true ]; then
  echo "📊 Deploying Graph Database Stack..."
  
  # Build graph DB deploy command
  GRAPH_CDK_COMMAND="npx cdk deploy DataExplorerGraphDbStack --app \"npx tsx bin/graph-db-app.ts\""
  
  if [ -n "$VPC_ID" ]; then
    echo "** Using existing VPC: $VPC_ID"
    GRAPH_CDK_COMMAND="$GRAPH_CDK_COMMAND --context vpcId=$VPC_ID"
  else
    echo "** Creating new VPC for Graph Database"
  fi
  
  GRAPH_CDK_COMMAND="$GRAPH_CDK_COMMAND --require-approval never"
  
  echo "Executing: $GRAPH_CDK_COMMAND"
  eval $GRAPH_CDK_COMMAND
  
  # Get Neptune outputs
  NEPTUNE_CLUSTER_ID=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneClusterId'].OutputValue" --output text 2>/dev/null || echo "")
  NEPTUNE_HOST=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneEndpoint'].OutputValue" --output text 2>/dev/null || echo "")
  NEPTUNE_SG=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneSecurityGroupId'].OutputValue" --output text 2>/dev/null || echo "")
  NEPTUNE_VPC_ID=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbVpcId'].OutputValue" --output text 2>/dev/null || echo "")
  
  if [[ -n "$NEPTUNE_HOST" && -n "$NEPTUNE_SG" ]]; then
    echo "✅ Neptune deployed successfully:"
    echo "   Cluster ID: $NEPTUNE_CLUSTER_ID"
    echo "   Endpoint: $NEPTUNE_HOST"
    echo "   Security Group: $NEPTUNE_SG"
    echo "   VPC ID: $NEPTUNE_VPC_ID"
    
    # Use Neptune's VPC for the main application
    if [ -n "$NEPTUNE_VPC_ID" ]; then
      VPC_ID="$NEPTUNE_VPC_ID"
      echo "✅ Using Neptune VPC for main application: $VPC_ID"
    fi
  else
    echo "⚠️  Warning: Could not retrieve Neptune outputs"
  fi
fi

# Create Knowledge Bases
echo "🧠 Creating Bedrock Knowledge Bases..."
./scripts/kb-create.sh

# Get Knowledge Base IDs
HELP_KB_ID=$(cat /tmp/kb-outputs/help-kb-id.txt 2>/dev/null || echo "")
HELP_KB_ARN=$(cat /tmp/kb-outputs/help-kb-arn.txt 2>/dev/null || echo "")
PRODUCTS_KB_ID=$(cat /tmp/kb-outputs/products-kb-id.txt 2>/dev/null || echo "")
PRODUCTS_KB_ARN=$(cat /tmp/kb-outputs/products-kb-arn.txt 2>/dev/null || echo "")

if [[ -n "$HELP_KB_ID" ]]; then
  echo "✅ Help Knowledge Base: $HELP_KB_ID"
else
  echo "⚠️  Warning: Could not retrieve Help Knowledge Base ID"
fi

if [[ -n "$PRODUCTS_KB_ID" ]]; then
  echo "✅ Products Knowledge Base: $PRODUCTS_KB_ID"
else
  echo "⚠️  Warning: Could not retrieve Products Knowledge Base ID"
fi

# Deploy Main Application Stack
echo "🏗️  Deploying Main Application Stack..."

CDK_COMMAND="npx cdk deploy --app \"npx tsx bin/cdk-app.ts\""

# Add VPC/Neptune context if provided
if [ -n "$VPC_ID" ]; then
  echo "** Using existing VPC: $VPC_ID"
  CDK_COMMAND="$CDK_COMMAND --context vpcId=$VPC_ID"
else
  echo "** Creating new VPC for Application"
fi

# Add Neptune context if available (from either existing or newly deployed Neptune)
if [ -n "$NEPTUNE_SG" ]; then
  CDK_COMMAND="$CDK_COMMAND --context neptuneSgId=$NEPTUNE_SG"
fi

if [ -n "$NEPTUNE_HOST" ]; then
  CDK_COMMAND="$CDK_COMMAND --context neptuneHost=$NEPTUNE_HOST"
fi

# Add guardrails context
echo "** Bedrock Guardrails mode: $GUARDRAIL_MODE"
CDK_COMMAND="$CDK_COMMAND --context guardrailMode=$GUARDRAIL_MODE"

# Add graph database context if deployed
if [ "$DEPLOY_GRAPH_DB" = true ]; then
  echo "** Graph Database enabled: true"
  CDK_COMMAND="$CDK_COMMAND --context withGraphDb=true"
fi

CDK_COMMAND="$CDK_COMMAND --require-approval never"

echo "Executing: $CDK_COMMAND"
eval $CDK_COMMAND

# Get deployment URLs
echo "🔍 Retrieving deployment URLs..."
ALB_URL=$(aws cloudformation describe-stacks --stack-name DataExplorerAgentsStack --query "Stacks[0].Outputs[?ExportName=='ALBEndpoint'].OutputValue" --output text 2>/dev/null || echo "Not available")
CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name DataExplorerAgentsStack --query "Stacks[0].Outputs[?ExportName=='ApplicationUrl'].OutputValue" --output text 2>/dev/null || echo "Not available")

# Show deployment summary
echo ""
echo "🎉 Deployment Complete!"
echo "======================="
echo ""

if [ -n "$VPC_ID" ]; then
  echo "📡 VPC Configuration:"
  echo "   Used existing VPC: $VPC_ID"
fi

if [ -n "$NEPTUNE_HOST" ]; then
  echo ""
  echo "📊 Neptune Configuration:"
  echo "   Endpoint: $NEPTUNE_HOST"
  echo "   Security Group: $NEPTUNE_SG"
fi

echo ""
echo "🛡️  Guardrail Configuration:"
echo "   Mode: $GUARDRAIL_MODE"
if [ "$GUARDRAIL_MODE" = "shadow" ]; then
  echo "   - Content will NOT be blocked"
  echo "   - Violations will be logged for monitoring"
  echo "   - Check container logs for [GUARDRAIL] messages"
else
  echo "   - Content WILL be blocked if it violates policies"
  echo "   - Blocked content will be replaced with safe messages"
fi

echo ""
echo "🌐 Application URLs:"
echo "   CloudFront (HTTPS): $CLOUDFRONT_URL"
echo "   ALB Direct (HTTP):  $ALB_URL"
echo ""

echo "📋 Next Steps:"
echo "1. Create an admin user:"
echo "   ./scripts/create-admin-user.sh"
echo ""
echo "2. Access your application:"
echo "   $CLOUDFRONT_URL"
echo ""

if [ "$DEPLOY_GRAPH_DB" = true ]; then
  echo "3. Check Graph Database status:"
  echo "   aws neptune describe-db-clusters --db-cluster-identifier $NEPTUNE_CLUSTER_ID"
  echo ""
fi

echo "✅ CloudShell deployment completed successfully!"
