<#
.SYNOPSIS
    Create Bedrock Knowledge Bases for AI Data Explorer (Windows PowerShell version)

.DESCRIPTION
    Creates IAM roles, S3 buckets, S3 vector stores, and Bedrock Knowledge Bases
    for the AI Data Explorer application.

.EXAMPLE
    .\kb-create.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# Disable AWS CLI pager
$env:AWS_PAGER = ""

# Set APP_NAME if not already set
if (-not $env:APP_NAME) {
    $env:APP_NAME = "ai-data-explorer"
}
$APP_NAME = $env:APP_NAME

# Set AWS_REGION if not already set
if (-not $env:AWS_REGION) {
    $env:AWS_REGION = aws configure get region
}
$AWS_REGION = $env:AWS_REGION

# Set EMBEDDING_MODEL
$EMBEDDING_MODEL = "arn:aws:bedrock:${AWS_REGION}::foundation-model/amazon.titan-embed-text-v2:0"
$env:EMBEDDING_MODEL = $EMBEDDING_MODEL

# Get account ID
$ACCOUNT = aws sts get-caller-identity --query Account --output text
$SOURCE_BUCKET_NAME = "${APP_NAME}-kb-${ACCOUNT}-${AWS_REGION}"
$SOURCE_BUCKET_ARN = "arn:aws:s3:::${SOURCE_BUCKET_NAME}"

# Create IAM role for Bedrock Knowledge Base
$ROLE_NAME = "BedrockKBRole-${APP_NAME}"
Write-Host "Creating IAM role: $ROLE_NAME"

# Trust policy
$trustPolicy = @"
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
"@

$trustPolicyFile = [System.IO.Path]::GetTempFileName()
$trustPolicy | Out-File -FilePath $trustPolicyFile -Encoding utf8

# Create role
$ROLE_CREATED = $false
try {
    aws iam create-role `
        --role-name $ROLE_NAME `
        --assume-role-policy-document "file://$trustPolicyFile" `
        --output json 2>$null | Out-Null
    Write-Host "Created new IAM role: $ROLE_NAME"
    $ROLE_CREATED = $true
} catch {
    Write-Host "Role $ROLE_NAME already exists"
}

Remove-Item $trustPolicyFile -Force

# Role policy
$rolePolicy = @"
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
        "arn:aws:s3vectors:${AWS_REGION}:${ACCOUNT}:bucket/${APP_NAME}-products-vectors-${AWS_REGION}/index/${APP_NAME}-products-index-${AWS_REGION}",
        "arn:aws:s3vectors:${AWS_REGION}:${ACCOUNT}:bucket/${APP_NAME}-tariffs-vectors-${AWS_REGION}",
        "arn:aws:s3vectors:${AWS_REGION}:${ACCOUNT}:bucket/${APP_NAME}-tariffs-vectors-${AWS_REGION}/*",
        "arn:aws:s3vectors:${AWS_REGION}:${ACCOUNT}:bucket/${APP_NAME}-tariffs-vectors-${AWS_REGION}/index/${APP_NAME}-tariffs-index-${AWS_REGION}"
      ]
    }
  ]
}
"@

$rolePolicyFile = [System.IO.Path]::GetTempFileName()
$rolePolicy | Out-File -FilePath $rolePolicyFile -Encoding utf8

# Attach policy to role
aws iam put-role-policy `
    --role-name $ROLE_NAME `
    --policy-name "${ROLE_NAME}-Policy" `
    --policy-document "file://$rolePolicyFile"

Remove-Item $rolePolicyFile -Force

$KB_ROLE_ARN = "arn:aws:iam::${ACCOUNT}:role/${ROLE_NAME}"
Write-Host "Created IAM role: $KB_ROLE_ARN"

# Wait for role propagation only if role was just created
if ($ROLE_CREATED) {
    Write-Host "Waiting for IAM role to propagate..."
    Start-Sleep -Seconds 10
}

# Create S3 bucket for knowledge base documents
Write-Host "Creating S3 bucket: $SOURCE_BUCKET_NAME"
try {
    if ($AWS_REGION -eq "us-east-1") {
        aws s3api create-bucket `
            --bucket $SOURCE_BUCKET_NAME `
            --region $AWS_REGION 2>$null | Out-Null
    } else {
        aws s3api create-bucket `
            --bucket $SOURCE_BUCKET_NAME `
            --region $AWS_REGION `
            --create-bucket-configuration "LocationConstraint=$AWS_REGION" 2>$null | Out-Null
    }
} catch {
    Write-Host "S3 bucket $SOURCE_BUCKET_NAME already exists"
}

Write-Host "S3 source bucket configured: $SOURCE_BUCKET_ARN"

# Function to create vector bucket and index
function New-VectorBucketAndIndex {
    param(
        [string]$Name,
        [string]$AppName,
        [string]$Region
    )
    
    $vectorBucketName = "${AppName}-${Name}-vectors-${Region}"
    $indexName = "${AppName}-${Name}-index-${Region}"
    
    # Create S3 vector bucket
    Write-Host "Creating S3 vector bucket: $vectorBucketName"
    try {
        aws s3vectors create-vector-bucket --vector-bucket-name $vectorBucketName 2>$null | Out-Null
    } catch {
        Write-Host "Vector bucket $vectorBucketName already exists"
    }
    
    # Get the vector bucket ARN
    $vectorBucketArn = aws s3vectors get-vector-bucket `
        --vector-bucket-name $vectorBucketName `
        --query 'vectorBucket.vectorBucketArn' `
        --output text
    
    Write-Host "Created $Name vector bucket: $vectorBucketArn"
    
    # Create S3 vector index
    Write-Host "Creating S3 vector index: $indexName"
    try {
        aws s3vectors create-index `
            --vector-bucket-name $vectorBucketName `
            --index-name $indexName `
            --data-type "float32" `
            --dimension 1024 `
            --distance-metric "cosine" `
            --metadata-configuration '{"nonFilterableMetadataKeys":["AMAZON_BEDROCK_TEXT","AMAZON_BEDROCK_METADATA"]}' 2>$null | Out-Null
    } catch {
        Write-Host "Vector index $indexName already exists"
    }
    
    # Get the vector index ARN
    $indexArn = aws s3vectors get-index `
        --vector-bucket-name $vectorBucketName `
        --index-name $indexName `
        --query 'index.indexArn' `
        --output text
    
    Write-Host "Created $Name vector index: $indexArn"
    
    return @{
        VectorBucketArn = $vectorBucketArn
        IndexArn = $indexArn
    }
}

# Create vector buckets and indexes for each KB
$helpVectors = New-VectorBucketAndIndex -Name "help" -AppName $APP_NAME -Region $AWS_REGION
$productsVectors = New-VectorBucketAndIndex -Name "products" -AppName $APP_NAME -Region $AWS_REGION
$tariffsVectors = New-VectorBucketAndIndex -Name "tariffs" -AppName $APP_NAME -Region $AWS_REGION

# Function to create or get knowledge base
function New-OrGetKnowledgeBase {
    param(
        [string]$Name,
        [string]$AppName,
        [string]$RoleArn,
        [string]$EmbeddingModel,
        [string]$IndexArn,
        [string]$VectorBucketArn
    )
    
    $kbName = "${AppName}-${Name}"
    
    Write-Host "Creating Bedrock $Name knowledge base..."
    
    # Check if KB already exists
    $existingKb = aws bedrock-agent list-knowledge-bases `
        --query "knowledgeBaseSummaries[?name=='$kbName'].knowledgeBaseId" `
        --output text 2>$null
    
    if ($existingKb -and $existingKb -ne "None" -and $existingKb.Trim()) {
        Write-Host "Knowledge base '$kbName' already exists with ID: $existingKb"
        $kbArn = aws bedrock-agent get-knowledge-base `
            --knowledge-base-id $existingKb `
            --query 'knowledgeBase.knowledgeBaseArn' `
            --output text
        
        return @{
            Id = $existingKb.Trim()
            Arn = $kbArn
        }
    }
    
    # Create new knowledge base with retry logic
    $kbConfig = @{
        type = "VECTOR"
        vectorKnowledgeBaseConfiguration = @{
            embeddingModelArn = $EmbeddingModel
        }
    } | ConvertTo-Json -Compress
    
    $storageConfig = @{
        type = "S3_VECTORS"
        s3VectorsConfiguration = @{
            indexArn = $IndexArn
            vectorBucketArn = $VectorBucketArn
        }
    } | ConvertTo-Json -Compress
    
    for ($i = 1; $i -le 3; $i++) {
        Write-Host "$Name KB Attempt $i of 3..."
        
        try {
            $kbJson = aws bedrock-agent create-knowledge-base `
                --name $kbName `
                --role-arn $RoleArn `
                --knowledge-base-configuration $kbConfig `
                --storage-configuration $storageConfig `
                --output json 2>&1
            
            $kb = $kbJson | ConvertFrom-Json
            Write-Host "Knowledge base created successfully"
            
            return @{
                Id = $kb.knowledgeBase.knowledgeBaseId
                Arn = $kb.knowledgeBase.knowledgeBaseArn
            }
        } catch {
            if ($i -eq 3) {
                Write-Host "Failed to create $Name knowledge base after 3 attempts"
                Write-Host $_.Exception.Message
                throw
            }
            Write-Host "$Name KB Attempt $i failed, retrying in 15 seconds..."
            Start-Sleep -Seconds 15
        }
    }
}

# Create knowledge bases
$helpKb = New-OrGetKnowledgeBase -Name "help" -AppName $APP_NAME -RoleArn $KB_ROLE_ARN `
    -EmbeddingModel $EMBEDDING_MODEL -IndexArn $helpVectors.IndexArn -VectorBucketArn $helpVectors.VectorBucketArn

$productsKb = New-OrGetKnowledgeBase -Name "products" -AppName $APP_NAME -RoleArn $KB_ROLE_ARN `
    -EmbeddingModel $EMBEDDING_MODEL -IndexArn $productsVectors.IndexArn -VectorBucketArn $productsVectors.VectorBucketArn

$tariffsKb = New-OrGetKnowledgeBase -Name "tariffs" -AppName $APP_NAME -RoleArn $KB_ROLE_ARN `
    -EmbeddingModel $EMBEDDING_MODEL -IndexArn $tariffsVectors.IndexArn -VectorBucketArn $tariffsVectors.VectorBucketArn

# Create output directory (use Windows temp path)
$outputDir = Join-Path $env:TEMP "kb-outputs"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Also create in WSL-compatible location if possible
try {
    wsl mkdir -p /tmp/kb-outputs 2>$null
    wsl bash -c "echo -n '$($helpKb.Id)' > /tmp/kb-outputs/help-kb-id.txt" 2>$null
    wsl bash -c "echo -n '$($helpKb.Arn)' > /tmp/kb-outputs/help-kb-arn.txt" 2>$null
    wsl bash -c "echo -n '$($productsKb.Id)' > /tmp/kb-outputs/products-kb-id.txt" 2>$null
    wsl bash -c "echo -n '$($productsKb.Arn)' > /tmp/kb-outputs/products-kb-arn.txt" 2>$null
    wsl bash -c "echo -n '$($tariffsKb.Id)' > /tmp/kb-outputs/tariffs-kb-id.txt" 2>$null
    wsl bash -c "echo -n '$($tariffsKb.Arn)' > /tmp/kb-outputs/tariffs-kb-arn.txt" 2>$null
} catch {
    # WSL not available, use Windows paths only
}

# Save to Windows temp
$helpKb.Id | Out-File -FilePath (Join-Path $outputDir "help-kb-id.txt") -NoNewline -Encoding utf8
$helpKb.Arn | Out-File -FilePath (Join-Path $outputDir "help-kb-arn.txt") -NoNewline -Encoding utf8
$productsKb.Id | Out-File -FilePath (Join-Path $outputDir "products-kb-id.txt") -NoNewline -Encoding utf8
$productsKb.Arn | Out-File -FilePath (Join-Path $outputDir "products-kb-arn.txt") -NoNewline -Encoding utf8
$tariffsKb.Id | Out-File -FilePath (Join-Path $outputDir "tariffs-kb-id.txt") -NoNewline -Encoding utf8
$tariffsKb.Arn | Out-File -FilePath (Join-Path $outputDir "tariffs-kb-arn.txt") -NoNewline -Encoding utf8

Write-Host ""
Write-Host "Help Knowledge Base created:"
Write-Host "  ID: $($helpKb.Id)"
Write-Host "  ARN: $($helpKb.Arn)"
Write-Host ""
Write-Host "Products Knowledge Base created:"
Write-Host "  ID: $($productsKb.Id)"
Write-Host "  ARN: $($productsKb.Arn)"
Write-Host ""
Write-Host "Tariffs Knowledge Base created:"
Write-Host "  ID: $($tariffsKb.Id)"
Write-Host "  ARN: $($tariffsKb.Arn)"

# Function to create or get data source
function New-OrGetDataSource {
    param(
        [string]$Name,
        [string]$AppName,
        [string]$KbId,
        [string]$BucketArn,
        [string]$Prefix
    )
    
    $dsName = "${AppName}-${Name}-datasource"
    
    Write-Host "Creating $Name data source for S3 bucket..."
    
    # Check if data source already exists
    $existingDs = aws bedrock-agent list-data-sources `
        --knowledge-base-id $KbId `
        --query "dataSourceSummaries[?name=='$dsName'].dataSourceId" `
        --output text 2>$null
    
    if ($existingDs -and $existingDs -ne "None" -and $existingDs.Trim()) {
        Write-Host "Data source '$dsName' already exists with ID: $existingDs"
        return $existingDs.Trim()
    }
    
    # Create new data source
    $dsConfig = @{
        type = "S3"
        s3Configuration = @{
            bucketArn = $BucketArn
            inclusionPrefixes = @($Prefix)
        }
    } | ConvertTo-Json -Compress
    
    $dsJson = aws bedrock-agent create-data-source `
        --knowledge-base-id $KbId `
        --name $dsName `
        --data-source-configuration $dsConfig `
        --data-deletion-policy "RETAIN" `
        --output json
    
    $ds = $dsJson | ConvertFrom-Json
    $dsId = $ds.dataSource.dataSourceId
    Write-Host "$Name data source created: $dsId"
    
    return $dsId
}

# Create data sources
$helpDsId = New-OrGetDataSource -Name "help" -AppName $APP_NAME -KbId $helpKb.Id -BucketArn $SOURCE_BUCKET_ARN -Prefix "docs/"
$productsDsId = New-OrGetDataSource -Name "products" -AppName $APP_NAME -KbId $productsKb.Id -BucketArn $SOURCE_BUCKET_ARN -Prefix "products/"
$tariffsDsId = New-OrGetDataSource -Name "tariffs" -AppName $APP_NAME -KbId $tariffsKb.Id -BucketArn $SOURCE_BUCKET_ARN -Prefix "tariffs/"

# Save data source IDs
$helpDsId | Out-File -FilePath (Join-Path $outputDir "help-data-source-id.txt") -NoNewline -Encoding utf8
$productsDsId | Out-File -FilePath (Join-Path $outputDir "products-data-source-id.txt") -NoNewline -Encoding utf8
$tariffsDsId | Out-File -FilePath (Join-Path $outputDir "tariffs-data-source-id.txt") -NoNewline -Encoding utf8

# Also save to WSL paths if available
try {
    wsl bash -c "echo -n '$helpDsId' > /tmp/kb-outputs/help-data-source-id.txt" 2>$null
    wsl bash -c "echo -n '$productsDsId' > /tmp/kb-outputs/products-data-source-id.txt" 2>$null
    wsl bash -c "echo -n '$tariffsDsId' > /tmp/kb-outputs/tariffs-data-source-id.txt" 2>$null
} catch {
    # WSL not available
}

Write-Host ""
Write-Host "KB outputs saved to: $outputDir"
