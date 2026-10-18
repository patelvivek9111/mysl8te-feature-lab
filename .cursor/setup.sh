#!/bin/bash
set -euo pipefail

echo "=== MySL8TE Feature Lab Environment Setup ==="

# Install fnm (Fast Node Manager)
if ! command -v fnm &> /dev/null; then
    echo "Installing fnm..."
    curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell
    if [ ! -f "$HOME/.local/share/fnm/fnm" ]; then
        echo "ERROR: fnm installation failed"
        exit 1
    fi
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
    echo "ERROR: fnm not found at expected location"
    exit 1
fi

# Verify Node.js version
NODE_VERSION=$(node --version 2>/dev/null || echo "")
if [ -z "$NODE_VERSION" ]; then
    echo "ERROR: Node.js installation failed"
    exit 1
fi
echo "Node.js version: $NODE_VERSION"

# Install workspace dependencies (optional, may not exist initially)
echo "Installing workspace dependencies..."
cd /workspace
npm install || echo "No workspace dependencies to install"

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd /workspace/frontend
if [ ! -f "package.json" ]; then
    echo "ERROR: frontend/package.json not found"
    exit 1
fi
npm install

# Install Playwright browsers
echo "Installing Playwright browsers..."
npx playwright install --with-deps chromium

# Install backend dependencies
echo "Installing backend dependencies..."
cd /workspace/backend
if [ ! -f "package.json" ]; then
    echo "ERROR: backend/package.json not found"
    exit 1
fi
npm install

# Install REA (pinned version for reproducibility)
REA_VERSION="6.7.0"
echo "Installing REA ${REA_VERSION}..."
export PATH="$HOME/.local/bin:$PATH"
if ! command -v rea &> /dev/null; then
    npm install --global --prefix "$HOME/.local" "rea-agents@${REA_VERSION}"
    npm config set allow-scripts=frida --location=user
fi

# Verify REA installation
INSTALLED_REA=$(rea --version 2>/dev/null || echo "")
if [ "$INSTALLED_REA" != "$REA_VERSION" ]; then
    echo "WARNING: Expected REA ${REA_VERSION}, got ${INSTALLED_REA}"
fi

# Install Ghidra
GHIDRA_VERSION="12.1.4"
GHIDRA_DIR="/workspace/ghidra_${GHIDRA_VERSION}_PUBLIC"
GHIDRA_URL="https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_${GHIDRA_VERSION}_build/ghidra_${GHIDRA_VERSION}_PUBLIC_20260921.zip"

if [ ! -d "$GHIDRA_DIR" ]; then
    echo "Installing Ghidra ${GHIDRA_VERSION}..."
    cd /workspace
    
    if [ ! -f "ghidra.zip" ]; then
        echo "Downloading Ghidra..."
        if command -v wget &> /dev/null; then
            wget -q --show-progress -O ghidra.zip "$GHIDRA_URL"
        elif command -v curl &> /dev/null; then
            curl -L -o ghidra.zip "$GHIDRA_URL"
        else
            echo "ERROR: Neither wget nor curl is available"
            exit 1
        fi
        
        if [ ! -f "ghidra.zip" ] || [ ! -s "ghidra.zip" ]; then
            echo "ERROR: Ghidra download failed"
            exit 1
        fi
    fi
    
    echo "Extracting Ghidra..."
    unzip -q ghidra.zip
    rm -f ghidra.zip
    
    if [ ! -d "$GHIDRA_DIR" ]; then
        echo "ERROR: Ghidra extraction failed"
        exit 1
    fi
    
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
VERIFICATION_FAILED=false

NODE_VER=$(node --version 2>/dev/null || echo 'NOT FOUND')
echo "Node.js: $NODE_VER"
[ "$NODE_VER" = "NOT FOUND" ] && VERIFICATION_FAILED=true

NPM_VER=$(npm --version 2>/dev/null || echo 'NOT FOUND')
echo "npm: $NPM_VER"
[ "$NPM_VER" = "NOT FOUND" ] && VERIFICATION_FAILED=true

REA_VER=$(rea --version 2>/dev/null || echo 'NOT FOUND')
echo "REA: $REA_VER"
[ "$REA_VER" = "NOT FOUND" ] && VERIFICATION_FAILED=true

if [ -d "$GHIDRA_DIR" ]; then
    echo "Ghidra: $GHIDRA_VERSION installed"
else
    echo "Ghidra: NOT FOUND"
    VERIFICATION_FAILED=true
fi

JAVA_VER=$(java -version 2>&1 | head -1 || echo 'NOT FOUND')
echo "Java: $JAVA_VER"
[ "$JAVA_VER" = "NOT FOUND" ] && VERIFICATION_FAILED=true

PLAYWRIGHT_VER=$(npx playwright --version 2>/dev/null || echo 'NOT FOUND')
echo "Playwright: $PLAYWRIGHT_VER"
[ "$PLAYWRIGHT_VER" = "NOT FOUND" ] && VERIFICATION_FAILED=true

if [ "$VERIFICATION_FAILED" = true ]; then
    echo ""
    echo "ERROR: Some installations failed verification"
    exit 1
fi

echo ""
echo "=== Setup Complete ==="
echo "To use these tools in your shell, run:"
echo "  export PATH=\"\$HOME/.local/share/fnm:\$HOME/.local/bin:\$PATH\""
echo "  eval \"\$(fnm env --use-on-cd)\""
echo "  export GHIDRA_INSTALL_DIR=\"$GHIDRA_DIR\""
echo "  export JAVA_HOME=\"/usr/lib/jvm/java-21-openjdk-amd64\""
