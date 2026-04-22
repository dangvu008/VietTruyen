#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/install-universal-agent-brief.sh [--force] <target-project>

Copies the universal agent briefing files into another project without
overwriting existing files unless --force is provided.
EOF
}

force=0

if [[ "${1:-}" == "--force" ]]; then
  force=1
  shift
fi

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

target="$1"
source_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$target"
target="$(cd "$target" && pwd)"

copy_file() {
  local src="$1"
  local dest="$2"

  if [[ -e "$dest" && "$force" -ne 1 ]]; then
    printf 'skip %s\n' "$dest"
    return
  fi

  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  printf 'write %s\n' "$dest"
}

copy_file "$source_root/AGENTS.md" "$target/AGENTS.md"
copy_file "$source_root/.agent/workflows/agent-brief.md" "$target/.agent/workflows/agent-brief.md"
copy_file "$source_root/.agent/skills/universal-agent-brief/SKILL.md" "$target/.agent/skills/universal-agent-brief/SKILL.md"
copy_file "$source_root/.agent/skills/universal-agent-brief/references/template.md" "$target/.agent/skills/universal-agent-brief/references/template.md"
copy_file "$source_root/.agent/skills/universal-agent-brief/references/codex.md" "$target/.agent/skills/universal-agent-brief/references/codex.md"
copy_file "$source_root/.agent/skills/universal-agent-brief/references/antigravity.md" "$target/.agent/skills/universal-agent-brief/references/antigravity.md"
copy_file "$source_root/docs/universal-agent-brief.md" "$target/docs/universal-agent-brief.md"

printf 'done\n'
