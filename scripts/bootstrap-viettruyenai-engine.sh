#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE_DIR="$ROOT/.engine/VietTruyenAI"
REPO_URL="https://github.com/dangvu008/VietTruyenAI.git"

mkdir -p "$ROOT/.engine"

if [ ! -d "$ENGINE_DIR/.git" ]; then
  git clone "$REPO_URL" "$ENGINE_DIR"
else
  git -C "$ENGINE_DIR" fetch origin
  git -C "$ENGINE_DIR" checkout main
  git -C "$ENGINE_DIR" pull --ff-only origin main
fi

echo "VietTruyenAI engine ready at: $ENGINE_DIR"
echo "Story data remains in this repository."
