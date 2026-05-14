#!/usr/bin/env bash
# File: run_9router_dev.sh
# Purpose: Start the 9router local OpenAI-compatible proxy for development.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${NINE_ROUTER_PORT:-20128}"
HOST="${NINE_ROUTER_HOST:-0.0.0.0}"

if [ -f "$ROOT_DIR/9router/package.json" ]; then
  cd "$ROOT_DIR/9router"
  exec npm run dev
fi

if command -v 9router >/dev/null 2>&1; then
  CLI_PATH="$(command -v 9router)"
  CLI_REAL_PATH="$(node -e "console.log(require('fs').realpathSync(process.argv[1]))" "$CLI_PATH")"
  GLOBAL_SERVER_PATH="$(dirname "$CLI_REAL_PATH")/app/server.js"

  if [ -f "$GLOBAL_SERVER_PATH" ]; then
    echo "Starting global 9router server at http://$HOST:$PORT"
    PORT="$PORT" HOSTNAME="$HOST" exec node "$GLOBAL_SERVER_PATH"
  fi

  exec 9router --port "$PORT" --host "$HOST" --no-browser --tray --skip-update
fi

echo "9router is not available. Add 9router/package.json or install the 9router CLI." >&2
exit 1
