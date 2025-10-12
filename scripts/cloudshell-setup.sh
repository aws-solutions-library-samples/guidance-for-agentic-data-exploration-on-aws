#!/bin/bash

# AI Data Explorer - CloudShell Environment Setup Script
# This script prepares AWS CloudShell for deploying the AI Data Explorer

set -e

echo "================================================================"
echo "🚀 Setting up AI Data Explorer environment in AWS CloudShell..."
echo "================================================================"

# Step 1: Install build dependencies
echo "🔧 Installing build dependencies..."
sudo yum update -y
sudo yum groupinstall -y "Development Tools"
sudo yum install -y gcc gcc-c++ make patch zlib-devel bzip2 bzip2-devel readline-devel sqlite sqlite-devel openssl-devel tk-devel libffi-devel xz-devel
echo "✅ Build dependencies installed"

# Step 2: Install pyenv
echo "📦 Installing pyenv..."
if [ ! -d "$HOME/.pyenv" ]; then
    wget -q https://raw.githubusercontent.com/pyenv/pyenv-installer/master/bin/pyenv-installer
    bash pyenv-installer
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
    pyenv install $PYTHON_VERSION
    echo "✅ Python $PYTHON_VERSION installed"
else
    echo "✅ Python $PYTHON_VERSION already installed"
fi

pyenv global $PYTHON_VERSION
echo "🐍 Python version: $(python -V)"

# Step 5: Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."

# Update npm to latest
sudo npm install -g npm@latest

# Install AWS CDK globally
sudo npm install -g aws-cdk@latest
echo "✅ AWS CDK installed: $(cdk --version)"

# Install project dependencies (skip devDependencies to save space)
npm install --omit=dev --no-cache
echo "✅ Project dependencies installed (production only)"
npm cache clean --force

# Step 6: Bootstrap CDK
echo "🏗️  Bootstrapping AWS CDK..."
if npx cdk bootstrap; then
    echo "✅ CDK bootstrap completed"
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
echo "🧹 Cleaning up to save space..."
# Clean up pyenv installer
rm -f pyenv-installer
# Clean up yum cache
sudo yum clean all
# Clean up Python build artifacts
rm -rf $PYTHON_PATH/src
rm -rf $PYTHON_PATH/lib/python*/test
echo "✅ Cleanup completed"

echo ""
echo "================================"
echo "🎉 Environment setup complete!"
echo "================================"
echo ""

echo "✅ Setup script completed successfully!"
