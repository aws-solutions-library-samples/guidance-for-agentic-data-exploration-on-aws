<#
.SYNOPSIS
    Deploy Graph Database Stack (Windows PowerShell version)

.DESCRIPTION
    Deploys the Neptune graph database stack for AI Data Explorer.

.PARAMETER Profile
    AWS CLI profile to use

.PARAMETER Region
    AWS region (e.g., us-east-1)

.PARAMETER VpcId
    Existing VPC ID (optional - creates new VPC if not provided)

.PARAMETER DryRun
    Show what would be deployed without deploying

.EXAMPLE
    .\deploy-graph-db.ps1 -Region us-east-1

.EXAMPLE
    .\deploy-graph-db.ps1 -Region us-east-1 -VpcId vpc-123
#>

[CmdletBinding()]
param(
    [string]$Profile,
    [string]$Region,
    [string]$VpcId,
    [switch]$DryRun,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

# Disable AWS CLI pager
$env:AWS_PAGER = ""

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
    Write-ColorOutput "Deploy Graph Database Stack" -Color Blue
    Write-Host ""
    Write-Host "Usage: .\deploy-graph-db.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Profile PROFILE       AWS CLI profile to use"
    Write-Host "  -Region REGION         AWS region (e.g., us-east-1)"
    Write-Host "  -VpcId ID              Existing VPC ID (optional - creates new VPC if not provided)"
    Write-Host "  -DryRun                Show what would be deployed without deploying"
    Write-Host "  -Help                  Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\deploy-graph-db.ps1 -Region us-east-1                    # Deploy with new VPC"
    Write-Host "  .\deploy-graph-db.ps1 -Region us-east-1 -VpcId vpc-123     # Deploy with existing VPC"
    Write-Host "  .\deploy-graph-db.ps1 -Profile prod -Region us-east-1     # Deploy with specific profile"
    exit 0
}

# Get project root (script is in dev-tools folder)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

Write-ColorOutput "📊 Deploying Graph Database Stack..." -Color Blue

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
} else {
    $Region = $env:AWS_DEFAULT_REGION
    if (-not $Region) {
        try {
            $Region = aws configure get region 2>$null
        } catch {
            $Region = $null
        }
    }
    
    if (-not $Region) {
        Write-ColorOutput "Error: AWS region not specified" -Color Red
        Write-Host "Please provide -Region or set AWS_DEFAULT_REGION"
        exit 1
    }
    
    $env:AWS_REGION = $Region
    $env:CDK_DEFAULT_REGION = $Region
}
Write-ColorOutput "Using AWS Region: $Region" -Color Yellow

# Get AWS account ID
try {
    $AWS_ACCOUNT = aws sts get-caller-identity --query Account --output text 2>$null
} catch {
    $AWS_ACCOUNT = $null
}

if (-not $AWS_ACCOUNT) {
    Write-ColorOutput "Error: Could not determine AWS account ID" -Color Red
    exit 1
}
$env:CDK_DEFAULT_ACCOUNT = $AWS_ACCOUNT
Write-ColorOutput "Using AWS Account: $AWS_ACCOUNT" -Color Yellow

# Create output directory (use Windows temp and WSL paths)
$outputDir = Join-Path $env:TEMP "graph-db-outputs"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Also create WSL-compatible directory
try {
    wsl mkdir -p /tmp/graph-db-outputs 2>$null
} catch {
    # WSL not available
}

# Set CDK_DOCKER environment variable
$env:CDK_DOCKER = "docker"

# Build CDK deploy command
$cdkArgs = @(
    "deploy", "DataExplorerGraphDbStack"
    "--app", "npx tsx bin/graph-db-app.ts"
)

# Add VPC context if provided
if ($VpcId) {
    Write-ColorOutput "Deploying to VPC: $VpcId" -Color Yellow
    $cdkArgs += "--context", "vpcId=$VpcId"
} else {
    Write-ColorOutput "Deploying with new VPC" -Color Yellow
}

$cdkArgs += "--require-approval", "never"

# Execute deployment
if ($DryRun) {
    Write-ColorOutput "[DRY RUN] Would execute:" -Color Blue
    Write-Host "npx cdk $($cdkArgs -join ' ')"
} else {
    npx cdk @cdkArgs
    
    # Get deployment outputs
    try {
        $neptuneClusterId = aws cloudformation describe-stacks `
            --stack-name DataExplorerGraphDbStack `
            --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneClusterId'].OutputValue" `
            --output text 2>$null
        
        $neptuneEndpoint = aws cloudformation describe-stacks `
            --stack-name DataExplorerGraphDbStack `
            --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneEndpoint'].OutputValue" `
            --output text 2>$null
        
        $neptuneSgId = aws cloudformation describe-stacks `
            --stack-name DataExplorerGraphDbStack `
            --query "Stacks[0].Outputs[?ExportName=='GraphDbNeptuneSecurityGroupId'].OutputValue" `
            --output text 2>$null
        
        $vpcIdOutput = aws cloudformation describe-stacks `
            --stack-name DataExplorerGraphDbStack `
            --query "Stacks[0].Outputs[?ExportName=='GraphDbVpcId'].OutputValue" `
            --output text 2>$null
        
        Write-Host ""
        Write-ColorOutput "🎉 Graph Database Stack Deployment Complete!" -Color Green
        Write-Host "=============================================="
        Write-Host "  📊 Neptune Cluster ID: $neptuneClusterId"
        Write-Host "  🌐 Neptune Endpoint: $neptuneEndpoint"
        Write-Host "  🔒 Neptune Security Group: $neptuneSgId"
        Write-Host "  🏠 VPC ID: $vpcIdOutput"
        Write-Host ""
        
        # Save outputs to Windows temp
        $neptuneClusterId | Out-File -FilePath (Join-Path $outputDir "neptune-cluster-id.txt") -NoNewline -Encoding utf8
        $neptuneEndpoint | Out-File -FilePath (Join-Path $outputDir "neptune-endpoint.txt") -NoNewline -Encoding utf8
        $neptuneSgId | Out-File -FilePath (Join-Path $outputDir "neptune-sg-id.txt") -NoNewline -Encoding utf8
        $vpcIdOutput | Out-File -FilePath (Join-Path $outputDir "vpc-id.txt") -NoNewline -Encoding utf8
        
        # Also save to WSL paths if available
        try {
            wsl bash -c "echo -n '$neptuneClusterId' > /tmp/graph-db-outputs/neptune-cluster-id.txt" 2>$null
            wsl bash -c "echo -n '$neptuneEndpoint' > /tmp/graph-db-outputs/neptune-endpoint.txt" 2>$null
            wsl bash -c "echo -n '$neptuneSgId' > /tmp/graph-db-outputs/neptune-sg-id.txt" 2>$null
            wsl bash -c "echo -n '$vpcIdOutput' > /tmp/graph-db-outputs/vpc-id.txt" 2>$null
        } catch {
            # WSL not available
        }
        
        Write-Host "Graph DB outputs saved to: $outputDir"
    } catch {
        Write-ColorOutput "Warning: Could not retrieve stack outputs" -Color Yellow
    }
}
