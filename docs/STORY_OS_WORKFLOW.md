# Story OS Workflow

## User command: “Viết tiếp 5 chương”

The user should not need to supply chapter numbers, context packs, or prior chat history.

### Resolution
1. Read root `story.yaml`.
2. Resolve active story.
3. Read story `manifest.yaml`.
4. If a mandatory milestone audit is due and lacks PASS receipt, run it first.
5. Resolve `latest_accepted_chapter`; next batch starts at `latest + 1`.
6. Retrieve hot canon/state plus relevant cold evidence.

### Write path
For every chapter:
`PREWRITE -> DRAFT -> REVIEW -> EDIT -> RE-REVIEW -> CANDIDATE -> TEMP_DELTA`

Temporary deltas may inform the next chapter in the same batch but MUST NOT mutate accepted state.

### Five-chapter gate
After five candidates:
- continuity
- causality
- timeline
- knowledge
- character trajectory
- power/inventory
- prose/style
- repetition
- arc progress
- mystery management
- graph consistency
- memory connectivity

If any MUST_FIX remains, patch only the affected chapter(s), then regression-review the entire batch.

### Acceptance
Only after all gates PASS:
- move chapter candidates to accepted prose;
- append accepted event log;
- update canon dynamic state;
- update knowledge layers;
- update relationship/story graph;
- update open threads;
- update arc fingerprint/reward history;
- write batch checkpoint;
- write audit receipt;
- update `manifest.yaml`.

Acceptance should be atomic at the batch level.

## User command: “Viết tiếp 10 chương”

Run the same workflow as:
`5 chapters -> mini-batch audit -> 5 chapters -> mini-batch audit -> full 10-chapter audit -> atomic accept`

## New chat behavior

A new Codex/chat session MUST recover from repo state, not conversation state. If repo says latest accepted is 505, “Viết tiếp 5 chương” means 506–510 regardless of what the model remembers.

## Milestone audit behavior

If Chapter 100 has been accepted but `audits/memory-0100.yaml` is absent or FAIL, Chapter 101 is blocked.

Same rule applies to required 500/1000 milestones.

## Output

Normal mode: show only reviewed final candidate chapters plus a concise:
- chapter range
- chapter review PASS/FAIL
- batch review PASS/FAIL
- memory audit PASS/FAIL
- commit/checkpoint status

Debug mode may expose draft/review/patch artifacts.
