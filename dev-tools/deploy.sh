#!/bin/bash

# Deploy AI Data Explorer with optional VPC/Neptune and Bedrock Guardrails
# Usage: ./deploy.sh [OPTIONS]
#
# Enterprise-friendly deployment script with support for:
# - Explicit AWS profile, region, and account
# - Bring-your-own VPC, subnets, and security groups
# - Dry-run mode for validation
# - CDK bootstrap check (not auto-run)

set -e

# Disable AWS CLI pager
export AWS_PAGER=""

# Configuration
MIN_AWS_CLI_VERSION="2.27.51"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to compare version numbers
version_compare() {
    local version1=$1
    local version2=$2
    IFS='.' read -ra V1 <<< "$version1"
    IFS='.' read -ra V2 <<< "$version2"
    for i in {0..2}; do
        local v1_part=${V1[i]:-0}
        local v2_part=${V2[i]:-0}
        if (( v1_part > v2_part )); then
            return 0
        elif (( v1_part < v2_part )); then
            return 1
        fi
    done
    return 0
}

# Default values
AWS_PROFILE=""
AWS_REGION=""
AWS_ACCOUNT=""
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
SKIP_BOOTSTRAP_CHECK=false

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
    --account)
      AWS_ACCOUNT="$2"
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
    --skip-bootstrap-check)
      SKIP_BOOTSTRAP_CHECK=true
      shift
      ;;
    --help|-h)
      echo -e "${CYAN}AI Data Explorer - Deployment Script${NC}"
      echo ""
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo -e "${YELLOW}AWS Configuration:${NC}"
      echo "  --profile PROFILE       AWS CLI profile to use"
      echo "  --region REGION         AWS region (e.g., us-east-1)"
      echo "  --account ACCOUNT       AWS account ID (optional, auto-detected if not provided)"
      echo ""
      echo -e "${YELLOW}VPC/Networking Options (for enterprise environments):${NC}"
      echo "  --vpc-id ID             Existing VPC ID"
      echo "  --public-subnet-ids IDS Comma-separated public subnet IDs (e.g., subnet-a,subnet-b)"
      echo "  --private-subnet-ids IDS Comma-separated private subnet IDs (e.g., subnet-c,subnet-d)"
      echo "  --alb-security-group-id ID  Security group ID for Application Load Balancer"
      echo "  --ecs-security-group-id ID  Security group ID for ECS tasks"
      echo ""
      echo -e "${YELLOW}Neptune/Graph Database Options:${NC}"
      echo "  --neptune-sg ID         Neptune security group ID"
      echo "  --neptune-host HOST     Neptune cluster endpoint"
      echo "  --with-graph-db         Deploy Neptune graph database stack"
      echo ""
      echo -e "${YELLOW}Guardrails Options:${NC}"
      echo "  --guardrail-mode MODE   'shadow' (monitor) or 'enforce' (block) - default: shadow"
      echo ""
      echo -e "${YELLOW}Deployment Options:${NC}"
      echo "  --dry-run               Show what would be deployed without deploying"
      echo "  --skip-bootstrap-check  Skip CDK bootstrap verification"
      echo "  --help, -h              Show this help message"
      echo ""
      echo -e "${YELLOW}Examples:${NC}"
      echo "  # Basic deployment (creates new VPC)"
      echo "  $0 --region us-east-1"
      echo ""
      echo "  # Deploy with specific AWS profile"
      echo "  $0 --profile my-profile --region us-east-1"
      echo ""
      echo "  # Enterprise deployment with existing VPC and subnets"
      echo "  $0 --profile prod --region us-east-1 \\"
      echo "     --vpc-id vpc-123 \\"
      echo "     --public-subnet-ids subnet-pub1,subnet-pub2 \\"
      echo "     --private-subnet-ids subnet-priv1,subnet-priv2"
      echo ""
      echo "  # Full enterprise deployment with all pre-created resources"
      echo "  $0 --profile prod --region us-east-1 \\"
      echo "     --vpc-id vpc-123 \\"
      echo "     --public-subnet-ids subnet-pub1,subnet-pub2 \\"
      echo "     --private-subnet-ids subnet-priv1,subnet-priv2 \\"
      echo "     --alb-security-group-id sg-alb \\"
      echo "     --ecs-security-group-id sg-ecs"
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
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          AI Data Explorer - Deployment                     ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Set AWS profile if provided
if [ -n "$AWS_PROFILE" ]; then
    export AWS_PROFILE
    echo -e "${YELLOW}Using AWS Profile: $AWS_PROFILE${NC}"
fi

# Set AWS region if provided
if [ -n "$AWS_REGION" ]; then
    export AWS_REGION
    export AWS_DEFAULT_REGION="$AWS_REGION"
    export CDK_DEFAULT_REGION="$AWS_REGION"
    echo -e "${YELLOW}Using AWS Region: $AWS_REGION${NC}"
else
    # Try to get region from profile or environment
    AWS_REGION="${AWS_DEFAULT_REGION:-$(aws configure get region 2>/dev/null || echo "")}"
    if [ -z "$AWS_REGION" ]; then
        echo -e "${RED}Error: AWS region not specified and could not be auto-detected${NC}"
        echo "Please provide --region or set AWS_DEFAULT_REGION"
        exit 1
    fi
    export AWS_REGION
    export CDK_DEFAULT_REGION="$AWS_REGION"
    echo -e "${YELLOW}Auto-detected AWS Region: $AWS_REGION${NC}"
fi

# Set embedding model ARN with region
export EMBEDDING_MODEL="arn:aws:bedrock:${AWS_REGION}::foundation-model/amazon.titan-embed-text-v2:0"

# Get or validate AWS account ID
if [ -n "$AWS_ACCOUNT" ]; then
    export CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT"
    echo -e "${YELLOW}Using AWS Account: $AWS_ACCOUNT${NC}"
else
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
    if [ -z "$AWS_ACCOUNT" ]; then
        echo -e "${RED}Error: Could not determine AWS account ID${NC}"
        echo "Please provide --account or ensure AWS credentials are configured"
        exit 1
    fi
    export CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT"
    echo -e "${YELLOW}Auto-detected AWS Account: $AWS_ACCOUNT${NC}"
fi

# Preflight check: AWS CLI version
echo ""
echo -e "${BLUE}Checking prerequisites...${NC}"
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ Error: AWS CLI is not installed or not in PATH${NC}"
    echo "📣 Please install AWS CLI version $MIN_AWS_CLI_VERSION or later"
    exit 1
fi

AWS_VERSION=$(aws --version 2>&1 | cut -d/ -f2 | cut -d' ' -f1)
if ! version_compare "$AWS_VERSION" "$MIN_AWS_CLI_VERSION"; then
    echo -e "${RED}❌ Error: AWS CLI version $AWS_VERSION is below minimum required version $MIN_AWS_CLI_VERSION${NC}"
    echo "📣 Please upgrade your AWS CLI to version $MIN_AWS_CLI_VERSION or later"
    exit 1
fi
echo -e "${GREEN}✓ AWS CLI version $AWS_VERSION${NC}"

# Check CDK bootstrap status
if [ "$SKIP_BOOTSTRAP_CHECK" != true ]; then
    echo -e "${BLUE}Checking CDK bootstrap status...${NC}"
    BOOTSTRAP_STACK=$(aws cloudformation describe-stacks \
        --stack-name CDKToolkit \
        --region "$AWS_REGION" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "NOT_FOUND")
    
    if [ "$BOOTSTRAP_STACK" = "NOT_FOUND" ]; then
        echo -e "${RED}❌ CDK is not bootstrapped in $AWS_REGION${NC}"
        echo ""
        echo "Please run the following command first:"
        echo -e "${YELLOW}  npx cdk bootstrap aws://$AWS_ACCOUNT/$AWS_REGION${NC}"
        echo ""
        echo "Or use --skip-bootstrap-check to bypass this verification"
        exit 1
    else
        echo -e "${GREEN}✓ CDK bootstrapped in $AWS_REGION${NC}"
    fi
fi

# Display configuration
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Configuration Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "  AWS Account:    $AWS_ACCOUNT"
echo "  AWS Region:     $AWS_REGION"
[ -n "$AWS_PROFILE" ] && echo "  AWS Profile:    $AWS_PROFILE"
echo "  Dry Run:        $DRY_RUN"
echo ""
echo "  VPC:"
if [ -n "$VPC_ID" ]; then
    echo "    VPC ID:              $VPC_ID"
    [ -n "$PUBLIC_SUBNET_IDS" ] && echo "    Public Subnets:      $PUBLIC_SUBNET_IDS"
    [ -n "$PRIVATE_SUBNET_IDS" ] && echo "    Private Subnets:     $PRIVATE_SUBNET_IDS"
    [ -n "$ALB_SECURITY_GROUP_ID" ] && echo "    ALB Security Group:  $ALB_SECURITY_GROUP_ID"
    [ -n "$ECS_SECURITY_GROUP_ID" ] && echo "    ECS Security Group:  $ECS_SECURITY_GROUP_ID"
else
    echo "    Creating new VPC"
fi
echo ""
echo "  Guardrails:     $GUARDRAIL_MODE"
echo "  Graph DB:       $DEPLOY_GRAPH_DB"
[ -n "$NEPTUNE_HOST" ] && echo "  Neptune Host:   $NEPTUNE_HOST"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}DRY RUN MODE - No resources will be deployed${NC}"
    echo ""
fi

# Validate Neptune configuration
if [ -n "$NEPTUNE_HOST" ]; then
    if [ -z "$NEPTUNE_SG" ]; then
        echo -e "${RED}Error: When using Neptune host, --neptune-sg is also required${NC}"
        exit 1
    fi
fi

# Build CDK deploy command (stay in project root)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Update version information before deployment
if [ "$DRY_RUN" != true ]; then
    echo "Updating version information..."
    npm run version:update
fi

# Deploy Graph Database Stack if requested
if [ "$DEPLOY_GRAPH_DB" = true ]; then
    echo -e "${BLUE}Deploying Graph Database Stack...${NC}"
    GRAPH_ARGS=""
    [ -n "$VPC_ID" ] && GRAPH_ARGS="$GRAPH_ARGS --vpc-id $VPC_ID"
    [ -n "$AWS_PROFILE" ] && GRAPH_ARGS="$GRAPH_ARGS --profile $AWS_PROFILE"
    [ -n "$AWS_REGION" ] && GRAPH_ARGS="$GRAPH_ARGS --region $AWS_REGION"
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "${CYAN}[DRY RUN] Would run: ./dev-tools/deploy-graph-db.sh $GRAPH_ARGS${NC}"
    else
        ./dev-tools/deploy-graph-db.sh $GRAPH_ARGS
        
        # Read Neptune outputs for main deployment
        if [ -f "/tmp/graph-db-outputs/neptune-endpoint.txt" ] && [ -f "/tmp/graph-db-outputs/neptune-sg-id.txt" ]; then
            NEPTUNE_HOST=$(cat /tmp/graph-db-outputs/neptune-endpoint.txt)
            NEPTUNE_SG=$(cat /tmp/graph-db-outputs/neptune-sg-id.txt)
            [ -z "$VPC_ID" ] && [ -f "/tmp/graph-db-outputs/vpc-id.txt" ] && VPC_ID=$(cat /tmp/graph-db-outputs/vpc-id.txt)
            echo "Using deployed Neptune: $NEPTUNE_HOST (SG: $NEPTUNE_SG)"
        fi
    fi
fi

# Check for existing Neptune stack
if [ -z "$NEPTUNE_HOST" ] && [ -z "$NEPTUNE_SG" ] && [ "$DRY_RUN" != true ]; then
    echo "Checking for existing Neptune stack..."
    EXISTING_NEPTUNE_HOST=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneEndpoint'].OutputValue" --output text 2>/dev/null || echo "")
    EXISTING_NEPTUNE_SG=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneSecurityGroupId'].OutputValue" --output text 2>/dev/null || echo "")
    EXISTING_VPC_ID=$(aws cloudformation describe-stacks --stack-name DataExplorerGraphDbStack --query "Stacks[0].Outputs[?ExportName=='GraphDbVpcId'].OutputValue" --output text 2>/dev/null || echo "")
    
    if [[ -n "$EXISTING_NEPTUNE_HOST" && -n "$EXISTING_NEPTUNE_SG" ]]; then
        NEPTUNE_HOST="$EXISTING_NEPTUNE_HOST"
        NEPTUNE_SG="$EXISTING_NEPTUNE_SG"
        [ -z "$VPC_ID" ] && [ -n "$EXISTING_VPC_ID" ] && VPC_ID="$EXISTING_VPC_ID"
        echo -e "${GREEN}Found existing Neptune stack${NC}"
    fi
fi

# Create Knowledge Base
if [ "$DRY_RUN" != true ]; then
    echo -e "${BLUE}Creating Bedrock Knowledge Bases...${NC}"
    ./scripts/kb-create.sh
    
    HELP_KB_ID=$(cat /tmp/kb-outputs/help-kb-id.txt 2>/dev/null || echo "")
    PRODUCTS_KB_ID=$(cat /tmp/kb-outputs/products-kb-id.txt 2>/dev/null || echo "")
    TARIFFS_KB_ID=$(cat /tmp/kb-outputs/tariffs-kb-id.txt 2>/dev/null || echo "")
    
    [ -n "$HELP_KB_ID" ] && echo -e "${GREEN}✓ Help Knowledge Base: $HELP_KB_ID${NC}"
    [ -n "$PRODUCTS_KB_ID" ] && echo -e "${GREEN}✓ Products Knowledge Base: $PRODUCTS_KB_ID${NC}"
    [ -n "$TARIFFS_KB_ID" ] && echo -e "${GREEN}✓ Tariffs Knowledge Base: $TARIFFS_KB_ID${NC}"
else
    echo -e "${CYAN}[DRY RUN] Would create Bedrock Knowledge Bases${NC}"
fi

# Build CDK command
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Deploying CDK Stack${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

CDK_COMMAND="CDK_DOCKER=podman npx cdk deploy --app \"npx tsx bin/cdk-app.ts\""

# Add VPC context
[ -n "$VPC_ID" ] && CDK_COMMAND="$CDK_COMMAND --context vpcId=$VPC_ID"
[ -n "$PUBLIC_SUBNET_IDS" ] && CDK_COMMAND="$CDK_COMMAND --context publicSubnetIds=$PUBLIC_SUBNET_IDS"
[ -n "$PRIVATE_SUBNET_IDS" ] && CDK_COMMAND="$CDK_COMMAND --context privateSubnetIds=$PRIVATE_SUBNET_IDS"
[ -n "$ALB_SECURITY_GROUP_ID" ] && CDK_COMMAND="$CDK_COMMAND --context albSecurityGroupId=$ALB_SECURITY_GROUP_ID"
[ -n "$ECS_SECURITY_GROUP_ID" ] && CDK_COMMAND="$CDK_COMMAND --context ecsSecurityGroupId=$ECS_SECURITY_GROUP_ID"

# Add Neptune context
if [ -n "$NEPTUNE_HOST" ]; then
    CDK_COMMAND="$CDK_COMMAND --context withGraphDb=true"
    CDK_COMMAND="$CDK_COMMAND --context neptuneHost=$NEPTUNE_HOST"
    CDK_COMMAND="$CDK_COMMAND --context neptuneSgId=$NEPTUNE_SG"
fi

# Add guardrails context
CDK_COMMAND="$CDK_COMMAND --context guardrailMode=$GUARDRAIL_MODE"
CDK_COMMAND="$CDK_COMMAND --require-approval never"

# Execute deployment
if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}[DRY RUN] Would execute:${NC}"
    echo "$CDK_COMMAND"
    echo ""
    echo -e "${CYAN}[DRY RUN] Synthesizing templates to validate...${NC}"
    CDK_DOCKER=podman npx cdk synth --app "npx tsx bin/cdk-app.ts" --quiet || true
    echo -e "${GREEN}✓ Dry run completed${NC}"
else
    eval $CDK_COMMAND
fi

# Show deployment summary
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$DRY_RUN" != true ]; then
    ALB_URL=$(aws cloudformation describe-stacks --stack-name DataExplorerAgentsStack --query "Stacks[0].Outputs[?ExportName=='ALBEndpoint'].OutputValue" --output text 2>/dev/null || echo "Not available")
    CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name DataExplorerAgentsStack --query "Stacks[0].Outputs[?ExportName=='ApplicationUrl'].OutputValue" --output text 2>/dev/null || echo "Not available")
    
    echo ""
    echo "  CloudFront URL (HTTPS): $CLOUDFRONT_URL"
fi

echo ""
