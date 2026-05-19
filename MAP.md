# MAP.md

Ngay lap: 2026-05-19

Pham vi: quet codebase VietTruyen, uu tien `src/`, `src-tauri/`, `supabase/`, `docs/`, `e2e/`, `tests/`, `scripts/`, `public/`, `plans/`.

Ghi chu phuong phap:

- Da dung import graph tinh tu 532 file TS/TSX/JS/JSX trong `src/`: 425 runtime files va 107 test files.
- `graphify` khong co trong moi truong, nen core/dead-code duoc suy ra bang parser import tuong doi: `import`, `export from`, dynamic `import(...)`.
- "Duoc goi nhieu nhat" trong tai lieu nay nghia la "duoc import boi nhieu file runtime nhat"; no khong dem call-site noi bo ham.
- "Khong duoc import" khong dong nghia chac chan dead code: entrypoint, worker, component duoc mount dong, test fixture, hoac file dang WIP deu co the co inbound import bang 0.

## 1. Module/folder chinh

- `src/main.tsx`: entrypoint Vite/React, apply appearance ban dau, mount `<App />`, roi defer khoi tao embedding va debug trace.
- `src/App.tsx`: root dieu phoi auth gate, storage provider, global/project shell, lazy overlays, va render page theo registry.
- `src/app/`: registry dieu huong lazy-loaded cho global tabs va project tabs, khong dung React Router.
- `src/components/layout/`: shell/layout UI cho global workspace va project workspace, gom sidebar, header, command center.
- `src/components/pages/`: cac page cap route cho dashboard, projects, adaptation, community, AI settings, bible, characters, world, outline, writer, chapters, review/export.
- `src/components/pages/outline/`: UI va hook rieng cho workflow outline 3 tang.
- `src/components/pages/template_manager/`: UI quan ly, xem, sua story templates.
- `src/components/pages/wizard/`: man hinh wizard cu/bo tro cho luong tao truyen, hien khong nam trong top-level canonical route.
- `src/components/creation/`: UI phu tro Creation Chat nhu cost panel, draft chapter card, plot/framework preview, session recovery/history.
- `src/components/adaptation/`: UI cac buoc phuong tac/hybrid rewrite va report originality.
- `src/components/shared/`: reusable UI va overlay dung chung: AI assistant, model selector, notification, version history, retcon modal, token dashboard, graph visualization.
- `src/components/story-editor/`: editor workspace chinh cho viet chuong, gom topbar, editor pane, AI panel, status bar, autosave recovery, chat history helpers.
- `src/components/system/`: bootstrap he thong nen, dac biet memory bootstrap khi vao project workspace.
- `src/core/`: logic domain/doc lap hon UI nhu writer engine, exporter, id generator, mock generators, debt tracker, scene chunker.
- `src/core/checkers/`: tap hop checker danh gia ban thao: pacing, continuity, consistency, OOC, reader pull, high point, discourse depth.
- `src/core/writer_strategies/`: strategy cho cac che do viet/continue/rewrite/polish.
- `src/data/`: du lieu seed/static: AI models, genre profiles, genre descriptions, style presets, markdown genre templates.
- `src/data/story_templates/`: registry va tung template truyen theo genre.
- `src/db/`: Dexie IndexedDB schema va helper DB cho narrative memory, chapter storage, session archive.
- `src/hooks/`: React hooks dung chung cho autosave, undo/redo, network status, model health sync, story timeline, translation, voice input.
- `src/lib/ai/`: AI application layer: model routing, tracked client, prompt builders, context builder, creation orchestration, chapter writer, polish, cache, token budget.
- `src/lib/adaptation/`: pipeline phuong tac/import/chuyen hoa: import source, extract skeleton, mutate details, score originality, recover imported project.
- `src/lib/assistant/`: intent contracts cho AI assistant.
- `src/lib/bible/`: smart sync/review cho bible/canon cua project.
- `src/lib/canon/`: dong goi canon bundle tu project data.
- `src/lib/chapter/`: guard noi dung chuong truoc khi luu.
- `src/lib/community/`: content guard, rate limiter, comment codec, block list, publish pipeline cho community.
- `src/lib/creation/`: normalize/seed/estimate helper cho luong Creation Chat va chapter drafts.
- `src/lib/dashboard/`: tinh metric/dashboard summary tu project data.
- `src/lib/debug/`: story debug trace va lifecycle tracing dung cho AI/generation/storage debug.
- `src/lib/document/`: parser/import pipeline cho text, pdf, epub, docx, liteparse/Tauri.
- `src/lib/i18n/`: translation store/types/resources cho VI/EN/ZH.
- `src/lib/memory/`: narrative memory engine: indexing, retrieval, embeddings, graph builder, summaries, pending hooks, propagation, reranking.
- `src/lib/navigation/`: workflow snapshot va helper dieu huong project dua tren do hoan thien cua project.
- `src/lib/project/`: helper hien thi/title project va detect imported project.
- `src/lib/report/`: reporter/trend cho status/quality.
- `src/lib/session/`: archive/restore session cua Creation Chat.
- `src/lib/storage/`: abstraction storage provider, local/online provider, autosave draft, trash, quota, debounced local storage.
- `src/lib/story_templates/`: fingerprint/registry/source helper cho shared story template.
- `src/lib/supabase/`: Supabase client va services auth, sync, version, community, collaboration, reports, templates, embeddings.
- `src/lib/surgery/`: advanced restructuring/retcon-style rewrite workflow: ingest source, dependency index, impact scan, rewrite queue, canon freezer.
- `src/lib/workflow/`: workflow engine/orchestrator cho full write pipeline, tu intent den context/build/write/review/persist.
- `src/store/`: Zustand stores cho project, app session, auth, AI, creation chat, generation, tokens, storage, notifications, templates, editor chat, surgery.
- `src/types/`: type contracts canonical cho Project/Chapter/Character/World/Workflow/Navigation/AI/Memory/Adaptation/etc.
- `src/workers/`: Web Worker rieng cho memory indexing.
- `src-tauri/`: Tauri desktop shell, Rust commands, permissions, config, icons, bundle metadata.
- `supabase/`: local Supabase config va SQL migrations tao/bo sung schema cloud.
- `e2e/`: Playwright specs cho auth, editor, project management, VietTruyen smoke flows.
- `tests/`: Vitest tests ngoai `src/`, hien chu yeu cho writer/checker character logic.
- `scripts/`: scripts maintenance/conversion/dev helper cho templates va agent brief.
- `docs/`: canonical spec, technical design, prompt standard, specs, agent boilerplate templates.
- `plans/`: planning/audit/baseline docs dang lam viec.
- `public/`: static assets va HTML check-data dung boi frontend.
- Root config files: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `playwright.config.ts`, `postcss.config.js` cau hinh build/test/dev UI.

## 2. Luong chinh cua app

### 2.1 Boot, auth, shell selection

User mo app -> `src/main.tsx` mount `src/App.tsx` -> `App` goi `useAuthStore.initAuth()` va khoi tao storage qua `useStorageStore` -> neu chua login render `src/components/pages/LoginPage.tsx` -> neu da login, `App` chon `GlobalShell` hoac `ProjectWorkspace` dua tren `useAppSessionStore` va `useProjectStore`.

Files chinh:

- `src/main.tsx`
- `src/App.tsx`
- `src/store/use_auth_store.ts`
- `src/store/use_storage_store.ts`
- `src/lib/storage/storage_context.ts`
- `src/components/pages/LoginPage.tsx`
- `src/components/layout/GlobalShell.tsx`
- `src/components/layout/ProjectWorkspace.tsx`

### 2.2 Dieu huong global tabs

User bam tab global -> `GlobalSidebar` goi `App.setGlobalTab` -> `App` render `GlobalShell` -> `renderGlobalPage()` trong `src/app/global_page_registry.tsx` chon lazy page tu `src/app/page_registry.tsx`.

Global tabs canonical theo docs/spec:

- `dashboard` -> `src/components/pages/DashboardPage.tsx`
- `projects` -> `src/components/pages/ProjectsPage.tsx`
- `adaptation` -> `src/components/pages/AdaptationPage.tsx`
- `community` -> `src/components/pages/CommunityPage.tsx`
- `ai-settings` -> `src/components/pages/AiSettingsPage.tsx`
- `creation-chat` -> `src/components/pages/CreationChatPage.tsx`
- `templates` -> `src/components/pages/TemplateManagerPage.tsx`

Files chinh:

- `src/App.tsx`
- `src/components/layout/GlobalShell.tsx`
- `src/components/layout/GlobalSidebar.tsx`
- `src/app/global_page_registry.tsx`
- `src/app/page_registry.tsx`
- `src/types/navigation.ts`

### 2.3 Mo/tao project va vao Project Workspace

User tao/mo project tu Dashboard/Projects/Creation Chat -> page goi `onEnterProject(projectId, preferredTab)` -> `App.handleEnterProject()` set active project trong `useProjectStore`, tinh tab goi y qua `getRecommendedProjectTab()`/`shouldOpenCreationChatForProject()` -> `App` doi shell sang `project` -> `ProjectWorkspace` render page qua `renderProjectPage()`.

Files chinh:

- `src/App.tsx`
- `src/components/pages/DashboardPage.tsx`
- `src/components/pages/ProjectsPage.tsx`
- `src/store/use_project_store.ts`
- `src/lib/navigation/project_workflow.ts`
- `src/components/layout/ProjectWorkspace.tsx`
- `src/components/layout/ProjectSidebar.tsx`
- `src/app/project_page_registry.tsx`
- `src/app/page_registry.tsx`

### 2.4 Project tabs va writer flow

User o trong project bam tab -> `ProjectSidebar` goi `ProjectWorkspace.guardedNavigate()` -> `ProjectWorkspace` chan `review/export` neu chua du dieu kien -> `App` cap nhat `projectTab` -> `renderProjectPage()` mount page tuong ung.

Project tabs canonical:

- `bible` -> `src/components/pages/BiblePage.tsx`
- `characters` -> `src/components/pages/CharactersPage.tsx`
- `world` -> `src/components/pages/WorldPage.tsx`
- `outline` -> `src/components/pages/OutlinePage.tsx`
- `writer` -> `src/components/pages/WriterPage.tsx` -> `src/components/story-editor/StoryWorkspace.tsx`
- `chapters` -> `src/components/pages/ChaptersPage.tsx`
- `storymap` -> `src/components/pages/StoryMapPage.tsx`
- `review` -> `WriterPage` voi `initialMode="review"`
- `export` -> `src/components/pages/ExportPage.tsx`

Files chinh:

- `src/components/layout/ProjectWorkspace.tsx`
- `src/lib/navigation/project_workflow.ts`
- `src/app/project_page_registry.tsx`
- `src/components/pages/WriterPage.tsx`
- `src/components/story-editor/StoryWorkspace.tsx`
- `src/components/story-editor/ChapterEditorPane.tsx`
- `src/components/story-editor/AIAssistantPanel.tsx`
- `src/components/story-editor/EditorTopbar.tsx`
- `src/components/story-editor/EditorStatusBar.tsx`

### 2.5 Creation Chat: user mo ta y tuong -> tao framework -> sinh chuong

User vao `creation-chat` tu dashboard/projects -> `CreationChatPage` doc/ghi `useCreationChatStore` -> cac action UI goi handler trong `src/lib/ai/creation_orchestrator.ts` -> orchestrator build prompt bang `creation_prompts.ts`/`creation_discuss_config.ts`, chon model bang `model_router.ts`, goi AI qua `tracked_ai_client.ts` -> ket qua duoc normalize bang `src/lib/creation/*` -> framework duoc seed thanh Project qua `buildCreationProjectSeed()` va `useProjectStore` -> chapter/project duoc luu vao Dexie/provider qua `narrative_db.ts`/`storage_provider`.

Files chinh:

- `src/components/pages/CreationChatPage.tsx`
- `src/store/use_creation_chat_store.ts`
- `src/lib/ai/creation_orchestrator.ts`
- `src/lib/ai/creation_prompts.ts`
- `src/lib/ai/creation_discuss_config.ts`
- `src/lib/ai/creation_cost_estimator.ts`
- `src/lib/ai/model_router.ts`
- `src/lib/ai/tracked_ai_client.ts`
- `src/lib/creation/project_seed.ts`
- `src/lib/creation/framework_normalizer.ts`
- `src/lib/creation/plot_preview_normalizer.ts`
- `src/store/use_project_store.ts`
- `src/db/narrative_db.ts`

### 2.6 Viet chuong bang editor/AI

User vao `writer` -> `WriterPage` truyen project/action vao `StoryWorkspace` -> user sua text qua `ChapterEditorPane` va autosave qua `useAutosave`/`autosave_draft_store` -> khi update chapter, `StoryWorkspace` goi `useProjectStore.updateChapter()` -> project store normalize/guard content va luu vao `narrative_db.ts` hoac `StorageProvider`.

Neu user bam generate/resume/batch AI -> `StoryWorkspace` tao intent `full_write_pipeline` -> `useWorkflowSessionStore.startIntent()` -> `writer_orchestrator.executeWorkflowIntent()` -> `full_write_pipeline.executeFullWritePipeline()` -> pipeline build context, goi AI, chay checker/style/memory tuy quality mode -> tra draft ve `StoryWorkspace` -> `useProjectStore` persist chapter.

Files chinh:

- `src/components/pages/WriterPage.tsx`
- `src/components/story-editor/StoryWorkspace.tsx`
- `src/components/story-editor/ChapterEditorPane.tsx`
- `src/hooks/use_autosave.ts`
- `src/lib/storage/autosave_draft_store.ts`
- `src/store/use_generation_store.ts`
- `src/store/use_workflow_session_store.ts`
- `src/lib/workflow/writer_orchestrator.ts`
- `src/lib/workflow/full_write_pipeline.ts`
- `src/lib/ai/context_builder.ts`
- `src/lib/ai/chapter_writer_ai.ts`
- `src/core/checkers/run_all_checkers.ts`
- `src/lib/ai/style_analyzer.ts`
- `src/lib/memory/memory_extractor.ts`
- `src/lib/memory/memory_sync_bridge.ts`
- `src/store/use_project_store.ts`
- `src/db/narrative_db.ts`

### 2.7 Memory/background indexing

User vao project workspace -> `App` lazy-load `MemoryBootstrap` khi co active project -> memory modules index/sync narrative state, embeddings, pending hooks, chapter order, retrieval context -> writer/review/retcon dung lai memory query de build context va warnings.

Files chinh:

- `src/App.tsx`
- `src/components/system/MemoryBootstrap.tsx`
- `src/lib/memory/memory_indexer.ts`
- `src/lib/memory/memory_query.ts`
- `src/lib/memory/hybrid_memory_query.ts`
- `src/lib/memory/retrieval_pack_builder.ts`
- `src/lib/memory/pending_hooks_repository.ts`
- `src/lib/memory/propagation_engine.ts`
- `src/db/narrative_db.ts`
- `src/workers/memory_indexer.worker.ts`

### 2.8 Storage/cloud sync

User tao/sua/xoa project/chapter -> UI/action goi `useProjectStore` -> store chon local/cloud provider tu `useStorageStore` -> local/browser data dung Dexie `narrative_db.ts`, Tauri local co `GitStorageProvider`, online/cloud dung `OnlineStorageProvider` + Supabase services -> migrations trong `supabase/migrations` dinh nghia schema cloud.

Files chinh:

- `src/store/use_project_store.ts`
- `src/store/use_storage_store.ts`
- `src/lib/storage/storage_provider.ts`
- `src/lib/storage/git_storage_provider.ts`
- `src/lib/storage/online_storage_provider.ts`
- `src/db/narrative_db.ts`
- `src/lib/supabase/supabase_client.ts`
- `src/lib/supabase/sync_service.ts`
- `src/lib/supabase/version_service.ts`
- `supabase/migrations/*.sql`

## 3. Core files duoc import nhieu nhat

Thong ke duoi day dem inbound imports tu runtime files trong `src`, loai `.test`/`.spec`.

| Hang | File | Inbound runtime imports | Vai tro |
|---:|---|---:|---|
| 1 | `src/types/story.ts` | 149 | Contract trung tam cho Project, Chapter, Character, World, Outline. |
| 2 | `src/types/story_template.ts` | 56 | Contract cho story template/genre template. |
| 3 | `src/core/id.ts` | 43 | Helper tao ID dung rong khap store, AI, workflow. |
| 4 | `src/types/narrative_memory.ts` | 36 | Contract cho memory/indexing/propagation. |
| 5 | `src/db/narrative_db.ts` | 31 | Dexie database va storage helper cho chapters/memory. |
| 6 | `src/store/use_project_store.ts` | 29 | Aggregate store chinh cua project va chapter CRUD. |
| 7 | `src/store/use_ai_store.ts` | 27 | Store cau hinh model/provider/runtime AI. |
| 8 | `src/lib/ai/model_router.ts` | 26 | Chon model theo task, cost, health, capability. |
| 9 | `src/lib/ai/tracked_ai_client.ts` | 25 | Wrapper goi AI co cache, token tracking, fallback. |
| 10 | `src/lib/ai/token_estimator.ts` | 19 | Uoc tinh/gioi han token va cost rate. |
| 11 | `src/types/adaptation.ts` | 18 | Contract phuong tac/adaptation. |
| 12 | `src/types/creation_chat.ts` | 18 | Contract state/message/progress cua Creation Chat. |
| 13 | `src/types/surgery.ts` | 16 | Contract advanced restructuring/surgery workflow. |
| 14 | `src/core/checkers/checker_types.ts` | 15 | Contract cho checker/review report. |
| 15 | `src/store/use_notification_store.ts` | 15 | Notification/toast store dung tren nhieu workflow. |
| 16 | `src/types/navigation.ts` | 15 | Contract dual-shell navigation va tab IDs. |
| 17 | `src/lib/supabase/supabase_client.ts` | 14 | Supabase client singleton cho services cloud. |
| 18 | `src/components/story-editor/editor_types.ts` | 12 | Contract noi bo story editor. |
| 19 | `src/store/use_auth_store.ts` | 11 | Auth session store dung boi App/AI/storage. |
| 20 | `src/lib/debug/story_debug_trace.ts` | 10 | Trace/debug lifecycle cho storage, AI, generation. |
| 21 | `src/lib/memory/chapter_order.ts` | 10 | Canonical sequence/order helper cho chapters. |
| 22 | `src/types/token_tracker.ts` | 10 | Token/cost/pipeline tracking contract. |
| 23 | `src/lib/memory/memory_registry.ts` | 9 | Normalize/register memory entities. |
| 24 | `src/store/use_token_store.ts` | 9 | Store token usage/cost tracking. |
| 25 | `src/store/use_writing_wizard_store.ts` | 9 | Store wizard/writing setup legacy/bo tro. |

Files co fan-out lon nhat, tuc import nhieu dependency nhat:

| File | Outbound imports | Ghi chu |
|---|---:|---|
| `src/data/story_templates/template_registry.ts` | 46 | Gom tat ca story template seed files. |
| `src/components/story-editor/StoryWorkspace.tsx` | 37 | Container editor phoi hop nhieu store/lib/UI. |
| `src/App.tsx` | 32 | Root app orchestration. |
| `src/components/pages/CreationChatPage.tsx` | 31 | Page chat gom UI, store, orchestrator, selectors. |
| `src/lib/workflow/full_write_pipeline.ts` | 24 | Pipeline noi context, AI, checker, memory. |
| `src/lib/ai/context_builder.ts` | 23 | Build context lon cho AI writing. |
| `src/lib/ai/creation_orchestrator.ts` | 22 | Dieu phoi luong Creation Chat. |
| `src/components/pages/ChaptersPage.tsx` | 21 | Manuscript management page. |
| `src/components/story-editor/AIAssistantPanel.tsx` | 19 | Panel AI trong editor. |
| `src/store/use_project_store.ts` | 18 | Store lon phu thuoc storage/adaptation/memory. |

## 4. Runtime files khong duoc runtime file nao import

Danh sach nay loai tests va chi xet import graph noi bo `src`. Cac file entrypoint/special-case duoc ghi chu rieng.

Chac chan khong nen goi la dead code neu chua kiem tra them:

- `src/main.tsx`: entrypoint Vite, duoc HTML/Vite load, khong can inbound import.
- `src/workers/memory_indexer.worker.ts`: worker co the duoc bundle/load bang worker URL hoac flow ngoai import regex.
- `src/lib/storage/index.ts`: barrel/export file, co the de public API nhung hien graph runtime khong import.
- `src/core/memory_extractor.ts`: co the la legacy duplicate voi `src/lib/memory/memory_extractor.ts`; can grep usage ngoai import truoc khi xoa.

Ung vien orphan/dead code can review:

- `src/components/ReadingPowerDashboard.tsx`
- `src/components/StrandWeaveChart.tsx`
- `src/components/adaptation/MutationConfigStep.tsx`
- `src/components/adaptation/OriginalityReportView.tsx`
- `src/components/adaptation/ProgressiveRewriteView.tsx`
- `src/components/adaptation/StyleConfigStep.tsx`
- `src/components/layout/ProjectCommandCenter.tsx`
- `src/components/pages/StatusDashboardPage.tsx`
- `src/components/pages/adaptation/DeepAnalysisView.tsx`
- `src/components/pages/adaptation/ImportSuccessView.tsx`
- `src/components/pages/wizard/AnalysisResultsPanel.tsx`
- `src/components/pages/wizard/FinishScreen.tsx`
- `src/components/pages/wizard/SetupScreen.tsx`
- `src/components/pages/wizard/StepBrainstorm.tsx`
- `src/components/pages/wizard/StepFoundation.tsx`
- `src/components/pages/wizard/StepIdea.tsx`
- `src/components/pages/wizard/StepOutline.tsx`
- `src/components/pages/wizard/StepReview.tsx`
- `src/components/pages/wizard/StepWrite.tsx`
- `src/components/pages/wizard/WritingScreen.tsx`
- `src/components/shared/AdaptationChatPanel.tsx`
- `src/components/shared/AiModelSelector.tsx`
- `src/components/shared/CostEstimatePanel.tsx`
- `src/components/shared/EntityGraphVisualization.tsx`
- `src/components/shared/ImportPreviewPanel.tsx`
- `src/components/shared/NarrativeWeightPanel.tsx`
- `src/components/shared/PlotDirectionPreview.tsx`
- `src/components/shared/TokenOptimizationTaskTracker.tsx`
- `src/components/story-editor/ChapterSidebar.tsx`
- `src/components/story-editor/GenerationStatusBadge.tsx`
- `src/data/genre_profiles.ts`
- `src/lib/adaptation/character_mapper.ts`
- `src/lib/adaptation/reader_edit_engine.ts`
- `src/lib/adaptation/skeleton_extractor.ts`
- `src/lib/ai/novel_polish_critique.ts`
- `src/lib/ai/retcon_analyzer.ts`
- `src/lib/ai/tinix_prompts.ts`
- `src/lib/document/document_import_pipeline.ts`
- `src/lib/memory/debt_tracker.ts`
- `src/lib/memory/fatigue_word_auditor.ts`
- `src/lib/memory/hybrid_memory_result.ts`
- `src/lib/memory/narrative_index_exporter.ts`
- `src/store/use_bible_store.ts`
- `src/store/use_narrative_store.ts`
- `src/store/use_surgery_store.ts`

Neu muon xoa dead code, nen lam buoc tiep theo rieng:

1. Chay `rg "<basename>|exported symbol"` tren toan repo de bat usage khong qua import.
2. Chay `npm run build` voi `noUnusedLocals` de bat exports/locals khong dung.
3. Kiem tra dynamic worker/import URL va cac file legacy docs nhac den.
4. Xoa tung nhom nho, moi nhom co test/build proof rieng.
