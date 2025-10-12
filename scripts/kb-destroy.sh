#!/bin/bash
set -e

# set APP_NAME if not already set
if [ -z "$APP_NAME" ]; then
  export APP_NAME="ai-data-explorer"
fi

# set AWS_REGION if not already set
if [ -z "$AWS_REGION" ]; then
  AWS_REGION=$(aws configure get region)
  export AWS_REGION
fi

echo "Deleting Bedrock Knowledge Base resources for: $APP_NAME"

# Find and delete help knowledge base
existing_help_kb=$(aws bedrock-agent list-knowledge-bases --query "knowledgeBaseSummaries[?name=='${APP_NAME}-help'].knowledgeBaseId" --output text)

if [[ -n "$existing_help_kb" && "$existing_help_kb" != "None" ]]; then
  echo "Found help knowledge base: $existing_help_kb"
  
  # Delete help data sources first
  echo "Deleting help data sources..."
  help_data_sources=$(aws bedrock-agent list-data-sources --knowledge-base-id "$existing_help_kb" --query "dataSourceSummaries[].dataSourceId" --output text)
  
  for ds_id in $help_data_sources; do
    if [[ -n "$ds_id" && "$ds_id" != "None" ]]; then
      echo "Deleting help data source: $ds_id"
      aws bedrock-agent delete-data-source --knowledge-base-id "$existing_help_kb" --data-source-id "$ds_id" || echo "Failed to delete help data source $ds_id"
    fi
  done
  
  # Delete help knowledge base
  echo "Deleting help knowledge base: $existing_help_kb"
  aws bedrock-agent delete-knowledge-base --knowledge-base-id "$existing_help_kb" || echo "Failed to delete help knowledge base"
else
  echo "No help knowledge base found with name: ${APP_NAME}-help"
fi

# Find and delete products knowledge base
existing_products_kb=$(aws bedrock-agent list-knowledge-bases --query "knowledgeBaseSummaries[?name=='${APP_NAME}-products'].knowledgeBaseId" --output text)

if [[ -n "$existing_products_kb" && "$existing_products_kb" != "None" ]]; then
  echo "Found products knowledge base: $existing_products_kb"
  
  # Delete products data sources first
  echo "Deleting products data sources..."
  products_data_sources=$(aws bedrock-agent list-data-sources --knowledge-base-id "$existing_products_kb" --query "dataSourceSummaries[].dataSourceId" --output text)
  
  for ds_id in $products_data_sources; do
    if [[ -n "$ds_id" && "$ds_id" != "None" ]]; then
      echo "Deleting products data source: $ds_id"
      aws bedrock-agent delete-data-source --knowledge-base-id "$existing_products_kb" --data-source-id "$ds_id" || echo "Failed to delete products data source $ds_id"
    fi
  done
  
  # Delete products knowledge base
  echo "Deleting products knowledge base: $existing_products_kb"
  aws bedrock-agent delete-knowledge-base --knowledge-base-id "$existing_products_kb" || echo "Failed to delete products knowledge base"
else
  echo "No products knowledge base found with name: ${APP_NAME}-products"
fi

# Delete S3 vector resources for help
echo "Deleting S3 help vector index..."
HELP_S3_INDEX_NAME="${APP_NAME}-help-index-${AWS_REGION}"
HELP_VECTOR_BUCKET_NAME="${APP_NAME}-help-vectors-${AWS_REGION}"

# Delete help vector index first
aws s3vectors delete-index \
  --vector-bucket-name "$HELP_VECTOR_BUCKET_NAME" \
  --index-name "$HELP_S3_INDEX_NAME" 2>/dev/null || echo "Help index may not exist or already deleted"

echo "Deleted help vector index: $HELP_S3_INDEX_NAME"

# Delete help vector bucket
aws s3vectors delete-vector-bucket \
  --vector-bucket-name "$HELP_VECTOR_BUCKET_NAME" 2>/dev/null || echo "Help vector bucket may not exist or already deleted"

echo "Deleted help vector bucket: $HELP_VECTOR_BUCKET_NAME"

# Delete S3 vector resources for products
echo "Deleting S3 products vector index..."
PRODUCTS_S3_INDEX_NAME="${APP_NAME}-products-index-${AWS_REGION}"
PRODUCTS_VECTOR_BUCKET_NAME="${APP_NAME}-products-vectors-${AWS_REGION}"

# Delete products vector index first
aws s3vectors delete-index \
  --vector-bucket-name "$PRODUCTS_VECTOR_BUCKET_NAME" \
  --index-name "$PRODUCTS_S3_INDEX_NAME" 2>/dev/null || echo "Products index may not exist or already deleted"

echo "Deleted products vector index: $PRODUCTS_S3_INDEX_NAME"

# Delete products vector bucket
aws s3vectors delete-vector-bucket \
  --vector-bucket-name "$PRODUCTS_VECTOR_BUCKET_NAME" 2>/dev/null || echo "Products vector bucket may not exist or already deleted"

echo "Deleted products vector bucket: $PRODUCTS_VECTOR_BUCKET_NAME"

# Delete IAM role
ROLE_NAME="BedrockKBRole-${APP_NAME}"
echo "Deleting IAM role: $ROLE_NAME"

# Delete role policy first
aws iam delete-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "${ROLE_NAME}-Policy" 2>/dev/null || echo "Role policy may not exist"

# Delete role
aws iam delete-role \
  --role-name "$ROLE_NAME" 2>/dev/null || echo "Role may not exist or already deleted"

echo "Deleted IAM role: $ROLE_NAME"

# Clean up temp files
rm -f /tmp/kb-outputs/help-kb-id.txt /tmp/kb-outputs/help-kb-arn.txt /tmp/kb-outputs/help-data-source-id.txt
rm -f /tmp/kb-outputs/products-kb-id.txt /tmp/kb-outputs/products-kb-arn.txt /tmp/kb-outputs/products-data-source-id.txt
rm -f /tmp/trust-policy.json /tmp/role-policy.json

echo "Cleanup completed for: $APP_NAME"
