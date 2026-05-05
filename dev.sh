#!/usr/bin/env bash
# dev.sh — Khởi động song song tất cả dev servers
# VietTruyen :1420 | 9router :20128

set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDS=()

cleanup() {
  echo -e "\n${YELLOW}⏹  Dừng tất cả servers...${NC}"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null && echo -e "  ${RED}✗${NC} Stopped PID $pid"
  done
  exit 0
}
trap cleanup SIGINT SIGTERM

free_port() {
  local port=$1
  local pid
  pid=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo -e "${YELLOW}⚠  Port $port đang dùng (PID $pid) — đang kill...${NC}"
    kill -9 "$pid" 2>/dev/null || true
    sleep 0.5
  fi
}

start_server() {
  local name=$1
  local port=$2
  local dir=$3
  local cmd=$4
  local color=$5

  free_port "$port"

  echo -e "${color}▶ [$name] Khởi động tại :$port${NC}"
  (
    cd "$dir"
    eval "$cmd" 2>&1 | sed "s/^/$(printf "${color}[${name}]${NC} ")/"
  ) &
  local new_pid=$!
  PIDS+=("$new_pid")
  echo -e "${GREEN}  ✓ [$name] PID $new_pid${NC}"
}

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     VietTruyen Dev Stack Launcher    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# --- Server 1: VietTruyen main app (Vite) ---
start_server "VietTruyen" "1420" "$ROOT_DIR" "npm run dev:ui" "$GREEN"

# --- Server 2: 9router AI Gateway (Next.js) ---
start_server "9router" "20128" "$ROOT_DIR/9router" "npm run dev" "$BLUE"

echo ""
echo -e "${GREEN}✅ Tất cả servers đang chạy:${NC}"
echo -e "   ${GREEN}• VietTruyen${NC} → http://localhost:1420"
echo -e "   ${BLUE}• 9router   ${NC} → http://localhost:20128"
echo -e "\n${YELLOW}  Ctrl+C để dừng tất cả${NC}\n"

# Đợi tất cả process con
wait
