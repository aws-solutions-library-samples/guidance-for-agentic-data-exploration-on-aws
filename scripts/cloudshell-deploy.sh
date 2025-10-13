#!/bin/bash

# AI Data Explorer - CloudShell Deployment Script
# Combined deployment script for CloudShell environment
# This script continuously cleans up during deployment to prevent space issues
set -e

# disable the use of a pager that requires user interaction
export AWS_PAGER=""

# set AWS_REGION if not already set
if [ -z "$AWS_REGION" ]; then
  AWS_REGION=$(aws configure get region)
  export AWS_REGION
fi

# Configure CDK to minimize build artifacts
export CDK_DISABLE_VERSION_CHECK=1
export CDK_NEW_BOOTSTRAP=1

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

# Clean up npm configuration issues early
echo "🔧 Cleaning npm configuration..."
npm config delete python 2>/dev/null || true
npm config delete python3 2>/dev/null || true
echo "✅ npm configuration cleaned"

# Function to continuously monitor and clean space
start_space_monitor() {
  (
    while true; do
      sleep 30
      
      # Clean CDK artifacts if they get too large
      if [ -d "cdk.out" ]; then
        CDK_SIZE=$(du -sm cdk.out 2>/dev/null | cut -f1 || echo "0")
        if [ "$CDK_SIZE" -gt 200 ]; then
          echo "🧹 CDK artifacts getting large (${CDK_SIZE}MB), cleaning old files..."
          find cdk.out -name "*.js" -mmin +5 -delete 2>/dev/null || true
          find cdk.out -name "*.d.ts" -delete 2>/dev/null || true
          find cdk.out -name "*.js.map" -delete 2>/dev/null || true
        fi
      fi
      
      # Clean npm cache if it exists
      npm cache clean --force 2>/dev/null || true
      
      # Clean pip cache
      python -m pip cache purge 2>/dev/null || true
      
      # Clean temp files
      rm -rf /tmp/npm-* 2>/dev/null || true
      rm -rf /tmp/cdk-* 2>/dev/null || true
      
    done
  ) &
  MONITOR_PID=$!
  echo "✅ Started background space monitor (PID: $MONITOR_PID)"
}

# Function to stop space monitor
stop_space_monitor() {
  if [ -n "$MONITOR_PID" ]; then
    kill $MONITOR_PID 2>/dev/null || true
    echo "✅ Stopped background space monitor"
  fi
}

# Trap to ensure cleanup on exit
trap 'stop_space_monitor; rm -rf cdk.out 2>/dev/null || true' EXIT

# Function for aggressive cleanup
cleanup_space() {
  echo "🧹 Space cleanup..."
  
  # Clean CDK artifacts
  rm -rf cdk.out 2>/dev/null || true
  
  # Clean npm cache
  npm cache clean --force 2>/dev/null || true
  
  # Clean pip cache
  python -m pip cache purge 2>/dev/null || true
  
  # Clean yum cache
  sudo yum clean all 2>/dev/null || true
  
  # Clean temporary files
  rm -rf /tmp/* 2>/dev/null || true
  
  echo "✅ Space cleanup completed"
}

# Validate Neptune configuration
if [ -n "$NEPTUNE_HOST" ]; then
  if [ -z "$NEPTUNE_SG" ]; then
    echo "❌ Error: When using Neptune host, --neptune-sg is also required"
    echo "Use --help for usage information"
    exit 1
  fi
fi

# Initial cleanup
cleanup_space

# Start continuous space monitoring
start_space_monitor

# Check if dependencies are installed, install minimally if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing minimal dependencies..."
  npm install --omit=dev --no-cache --no-audit --no-fund --prefer-offline
  cleanup_space
fi

# Ensure CDK is bootstrapped
echo "🏗️  Checking CDK bootstrap status..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit > /dev/null 2>&1; then
  echo "📦 Bootstrapping CDK environment..."
  npx cdk bootstrap --require-approval never
  echo "✅ CDK bootstrap completed"
  cleanup_space
else
  echo "✅ CDK already bootstrapped"
fi

# Deploy Graph Database Stack if requested
if [ "$DEPLOY_GRAPH_DB" = true ]; then
  echo "📊 Deploying Graph Database Stack..."
  
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
  
  # Clean up immediately after graph DB deployment
  cleanup_space
  
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

# Clean up after KB creation
cleanup_space

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

# Add Neptune context if available
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

# Stop the space monitor
stop_space_monitor

# Final cleanup
echo "🧹 Final cleanup..."
cleanup_space

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
