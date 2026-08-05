#!/usr/bin/env bash
# 无 Docker 时本地启动（SQLite + 前后端）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT/backend"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  . .venv/bin/activate
  pip install -r requirements.txt
else
  . .venv/bin/activate
fi

export DATABASE_URL="${DATABASE_URL:-sqlite:///./cso.db}"
export SECRET_KEY="${SECRET_KEY:-dev-local}"
uvicorn app.main:app --host 127.0.0.1 --port 8200 --reload &
BACK_PID=$!

cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then
  npm install --legacy-peer-deps
fi
export BACKEND_INTERNAL_URL=http://127.0.0.1:8200
npm run dev &
FRONT_PID=$!

trap 'kill $BACK_PID $FRONT_PID 2>/dev/null || true' EXIT
echo "后端 http://127.0.0.1:8200  前端 http://127.0.0.1:3200"
wait
