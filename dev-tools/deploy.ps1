<#
.SYNOPSIS
    Deploy AI Data Explorer to AWS (Windows PowerShell version)

.DESCRIPTION
    Enterprise-friendly deployment script with support for:
    - Explicit AWS profile, region, and account
    - Bring-your-own VPC, subnets, and security groups
    - Dry-run mode for validation
    - CDK bootstrap check (not auto-run)

.PARAMETER Profile
    AWS CLI profile to use

.PARAMETER Region
    AWS region (e.g., us-east-1)

.PARAMETER Account
    AWS account ID (optional, auto-detected if not provided)

.PARAMETER VpcId
    Existing VPC ID

.PARAMETER PublicSubnetIds
    Comma-separated public subnet IDs

.PARAMETER PrivateSubnetIds
    Comma-separated private subnet IDs

.PARAMETER AlbSecurityGroupId
    Security group ID for Application Load Balancer

.PARAMETER EcsSecurityGroupId
    Security group ID for ECS tasks

.PARAMETER NeptuneSg
    Neptune security group ID

.PARAMETER NeptuneHost
    Neptune cluster endpoint

.PARAMETER WithGraphDb
    Deploy Neptune graph database stack

.PARAMETER GuardrailMode
    'shadow' (monitor) or 'enforce' (block) - default: shadow

.PARAMETER DryRun
    Show what would be deployed without deploying

.PARAMETER SkipBootstrapCheck
    Skip CDK bootstrap verification

.EXAMPLE
    .\deploy.ps1 -Region us-east-1

.EXAMPLE
    .\deploy.ps1 -Profile my-profile -Region us-east-1

.EXAMPLE
    .\deploy.ps1 -Region us-east-1 -VpcId vpc-123 -PublicSubnetIds "subnet-pub1,subnet-pub2"
#>

[CmdletBinding()]
param(
    [string]$Profile,
    [string]$Region,
    [string]$Account,
    [string]$VpcId,
    [string]$PublicSubnetIds,
    [string]$PrivateSubnetIds,
    [string]$AlbSecurityGroupId,
    [string]$EcsSecurityGroupId,
    [string]$NeptuneSg,
    [string]$NeptuneHost,
    [switch]$WithGraphDb,
    [ValidateSet("shadow", "enforce")]
    [string]$GuardrailMode = "shadow",
    [switch]$DryRun,
    [switch]$SkipBootstrapCheck,
    [switch]$Help
)

# Configuration
$MIN_AWS_CLI_VERSION = "2.27.51"
$APP_NAME = "ai-data-explorer"

# Set error action preference
$ErrorActionPreference = "Stop"

# Function to compare version numbers
function Compare-Version {
    param([string]$Version1, [string]$Version2)
    
    $v1Parts = $Version1.Split('.')
    $v2Parts = $Version2.Split('.')
    
    for ($i = 0; $i -lt 3; $i++) {
        $v1Part = if ($i -lt $v1Parts.Length) { [int]$v1Parts[$i] } else { 0 }
        $v2Part = if ($i -lt $v2Parts.Length) { [int]$v2Parts[$i] } else { 0 }
        
        if ($v1Part -gt $v2Part) { return 1 }
        if ($v1Part -lt $v2Part) { return -1 }
    }
    return 0
}

# Function to write colored output
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# Show help
if ($Help) {
    Write-ColorOutput "AI Data Explorer - Deployment Script (PowerShell)" -Color Cyan
    Write-Host ""
    Write-Host "Usage: .\deploy.ps1 [OPTIONS]"
    Write-Host ""
    Write-ColorOutput "AWS Configuration:" -Color Yellow
    Write-Host "  -Profile PROFILE       AWS CLI profile to use"
    Write-Host "  -Region REGION         AWS region (e.g., us-east-1)"
    Write-Host "  -Account ACCOUNT       AWS account ID (optional, auto-detected if not provided)"
    Write-Host ""
    Write-ColorOutput "VPC/Networking Options (for enterprise environments):" -Color Yellow
    Write-Host "  -VpcId ID              Existing VPC ID"
    Write-Host "  -PublicSubnetIds IDS   Comma-separated public subnet IDs"
    Write-Host "  -PrivateSubnetIds IDS  Comma-separated private subnet IDs"
    Write-Host "  -AlbSecurityGroupId ID Security group ID for Application Load Balancer"
    Write-Host "  -EcsSecurityGroupId ID Security group ID for ECS tasks"
    Write-Host ""
    Write-ColorOutput "Neptune/Graph Database Options:" -Color Yellow
    Write-Host "  -NeptuneSg ID          Neptune security group ID"
    Write-Host "  -NeptuneHost HOST      Neptune cluster endpoint"
    Write-Host "  -WithGraphDb           Deploy Neptune graph database stack"
    Write-Host ""
    Write-ColorOutput "Guardrails Options:" -Color Yellow
    Write-Host "  -GuardrailMode MODE    'shadow' (monitor) or 'enforce' (block) - default: shadow"
    Write-Host ""
    Write-ColorOutput "Deployment Options:" -Color Yellow
    Write-Host "  -DryRun                Show what would be deployed without deploying"
    Write-Host "  -SkipBootstrapCheck    Skip CDK bootstrap verification"
    Write-Host "  -Help                  Show this help message"
    Write-Host ""
    Write-ColorOutput "Examples:" -Color Yellow
    Write-Host "  # Basic deployment (creates new VPC)"
    Write-Host "  .\deploy.ps1 -Region us-east-1"
    Write-Host ""
    Write-Host "  # Deploy with specific AWS profile"
    Write-Host "  .\deploy.ps1 -Profile my-profile -Region us-east-1"
    Write-Host ""
    Write-Host "  # Enterprise deployment with existing VPC and subnets"
    Write-Host "  .\deploy.ps1 -Profile prod -Region us-east-1 ``"
    Write-Host "     -VpcId vpc-123 ``"
    Write-Host "     -PublicSubnetIds 'subnet-pub1,subnet-pub2' ``"
    Write-Host "     -PrivateSubnetIds 'subnet-priv1,subnet-priv2'"
    Write-Host ""
    Write-ColorOutput "Required VPC Endpoints (for private subnet deployments):" -Color Yellow
    Write-Host "  - com.amazonaws.<region>.ecr.api"
    Write-Host "  - com.amazonaws.<region>.ecr.dkr"
    Write-Host "  - com.amazonaws.<region>.s3 (Gateway)"
    Write-Host "  - com.amazonaws.<region>.logs"
    Write-Host "  - com.amazonaws.<region>.secretsmanager"
    Write-Host "  - com.amazonaws.<region>.bedrock-runtime"
    Write-Host "  - com.amazonaws.<region>.bedrock-agent-runtime"
    Write-Host "  - com.amazonaws.<region>.sts"
    Write-Host "  - com.amazonaws.<region>.xray"
    Write-Host ""
    exit 0
}

# Banner
Write-Host ""
Write-ColorOutput "╔════════════════════════════════════════════════════════════╗" -Color Cyan
Write-ColorOutput "║          AI Data Explorer - Deployment (PowerShell)        ║" -Color Cyan
Write-ColorOutput "╚════════════════════════════════════════════════════════════╝" -Color Cyan
Write-Host ""

# Disable AWS CLI pager
$env:AWS_PAGER = ""

# Set AWS profile if provided
if ($Profile) {
    $env:AWS_PROFILE = $Profile
    Write-ColorOutput "Using AWS Profile: $Profile" -Color Yellow
}

# Set AWS region
if ($Region) {
    $env:AWS_REGION = $Region
    $env:AWS_DEFAULT_REGION = $Region
    $env:CDK_DEFAULT_REGION = $Region
    Write-ColorOutput "Using AWS Region: $Region" -Color Yellow
} else {
    # Try to get region from profile or environment
    $Region = $env:AWS_DEFAULT_REGION
    if (-not $Region) {
        try {
            $Region = aws configure get region 2>$null
        } catch {
            $Region = $null
        }
    }
    
    if (-not $Region) {
        Write-ColorOutput "Error: AWS region not specified and could not be auto-detected" -Color Red
        Write-Host "Please provide -Region or set AWS_DEFAULT_REGION"
        exit 1
    }
    
    $env:AWS_REGION = $Region
    $env:CDK_DEFAULT_REGION = $Region
    Write-ColorOutput "Auto-detected AWS Region: $Region" -Color Yellow
}

# Set embedding model ARN with region
$env:EMBEDDING_MODEL = "arn:aws:bedrock:${Region}::foundation-model/amazon.titan-embed-text-v2:0"
$env:APP_NAME = $APP_NAME

# Get or validate AWS account ID
if ($Account) {
    $env:CDK_DEFAULT_ACCOUNT = $Account
    Write-ColorOutput "Using AWS Account: $Account" -Color Yellow
} else {
    try {
        $Account = aws sts get-caller-identity --query Account --output text 2>$null
    } catch {
        $Account = $null
    }
    
    if (-not $Account) {
        Write-ColorOutput "Error: Could not determine AWS account ID" -Color Red
        Write-Host "Please provide -Account or ensure AWS credentials are configured"
        exit 1
    }
    
    $env:CDK_DEFAULT_ACCOUNT = $Account
    Write-ColorOutput "Auto-detected AWS Account: $Account" -Color Yellow
}

# Preflight check: AWS CLI version
Write-Host ""
Write-ColorOutput "Checking prerequisites..." -Color Blue

$awsCommand = Get-Command aws -ErrorAction SilentlyContinue
if (-not $awsCommand) {
    Write-ColorOutput "❌ Error: AWS CLI is not installed or not in PATH" -Color Red
    Write-Host "📣 Please install AWS CLI version $MIN_AWS_CLI_VERSION or later"
    exit 1
}

$awsVersionOutput = aws --version 2>&1
$awsVersion = ($awsVersionOutput -split '/')[1] -split ' ' | Select-Object -First 1

if ((Compare-Version $awsVersion $MIN_AWS_CLI_VERSION) -lt 0) {
    Write-ColorOutput "❌ Error: AWS CLI version $awsVersion is below minimum required version $MIN_AWS_CLI_VERSION" -Color Red
    Write-Host "📣 Please upgrade your AWS CLI to version $MIN_AWS_CLI_VERSION or later"
    exit 1
}
Write-ColorOutput "✓ AWS CLI version $awsVersion" -Color Green

# Check CDK bootstrap status
if (-not $SkipBootstrapCheck) {
    Write-ColorOutput "Checking CDK bootstrap status..." -Color Blue
    
    try {
        $bootstrapStack = aws cloudformation describe-stacks `
            --stack-name CDKToolkit `
            --region $Region `
            --query 'Stacks[0].StackStatus' `
            --output text 2>$null
    } catch {
        $bootstrapStack = "NOT_FOUND"
    }
    
    if (-not $bootstrapStack -or $bootstrapStack -eq "NOT_FOUND") {
        Write-ColorOutput "❌ CDK is not bootstrapped in $Region" -Color Red
        Write-Host ""
        Write-Host "Please run the following command first:"
        Write-ColorOutput "  npx cdk bootstrap aws://$Account/$Region" -Color Yellow
        Write-Host ""
        Write-Host "Or use -SkipBootstrapCheck to bypass this verification"
        exit 1
    } else {
        Write-ColorOutput "✓ CDK bootstrapped in $Region" -Color Green
    }
}

# Display configuration
Write-Host ""
Write-ColorOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -Color Blue
Write-ColorOutput "Configuration Summary" -Color Blue
Write-ColorOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -Color Blue
Write-Host "  AWS Account:    $Account"
Write-Host "  AWS Region:     $Region"
if ($Profile) { Write-Host "  AWS Profile:    $Profile" }
Write-Host "  Dry Run:        $DryRun"
Write-Host ""
Write-Host "  VPC:"
if ($VpcId) {
    Write-Host "    VPC ID:              $VpcId"
    if ($PublicSubnetIds) { Write-Host "    Public Subnets:      $PublicSubnetIds" }
    if ($PrivateSubnetIds) { Write-Host "    Private Subnets:     $PrivateSubnetIds" }
    if ($AlbSecurityGroupId) { Write-Host "    ALB Security Group:  $AlbSecurityGroupId" }
    if ($EcsSecurityGroupId) { Write-Host "    ECS Security Group:  $EcsSecurityGroupId" }
} else {
    Write-Host "    Creating new VPC"
}
Write-Host ""
Write-Host "  Guardrails:     $GuardrailMode"
Write-Host "  Graph DB:       $WithGraphDb"
if ($NeptuneHost) { Write-Host "  Neptune Host:   $NeptuneHost" }
Write-Host ""

if ($DryRun) {
    Write-ColorOutput "DRY RUN MODE - No resources will be deployed" -Color Cyan
    Write-Host ""
}

# Validate Neptune configuration
if ($NeptuneHost -and -not $NeptuneSg) {
    Write-ColorOutput "Error: When using Neptune host, -NeptuneSg is also required" -Color Red
    exit 1
}

# Get project root (script is in dev-tools folder)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

# Update version information before deployment
if (-not $DryRun) {
    Write-Host "Updating version information..."
    npm run version:update
}

# Deploy Graph Database Stack if requested
if ($WithGraphDb) {
    Write-ColorOutput "Deploying Graph Database Stack..." -Color Blue
    
    $graphArgs = @()
    if ($VpcId) { $graphArgs += "--vpc-id", $VpcId }
    if ($Profile) { $graphArgs += "--profile", $Profile }
    if ($Region) { $graphArgs += "--region", $Region }
    
    if ($DryRun) {
        Write-ColorOutput "[DRY RUN] Would run: .\dev-tools\deploy-graph-db.ps1 $($graphArgs -join ' ')" -Color Cyan
    } else {
        # Check if PowerShell version exists, otherwise use bash via WSL
        $graphDbScript = Join-Path $ProjectRoot "dev-tools\deploy-graph-db.ps1"
        if (Test-Path $graphDbScript) {
            & $graphDbScript @graphArgs
        } else {
            Write-ColorOutput "Note: Using WSL to run deploy-graph-db.sh" -Color Yellow
            $bashArgs = $graphArgs -join ' '
            wsl bash -c "./dev-tools/deploy-graph-db.sh $bashArgs"
        }
        
        # Read Neptune outputs for main deployment
        $neptuneEndpointFile = "/tmp/graph-db-outputs/neptune-endpoint.txt"
        $neptuneSgFile = "/tmp/graph-db-outputs/neptune-sg-id.txt"
        $vpcIdFile = "/tmp/graph-db-outputs/vpc-id.txt"
        
        # Try to read from WSL paths
        try {
            $NeptuneHost = wsl cat $neptuneEndpointFile 2>$null
            $NeptuneSg = wsl cat $neptuneSgFile 2>$null
            if (-not $VpcId) {
                $VpcId = wsl cat $vpcIdFile 2>$null
            }
            if ($NeptuneHost) {
                Write-Host "Using deployed Neptune: $NeptuneHost (SG: $NeptuneSg)"
            }
        } catch {
            Write-ColorOutput "Warning: Could not read Neptune outputs" -Color Yellow
        }
    }
}

# Check for existing Neptune stack
if (-not $NeptuneHost -and -not $NeptuneSg -and -not $DryRun) {
    Write-Host "Checking for existing Neptune stack..."
    
    try {
        $existingNeptuneHost = aws cloudformation describe-stacks `
            --stack-name DataExplorerGraphDbStack `
            --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneEndpoint'].OutputValue" `
            --output text 2>$null
        
        $existingNeptuneSg = aws cloudformation describe-stacks `
            --stack-name DataExplorerGraphDbStack `
            --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneSecurityGroupId'].OutputValue" `
            --output text 2>$null
        
        $existingVpcId = aws cloudformation describe-stacks `
            --stack-name DataExplorerGraphDbStack `
            --query "Stacks[0].Outputs[?ExportName=='GraphDbVpcId'].OutputValue" `
            --output text 2>$null
        
        if ($existingNeptuneHost -and $existingNeptuneSg -and $existingNeptuneHost -ne "None") {
            $NeptuneHost = $existingNeptuneHost
            $NeptuneSg = $existingNeptuneSg
            if (-not $VpcId -and $existingVpcId) {
                $VpcId = $existingVpcId
            }
            Write-ColorOutput "Found existing Neptune stack" -Color Green
        }
    } catch {
        # No existing Neptune stack
    }
}

# Create Knowledge Base
if (-not $DryRun) {
    Write-ColorOutput "Creating Bedrock Knowledge Bases..." -Color Blue
    
    # Check if PowerShell version exists, otherwise use bash via WSL
    $kbCreateScript = Join-Path $ProjectRoot "scripts\kb-create.ps1"
    if (Test-Path $kbCreateScript) {
        & $kbCreateScript
    } else {
        Write-ColorOutput "Note: Using WSL to run kb-create.sh" -Color Yellow
        wsl bash -c "./scripts/kb-create.sh"
    }
    
    # Read KB outputs
    try {
        $HelpKbId = wsl cat /tmp/kb-outputs/help-kb-id.txt 2>$null
        $ProductsKbId = wsl cat /tmp/kb-outputs/products-kb-id.txt 2>$null
        $TariffsKbId = wsl cat /tmp/kb-outputs/tariffs-kb-id.txt 2>$null
        
        if ($HelpKbId) { Write-ColorOutput "✓ Help Knowledge Base: $HelpKbId" -Color Green }
        if ($ProductsKbId) { Write-ColorOutput "✓ Products Knowledge Base: $ProductsKbId" -Color Green }
        if ($TariffsKbId) { Write-ColorOutput "✓ Tariffs Knowledge Base: $TariffsKbId" -Color Green }
    } catch {
        Write-ColorOutput "Warning: Could not read KB outputs" -Color Yellow
    }
} else {
    Write-ColorOutput "[DRY RUN] Would create Bedrock Knowledge Bases" -Color Cyan
}

# Build CDK command
Write-Host ""
Write-ColorOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -Color Blue
Write-ColorOutput "Deploying CDK Stack" -Color Blue
Write-ColorOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -Color Blue

# Set CDK_DOCKER environment variable (use docker on Windows)
$env:CDK_DOCKER = "docker"

$cdkArgs = @(
    "deploy"
    "--app", "npx tsx bin/cdk-app.ts"
)

# Add VPC context
if ($VpcId) { $cdkArgs += "--context", "vpcId=$VpcId" }
if ($PublicSubnetIds) { $cdkArgs += "--context", "publicSubnetIds=$PublicSubnetIds" }
if ($PrivateSubnetIds) { $cdkArgs += "--context", "privateSubnetIds=$PrivateSubnetIds" }
if ($AlbSecurityGroupId) { $cdkArgs += "--context", "albSecurityGroupId=$AlbSecurityGroupId" }
if ($EcsSecurityGroupId) { $cdkArgs += "--context", "ecsSecurityGroupId=$EcsSecurityGroupId" }

# Add Neptune context
if ($NeptuneHost) {
    $cdkArgs += "--context", "withGraphDb=true"
    $cdkArgs += "--context", "neptuneHost=$NeptuneHost"
    $cdkArgs += "--context", "neptuneSgId=$NeptuneSg"
}

# Add guardrails context
$cdkArgs += "--context", "guardrailMode=$GuardrailMode"
$cdkArgs += "--require-approval", "never"

# Execute deployment
if ($DryRun) {
    Write-ColorOutput "[DRY RUN] Would execute:" -Color Cyan
    Write-Host "npx cdk $($cdkArgs -join ' ')"
    Write-Host ""
    Write-ColorOutput "[DRY RUN] Synthesizing templates to validate..." -Color Cyan
    
    try {
        npx cdk synth --app "npx tsx bin/cdk-app.ts" --quiet
    } catch {
        # Ignore synth errors in dry run
    }
    
    Write-ColorOutput "✓ Dry run completed" -Color Green
} else {
    npx cdk @cdkArgs
}

# Show deployment summary
Write-Host ""
Write-ColorOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -Color Green
Write-ColorOutput "Deployment Complete!" -Color Green
Write-ColorOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -Color Green

if (-not $DryRun) {
    try {
        $albUrl = aws cloudformation describe-stacks `
            --stack-name DataExplorerAgentsStack `
            --query "Stacks[0].Outputs[?ExportName=='ALBEndpoint'].OutputValue" `
            --output text 2>$null
        
        $cloudfrontUrl = aws cloudformation describe-stacks `
            --stack-name DataExplorerAgentsStack `
            --query "Stacks[0].Outputs[?ExportName=='ApplicationUrl'].OutputValue" `
            --output text 2>$null
        
        Write-Host ""
        Write-Host "  CloudFront URL (HTTPS): $cloudfrontUrl"
    } catch {
        Write-Host "  URLs not available yet"
    }
}

Write-Host ""
