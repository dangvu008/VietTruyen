# Phase 2: Editor Safety Net (Undo/Redo + AI Stream Buffer)

> **Priority:** P0 | **Est:** ~350 LOC | **Session:** Single
> **Goal:** Prevent content loss from accidental edits and AI stream interruptions

## Data Flow

```
[Undo/Redo]
  Editor textarea onChange → snapshot current → push to undoStack (ring buffer, max 50)
  Ctrl+Z → pop undoStack → push to redoStack → restore content
  Ctrl+Shift+Z → pop redoStack → push to undoStack → restore content

[AI Stream Buffer]
  AI stream chunk arrives → append to streamBuffer (in-memory)
  Stream complete → commit to chapter content (normal flow)
  Stream interrupted → autosave_draft_store.saveDraft(streamBuffer) → recoverable
```

## Code Contracts

```typescript
// src/hooks/use_undo_redo.ts — NEW
interface UndoRedoState {
  undoStack: string[];    // ring buffer, max 50
  redoStack: string[];
  canUndo: boolean;
  canRedo: boolean;
}

function useUndoRedo(initialValue: string): {
  value: string;
  setValue: (v: string) => void;     // records snapshot before change
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  snapshot: () => void;              // manual snapshot (before large ops)
}

// src/lib/ai/stream_recovery.ts — NEW
interface StreamRecoveryBuffer {
  chapterId: string;
  partialContent: string;
  timestamp: number;
  promptHash: string;
}

function bufferStreamChunk(chapterId: string, chunk: string): void;
function getRecoveryBuffer(chapterId: string): StreamRecoveryBuffer | null;
function clearRecoveryBuffer(chapterId: string): void;
function hasRecoverableStream(): boolean;
```

## Tasks

### Wave 1 (foundations)

#### Task 2A: Create useUndoRedo hook
- **File:** `src/hooks/use_undo_redo.ts` — new
- **touches:** [src/hooks/use_undo_redo.ts]
- **provides:** [useUndoRedo hook]
- **requires:** []
- **Logic:** Ring buffer of 50 text snapshots. Debounce snapshots: only save if >500ms since last or >20 chars changed. Clear redoStack on new edit.
- **Edge case:** Very large chapter (~50KB) × 50 snapshots = ~2.5MB → acceptable for in-memory

#### Task 2B: Create stream recovery buffer
- **File:** `src/lib/ai/stream_recovery.ts` — new
- **touches:** [src/lib/ai/stream_recovery.ts]
- **provides:** [bufferStreamChunk, getRecoveryBuffer, clearRecoveryBuffer]
- **requires:** []
- **Logic:** Write partial content to autosave_draft_store on each chunk. On stream complete, clear buffer. On next app load, check for orphaned buffers.

### Wave 2 (integration)

#### Task 2C: Integrate undo/redo into StoryWorkspace editor
- **File:** `src/components/story-editor/StoryWorkspace.tsx`
- **touches:** [src/components/story-editor/StoryWorkspace.tsx]
- **provides:** [Ctrl+Z/Ctrl+Shift+Z in chapter editor]
- **requires:** [useUndoRedo from Wave 1]
- **depends_on:** [task-2a]
- **Logic:** Wrap chapter content textarea with useUndoRedo. Add keyboard shortcut listeners. Show undo/redo buttons in toolbar.
- **Edge case:** Focus not in textarea → don't intercept Ctrl+Z globally

#### Task 2D: Wire stream buffer into AI generation pipeline
- **File:** `src/lib/ai/chapter_writer_ai.ts`
- **touches:** [src/lib/ai/chapter_writer_ai.ts, src/lib/ai/full_write_pipeline.ts]
- **provides:** [crash-safe AI generation]
- **requires:** [stream_recovery from Wave 1]
- **depends_on:** [task-2b]
- **Logic:** Before streaming, init buffer. On each chunk, call bufferStreamChunk. On complete, clearRecoveryBuffer. On error/abort, buffer persists for recovery.

### Wave 3 (recovery UI + tests)

#### Task 2E: Recovery prompt on app load
- **File:** `src/components/story-editor/StoryWorkspace.tsx`
- **touches:** [src/components/story-editor/StoryWorkspace.tsx]
- **provides:** [stream recovery UI prompt]
- **requires:** [Task 2D]
- **depends_on:** [task-2d]
- **Logic:** On mount, check hasRecoverableStream(). If yes, show banner: "Phát hiện nội dung AI chưa lưu. Khôi phục?" → append to chapter or discard.

#### Task 2F: Tests
- **File:** `src/hooks/use_undo_redo.test.ts` — new
- **touches:** [src/hooks/use_undo_redo.test.ts, src/lib/ai/stream_recovery.test.ts]
- **provides:** [regression tests]
- **requires:** [Task 2A, 2B]
- **depends_on:** [task-2a, task-2b]
- **Tests:** undo restores previous, redo restores after undo, stack overflow at 50, debounce works, stream buffer persists/clears correctly

## Failure Scenarios

| When | Then | Error Handling |
|------|------|----------------|
| Undo on empty stack | No-op, canUndo=false | Button disabled |
| 51st edit (overflow) | Drop oldest snapshot | Ring buffer eviction |
| Stream buffer corrupted | Discard, log warning | Try/catch with fallback |
| App crash during stream | Buffer in autosave_draft_store | Recovery prompt on next load |

## Rejection Criteria

- ❌ DO NOT use external undo library — keep zero-dep
- ❌ DO NOT store undo stack in localStorage — in-memory only
- ❌ DO NOT intercept Ctrl+Z globally — only when editor textarea focused
- ❌ DO NOT block main thread — debounce snapshots

## Cross-Phase Context

- **Assumes from Phase 1:** Export and Plot QA bugs fixed
- **Exports for Phase 3:** Undo/redo pattern can be reused for project deletion recovery
- **Exports for Phase 4:** Stream buffer integrates with offline detection

## Acceptance Criteria

- [ ] Ctrl+Z undoes last edit in chapter editor
- [ ] Ctrl+Shift+Z redoes undone edit
- [ ] AI stream interrupted → content recoverable on next app load
- [ ] All new tests pass: `npm test -- --run use_undo_redo stream_recovery`
- [ ] No memory leak: undo stack capped at 50 entries
