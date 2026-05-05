# Debug Knowledge Base

### 2026-04-26 — Uploaded story chapters show empty content after online hydration
- **Symptom**: Imported/uploaded projects can open the writer with "Content Load Issue" even when IndexedDB still has chapter content.
- **Root Cause**: `loadProjectWithFullChapters` trusted provider chapter rows whenever any rows existed. If Supabase/provider had metadata-only rows with `content: ""`, local IndexedDB payload was ignored.
- **Fix**: Detect provider metadata-only chapters, merge or fall back to IndexedDB payloads, and save provider project snapshots before replacing chapters for new uploaded/adapted projects.
- **Files**: `src/store/use_project_store.ts`, `src/store/use_project_store.test.ts`

### 2026-05-03 — Streaming chapter generation hangs or saves weak/incomplete chapter output
- **Symptom**: AI chapter generation can keep loading after provider/API trouble, keep weak titles like "Trống", or stop mid-paragraph without automatically continuing.
- **Root Cause**: The chapter writer streaming path did not share the tracked non-streaming model fallback behavior, and stream timeout/max-token endings were not surfaced as incomplete output for continuation.
- **Fix**: Treat partial stream timeout/output-limit stops as incomplete, retry recoverable streaming failures with another routed model, auto-continue incomplete writer responses before parsing, and resolve weak chapter titles through outline/existing chapter fallback.
- **Files**: `src/lib/ai/chapter_writer_ai.ts`, `src/lib/ai/streaming_ai_client.ts`, `src/lib/ai/chapter_writer_ai.test.ts`, `src/lib/ai/streaming_ai_client.test.ts`

### 2026-05-03 — Story editor "Tóm tắt truyện" returns retrieval traces
- **Symptom**: The Muse assistant can answer a broad story-summary request with "Dấu vết liên quan nhất..." and raw `[chapter summary]` retrieval snippets.
- **Root Cause**: `answerPlotQuestion` only treated longer phrases such as "tóm tắt toàn bộ truyện" as whole-story summaries, so short prompts like "Tóm tắt truyện" fell through to local memory retrieval first.
- **Fix**: Route broad story-summary/review phrases to the local whole-story summary path before memory retrieval and add regression coverage for "Tóm tắt truyện".
- **Files**: `src/lib/ai/plot_qa.ts`, `src/lib/ai/plot_qa.test.ts`
