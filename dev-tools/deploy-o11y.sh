#!/bin/bash

# Deploy observability monitoring dashboard as standalone stack
# This script deploys the monitoring dashboard independently

set -e

echo "Deploying AI Data Explorer Monitoring Dashboard..."

# Set container runtime
export CDK_DOCKER=${CDK_DOCKER:-podman}

# Deploy the monitoring dashboard
npx cdk deploy \
  --app "npx ts-node bin/o11y-app.ts" \
  --require-approval never

echo "Monitoring dashboard deployed successfully!"
echo "Check AWS CloudWatch console for the 'AI-Data-Explorer-Monitoring' dashboard"
