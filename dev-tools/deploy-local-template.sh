#!/bin/bash

# Template for local deployment configuration
# Copy this file to deploy-local.sh and customize the values below

# Predefined configuration - CUSTOMIZE THESE VALUES FOR YOUR ENVIRONMENT
VPC_ID=""                                   # Your VPC ID
NEPTUNE_SG=""                               # Your Neptune security group ID
NEPTUNE_HOST=""                             # Your Neptune endpoint
GUARDRAIL_MODE="enforce"                    # shadow or enforce

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Handle help option
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "This script deploys with your customized configuration (options override defaults):"
    echo "  VPC ID: $VPC_ID"
    echo "  Neptune Security Group: $NEPTUNE_SG"
    echo "  Neptune Host: $NEPTUNE_HOST"
    echo "  Guardrail Mode: $GUARDRAIL_MODE"
    echo ""
    echo "Override Options:"
    echo "  --guardrail-mode MODE   Override predefined guardrail mode"
    echo "  --help, -h              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Deploy with all predefined values"
    echo "  $0 --guardrail-mode enforce          # Override guardrail mode only"
    exit 0
fi

echo "Deploying with your customized configuration:"
echo "  VPC ID: $VPC_ID"
echo "  Neptune Security Group: $NEPTUNE_SG"
echo "  Neptune Host: $NEPTUNE_HOST"
echo "  Guardrail Mode: $GUARDRAIL_MODE"
echo ""

# Build command with predefined values
DEPLOY_ARGS=(
    --vpc-id "$VPC_ID"
    --neptune-sg "$NEPTUNE_SG"
    --neptune-host "$NEPTUNE_HOST"

    --guardrail-mode "$GUARDRAIL_MODE"
)

# Call the main deploy script with predefined values and pass through any overrides
"$SCRIPT_DIR/deploy.sh" "${DEPLOY_ARGS[@]}" "$@"
