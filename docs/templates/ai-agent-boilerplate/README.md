# AI Agent Boilerplate

Minimal handoff template for agent-driven projects.

## Files

- `docs/BOARD.md`: backlog and active task list
- `docs/DESIGN.md`: implementation and test design
- `CLAUDE.md`: executor rules
- `watcher.sh`: optional trigger loop

## Usage

```bash
cp -R docs/templates/ai-agent-boilerplate /path/to/new-project
cd /path/to/new-project/ai-agent-boilerplate
chmod +x watcher.sh
./watcher.sh
```

## Prompt Rule

Use concise English-first prompts. See `docs/PROMPT_STANDARD.md` in the main repo for the canonical format.
