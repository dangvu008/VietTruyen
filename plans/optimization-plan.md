# VietTruyen — Optimization Plan

> Date: 2026-04-04 (revised 2026-05-13 after adversary review)
> Scope: Frontend architecture, bundle boundaries, state ownership, AI integration consistency, quality gates
> Risk Level: Medium
> Strategy: Audit what is already in place, then complete the remaining bottlenecks
> Revision note: prior "first implementation slice" has been largely landed in the repo. This document is now an *audit and completion* plan, not a from-scratch roadmap. See §0 *Status as of 2026-05-13*.

---

## 0. Status as of 2026-05-13 (Adversary Review Outcome)

The original plan assumed a blank slate. Repo inspection shows several first-slice items have already shipped. Re-running them would create duplicate registries or break code that callers now depend on.

### Already landed (do NOT redo)

| Item | Evidence |
|---|---|
| Lazy-loaded overlays (`AiAssistant`, `AiActivityOverlay`, `NotificationCenter`, `MemoryBootstrap`) | `src/App.tsx:17-22` |
| Dual-shell page registries (`global_page_registry.tsx`, `project_page_registry.tsx`) | `src/App.tsx:44-45`, `src/app/global_page_registry.tsx`, `src/app/project_page_registry.tsx` |
| Selectors module (`selectActiveProject`, `selectProjectActions`, `selectProjectMeta`) | `src/store/selectors.ts:1-65`, `src/App.tsx:39` |
| `shallow` comparator wrappers on root subscriptions | `src/App.tsx:84-95, 104-110, 114-121, 125-126, 129-136` |
| `MemoryBootstrap` syncKey using `updatedAt + chapterCount + latestChapterUpdatedAt` | `src/components/system/MemoryBootstrap.tsx:10-21` |
| `manualChunks` in `vite.config.ts` | `vite.config.ts:37` |
| 4-mode AI runtime model in code (`local_proxy | edge_proxy | direct_provider | disabled`) | `src/lib/ai/ai_runtime_mode.ts:1` |
| Legacy `render_active_page.tsx` is still present alongside the new registries | `src/app/render_active_page.tsx` |

### Still open (this plan covers)

1. `selectProjectMeta` exposes the full `projects` array at the root — every chapter edit re-renders App. (ADV-002)
2. `direct_provider` mode is implemented but the runtime/security policy around `apiKeys` and env-direct keys is unsettled. (ADV-003)
3. Three coexisting page-routing surfaces with no canonical/compat/dead classification. (ADV-004)
4. `normalizeProject` is called in 20+ sites. The risk is the *rehydrate map* and any per-update array map, not the new-object factories. (ADV-005)
5. `MemoryBootstrap` syncKey still tracks `updatedAt`, which may drift from real content changes. (ADV-006)
6. `vitest` scope collects `.tmp-impeccable` files → no trustworthy gate for Waves 1–4. (ADV-007)
7. No bundle baseline / chunk budget is recorded. (ADV-008)

---

## Objective

Stabilize the current architecture so VietTruyen can scale in three directions without accumulating structural debt:

- more pages and workflows
- larger projects with many chapters
- a cleaner AI execution model across guest, local proxy, direct provider, and authenticated cloud usage

This plan is intentionally biased toward **architecture and execution flow**, not cosmetic refactors.

---

## Current State

- Stack: React 18 + TypeScript + Vite + Zustand + Dexie + Supabase + Tauri
- App shell: state-based routing in `src/App.tsx`, dual-shell (`GlobalShell` + `ProjectWorkspace`)
- Main bottlenecks observed in repo analysis:
  - `useProjectStore()` is subscribed at the root via `selectProjectMeta`, which returns the full `projects` array — selectors are present but the slice is too wide
  - `use_project_store.ts` normalizes the entire `state.projects` array during rehydrate; some array updates may also normalize untouched entries
  - `MemoryBootstrap` reacts to `updatedAt`, which can drift from actual content changes
  - AI architecture is in transition: proxy-first in infrastructure, `direct_provider` and `apiKeys` still active in UI/store
  - navigation logic is fragmented across `render_active_page.tsx` (legacy), `global_page_registry.tsx`, and `project_page_registry.tsx`
  - several domain concepts exist in both `src/core` and `src/lib/memory`
- Build status:
  - `npm run build` passes
  - build output still reports large chunks (main ~875 kB, heavy doc/PDF chunks) — but no baseline file checked in
- Test status:
  - app-scope tests pass
  - full `vitest` run fails because it also collects `.tmp-impeccable` test files outside the app scope

---

## Guardrails

### Allowed Scope

- `src/App.tsx`
- `src/app/*`
- `src/components/system/*`
- `src/components/layout/*`
- `src/store/*`
- `src/lib/ai/*`
- `src/lib/memory/*`
- `src/core/*` only where boundary cleanup is required
- `vite.config.ts`
- `tsconfig.json`
- `vitest.config.ts` (or equivalent test config)
- `plans/*`

### Do Not Touch

- `package.json` dependencies unless a separate decision is made
- Supabase schema and remote infrastructure
- Tauri packaging and CI config
- product feature scope

### Stop And Ask Before

- adding dependencies
- changing Supabase contracts
- removing files outright instead of consolidating them
- changing Tauri security or deployment settings
- removing `direct_provider` runtime or `apiKeys` storage (see Wave 3 decision gate)
- removing `render_active_page.tsx` or any other legacy surface (see Wave 4)

---

## Priorities

| Priority | Theme | Why Now |
|----------|-------|---------|
| P0 | Test scope fix (`vitest`) | Without it, no later wave has a trustworthy gate |
| P0 | Root subscription slice | Real cause of root re-renders; selector pass alone did not fix it |
| P0 | Store rehydrate normalization | Concrete CPU hit; narrow surgical fix |
| P0 | Memory sync key correctness | Fixes false-negative / false-positive memory rebuilds |
| P1 | AI architecture convergence + `direct_provider` decision | Trust boundary; cannot leak across modes |
| P1 | Navigation surface classification | Three coexisting registries must be labeled before refactor |
| P2 | Bundle budget & chunk tuning | Needs baseline checked in before tightening |
| P2 | Stricter contracts (`any` purge, compiler strictness) | Maintenance, not a runtime bug |

---

## Wave 0: Quality Gate Prerequisite *(NEW — pulled from old Wave 5)*

### Problem

`vitest` collects `.tmp-impeccable/**` and other non-app files, so `npm run test:run` fails. Waves 1–4 list `npm run test:run` as verification but cannot trust the result today.

### Scope

- `vite.config.ts` (or `vitest.config.ts` if split)
- no source changes

### Changes

1. Add `test.include` / `test.exclude` patterns in vitest config so only `src/**/*.test.{ts,tsx}` and `tests/**/*.test.{ts,tsx}` are collected.
2. Explicitly exclude `.tmp-*`, `node_modules`, `dist`, `e2e/**`.
3. Verify with: `npm run test:run` exits 0 and reports the expected suite count.

### Done When

- `npm run test:run` is a green, repeatable gate for every later wave.

### Verification

- `npm run test:run`
- check CI snapshot — test count should match `find src tests -name "*.test.*" | wc -l`.

### Risk

- Very low. If a needed test was located in an excluded folder, it will surface as a missing assertion in CI within a day. Mitigate by `git grep "describe(" .tmp-impeccable` first to confirm none of those tests are load-bearing.

---

## Wave 1: App Shell Audit & Slice Tightening *(REVISED)*

### Problem

The prior "Wave 1 first slice" (lazy pages + selectors + manualChunks + MemoryBootstrap key) has already landed. However, the root still re-renders on every chapter edit because `selectProjectMeta` returns the full `projects: Project[]` array — `shallow` does not help when the array reference changes.

Adversary attack: edit any chapter → `state.projects` rebuild → `selectProjectMeta` returns a new `{projects, activeProjectId}` → `App` re-renders even while user is deep in Project Workspace.

### Scope

- `src/store/selectors.ts`
- `src/App.tsx` (subscription sites)
- `src/components/layout/GlobalShell.tsx` (where the project list is actually consumed)
- `src/components/layout/ProjectWorkspace.tsx`

### Changes

1. Define a new lightweight selector `selectProjectListMeta` that returns a stable-shaped array of `{ id, title, updatedAt, hasChapters }` projections, NOT the full project objects. Cache with `useShallow` or a memoized computed.
2. Keep `selectActiveProject` as-is — it correctly returns one project.
3. Replace `useProjectStore(selectProjectMeta, shallow)` in `App.tsx:125` with the new metadata selector.
4. Move the full `projects` array subscription down into `GlobalShell` (dashboard/projects pages) where it is actually read. `App.tsx` should not subscribe to `projects` at all.
5. Audit other root-level full-store subscriptions:
   - `useAiStore` at `App.tsx:129` reads `apiKeys` — feeds into `hasDirectApiKey`. Keep, but see Wave 3.
   - `useAppSessionStore` at `App.tsx:84-95` is already narrow.

### Done When

- editing a chapter inside Project Workspace does NOT trigger a render of `App` (verified via React DevTools profiler or `whyDidYouRender`)
- root no longer touches the full `projects` array
- `selectProjectMeta` either disappears or is renamed to make its full-array semantics explicit (e.g. `selectAllProjects`), preventing future misuse

### Verification

- `npm run build`
- `npm run test:run` (gated by Wave 0)
- React DevTools profiler: edit a chapter in writer → confirm App.tsx render count does not increment

### Risk

- `GlobalShell` / `ProjectsPage` must continue receiving the full array. Confirm prop drilling vs in-component subscription before moving the boundary.

---

## Wave 2: Store Normalization & Memory Sync Stabilization *(REVISED — narrowed)*

### Problem

`normalizeProject` is called from 20+ sites in `use_project_store.ts`. Most of them are correct — they normalize *new* or *copied* objects (createProject:1168, duplicateProject:1219, adaptProject:2225, makeLocalCopy, cloud-bound paths). The actual waste:

- `state.projects.map((project) => normalizeProject(project))` at line 2317 (Zustand `onRehydrateStorage`) walks every project at boot.
- Any `updateProjectArray`-style loop that re-runs `normalizeProject` on untouched entries when only one project changed.

`MemoryBootstrap` syncKey at `MemoryBootstrap.tsx:20` is better than object identity but still tracks `updatedAt` — content-only edits that bypass `updatedAt` cause stale memory, metadata edits that bump `updatedAt` cause spurious rebuilds.

### Scope

- `src/store/use_project_store.ts`
- `src/components/system/MemoryBootstrap.tsx`
- `src/lib/memory/memory_sync_bridge.ts` (consumer)

### Changes

1. **Keep** `normalizeProject` on factories — `createProject` (1168), `duplicateProject` (1219), `adaptProject` (2225), and similar new-object paths. These produce data that must be canonical; removing normalization here risks downstream contract drift. Document this intent inline.
2. **Audit** every array-map call site that normalizes more than the changed project:
   - `state.projects = state.projects.map((project) => normalizeProject(project))` at line 2317 — change to: normalize only on schema-version mismatch, otherwise pass through.
   - Any `updateProjectArray` helper that maps the full array — make it return the input reference if no entry changed.
3. **Add an explicit canonical factory** (`makeCanonicalProject(input: Partial<Project>): Project`) so the call sites in §1 are obviously safe to keep.
4. **Strengthen `MemoryBootstrap` syncKey**:
   - Replace `${project.updatedAt}` dependency with `${project.contentSignature}` derived from a stable hash of chapter ids + chapter `updatedAt` + chapter `contentLength` (or `contentHash` if cheap).
   - Define "meaningful memory change" explicitly:
     - chapter added/removed/reordered
     - chapter `content` changed (length, hash)
     - character/world facts changed (separate sub-key)
   - Metadata-only edits (title, theme, color) must NOT trigger memory rebuild.
5. Selectors stay; subscriptions outside the root remain in feature components.

### Done When

- `state.projects` reference is stable when an unrelated project is not edited
- chapter edit triggers exactly one memory sync; metadata-only edit triggers zero
- canonical factory has a unit test asserting all required fields are present

### Verification

- `npm run test:run`
- unit test: edit chapter A's content → `memory_sync_bridge` is called once with project A; project B sync key unchanged
- unit test: edit project title only → memory sync NOT triggered

### Risk

- Memory sync regressions are silent. Add a debug trace `[MemoryBootstrap] sync triggered: reason=X` to make this observable.
- Content signature must be cheap. If chapter content is large, hash chapter `updatedAt + length` and avoid touching content body in the syncKey path.

---

## Wave 3: AI Architecture Convergence *(REVISED — direct_provider decision required)*

### Problem

`ai_runtime_mode.ts` already supports four modes (`local_proxy | edge_proxy | direct_provider | disabled`). Guests with a direct API key still resolve to `direct_provider` — frontend holds the key, which is a different trust boundary than edge-proxy auth. The plan must explicitly decide what to do with `direct_provider` and `apiKeys` storage; otherwise the convergence work will leave the legacy path partially wired and partially deprecated.

### Decision Gate (BLOCKING before any code change)

Pick one of:

- **Option A — Keep `direct_provider` as dev-only.** Behind `import.meta.env.DEV` flag. Production builds resolve `hasDirectApiKey=false` regardless of env or stored keys. Risk: dev parity divergence.
- **Option B — Keep `direct_provider` for guests permanently.** Document the trust boundary, ensure guest direct calls never see authenticated user data, add a banner "API key stored locally".
- **Option C — Remove `direct_provider`.** Deprecate over one release: warn in console, then strip code. Requires UI migration so guest with key falls back to local_proxy + onboarding.

> Recommendation: **B with explicit guard rails** — guest convenience matters; the security boundary is honest if labeled.

### Scope (after decision)

- `src/lib/ai/ai_runtime_mode.ts`
- `src/lib/ai/ai_client.ts`
- `src/lib/ai/tracked_ai_client.ts`
- `src/lib/ai/streaming_ai_client.ts`
- `src/store/use_ai_store.ts`
- `src/App.tsx:129-153` (`apiKeys`, `hasDirectApiKey`, `aiRuntimeMode`)
- `src/components/pages/AiSettingsPage.tsx`
- `src/components/shared/AiConnectionDebugPanel.tsx`

### Changes

1. **Single readiness helper.** Replace ad-hoc `apiKeys.gemini`-style checks with `isAiRuntimeReady(mode)` everywhere. Audit grep results in §Scope above must show zero direct `apiKeys.xxx` truthy checks outside `resolveAiRuntimeMode`'s input computation.
2. **Define mode-to-capability matrix** in code (one map, exported), so UI doesn't infer capability from mode strings.
3. **Apply the decision** from the gate above to `resolveAiRuntimeMode` and the corresponding UI surfaces.
4. **Guest mode behavior matrix**, documented inline:
   - guest + local proxy on → `local_proxy`
   - guest + direct key (env or stored) → `direct_provider` (or `disabled` per decision)
   - guest + nothing → `disabled`
   - authenticated → `edge_proxy` (unless local proxy is explicitly on)
5. **Migration of stored `apiKeys`**: if decision is C, write a one-time migration in `use_ai_store` to clear stored keys after warning; if A or B, keep as-is but stop using as a readiness signal.

### Done When

- AI entry points do not rely on `apiKeys.gemini` as the readiness source
- `resolveAiRuntimeMode` has tests covering all 4 modes × 3 auth states
- the chosen `direct_provider` policy is implemented and documented in `AGENTS.md` / `DESIGN.md`

### Verification

- `npm run test:run` (covers `ai_runtime_mode.test.ts` + new cases)
- manual checks in three modes:
  - guest + local proxy off + no key
  - guest + local proxy on
  - authenticated + edge proxy
  - guest + direct key (only if decision is A or B)
- targeted smoke test of writer/assistant flow per mode

### Risk

- Removing `apiKeys` readiness without migration breaks active sessions. Keep `apiKeys` storage for 1 release, only swap the *readiness signal*.

---

## Wave 4: Navigation & Domain Boundary Cleanup *(REVISED — classify before refactor)*

### Problem

Three routing surfaces coexist:

- `src/app/render_active_page.tsx` — legacy, still contains studio/brainstorm/memory/analytics cases
- `src/app/global_page_registry.tsx` — new global shell registry
- `src/app/project_page_registry.tsx` — new project shell registry

`TopMenu.tsx` and `EtherealLayout.tsx` also redefine navigation groups. Without classifying which surface is canonical, refactor risks removing live code or keeping dead code.

### Wave 4a: Surface Classification *(BLOCKING for 4b)*

Produce a written matrix (committed to `plans/navigation-surface-audit.md` or as a section in this file) classifying every routing/menu surface as one of:

- **Canonical** — the new source of truth, all new work targets this
- **Compatibility** — still used by some path; will be migrated
- **Dead** — no live caller; can be removed in 4c

Files to classify at minimum:

- `src/app/render_active_page.tsx`
- `src/app/global_page_registry.tsx`
- `src/app/project_page_registry.tsx`
- `src/components/layout/TopMenu.tsx`
- `src/components/layout/EtherealLayout.tsx`
- `src/components/layout/GlobalSidebar.tsx`
- `src/types/navigation.ts`

For each "Compatibility" entry, name the caller and the migration target.

### Wave 4b: Consolidation *(after 4a)*

1. Choose one source of truth for navigation metadata (likely `src/types/navigation.ts` + the dual registries).
2. Migrate `TopMenu` and `EtherealLayout` to consume that source instead of redefining groups locally.
3. Migrate or remove "Compatibility" surfaces one by one.
4. Audit duplicated domain modules across `src/core` and `src/lib/memory` (`memory_extractor`, `scene_chunker`, `debt_tracker`, `chapter_summary_generator`). Decide per pair:
   - keep one implementation and migrate callers
   - or keep both with explicit naming and ownership if they truly serve different layers
5. Update `AGENTS.md` / `DESIGN.md` to reflect canonical ownership.

### Wave 4c: Dead Code Removal *(after 4b)*

Delete "Dead" surfaces from 4a. Each deletion is a separate commit with `git grep` evidence in the message.

### Done When

- one navigation metadata source defined and consumed everywhere
- no Compatibility entries remain in the surface matrix
- `render_active_page.tsx` is either kept as canonical (and the new registries fold into it) or removed
- a new contributor can identify the source of truth for navigation and memory concepts quickly

### Verification

- `npm run build`
- `npm run test:run`
- `git grep` checks for old import paths return zero
- manual navigation smoke test on desktop layout, covering all tabs from `TAB_IDS` in `render_active_page.tsx:29`

### Risk

- Removing a "Dead" surface that is loaded dynamically (string-key lookup) would be silent. Mitigate by grepping for the tab id literal across the whole repo before deletion.

---

## Wave 5: Stricter Contracts *(was Wave 5; quality gate moved to Wave 0)*

### Problem

`any` is still common; `tsconfig` allows unused locals/parameters.

### Scope

- `tsconfig.json`
- affected files with low-risk typing fixes

### Changes

1. Reduce the easiest `any` usages first:
   - app shell placeholders
   - assistant/session stores
   - retcon store boundaries
   - smart input/result handlers
2. Enable stricter compiler rules in stages:
   - start with `noUnusedLocals`
   - then `noUnusedParameters`
3. Do not attempt a full `any` purge in one pass.

### Done When

- strictness increases without destabilizing active flows
- the worst low-signal `any` usages are removed

### Verification

- `npm run test:run`
- `npm run build`

---

## Build-Specific Improvements *(REVISED — baseline first)*

`manualChunks` already exists in `vite.config.ts:37`. This wave needs a measurable target before touching more chunk config.

### Pre-work: Baseline Snapshot *(BLOCKING for any chunk change)*

1. Run `npm run build` and capture the chunk size report to `plans/baseline/build-2026-05-13.txt`.
2. Note in this plan: current `main` chunk size, current `pdf.worker` size, current count of warnings.
3. Set explicit targets:

| Metric | Baseline (fill in) | Target |
|---|---|---|
| `main` (initial) chunk | TBD (~875 kB?) | ≤ 400 kB gzipped |
| `pdf.worker` chunk | TBD | isolated, not in initial |
| Build warning count | TBD | reduce by ≥ 50% or document each remaining |
| Static/dynamic mixed-import warnings | TBD | 0 |

### Targeted Changes (after baseline)

- review and refine `manualChunks` rules; isolate `supabase_client.ts` to one import mode
- isolate heavy document/PDF code paths from the entry chunk
- avoid mixed static and dynamic import patterns for the same module unless intentional

### Success Criteria

- main application entry chunk hits the recorded target (verified by build output)
- vendor/document-related code is more cacheable
- build warnings are reduced as documented in the baseline file

---

## Suggested Execution Order *(REVISED)*

1. **Wave 0** — fix `vitest` scope (gates everything else)
2. **Wave 1** — root subscription slice tightening (the actual perf bottleneck)
3. **Wave 2** — narrow normalization + memory sync key
4. **Build baseline** snapshot + targeted chunk tuning
5. **Wave 3** — AI runtime convergence (after `direct_provider` decision)
6. **Wave 4a** — navigation surface classification (writing only)
7. **Wave 4b/4c** — consolidation + dead code removal
8. **Wave 5** — typing & compiler strictness

This order prioritizes a trustworthy test gate, then runtime impact, then correctness, then maintainability.

---

## Success Metrics

| Metric | Current Direction | Target |
|--------|-------------------|--------|
| Root component re-render on chapter edit | Still happens (ADV-002) | Zero re-render of App outside route switch |
| Initial bundle cost | High, baseline TBD | Recorded baseline + ≥ 50% main chunk reduction |
| Normalization CPU on update | High at rehydrate | Normalize only changed or new projects |
| Memory sync churn | Updates on `updatedAt` | Triggers on content signature only |
| AI readiness logic | 4 modes implemented, policy unclear | Documented policy + single readiness helper |
| Navigation ownership | 3 coexisting surfaces | One canonical, others gone or labeled |
| Test reliability | Polluted by `.tmp-impeccable` | App-only suite, green on every wave |

---

## Out of Scope for This Plan

- React Router migration
- dependency changes
- Supabase schema redesign
- Tauri security hardening
- feature redesign of writing/adaptation/community flows
- storage layer / sync remediation — see `plans/storage-remediation.md`

---

## Decision Points (must answer before starting)

- [ ] **D-Wave3:** `direct_provider` policy — A (dev-only), B (guest permanent), or C (deprecate)?
- [ ] **D-Wave4:** canonical navigation source — keep `render_active_page.tsx` or fold into dual registries?
- [ ] **D-Memory:** content signature strategy — `chapter.updatedAt + length` (cheap) vs explicit hash (precise but more CPU)?
- [ ] **D-Bundle:** target for main chunk after Wave 1 + chunk tuning (suggest ≤ 400 kB gzipped)?
- [ ] **D-Wave5:** how aggressive on `any` purge — soft (low-signal sites only) or hard (whole-codebase)?

---

## Changelog

- 2026-04-04 — initial plan
- 2026-05-13 — revised after adversary review (ADV-001 through ADV-008):
  - added §0 Status section listing what already shipped
  - added Wave 0 (vitest scope) as blocking prerequisite
  - rewrote Wave 1 to fix `selectProjectMeta` full-array problem (ADV-002)
  - narrowed Wave 2 normalization removal to rehydrate + array-map sites (ADV-005)
  - tightened Wave 2 memory sync key criteria (ADV-006)
  - rewrote Wave 3 with explicit `direct_provider` decision gate (ADV-003)
  - split Wave 4 into 4a (classify), 4b (consolidate), 4c (remove) (ADV-004)
  - added baseline-snapshot pre-work before any chunk tuning (ADV-008)
  - moved test-scope fix from Wave 5 to Wave 0 (ADV-007)
  - removed obsolete "Recommended First Implementation Slice" (now stale per ADV-001)
