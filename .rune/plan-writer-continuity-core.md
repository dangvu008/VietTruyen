# Goal: Writer Continuity Core

## Overview
Xây một lõi viết truyện bền mạch cho VietTruyen bằng ba lớp nối nhau: `Chapter Context Capsule` làm dữ liệu ngữ cảnh, `Continuity Guard` làm máy phát hiện lệch mạch, và `Self-Reflection` làm vòng biên tập ẩn trong `writer`.

## Phases
| # | Name | Status | Plan File | Summary |
|---|------|--------|-----------|---------|
| 1 | Capsule Foundation | ⬚ Pending | plan-writer-continuity-core-phase1.md | Types, storage, chapter lifecycle hooks |
| 2 | Continuity Guard | ⬚ Pending | plan-writer-continuity-core-phase2.md | Review contracts, issue generation, UI surface |
| 3 | Reflection Pipeline | ⬚ Pending | plan-writer-continuity-core-phase3.md | Writer quality modes and self-review loop |

## Key Decisions
- Capsule là metadata cấp chapter, không thay chapter content và không thay `summary` ngắn hiện có.
- `Continuity Guard` chỉ cảnh báo, không tự sửa bản thảo.
- `Self-Reflection` là tuỳ chọn theo quality mode, không ép mọi lần viết AI phải chạy mode nặng nhất.

## Decision Compliance
- Decisions (locked): bám `writer`, `chapters`, `review`; không tạo top-level tab mới; project state ownership giữ ở `use_project_store`.
- Discretion (agent): dùng capsule làm nền cho cả guard lẫn reflection để tránh ba hệ rời nhau.
- Deferred: sync cloud cho capsule, user-editable capsule UI đầy đủ, batch re-index toàn thư viện truyện cũ.

## Architecture
- `writer` gọi workflow pipeline với quality mode.
- pipeline đọc project canon + capsule gần nhất.
- save chapter xong thì persist capsule.
- `review` đọc canon + outline + capsules để trả issue có severity/category.

## Dependencies
- `use_project_store` và Dexie chapter persistence: required
- `use_workflow_session_store` orchestration: required
- current review surface/types: partial, likely needs extension

## Risks
- Metadata drift giữa chapter content và capsule: cần regenerate rõ thời điểm save/AI write.
- Prompt cost tăng nếu reflection và guard cùng chạy: cần quality mode + selective context.
- UI review nhiễu nếu issue density quá cao: cần severity ranking và grouping theo category.
