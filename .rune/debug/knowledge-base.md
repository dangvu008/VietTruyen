# Debug Knowledge Base

### 2026-04-26 — Uploaded story chapters show empty content after online hydration
- **Symptom**: Imported/uploaded projects can open the writer with "Content Load Issue" even when IndexedDB still has chapter content.
- **Root Cause**: `loadProjectWithFullChapters` trusted provider chapter rows whenever any rows existed. If Supabase/provider had metadata-only rows with `content: ""`, local IndexedDB payload was ignored.
- **Fix**: Detect provider metadata-only chapters, merge or fall back to IndexedDB payloads, and save provider project snapshots before replacing chapters for new uploaded/adapted projects.
- **Files**: `src/store/use_project_store.ts`, `src/store/use_project_store.test.ts`
