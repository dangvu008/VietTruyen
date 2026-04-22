# VietTruyen — Optimization Plan

> Date: 2026-04-04
> Scope: Frontend architecture, bundle boundaries, state ownership, AI integration consistency, quality gates
> Risk Level: Medium
> Strategy: Fix scaling bottlenecks before adding more features

---

## Objective

Stabilize the current architecture so VietTruyen can scale in three directions without accumulating structural debt:

- more pages and workflows
- larger projects with many chapters
- a cleaner AI execution model across guest, local proxy, and authenticated cloud usage

This plan is intentionally biased toward **architecture and execution flow**, not cosmetic refactors.

---

## Current State

- Stack: React 18 + TypeScript + Vite + Zustand + Dexie + Supabase + Tauri
- App shell: state-based routing in `src/App.tsx`
- Main bottlenecks observed in repo analysis:
  - `src/App.tsx` eagerly imports almost every page and orchestrates too much UI state
  - `useProjectStore()` is subscribed wholesale in multiple components
  - `use_project_store.ts` normalizes untouched projects on every update
  - `MemoryBootstrap` sync depends on the `project` object reference, not a stable change key
  - AI architecture is in transition: proxy-first in infrastructure, legacy API-key assumptions still present in UI/store
  - navigation logic is duplicated across `TopMenu.tsx` and `EtherealLayout.tsx`
  - several domain concepts exist in both `src/core` and `src/lib/memory`
- Build status:
  - `npm run build` passes
  - build output still reports large chunks, including a main chunk around `875 kB` and heavy document/PDF chunks
- Test status:
  - app tests pass
  - full `vitest` run fails because it also collects `.tmp-impeccable` test files outside the app scope

---

## Guardrails

### Allowed Scope

- `src/App.tsx`
- `src/components/system/*`
- `src/components/layout/*`
- `src/store/*`
- `src/lib/ai/*`
- `src/lib/memory/*`
- `src/core/*` only where boundary cleanup is required
- `vite.config.ts`
- `tsconfig.json`
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

---

## Priorities

| Priority | Theme | Why Now |
|----------|-------|---------|
| P0 | App shell and render boundaries | This is the current scaling bottleneck |
| P0 | Store ownership and memory sync | Reduces redundant work on every project edit |
| P1 | AI architecture convergence | Current design drift will keep leaking into UI decisions |
| P1 | Navigation and module boundaries | Improves maintainability and lowers agent/human confusion |
| P2 | Quality gates and stricter contracts | Needed to keep future refactors safe |

---

## Wave 1: App Shell and Route Boundaries

### Problem

`src/App.tsx` currently acts as:

- route registry
- page loader
- layout coordinator
- auth gate
- active-project resolver
- AI trigger host

This concentrates too much responsibility in one file and causes the initial bundle to pull in pages that are not needed for first render.

### Scope

- `src/App.tsx`
- new route registry module under `src/app/` or `src/components/pages/`
- page loading fallback component if needed

### Changes

1. Convert page imports in `src/App.tsx` from eager imports to `React.lazy`.
2. Move page resolution into a dedicated registry, for example:
   - `src/app/page_registry.tsx`
   - `src/app/render_active_page.tsx`
3. Keep auth gating in `App.tsx`, but move page rendering concerns out.
4. Replace full `useProjectStore()` subscription in `App.tsx` with granular selectors.
5. Preserve the current state-based routing model for now; do not introduce React Router in this wave.

### Done When

- `App.tsx` no longer imports every page eagerly
- the root component only owns auth gate, top-level modals, and route state
- inactive pages are loaded on demand
- root no longer subscribes to the entire project store

### Verification

- `npm run build`
- confirm chunk splitting improved from current baseline
- open the app and navigate across at least: `dashboard`, `projects`, `writer`, `community`

---

## Wave 2: Project Store Ownership and Memory Sync

### Problem

`src/store/use_project_store.ts` is the largest store and currently mixes:

- aggregate CRUD
- normalization
- chapter persistence
- Dexie hydration
- adaptation flows

It also performs redundant normalization of untouched projects, and `MemoryBootstrap` reacts to object identity rather than meaningful content changes.

### Scope

- `src/store/use_project_store.ts`
- `src/store/selectors.ts` or equivalent shared selector module
- `src/components/system/MemoryBootstrap.tsx`
- components currently calling `useProjectStore()` without selectors

### Changes

1. Add shared selectors:
   - `selectActiveProject`
   - `selectProjectActions`
   - `selectProjectMeta`
2. Replace broad store subscriptions in current call sites with selectors.
3. Fix `updateProjectArray` so unchanged projects are returned as-is.
4. Remove unnecessary re-normalization in `createProject`, `duplicateProject`, and `adaptProject`.
5. Change `MemoryBootstrap` to depend on a stable sync key, for example:
   - `project.id`
   - `project.updatedAt`
   - chapter count
   - optional content hash or indexed version marker later
6. Keep the existing store file intact if needed for this wave; splitting into multiple stores is optional and should only happen after selector-based stabilization.

### Done When

- no known call site uses `useProjectStore()` as a full-store subscription unless justified
- project updates do not normalize unrelated projects
- memory sync only reruns on meaningful project changes

### Verification

- `npm run build`
- `npm run test:run` after test-scope fix in Wave 5, or run targeted tests first
- manual smoke test:
  - edit bible fields
  - edit characters
  - add or update chapters
  - confirm no obvious sync storm in console

---

## Wave 3: AI Architecture Convergence

### Problem

The repo currently signals two competing designs:

- infrastructure and client code say AI is proxy-first and server-managed
- UI and state still carry legacy API-key assumptions

This makes product behavior harder to reason about, especially for guest mode and AI availability checks.

### Scope

- `src/store/use_ai_store.ts`
- `src/lib/ai/ai_client.ts`
- `src/lib/ai/tracked_ai_client.ts`
- `src/App.tsx`
- AI settings and assistant entry points if required

### Changes

1. Define a single runtime model for AI availability:
   - `local_proxy`
   - `edge_proxy_authenticated`
   - `disabled`
2. Remove UI decisions that depend on legacy `apiKeys` fields.
3. Keep backward compatibility only where unavoidable; stop using deprecated fields as the primary readiness signal.
4. Move AI readiness checks behind a single helper or selector.
5. Document guest-mode behavior explicitly:
   - guest can use local proxy
   - guest cannot use edge proxy
   - unauthenticated cloud usage is blocked by design

### Done When

- AI entry points do not rely on `apiKeys.gemini` as the readiness source
- guest/authenticated behavior is predictable
- store, UI, and transport layers describe the same execution model

### Verification

- manual checks in three modes:
  - guest + local proxy off
  - guest + local proxy on
  - authenticated + edge proxy
- targeted smoke test of writer/assistant flow

---

## Wave 4: Navigation and Domain Boundary Cleanup

### Problem

Navigation intent and domain structure are currently harder to maintain than they should be:

- `TopMenu.tsx` and `EtherealLayout.tsx` both carry navigation structure
- similar concepts exist in both `src/core` and `src/lib/memory`

This is not a runtime bug by itself, but it increases design drift and slows future refactors.

### Scope

- `src/components/layout/TopMenu.tsx`
- `src/components/layout/EtherealLayout.tsx`
- duplicated domain modules in `src/core` and `src/lib/memory`
- supporting docs if necessary

### Changes

1. Choose one source of truth for navigation metadata.
2. Make layout consume shared nav config instead of redefining groups locally.
3. Audit duplicated concepts across:
   - `memory_extractor`
   - `scene_chunker`
   - `debt_tracker`
   - `chapter_summary_generator`
4. Decide per pair:
   - keep one implementation and migrate callers
   - or keep both with explicit naming and ownership if they truly serve different layers
5. Update docs where code ownership changes.

### Done When

- navigation structure is defined once
- duplicated domain modules are either consolidated or explicitly differentiated
- a new contributor can identify the source of truth for each major memory-related concept quickly

### Verification

- `npm run build`
- grep-level sanity checks for old import paths
- manual navigation smoke test on desktop layout

---

## Wave 5: Quality Gates and Contract Enforcement

### Problem

The codebase already has a strong design contract, but enforcement is weaker than the documentation:

- `vitest` scope is too broad
- `any` is still common in several files
- `tsconfig` still allows unused locals and parameters

### Scope

- `vite.config.ts`
- `tsconfig.json`
- affected files with low-risk typing fixes

### Changes

1. Restrict test collection so `vitest` only runs repo-owned test files.
2. Add explicit `include` or `exclude` patterns for `.tmp-*` and other non-app folders.
3. Reduce the easiest `any` usages first in:
   - app shell placeholders
   - assistant/session stores
   - retcon store boundaries
   - smart input/result handlers
4. Enable stricter compiler rules in stages:
   - start with `noUnusedLocals`
   - then `noUnusedParameters`
5. Do not attempt a full `any` purge in one pass.

### Done When

- `npm run test:run` reflects only this app's test scope
- strictness increases without destabilizing active flows
- the worst low-signal `any` usages are removed

### Verification

- `npm run test:run`
- `npm run build`

---

## Build-Specific Improvements

These can be executed during Wave 1 or immediately after it.

### Targeted Changes

- add `build.rollupOptions.output.manualChunks` in `vite.config.ts`
- isolate heavy document-related code paths where possible
- avoid mixed static and dynamic import patterns for the same module unless intentional

### Current Signals

- large main chunks remain
- `pdf.worker` is very large
- Vite warns that `supabase_client.ts` is both statically and dynamically imported

### Success Criteria

- main application entry chunk is materially smaller
- vendor/document-related code is more cacheable
- build warnings are reduced or understood and documented

---

## Suggested Execution Order

1. Wave 1: App shell and lazy boundaries
2. Wave 2: Store selectors, normalization fix, memory sync stabilization
3. Build-specific chunk tuning
4. Wave 3: AI architecture convergence
5. Wave 4: Navigation and domain-boundary cleanup
6. Wave 5: Quality gates and stricter contracts

This order keeps runtime impact first, then correctness, then maintainability.

---

## Success Metrics

| Metric | Current Direction | Target |
|--------|-------------------|--------|
| Root component complexity | Too high | `App.tsx` becomes orchestration-only |
| Initial bundle cost | High | pages load lazily |
| Redundant re-renders | High | selector-based subscriptions |
| Memory sync churn | High | stable sync trigger |
| AI readiness logic | Drifting | single explicit runtime model |
| Navigation ownership | Duplicated | one source of truth |
| Test reliability | Polluted by external files | app-only suite |

---

## Out of Scope for This Plan

- React Router migration
- dependency changes
- Supabase schema redesign
- Tauri security hardening
- feature redesign of writing/adaptation/community flows

---

## Recommended First Implementation Slice

If execution starts immediately, the best first slice is:

1. lazy-load pages in `src/App.tsx`
2. add `src/store/selectors.ts`
3. replace full-store subscription in `App.tsx`
4. fix `MemoryBootstrap` dependency key
5. add initial `manualChunks` in `vite.config.ts`

This slice is small enough to ship incrementally and large enough to reduce the current bottlenecks.
