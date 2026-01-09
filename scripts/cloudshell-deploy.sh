#!/bin/bash

# AI Data Explorer - CloudShell Deployment Script
# Combined deployment script for CloudShell environment
# This script continuously cleans up during deployment to prevent space issues
#
# Enterprise-friendly deployment with support for:
# - Explicit AWS profile and region
# - Bring-your-own VPC, subnets, and security groups
# - Dry-run mode for validation

set -e

# Disable AWS CLI pager
export AWS_PAGER=""

# Configure CDK to minimize build artifacts
export CDK_DISABLE_VERSION_CHECK=1
export CDK_NEW_BOOTSTRAP=1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Default values
AWS_PROFILE=""
AWS_REGION=""
VPC_ID=""
PUBLIC_SUBNET_IDS=""
PRIVATE_SUBNET_IDS=""
ALB_SECURITY_GROUP_ID=""
ECS_SECURITY_GROUP_ID=""
NEPTUNE_SG=""
NEPTUNE_HOST=""
GUARDRAIL_MODE="shadow"
DEPLOY_GRAPH_DB=false
DRY_RUN=false

# Knowledge Base configuration
export APP_NAME="ai-data-explorer"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    # AWS Configuration
    --profile)
      AWS_PROFILE="$2"
      shift 2
      ;;
    --region)
      AWS_REGION="$2"
      shift 2
      ;;
    # VPC/Networking Options
    --vpc-id)
      VPC_ID="$2"
      shift 2
      ;;
    --public-subnet-ids)
      PUBLIC_SUBNET_IDS="$2"
      shift 2
      ;;
    --private-subnet-ids)
      PRIVATE_SUBNET_IDS="$2"
      shift 2
      ;;
    --alb-security-group-id)
      ALB_SECURITY_GROUP_ID="$2"
      shift 2
      ;;
    --ecs-security-group-id)
      ECS_SECURITY_GROUP_ID="$2"
      shift 2
      ;;
    # Neptune Options
    --neptune-sg)
      NEPTUNE_SG="$2"
      shift 2
      ;;
    --neptune-host)
      NEPTUNE_HOST="$2"
      shift 2
      ;;
    --with-graph-db)
      DEPLOY_GRAPH_DB=true
      shift
      ;;
    # Guardrails Options
    --guardrail-mode)
      GUARDRAIL_MODE="$2"
      shift 2
      ;;
    # Deployment Options
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help|-h)
      echo -e "${CYAN}AI Data Explorer - CloudShell Deployment${NC}"
      echo ""
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo -e "${YELLOW}AWS Configuration:${NC}"
      echo "  --profile PROFILE       AWS CLI profile to use"
      echo "  --region REGION         AWS region (e.g., us-east-1)"
      echo ""
      echo -e "${YELLOW}VPC/Networking Options (for enterprise environments):${NC}"
      echo "  --vpc-id ID             Existing VPC ID"
      echo "  --public-subnet-ids IDS Comma-separated public subnet IDs"
      echo "  --private-subnet-ids IDS Comma-separated private subnet IDs"
      echo "  --alb-security-group-id ID  Security group ID for ALB"
      echo "  --ecs-security-group-id ID  Security group ID for ECS tasks"
      echo ""
      echo -e "${YELLOW}Neptune/Graph Database Options:${NC}"
      echo "  --neptune-sg ID         Neptune security group ID"
      echo "  --neptune-host HOST     Neptune cluster endpoint"
      echo "  --with-graph-db         Deploy Neptune graph database stack"
      echo ""
      echo -e "${YELLOW}Guardrails Options:${NC}"
      echo "  --guardrail-mode MODE   'shadow' (monitor) or 'enforce' (block)"
      echo ""
      echo -e "${YELLOW}Deployment Options:${NC}"
      echo "  --dry-run               Show what would be deployed without deploying"
      echo "  --help, -h              Show this help message"
      echo ""
      echo -e "${YELLOW}Required VPC Endpoints (for private subnet deployments):${NC}"
      echo "  - com.amazonaws.<region>.ecr.api"
      echo "  - com.amazonaws.<region>.ecr.dkr"
      echo "  - com.amazonaws.<region>.s3 (Gateway)"
      echo "  - com.amazonaws.<region>.logs"
      echo "  - com.amazonaws.<region>.secretsmanager"
      echo "  - com.amazonaws.<region>.bedrock-runtime"
      echo "  - com.amazonaws.<region>.bedrock-agent-runtime"
      echo "  - com.amazonaws.<region>.sts"
      echo "  - com.amazonaws.<region>.xray"
      echo ""
      exit 0
      ;;
    *)
      echo -e "${RED}❌ Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     AI Data Explorer - CloudShell Deployment               ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

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

# Set embedding model ARN
export EMBEDDING_MODEL="arn:aws:bedrock:${AWS_REGION}::foundation-model/amazon.titan-embed-text-v2:0"

# Get AWS account ID
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
if [ -z "$AWS_ACCOUNT" ]; then
    echo -e "${RED}Error: Could not determine AWS account ID${NC}"
    exit 1
fi
export CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT"
echo -e "${YELLOW}Using AWS Account: $AWS_ACCOUNT${NC}"

if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}DRY RUN MODE - No resources will be deployed${NC}"
fi

# Clean up npm configuration issues early
echo -e "${BLUE}Cleaning npm configuration...${NC}"
npm config delete python 2>/dev/null || true
npm config delete python3 2>/dev/null || true

# Function to continuously monitor and clean space
start_space_monitor() {
  (
    while true; do
      sleep 30
      if [ -d "cdk.out" ]; then
        CDK_SIZE=$(du -sm cdk.out 2>/dev/null | cut -f1 || echo "0")
        if [ "$CDK_SIZE" -gt 200 ]; then
          find cdk.out -name "*.js" -mmin +5 -delete 2>/dev/null || true
          find cdk.out -name "*.d.ts" -delete 2>/dev/null || true
          find cdk.out -name "*.js.map" -delete 2>/dev/null || true
        fi
      fi
      npm cache clean --force 2>/dev/null || true
      python -m pip cache purge 2>/dev/null || true
      rm -rf /tmp/npm-* 2>/dev/null || true
      rm -rf /tmp/cdk-* 2>/dev/null || true
    done
  ) &
  MONITOR_PID=$!
}

stop_space_monitor() {
  if [ -n "$MONITOR_PID" ]; then
    kill $MONITOR_PID 2>/dev/null || true
  fi
}

trap 'stop_space_monitor; rm -rf cdk.out 2>/dev/null || true' EXIT

cleanup_space() {
  rm -rf cdk.out 2>/dev/null || true
  npm cache clean --force 2>/dev/null || true
  python -m pip cache purge 2>/dev/null || true
  sudo yum clean all 2>/dev/null || true
  rm -rf /tmp/* 2>/dev/null || true
}

# Validate Neptune configuration
if [ -n "$NEPTUNE_HOST" ] && [ -z "$NEPTUNE_SG" ]; then
    echo -e "${RED}Error: When using Neptune host, --neptune-sg is also required${NC}"
    exit 1
fi

# Initial cleanup and start monitoring
cleanup_space
start_space_monitor

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "${BLUE}Installing dependencies...${NC}"
  npm install --omit=dev --no-cache --no-audit --no-fund --prefer-offline
  cleanup_space
fi

# Check CDK bootstrap
echo -e "${BLUE}Checking CDK bootstrap status...${NC}"
if ! aws cloudformation describe-stacks --stack-name CDKToolkit > /dev/null 2>&1; then
  if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}[DRY RUN] Would bootstrap CDK${NC}"
  else
    echo -e "${YELLOW}Bootstrapping CDK environment...${NC}"
    npx cdk bootstrap --require-approval never
    cleanup_space
  fi
else
  echo -e "${GREEN}✓ CDK already bootstrapped${NC}"
fi

# Deploy Graph Database Stack if requested
if [ "$DEPLOY_GRAPH_DB" = true ]; then
  echo -e "${BLUE}Deploying Graph Database Stack...${NC}"
  
  GRAPH_CDK_COMMAND="npx cdk deploy DataExplorerGraphDbStack --app \"npx tsx bin/graph-db-app.ts\""
  [ -n "$VPC_ID" ] && GRAPH_CDK_COMMAND="$GRAPH_CDK_COMMAND --context vpcId=$VPC_ID"
  GRAPH_CDK_COMMAND="$GRAPH_CDK_COMMAND --require-approval never"
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}[DRY RUN] Would run: $GRAPH_CDK_COMMAND${NC}"
  else
    eval $GRAPH_CDK_COMMAND
    cleanup_space
    
    NEPTUNE_HOST=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneEndpoint'].OutputValue" --output text 2>/dev/null || echo "")
    NEPTUNE_SG=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneSecurityGroupId'].OutputValue" --output text 2>/dev/null || echo "")
    NEPTUNE_VPC_ID=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbVpcId'].OutputValue" --output text 2>/dev/null || echo "")
    
    [ -z "$VPC_ID" ] && [ -n "$NEPTUNE_VPC_ID" ] && VPC_ID="$NEPTUNE_VPC_ID"
  fi
fi

# Create Knowledge Bases
if [ "$DRY_RUN" = true ]; then
  echo -e "${CYAN}[DRY RUN] Would create Bedrock Knowledge Bases${NC}"
else
  echo -e "${BLUE}Creating Bedrock Knowledge Bases...${NC}"
  ./scripts/kb-create.sh
  cleanup_space
fi

# Build CDK command
echo -e "${BLUE}Deploying Main Application Stack...${NC}"

CDK_COMMAND="npx cdk deploy --app \"npx tsx bin/cdk-app.ts\""

# Add context parameters
[ -n "$VPC_ID" ] && CDK_COMMAND="$CDK_COMMAND --context vpcId=$VPC_ID"
[ -n "$PUBLIC_SUBNET_IDS" ] && CDK_COMMAND="$CDK_COMMAND --context publicSubnetIds=$PUBLIC_SUBNET_IDS"
[ -n "$PRIVATE_SUBNET_IDS" ] && CDK_COMMAND="$CDK_COMMAND --context privateSubnetIds=$PRIVATE_SUBNET_IDS"
[ -n "$ALB_SECURITY_GROUP_ID" ] && CDK_COMMAND="$CDK_COMMAND --context albSecurityGroupId=$ALB_SECURITY_GROUP_ID"
[ -n "$ECS_SECURITY_GROUP_ID" ] && CDK_COMMAND="$CDK_COMMAND --context ecsSecurityGroupId=$ECS_SECURITY_GROUP_ID"
[ -n "$NEPTUNE_SG" ] && CDK_COMMAND="$CDK_COMMAND --context neptuneSgId=$NEPTUNE_SG"
[ -n "$NEPTUNE_HOST" ] && CDK_COMMAND="$CDK_COMMAND --context neptuneHost=$NEPTUNE_HOST --context withGraphDb=true"

CDK_COMMAND="$CDK_COMMAND --context guardrailMode=$GUARDRAIL_MODE"
CDK_COMMAND="$CDK_COMMAND --require-approval never"

if [ "$DRY_RUN" = true ]; then
  echo -e "${CYAN}[DRY RUN] Would run: $CDK_COMMAND${NC}"
else
  eval $CDK_COMMAND
fi

# Cleanup
stop_space_monitor
cleanup_space

# Show results
if [ "$DRY_RUN" != true ]; then
  ALB_URL=$(aws cloudformation describe-stacks --stack-name DataExplorerAgentsStack --query "Stacks[0].Outputs[?ExportName=='ALBEndpoint'].OutputValue" --output text 2>/dev/null || echo "Not available")
  CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name DataExplorerAgentsStack --query "Stacks[0].Outputs[?ExportName=='ApplicationUrl'].OutputValue" --output text 2>/dev/null || echo "Not available")

  echo ""
  echo -e "${GREEN}🎉 Deployment Complete!${NC}"
  echo "========================"
  echo ""
  echo "  CloudFront (HTTPS): $CLOUDFRONT_URL"
  echo "  ALB Direct (HTTP):  $ALB_URL"
  echo ""
  echo "Next Steps:"
  echo "  1. Create admin user: ./scripts/create-admin-user.sh"
  echo "  2. Access: $CLOUDFRONT_URL"
fi

echo -e "${GREEN}✓ CloudShell deployment completed${NC}"
