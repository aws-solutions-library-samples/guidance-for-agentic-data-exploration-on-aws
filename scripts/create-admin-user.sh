#!/bin/bash

# Script to create an initial admin user in Cognito
# Usage: ./create-admin-user.sh [email] [password]

# disable the use of a pager that requires user interaction
export AWS_PAGER=""

# Default values
DEFAULT_EMAIL="demo@example.com"
DEFAULT_PASSWORD="TempPassw0rd!"  # pragma: allowlist secret

# Use provided arguments or defaults
EMAIL="${1:-$DEFAULT_EMAIL}"
PASSWORD="${2:-$DEFAULT_PASSWORD}"

echo "Creating Cognito admin user..."
echo "Email: $EMAIL"
echo ""

# Get User Pool ID from CloudFormation stack
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name DataExplorerAgentsStack \
  --query "Stacks[0].Outputs[?ExportName=='UserPoolId'].OutputValue" \
  --output text 2>/dev/null)

if [ -z "$USER_POOL_ID" ] || [ "$USER_POOL_ID" = "None" ]; then
  echo "❌ Error: Could not find User Pool ID from CloudFormation stack"
  echo "   Make sure the stack is deployed successfully"
  exit 1
fi

echo "📋 User Pool ID: $USER_POOL_ID"

# Create the user
echo "🔨 Creating user..."
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
  --temporary-password "$PASSWORD" \
  --message-action SUPPRESS

if [ $? -ne 0 ]; then
  echo "❌ Failed to create user"
  exit 1
fi

# Set permanent password
echo "🔑 Setting permanent password..."
aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --password "$PASSWORD" \
  --permanent

if [ $? -ne 0 ]; then
  echo "❌ Failed to set permanent password"
  exit 1
fi

# Add user to Admin group
echo "👑 Adding user to Admin group..."
aws cognito-idp admin-add-user-to-group \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --group-name "Admin"

if [ $? -ne 0 ]; then
  echo "❌ Failed to add user to Admin group"
  exit 1
fi

echo ""
echo "✅ Admin user created successfully!"
echo ""
echo "📧 Email: $EMAIL"
echo "🔐 Password: $PASSWORD"
echo "👑 Group: Admin"
echo ""

# Get and display the CloudFront URL
CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name DataExplorerAgentsStack --query "Stacks[0].Outputs[?ExportName=='ApplicationUrl'].OutputValue" --output text 2>/dev/null || echo "Not available")

if [ "$CLOUDFRONT_URL" != "Not available" ]; then
    echo "🌐 Login at: $CLOUDFRONT_URL"
    echo ""
    echo "Click the link above or copy/paste into your browser to access the application."
else
    echo "🌐 CloudFront URL not found. Check your deployment status."
fi
