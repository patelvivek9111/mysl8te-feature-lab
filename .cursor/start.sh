#!/usr/bin/env bash
# Boot the Feature Lab API and Vite app. Safe to run more than once.
set -euo pipefail

NODE_PREFIX="/usr/local/lib/nodejs"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export PATH="${NODE_PREFIX}/bin:${PATH}"
export GHIDRA_INSTALL_DIR="${ROOT}/ghidra_12.1.4_PUBLIC"
export JAVA_HOME="/usr/lib/jvm/java-21-openjdk-amd64"

sudo service postgresql start
until pg_isready -q; do sleep 1; done
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='ubuntu'" | grep -q 1 || sudo -u postgres createuser -s ubuntu
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='mysl8te_feature_lab'" | grep -q 1 || sudo -u postgres createdb -O ubuntu mysl8te_feature_lab
(cd "${ROOT}/backend" && npx prisma db push --skip-generate)

backend_up() { curl -sf "http://127.0.0.1:3001/api/health" | grep -q academic-review-lab; }
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
  start_session backend "${ROOT}/backend" "export NODE_ENV=development SEED_ON_BOOT=true; exec npm run dev"
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
