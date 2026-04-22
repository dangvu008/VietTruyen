# Universal Agent Brief

Tai lieu nay dong goi mot lop "briefing" de dung AI agent an toan hon trong moi du an, dac biet cho Antigravity va Codex.

## Muc tieu

Thay vi viet prompt kieu:

```text
fix this project
```

hay dung brief co hop dong ro:

```text
Objective:
Fix login validation in the auth UI.

Allowed Scope:
- src/auth/*
- related tests only

Do Not Touch:
- package.json
- DB schema
- deployment config

Stop And Ask Before:
- adding dependencies
- deleting files
- changing DB schema

Done When:
- invalid email is blocked
- empty password is blocked
- valid input still submits

Verification:
- run the smallest relevant test command
```

## Tai sao no portable

- Khong khoa cung vao stack cu the
- Luon bat dau bang viec doc repo hien tai
- Scope theo file/thu muc neu biet, theo module neu chua biet
- Tach phan chung va phan overlay rieng cho tung tool

## Thanh phan da them vao repo nay

- `AGENTS.md`: huong dan chung cho coding agents
- `.agent/skills/universal-agent-brief/`: skill cho Antigravity
- `.agent/workflows/agent-brief.md`: slash workflow de tao brief

## Cach dung voi Codex

1. Mo `AGENTS.md` de agent co contract chung.
2. Neu can, copy brief tu template va dien theo task.
3. Neu task lon, tach thanh nhieu brief nho theo giai doan.

## Cach dung voi Antigravity

1. Dung workflow `/agent-brief <task>`.
2. Neu task lon hoac nhieu domain, chuyen sang `/plan` hoac `/orchestrate`.
3. Giu nguyen `Allowed Scope`, `Do Not Touch`, `Stop And Ask Before`, `Done When`.

## Cai sang du an khac

Dung script:

```bash
./scripts/install-universal-agent-brief.sh /path/to/another-project
```

Neu muon ghi de file da ton tai:

```bash
./scripts/install-universal-agent-brief.sh --force /path/to/another-project
```

## Ghi chu

Neu repo dich da co `AGENTS.md` hoac `.agent` rieng, uu tien merge co chu y thay vi ghi de mu quang.
