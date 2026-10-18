#!/usr/bin/env bash
# Idempotent Cloud Agent install: Node 24, workspace deps, Playwright, REA.
# Ghidra and the JDK are verified here; long-running servers belong in start.sh.
set -euo pipefail

NODE_VERSION="24.22.0"
NODE_PREFIX="/usr/local/lib/nodejs"
REA_VERSION="6.7.0"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export DEBIAN_FRONTEND=noninteractive
export PATH="${NODE_PREFIX}/bin:${PATH}"

install_node() {
  local current=""
  if [[ -x "${NODE_PREFIX}/bin/node" ]]; then
    current="$("${NODE_PREFIX}/bin/node" --version 2>/dev/null || true)"
  fi
  if [[ "${current}" == "v${NODE_VERSION}" ]]; then
    echo "Node.js v${NODE_VERSION} already installed"
    return
  fi

  echo "Installing Node.js v${NODE_VERSION}..."
  local tmp
  tmp="$(mktemp)"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" -o "${tmp}"
  sudo rm -rf "${NODE_PREFIX}"
  sudo mkdir -p "${NODE_PREFIX}"
  sudo tar -xJf "${tmp}" -C "${NODE_PREFIX}" --strip-components=1
  rm -f "${tmp}"
  sudo chown -R "$(id -u):$(id -g)" "${NODE_PREFIX}"
  for bin in node npm npx corepack; do
    sudo ln -sfn "${NODE_PREFIX}/bin/${bin}" "/usr/local/bin/${bin}"
  done
}

install_node

if ! java -version >/dev/null 2>&1; then
  echo "Installing OpenJDK 21..."
  sudo apt-get update
  sudo apt-get install -y --no-install-recommends openjdk-21-jdk-headless ca-certificates
fi

if [[ ! -x /usr/lib/jvm/java-21-openjdk-amd64/bin/java ]]; then
  echo "ERROR: Java 21 not found at /usr/lib/jvm/java-21-openjdk-amd64" >&2
  exit 1
fi

sudo tee /etc/profile.d/zz-mysl8te-dev.sh >/dev/null <<EOF
export PATH="${NODE_PREFIX}/bin:\${PATH}"
export GHIDRA_INSTALL_DIR="${ROOT}/ghidra_12.1.4_PUBLIC"
export JAVA_HOME="/usr/lib/jvm/java-21-openjdk-amd64"
EOF
sudo rm -f /etc/profile.d/mysl8te-dev.sh

# Login shells source ~/.bashrc after /etc/profile.d. Keep Node 24 ahead of nvm.
bashrc="${HOME}/.bashrc"
path_line="export PATH=\"${NODE_PREFIX}/bin:\$PATH\""
if [[ -f "${bashrc}" ]] && ! grep -qxF "${path_line}" "${bashrc}"; then
  printf '\n%s\n' "${path_line}" >> "${bashrc}"
fi

# npm 11 blocks dependency install scripts unless they are approved.
# Configure this outside the workspace; npm config rejects workspace roots.
(
  cd /tmp
  npm config set allow-scripts=esbuild,frida --location=user
)

export GHIDRA_INSTALL_DIR="${ROOT}/ghidra_12.1.4_PUBLIC"
export JAVA_HOME="/usr/lib/jvm/java-21-openjdk-amd64"

if [[ ! -x "${GHIDRA_INSTALL_DIR}/support/analyzeHeadless" ]]; then
  echo "ERROR: Ghidra missing at ${GHIDRA_INSTALL_DIR}" >&2
  exit 1
fi

echo "Installing workspace dependencies..."
cd "${ROOT}"
npm ci

echo "Installing Playwright Chromium..."
cd "${ROOT}/frontend"
npx playwright install --with-deps chromium

echo "Installing REA ${REA_VERSION}..."
if [[ "$(rea --version 2>/dev/null || true)" != "${REA_VERSION}" ]]; then
  npm install --global "rea-agents@${REA_VERSION}"
fi

hash -r
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "REA: $(rea --version)"
echo "Java: $(java -version 2>&1 | head -1)"
echo "Ghidra: ${GHIDRA_INSTALL_DIR}"
echo "Playwright: $(cd "${ROOT}/frontend" && npx playwright --version)"
