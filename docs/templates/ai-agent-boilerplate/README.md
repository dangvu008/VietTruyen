# THE ORCHESTRA Boilerplate

Template nay dong goi bo khung van hanh THE ORCHESTRA de ban copy sang du an moi.

## Thanh phan

- `docs/BOARD.md`: kanban cho backlog, in-progress, done
- `docs/DESIGN.md`: tai lieu thiet ke va Gherkin
- `CLAUDE.md`: luat cho execute coder
- `.antigravity_rules`: luat cho planner / architect
- `watcher.sh`: script gac cong doc `.ready_for_claude`

## Cach dung

```bash
cp -R docs/templates/ai-agent-boilerplate /path/to/new-project
cd /path/to/new-project/ai-agent-boilerplate
chmod +x watcher.sh
./watcher.sh
```
