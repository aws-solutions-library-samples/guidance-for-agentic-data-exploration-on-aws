#!/bin/bash

# AI Data Explorer - CloudShell Environment Setup Script
# This script prepares AWS CloudShell for deploying the AI Data Explorer

set -e

echo "================================================================"
echo "🚀 Setting up AI Data Explorer environment in AWS CloudShell..."
echo "================================================================"

# Configure npm to minimize cache usage
export npm_config_cache=/tmp/npm-cache
export npm_config_prefer_offline=true
export npm_config_audit=false
export npm_config_fund=false

# Step 1: Install build dependencies
echo "🔧 Installing build dependencies..."
sudo yum update -y -q
sudo yum groupinstall -y -q "Development Tools"
sudo yum install -y -q gcc gcc-c++ make patch zlib-devel bzip2 bzip2-devel readline-devel sqlite sqlite-devel openssl-devel tk-devel libffi-devel xz-devel
sudo yum clean all
echo "✅ Build dependencies installed"

# Step 2: Install pyenv
echo "📦 Installing pyenv..."
if [ ! -d "$HOME/.pyenv" ]; then
    curl -s https://raw.githubusercontent.com/pyenv/pyenv-installer/master/bin/pyenv-installer | bash
    echo "✅ pyenv installed"
else
    echo "✅ pyenv already installed"
fi

# Step 3: Setup shell environment
echo "🔧 Setting up shell environment..."
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"

# Add to shell profile for persistence
if ! grep -q "PYENV_ROOT" ~/.bashrc; then
    echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc
    echo 'export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc
    echo 'if command -v pyenv 1>/dev/null 2>&1; then' >> ~/.bashrc
    echo '  eval "$(pyenv init -)"' >> ~/.bashrc
    echo 'fi' >> ~/.bashrc
    echo "✅ Added pyenv to ~/.bashrc"
fi

# Initialize pyenv for current session
if command -v pyenv 1>/dev/null 2>&1; then
    eval "$(pyenv init -)"
fi

# Step 4: Install Python 3.13.6
PYTHON_VERSION=3.13.6
echo "🐍 Installing Python $PYTHON_VERSION (this may take a few minutes)..."
if ! pyenv versions | grep -q "$PYTHON_VERSION"; then
    # Configure Python build to minimize size
    export PYTHON_CONFIGURE_OPTS="--enable-optimizations --disable-test-modules --without-ensurepip"
    export CFLAGS="-Os"  # Optimize for size
    
    pyenv install $PYTHON_VERSION
    
    # Immediate cleanup of build artifacts
    rm -rf ~/.pyenv/cache/*
    rm -rf ~/.pyenv/versions/$PYTHON_VERSION/src
    rm -rf ~/.pyenv/versions/$PYTHON_VERSION/lib/python*/test
    rm -rf ~/.pyenv/versions/$PYTHON_VERSION/lib/python*/unittest
    rm -rf ~/.pyenv/versions/$PYTHON_VERSION/lib/python*/tkinter
    rm -rf ~/.pyenv/versions/$PYTHON_VERSION/lib/python*/turtle*
    rm -rf ~/.pyenv/versions/$PYTHON_VERSION/lib/python*/idlelib
    rm -rf ~/.pyenv/versions/$PYTHON_VERSION/lib/python*/ensurepip/_bundled
    
    echo "✅ Python $PYTHON_VERSION installed and optimized"
else
    echo "✅ Python $PYTHON_VERSION already installed"
fi

pyenv global $PYTHON_VERSION
echo "🐍 Python version: $(python -V)"

# Install pip manually (since we disabled ensurepip)
if ! command -v pip &> /dev/null; then
    echo "📦 Installing pip..."
    curl -s https://bootstrap.pypa.io/get-pip.py | python
    python -m pip cache purge
fi

# Step 5: Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."

# Update npm to latest
mkdir -p /tmp/npm-global
export npm_config_prefix=/tmp/npm-global
export PATH=/tmp/npm-global/bin:$PATH
sudo npm install -g npm@latest --no-cache

# Install AWS CDK globally
sudo npm install -g aws-cdk@latest --no-cache
echo "✅ AWS CDK installed: $(cdk --version)"

# Install project dependencies with minimal footprint
npm install --omit=dev --no-cache --prefer-offline --no-audit --no-fund
echo "✅ Project dependencies installed (production only, no cache)"

# Clean up immediately
rm -rf /tmp/npm-cache 2>/dev/null || true
npm cache clean --force 2>/dev/null || true

# Step 6: Bootstrap CDK
echo "🏗️  Bootstrapping AWS CDK..."
if npx cdk bootstrap; then
    echo "✅ CDK bootstrap completed"
    # Clean up any bootstrap artifacts
    rm -rf cdk.out 2>/dev/null || true
else
    echo "⚠️  CDK bootstrap may have already been done or failed"
fi

# Step 7: Verify environment
echo "🔍 Verifying environment..."
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo "  Python: $(python --version)"
echo "  AWS CDK: $(npx cdk --version)"
echo "  AWS CLI: $(aws --version)"
echo "  Current directory: $(pwd)"

# Step 8: Cleanup   
PYTHON_PATH="$HOME/.pyenv/versions/$PYTHON_VERSION"

echo ""
echo "🧹 Cleaning up..."

# Clean up pyenv installer
rm -f pyenv-installer
# Clean up all caches
sudo yum clean all 2>/dev/null || true
npm cache clean --force 2>/dev/null || true
python -m pip cache purge 2>/dev/null || true
echo "✅ Cleanup completed"

echo ""
echo "================================"
echo "🎉 Environment setup complete!"
echo "================================"
echo ""

echo "✅ Setup script completed successfully!"
