#!/bin/bash
set -e

# disable the use of a pager that requires user interaction
export AWS_PAGER=""

# set APP_NAME if not already set
if [ -z "$APP_NAME" ]; then
  export APP_NAME="ai-data-explorer"
fi

# set AWS_REGION if not already set
if [ -z "$AWS_REGION" ]; then
  AWS_REGION=$(aws configure get region)
  export AWS_REGION
fi

# set EMBEDDING_MODEL
EMBEDDING_MODEL="arn:aws:bedrock:${AWS_REGION}::foundation-model/amazon.titan-embed-text-v2:0"
export EMBEDDING_MODEL

# Get account ID and region
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
# REGION=$(aws configure get region)
SOURCE_BUCKET_NAME="${APP_NAME}-kb-${ACCOUNT}-${AWS_REGION}"
SOURCE_BUCKET_ARN="arn:aws:s3:::${SOURCE_BUCKET_NAME}"

# Create IAM role for Bedrock Knowledge Base
ROLE_NAME="BedrockKBRole-${APP_NAME}"
echo "Creating IAM role: $ROLE_NAME"

# Trust policy
cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "bedrock.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create role
if aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document file:///tmp/trust-policy.json 2>/dev/null; then
  echo "Created new IAMrole: $ROLE_NAME"
  ROLE_CREATED=true
else
  echo "Role $ROLE_NAME already exists"
  ROLE_CREATED=false
fi

# Role policy
cat > /tmp/role-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInvokeModelStatement",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": ["${EMBEDDING_MODEL}"]
    },
    {
      "Sid": "S3ListBucketStatement",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": ["${SOURCE_BUCKET_ARN}"],
      "Condition": {
        "StringEquals": {
          "aws:ResourceAccount": "${ACCOUNT}"
        }
      }
    },
    {
      "Sid": "S3GetObjectStatement",
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": ["${SOURCE_BUCKET_ARN}/*"],
      "Condition": {
        "StringEquals": {
          "aws:ResourceAccount": "${ACCOUNT}"
        }
      }
    },
    {
      "Sid": "S3VectorsStatement",
      "Effect": "Allow",
      "Action": [
        "s3vectors:QueryVectors",
        "s3vectors:PutVectors",
        "s3vectors:DeleteVectors",
        "s3vectors:GetVectors",
        "s3vectors:ListVectors",
        "s3vectors:GetIndex",
        "s3vectors:ListIndexes",
        "s3vectors:GetVectorBucket",
        "s3vectors:ListVectorBuckets"
      ],
      "Resource": [
        "arn:aws:s3vectors:${AWS_REGION}:${ACCOUNT}:bucket/${APP_NAME}-help-vectors-${AWS_REGION}",
        "arn:aws:s3vectors:${AWS_REGION}:${ACCOUNT}:bucket/${APP_NAME}-help-vectors-${AWS_REGION}/*",
        "arn:aws:s3vectors:${AWS_REGION}:${ACCOUNT}:bucket/${APP_NAME}-help-vectors-${AWS_REGION}/index/${APP_NAME}-help-index-${AWS_REGION}",
        "arn:aws:s3vectors:${AWS_REGION}:${ACCOUNT}:bucket/${APP_NAME}-products-vectors-${AWS_REGION}",
        "arn:aws:s3vectors:${AWS_REGION}:${ACCOUNT}:bucket/${APP_NAME}-products-vectors-${AWS_REGION}/*",
        "arn:aws:s3vectors:${AWS_REGION}:${ACCOUNT}:bucket/${APP_NAME}-products-vectors/index/${APP_NAME}-products-index-${AWS_REGION}",
        "arn:aws:s3vectors:${AWS_REGION}:${ACCOUNT}:bucket/${APP_NAME}-tariffs-vectors-${AWS_REGION}",
        "arn:aws:s3vectors:${AWS_REGION}:${ACCOUNT}:bucket/${APP_NAME}-tariffs-vectors-${AWS_REGION}/*",
        "arn:aws:s3vectors:${AWS_REGION}:${ACCOUNT}:bucket/${APP_NAME}-tariffs-vectors/index/${APP_NAME}-tariffs-index-${AWS_REGION}"
      ]
    }
  ]
}
EOF

# Attach policy to role
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "${ROLE_NAME}-Policy" \
  --policy-document file:///tmp/role-policy.json

KB_ROLE_ARN="arn:aws:iam::${ACCOUNT}:role/${ROLE_NAME}"
echo "Created IAM role: $KB_ROLE_ARN"

# Wait for role propagation only if role was just created
if [ "$ROLE_CREATED" = true ]; then
  echo "Waiting for IAM role to propagate..."
  sleep 10
fi

# Create S3 bucket for knowledge base documents
echo "Creating S3 bucket: $SOURCE_BUCKET_NAME"
if [ "$AWS_REGION" = "us-east-1" ]; then
  aws s3api create-bucket \
    --bucket "$SOURCE_BUCKET_NAME" \
    --region "$AWS_REGION" 2>/dev/null || echo "S3 bucket $SOURCE_BUCKET_NAME already exists"
else
  aws s3api create-bucket \
    --bucket "$SOURCE_BUCKET_NAME" \
    --region "$AWS_REGION" \
    --create-bucket-configuration LocationConstraint="$AWS_REGION" 2>/dev/null || echo "S3 bucket $SOURCE_BUCKET_NAME already exists"
fi

echo "S3 source bucket configured: $SOURCE_BUCKET_ARN"

# Create S3 vector bucket
echo "Creating S3 vector bucket..."
HELP_VECTOR_BUCKET_NAME="${APP_NAME}-help-vectors-${AWS_REGION}"
aws s3vectors create-vector-bucket \
  --vector-bucket-name "$HELP_VECTOR_BUCKET_NAME" 2>/dev/null || echo "Vector bucket $HELP_VECTOR_BUCKET_NAME already exists"

# Get the vector bucket ARN
HELP_VECTOR_BUCKET_ARN=$(aws s3vectors get-vector-bucket \
  --vector-bucket-name "$HELP_VECTOR_BUCKET_NAME" \
  --query 'vectorBucket.vectorBucketArn' \
  --output text)

echo "Created Help vector bucket: $HELP_VECTOR_BUCKET_ARN"

# Create S3 vector index
echo "Creating S3 vector index..."
HELP_S3_INDEX_NAME="${APP_NAME}-help-index-${AWS_REGION}"
aws s3vectors create-index \
  --vector-bucket-name "$HELP_VECTOR_BUCKET_NAME" \
  --index-name "$HELP_S3_INDEX_NAME" \
  --data-type "float32" \
  --dimension 1024 \
  --distance-metric "cosine" \
  --metadata-configuration '{"nonFilterableMetadataKeys":["AMAZON_BEDROCK_TEXT","AMAZON_BEDROCK_METADATA"]}' 2>/dev/null || echo "Vector index $HELP_S3_INDEX_NAME already exists"

# Get the vector index ARN
S3_INDEX_ARN=$(aws s3vectors get-index \
  --vector-bucket-name "$HELP_VECTOR_BUCKET_NAME" \
  --index-name "$HELP_S3_INDEX_NAME" \
  --query 'index.indexArn' \
  --output text)

echo "Created Help vector index: $S3_INDEX_ARN"

# Create S3 vector bucket for products
echo "Creating S3 products vector bucket..."
PRODUCTS_VECTOR_BUCKET_NAME="${APP_NAME}-products-vectors-${AWS_REGION}"
aws s3vectors create-vector-bucket \
  --vector-bucket-name "$PRODUCTS_VECTOR_BUCKET_NAME" 2>/dev/null || echo "Vector bucket $PRODUCTS_VECTOR_BUCKET_NAME already exists"

# Get the products vector bucket ARN
PRODUCTS_VECTOR_BUCKET_ARN=$(aws s3vectors get-vector-bucket \
  --vector-bucket-name "$PRODUCTS_VECTOR_BUCKET_NAME" \
  --query 'vectorBucket.vectorBucketArn' \
  --output text)

echo "Created products vector bucket: $PRODUCTS_VECTOR_BUCKET_ARN"

# Create S3 products vector index
echo "Creating S3 products vector index..."
PRODUCTS_S3_INDEX_NAME="${APP_NAME}-products-index-${AWS_REGION}"
aws s3vectors create-index \
  --vector-bucket-name "$PRODUCTS_VECTOR_BUCKET_NAME" \
  --index-name "$PRODUCTS_S3_INDEX_NAME" \
  --data-type "float32" \
  --dimension 1024 \
  --distance-metric "cosine" \
  --metadata-configuration '{"nonFilterableMetadataKeys":["AMAZON_BEDROCK_TEXT","AMAZON_BEDROCK_METADATA"]}' 2>/dev/null || echo "Vector index $PRODUCTS_S3_INDEX_NAME already exists"

# Get the products vector index ARN
PRODUCTS_S3_INDEX_ARN=$(aws s3vectors get-index \
  --vector-bucket-name "$PRODUCTS_VECTOR_BUCKET_NAME" \
  --index-name "$PRODUCTS_S3_INDEX_NAME" \
  --query 'index.indexArn' \
  --output text)

echo "Created products vector index: $PRODUCTS_S3_INDEX_ARN"

# Create S3 vector bucket for tariffs
echo "Creating S3 tariffs vector bucket..."
TARIFFS_VECTOR_BUCKET_NAME="${APP_NAME}-tariffs-vectors-${AWS_REGION}"
aws s3vectors create-vector-bucket \
  --vector-bucket-name "$TARIFFS_VECTOR_BUCKET_NAME" 2>/dev/null || echo "Vector bucket $TARIFFS_VECTOR_BUCKET_NAME already exists"

# Get the tariffs vector bucket ARN
TARIFFS_VECTOR_BUCKET_ARN=$(aws s3vectors get-vector-bucket \
  --vector-bucket-name "$TARIFFS_VECTOR_BUCKET_NAME" \
  --query 'vectorBucket.vectorBucketArn' \
  --output text)

echo "Created tariffs vector bucket: $TARIFFS_VECTOR_BUCKET_ARN"

# Create S3 tariffs vector index
echo "Creating S3 tariffs vector index..."
TARIFFS_S3_INDEX_NAME="${APP_NAME}-tariffs-index-${AWS_REGION}"
aws s3vectors create-index \
  --vector-bucket-name "$TARIFFS_VECTOR_BUCKET_NAME" \
  --index-name "$TARIFFS_S3_INDEX_NAME" \
  --data-type "float32" \
  --dimension 1024 \
  --distance-metric "cosine" \
  --metadata-configuration '{"nonFilterableMetadataKeys":["AMAZON_BEDROCK_TEXT","AMAZON_BEDROCK_METADATA"]}' 2>/dev/null || echo "Vector index $TARIFFS_S3_INDEX_NAME already exists"

# Get the tariffs vector index ARN
TARIFFS_S3_INDEX_ARN=$(aws s3vectors get-index \
  --vector-bucket-name "$TARIFFS_VECTOR_BUCKET_NAME" \
  --index-name "$TARIFFS_S3_INDEX_NAME" \
  --query 'index.indexArn' \
  --output text)

echo "Created tariffs vector index: $TARIFFS_S3_INDEX_ARN"

# Create knowledge base with retry logic for IAM propagation
echo "Creating Bedrock Help knowledge base..."

# First check if Help KB already exists
existing_help_kb=$(aws bedrock-agent list-knowledge-bases --query "knowledgeBaseSummaries[?name=='${APP_NAME}-help'].knowledgeBaseId" --output text)

if [[ -n "$existing_help_kb" && "$existing_help_kb" != "None" ]]; then
  echo "Knowledge base '${APP_NAME}-help' already exists with ID: $existing_help_kb"
  help_id="$existing_help_kb"
  help_arn=$(aws bedrock-agent get-knowledge-base --knowledge-base-id "$help_id" --query 'knowledgeBase.knowledgeBaseArn' --output text)
  help_json='{"knowledgeBase":{"knowledgeBaseId":"'$help_id'","knowledgeBaseArn":"'$help_arn'"}}'
else
  # Create new help knowledge base
  for i in {1..3}; do
    echo "Help KB Attempt $i of 3..."
    help_json=$(aws bedrock-agent create-knowledge-base \
      --name "${APP_NAME}-help" \
      --role-arn "${KB_ROLE_ARN}" \
      --knowledge-base-configuration "$(cat <<EOF
{
  "type": "VECTOR",
  "vectorKnowledgeBaseConfiguration": {
    "embeddingModelArn": "${EMBEDDING_MODEL}"
  }
}
EOF
      )" \
      --storage-configuration "$(cat <<EOF
{
  "type": "S3_VECTORS",
  "s3VectorsConfiguration": {
    "indexArn": "$S3_INDEX_ARN",
    "vectorBucketArn": "$HELP_VECTOR_BUCKET_ARN"
  }
}
EOF
      )" 2>&1)

    if [[ $? -eq 0 ]]; then
      echo "Knowledge base created successfully"
      break
    elif [[ $i -eq 3 ]]; then
      echo "Failed to create help knowledge base after 3 attempts"
      echo "$help_json"
      exit 1
    else
      echo "Help KB Attempt $i failed, retrying in 15 seconds..."
      echo "$help_json"
      sleep 15
    fi
  done
fi

# Create Products knowledge base
echo "Creating Bedrock Products knowledge base..."

# First check if Products KB already exists
existing_products_kb=$(aws bedrock-agent list-knowledge-bases --query "knowledgeBaseSummaries[?name=='${APP_NAME}-products'].knowledgeBaseId" --output text)

if [[ -n "$existing_products_kb" && "$existing_products_kb" != "None" ]]; then
  echo "Knowledge base '${APP_NAME}-products' already exists with ID: $existing_products_kb"
  products_id="$existing_products_kb"
  products_arn=$(aws bedrock-agent get-knowledge-base --knowledge-base-id "$products_id" --query 'knowledgeBase.knowledgeBaseArn' --output text)
  products_json='{"knowledgeBase":{"knowledgeBaseId":"'$products_id'","knowledgeBaseArn":"'$products_arn'"}}'
else
  # Create new products knowledge base
  for i in {1..3}; do
    echo "Products KB Attempt $i of 3..."
    products_json=$(aws bedrock-agent create-knowledge-base \
      --name "${APP_NAME}-products" \
      --role-arn "${KB_ROLE_ARN}" \
      --knowledge-base-configuration "$(cat <<EOF
{
  "type": "VECTOR",
  "vectorKnowledgeBaseConfiguration": {
    "embeddingModelArn": "${EMBEDDING_MODEL}"
  }
}
EOF
      )" \
      --storage-configuration "$(cat <<EOF
{
  "type": "S3_VECTORS",
  "s3VectorsConfiguration": {
    "indexArn": "$PRODUCTS_S3_INDEX_ARN",
    "vectorBucketArn": "$PRODUCTS_VECTOR_BUCKET_ARN"
  }
}
EOF
      )" 2>&1)

    if [[ $? -eq 0 ]]; then
      echo "Products knowledge base created successfully"
      break
    elif [[ $i -eq 3 ]]; then
      echo "Failed to create products knowledge base after 3 attempts"
      echo "$products_json"
      exit 1
    else
      echo "Products KB Attempt $i failed, retrying in 15 seconds..."
      echo "$products_json"
      sleep 15
    fi
  done
fi

# Write KB values to files for use in CDK
mkdir -p /tmp/kb-outputs

# Help KB outputs
help_arn=$(echo $help_json | jq '.knowledgeBase.knowledgeBaseArn' -r)
echo -n $help_arn > /tmp/kb-outputs/help-kb-arn.txt

help_id=$(echo $help_json | jq '.knowledgeBase.knowledgeBaseId' -r)
echo -n $help_id > /tmp/kb-outputs/help-kb-id.txt

echo "Help Knowledge Base created:"
echo "  ID: $help_id"
echo "  ARN: $help_arn"

# Products KB outputs
products_arn=$(echo $products_json | jq '.knowledgeBase.knowledgeBaseArn' -r)
echo -n $products_arn > /tmp/kb-outputs/products-kb-arn.txt

products_id=$(echo $products_json | jq '.knowledgeBase.knowledgeBaseId' -r)
echo -n $products_id > /tmp/kb-outputs/products-kb-id.txt

echo "Products Knowledge Base created:"
echo "  ID: $products_id"
echo "  ARN: $products_arn"

# Create Tariffs knowledge base
echo "Creating Bedrock Tariffs knowledge base..."

# First check if Tariffs KB already exists
existing_tariffs_kb=$(aws bedrock-agent list-knowledge-bases --query "knowledgeBaseSummaries[?name=='${APP_NAME}-tariffs'].knowledgeBaseId" --output text)

if [[ -n "$existing_tariffs_kb" && "$existing_tariffs_kb" != "None" ]]; then
  echo "Knowledge base '${APP_NAME}-tariffs' already exists with ID: $existing_tariffs_kb"
  tariffs_id="$existing_tariffs_kb"
  tariffs_arn=$(aws bedrock-agent get-knowledge-base --knowledge-base-id "$tariffs_id" --query 'knowledgeBase.knowledgeBaseArn' --output text)
  tariffs_json='{"knowledgeBase":{"knowledgeBaseId":"'$tariffs_id'","knowledgeBaseArn":"'$tariffs_arn'"}}'
else
  # Create new tariffs knowledge base
  for i in {1..3}; do
    echo "Tariffs KB Attempt $i of 3..."
    tariffs_json=$(aws bedrock-agent create-knowledge-base \
      --name "${APP_NAME}-tariffs" \
      --role-arn "${KB_ROLE_ARN}" \
      --knowledge-base-configuration "$(cat <<EOF
{
  "type": "VECTOR",
  "vectorKnowledgeBaseConfiguration": {
    "embeddingModelArn": "${EMBEDDING_MODEL}"
  }
}
EOF
      )" \
      --storage-configuration "$(cat <<EOF
{
  "type": "S3_VECTORS",
  "s3VectorsConfiguration": {
    "indexArn": "$TARIFFS_S3_INDEX_ARN",
    "vectorBucketArn": "$TARIFFS_VECTOR_BUCKET_ARN"
  }
}
EOF
      )" 2>&1)

    if [[ $? -eq 0 ]]; then
      echo "Tariffs knowledge base created successfully"
      break
    elif [[ $i -eq 3 ]]; then
      echo "Failed to create tariffs knowledge base after 3 attempts"
      echo "$tariffs_json"
      exit 1
    else
      echo "Tariffs KB Attempt $i failed, retrying in 15 seconds..."
      echo "$tariffs_json"
      sleep 15
    fi
  done
fi

# Tariffs KB outputs
tariffs_arn=$(echo $tariffs_json | jq '.knowledgeBase.knowledgeBaseArn' -r)
echo -n $tariffs_arn > /tmp/kb-outputs/tariffs-kb-arn.txt

tariffs_id=$(echo $tariffs_json | jq '.knowledgeBase.knowledgeBaseId' -r)
echo -n $tariffs_id > /tmp/kb-outputs/tariffs-kb-id.txt

echo "Tariffs Knowledge Base created:"
echo "  ID: $tariffs_id"
echo "  ARN: $tariffs_arn"

# Create help data source
echo "Creating help data source for S3 bucket: $SOURCE_BUCKET_NAME"

# Check if help data source already exists
existing_help_ds=$(aws bedrock-agent list-data-sources --knowledge-base-id "$help_id" --query "dataSourceSummaries[?name=='${APP_NAME}-help-datasource'].dataSourceId" --output text)

if [[ -n "$existing_help_ds" && "$existing_help_ds" != "None" ]]; then
  echo "Data source '${APP_NAME}-help-datasource' already exists with ID: $existing_help_ds"
  help_data_source_id="$existing_help_ds"
else
  # Create new help data source
  help_data_source_json=$(aws bedrock-agent create-data-source \
    --knowledge-base-id "$help_id" \
    --name "${APP_NAME}-help-datasource" \
    --data-source-configuration "$(cat <<EOF
{
  "type": "S3",
  "s3Configuration": {
    "bucketArn": "$SOURCE_BUCKET_ARN",
    "inclusionPrefixes": ["docs/"]
  }
}
EOF
    )" \
    --data-deletion-policy "RETAIN")

  help_data_source_id=$(echo $help_data_source_json | jq '.dataSource.dataSourceId' -r)
  echo "Help data source created: $help_data_source_id"
fi

# Save help data source ID to temp file
echo -n $help_data_source_id > /tmp/kb-outputs/help-data-source-id.txt

# Create products data source
echo "Creating products data source for S3 bucket: $SOURCE_BUCKET_NAME"

# Check if products data source already exists
existing_products_ds=$(aws bedrock-agent list-data-sources --knowledge-base-id "$products_id" --query "dataSourceSummaries[?name=='${APP_NAME}-products-datasource'].dataSourceId" --output text)

if [[ -n "$existing_products_ds" && "$existing_products_ds" != "None" ]]; then
  echo "Data source '${APP_NAME}-products-datasource' already exists with ID: $existing_products_ds"
  products_data_source_id="$existing_products_ds"
else
  # Create new products data source
  products_data_source_json=$(aws bedrock-agent create-data-source \
    --knowledge-base-id "$products_id" \
    --name "${APP_NAME}-products-datasource" \
    --data-source-configuration "$(cat <<EOF
{
  "type": "S3",
  "s3Configuration": {
    "bucketArn": "$SOURCE_BUCKET_ARN",
    "inclusionPrefixes": ["products/"]
  }
}
EOF
    )" \
    --data-deletion-policy "RETAIN")

  products_data_source_id=$(echo $products_data_source_json | jq '.dataSource.dataSourceId' -r)
  echo "Products data source created: $products_data_source_id"
fi

# Save products data source ID to temp file
echo -n $products_data_source_id > /tmp/kb-outputs/products-data-source-id.txt

# Create tariffs data source
echo "Creating tariffs data source for S3 bucket: $SOURCE_BUCKET_NAME"

# Check if tariffs data source already exists
existing_tariffs_ds=$(aws bedrock-agent list-data-sources --knowledge-base-id "$tariffs_id" --query "dataSourceSummaries[?name=='${APP_NAME}-tariffs-datasource'].dataSourceId" --output text)

if [[ -n "$existing_tariffs_ds" && "$existing_tariffs_ds" != "None" ]]; then
  echo "Data source '${APP_NAME}-tariffs-datasource' already exists with ID: $existing_tariffs_ds"
  tariffs_data_source_id="$existing_tariffs_ds"
else
  # Create new tariffs data source
  tariffs_data_source_json=$(aws bedrock-agent create-data-source \
    --knowledge-base-id "$tariffs_id" \
    --name "${APP_NAME}-tariffs-datasource" \
    --data-source-configuration "$(cat <<EOF
{
  "type": "S3",
  "s3Configuration": {
    "bucketArn": "$SOURCE_BUCKET_ARN",
    "inclusionPrefixes": ["tariffs/"]
  }
}
EOF
    )" \
    --data-deletion-policy "RETAIN")

  tariffs_data_source_id=$(echo $tariffs_data_source_json | jq '.dataSource.dataSourceId' -r)
  echo "Tariffs data source created: $tariffs_data_source_id"
fi

# Save tariffs data source ID to temp file
echo -n $tariffs_data_source_id > /tmp/kb-outputs/tariffs-data-source-id.txt
