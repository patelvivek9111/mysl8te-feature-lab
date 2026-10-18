#!/usr/bin/env bash
# Boot the Feature Lab API and Vite app. Safe to run more than once.
set -euo pipefail

NODE_PREFIX="/usr/local/lib/nodejs"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export PATH="${NODE_PREFIX}/bin:${PATH}"
export GHIDRA_INSTALL_DIR="${ROOT}/ghidra_12.1.4_PUBLIC"
export JAVA_HOME="/usr/lib/jvm/java-21-openjdk-amd64"

backend_up() { curl -sf "http://127.0.0.1:3001/api/health" >/dev/null; }
frontend_up() { curl -sf -o /dev/null "http://127.0.0.1:5173/"; }

start_session() {
  local name="$1"
  local dir="$2"
  local cmd="$3"
  if tmux has-session -t "${name}" 2>/dev/null; then
    tmux kill-session -t "${name}"
  fi
  tmux new-session -d -s "${name}" -c "${dir}" "export PATH=\"${NODE_PREFIX}/bin:\$PATH\"; ${cmd}"
}

if ! backend_up; then
  start_session backend "${ROOT}/backend" "export NODE_ENV=development ALLOW_TEST_RESET=true; exec npm run dev"
fi

if ! frontend_up; then
  start_session frontend "${ROOT}/frontend" "exec npm run dev -- --host 0.0.0.0 --port 5173"
fi

for _ in $(seq 1 60); do
  if backend_up && frontend_up; then
    echo "backend :3001 and frontend :5173 are ready"
    exit 0
  fi
  sleep 1
done

echo "dev servers did not become ready" >&2
tmux capture-pane -pt backend 2>/dev/null | tail -50 >&2 || true
tmux capture-pane -pt frontend 2>/dev/null | tail -50 >&2 || true
exit 1
