#!/bin/bash
set -euo pipefail

echo "=== MySL8TE Feature Lab Environment Setup ==="

# Install fnm (Fast Node Manager)
if ! command -v fnm &> /dev/null; then
    echo "Installing fnm..."
    curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell
fi

# Setup Node.js 24
export PATH="$HOME/.local/share/fnm:$PATH"
export FNM_DIR="$HOME/.local/share/fnm"
if [ -f "$FNM_DIR/fnm" ]; then
    eval "$("$FNM_DIR/fnm" env --use-on-cd)"
    
    echo "Installing Node.js 24..."
    fnm install 24
    fnm use 24
    fnm default 24
else
    echo "Warning: fnm not found at expected location"
fi

# Verify Node.js version
NODE_VERSION=$(node --version 2>/dev/null || echo "not found")
echo "Node.js version: $NODE_VERSION"

# Install workspace dependencies
echo "Installing workspace dependencies..."
cd /workspace
npm install || true

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd /workspace/frontend
npm install

# Install Playwright browsers
echo "Installing Playwright browsers..."
npx playwright install --with-deps chromium

# Install backend dependencies
echo "Installing backend dependencies..."
cd /workspace/backend
npm install

# Install REA
echo "Installing REA..."
export PATH="$HOME/.local/bin:$PATH"
if ! command -v rea &> /dev/null; then
    npm install --global --prefix "$HOME/.local" rea-agents@latest
    npm config set allow-scripts=frida --location=user
fi

# Install Ghidra
GHIDRA_VERSION="12.1.4"
GHIDRA_DIR="/workspace/ghidra_${GHIDRA_VERSION}_PUBLIC"
GHIDRA_URL="https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_${GHIDRA_VERSION}_build/ghidra_${GHIDRA_VERSION}_PUBLIC_20260921.zip"

if [ ! -d "$GHIDRA_DIR" ]; then
    echo "Installing Ghidra ${GHIDRA_VERSION}..."
    cd /workspace
    
    if [ ! -f "ghidra.zip" ]; then
        wget -q --show-progress -O ghidra.zip "$GHIDRA_URL" || \
        curl -L -o ghidra.zip "$GHIDRA_URL"
    fi
    
    echo "Extracting Ghidra..."
    unzip -q ghidra.zip
    rm -f ghidra.zip
    
    echo "Ghidra installed at: $GHIDRA_DIR"
else
    echo "Ghidra already installed at: $GHIDRA_DIR"
fi

# Set environment variables
export GHIDRA_INSTALL_DIR="$GHIDRA_DIR"
export JAVA_HOME="/usr/lib/jvm/java-21-openjdk-amd64"

# Verify installations
echo ""
echo "=== Verification ==="
echo "Node.js: $(node --version 2>/dev/null || echo 'NOT FOUND')"
echo "npm: $(npm --version 2>/dev/null || echo 'NOT FOUND')"
echo "REA: $(rea --version 2>/dev/null || echo 'NOT FOUND')"
echo "Ghidra: $([ -d "$GHIDRA_DIR" ] && echo "$GHIDRA_VERSION installed" || echo 'NOT FOUND')"
echo "Java: $(java -version 2>&1 | head -1 || echo 'NOT FOUND')"
echo "Playwright: $(npx playwright --version 2>/dev/null || echo 'NOT FOUND')"

echo ""
echo "=== Setup Complete ==="
echo "To use these tools in your shell, run:"
echo "  export PATH=\"\$HOME/.local/share/fnm:\$HOME/.local/bin:\$PATH\""
echo "  eval \"\$(fnm env --use-on-cd)\""
echo "  export GHIDRA_INSTALL_DIR=\"$GHIDRA_DIR\""
echo "  export JAVA_HOME=\"/usr/lib/jvm/java-21-openjdk-amd64\""
