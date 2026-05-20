# Spec: MTL Polish Pipeline

## Objective
Thêm pipeline polish cho bản dịch máy convert Trung→Việt (web novel) như một product line mới của VietTruyen, reuse 80% infrastructure đã có (9router, novel_polish, memory, document import, workflow_session_store). Mục tiêu là biến file `.txt` convert thô (terminology mâu thuẫn, lược chủ ngữ, văn phong máy) thành bản đọc được, có term consistency, có khử AI-tic, có gate đánh giá chất lượng.

User outcomes:
- Upload file convert Trung→Việt → tự động tách chương, extract glossary tên/thuật ngữ tu luyện/môn phái, polish từng chương.
- Mỗi chương sau polish có term apply ≥95% occurrences, không còn "thì", "rằng", "là" cứng nhắc kiểu máy dịch.
- Review tab có report QE riêng cho MTL: term consistency, anti-AI, Vietnamese punctuation, zero-pronoun warnings.
- Reuse cùng project workspace 9-tab — KHÔNG tạo top-level tab mới.

## Assumptions
1. Không dịch trực tiếp từ Chinese raw — VietTruyen polish OUTPUT của các MT engine khác (Google, DeepSeek MT, Qwen).
2. User upload file `.txt` đã có sẵn bản convert; raw Chinese là optional input.
3. `Project` aggregate vẫn là source of truth; MTL chỉ thêm metadata + glossary entity con.
4. Local-first vẫn được giữ; raw Chinese mặc định client-only (không sync cloud) để tránh DMCA risk.
5. Polish chạy batch là chính, không cần streaming real-time ở phase này.

## Tech Stack
- Frontend/runtime: React 18 + TypeScript + Vite + Tailwind
- Local persistence: Dexie (`src/db/narrative_db.ts`) — schema bump v4 → v5
- AI orchestration:
  - `src/lib/ai/model_router.ts` (thêm task types MTL)
  - `src/lib/ai/nine_router_catalog.ts` (reuse)
  - `src/lib/ai/novel_polish.ts` (reuse mode `anti_ai_tic`)
  - `src/lib/workflow/writer_orchestrator.ts` (pattern reuse cho MtlPolishOrchestrator)
- Document parsing: `src/lib/document/*` (reuse mammoth/pdfjs-dist nếu user upload docx/pdf)

## Commands
- Test MTL units: `npm run test:run -- src/lib/mtl/`
- Test focused checkers: `npm run test:run -- src/core/checkers/vi_punctuation_checker.test.ts src/core/checkers/term_consistency_checker.test.ts`
- Test orchestrator: `npm run test:run -- src/lib/workflow/mtl_polish_pipeline.test.ts`
- Build: `npm run build`
- Dev app: `npm run dev`
- Dev 9router: `npm run dev:9router`

## Project Structure
- `src/types/mtl.ts` (new) → `MtlMeta`, `MtlGlossary`, `MtlGlossaryEntry`, `ChapterMtlMeta`, `MtlQeReport`, `MtlSourceLanguage`
- `src/types/story.ts` → extend `Project.mtlMeta?`, `Chapter.mtl?`
- `src/lib/mtl/` (new) →
  - `mtl_chapter_splitter.ts` — regex-based chapter detection (`第\d+章`, `Chương \d+`, custom marker)
  - `glossary_extractor.ts` — LLM extract entity từ first N chương
  - `glossary_enforcer.ts` — tag/replace term theo glossary entries
  - `mtl_source_preprocessor.ts` — normalize whitespace, strip metadata
  - `mtl_source_pipeline.ts` — `prepareMtlSourceDraft()` song song với `adaptation_import_pipeline.ts`
- `src/lib/workflow/mtl_polish_pipeline.ts` (new) → `MtlPolishOrchestrator` với 6-stage GATE
- `src/lib/ai/style_standards/` (new) →
  - `vi_punctuation_rules.ts` — port từ duytung.vn/viet-chuyen-nghiep v3.1 (`review/punctuation.md`)
  - `vi_anti_ai_rules.ts` — port từ `review/anti-ai.md`
  - `vi_natural_rules.ts` — port từ `review/natural.md`
  - `vi_rhythm_rules.ts` — port từ `editorial/rhythm.md` (advisory)
- `src/core/checkers/` → thêm `term_consistency_checker.ts`, `vi_punctuation_checker.ts`, `vi_anti_ai_checker.ts`
- `src/components/pages/AdaptationPage.tsx` → extend với tab "MTL Polish" (new source type)
- `src/components/pages/ReviewPage*` → render `MtlQeReport` panel cạnh `ContinuityIssue` hiện có
- `src/db/narrative_db.ts` → bump schema v5, thêm `mtlGlossaries`, `mtlQeReports`
- `src/store/use_project_store.ts` → CRUD glossary + mtlMeta

## Domain Notes
Feature chạm 4 domain:
- `MtlSource` → upload, parse, chapter split, language detection, raw text per chapter
- `MtlGlossary` → entity registry cho term Zh↔Vi (person/sect/place/item/skill/realm/title/term/idiom), per-entry lock + confidence
- `MtlPolish` → 6-stage pipeline orchestration, model routing, prompt assembly với style standards
- `MtlQuality` → QE checkers (term consistency, anti-AI, Vietnamese punctuation, zero-pronoun warnings)

Surface canonical: `adaptation` (entry), `chapters` + `writer` (manuscript ops), `review` (QE report). KHÔNG tạo tab mới — conform `docs/CANONICAL_AGENT_SPEC.md`.

## Pipeline — 6 Stage GATE
Inspired theo pattern TBT/GATE của skill viet-chuyen-nghiep v3.1 (duytung.vn). Sequential mặc định, có nhánh điều kiện (halt nếu glossary gap > threshold):

1. **Preprocess** (cheap, deterministic) — normalize whitespace, strip metadata, split paragraphs, detect language confidence (zh/vi mixing). ⛔ GATE → `PreprocessedChapter`.
2. **Glossary Enforcement** (cheap, regex+fuzzy) — scan raw text for `source`/`altTargets` của từng entry; tag occurrences `<<term:id>>...<</term>>`; report missing terms. ⛔ GATE → `TaggedChapter` + `GlossaryGapList`. Halt nếu gaps > 20% → surface UI cho user duyệt trước polish.
3. **Structural Polish** (LLM, balanced tier) — input `TaggedChapter` + glossary + chapter context capsule. Task: zero-pronoun restore + Vietnamese natural flow + preserve tagged terms. Model via `model_router` task `mtl_structural_polish`. System prompt inject `vi_punctuation_rules` + `vi_anti_ai_rules` + `vi_natural_rules`. ⛔ GATE → `StructuralPolishedChapter`.
4. **Anti-AI Pass** (LLM, fast tier) — reuse `novel_polish.ts` mode `anti_ai_tic` deep-pass; augment với patterns từ `vi_anti_ai_rules` (Title Case, AI labels, over-formatting, transition overuse). ⛔ GATE → `AntiAiPolishedChapter`.
5. **QE Report** (deterministic + LLM critic) — chạy `term_consistency_checker`, `vi_punctuation_checker`, `vi_anti_ai_checker`. (P2) chạy `zero_pronoun_checker` + DITING 6-dim scorer. ⛔ GATE → `MtlQeReport`.
6. **Persist + Review Handoff** — save polished text → `Chapter.content`; save raw → `ChapterMtlMeta.rawSourceText`; save report → `mtlQeReports` table; trigger `memory_indexer` để update narrative graph. ⛔ GATE → complete.

Workflow contract: thêm `WorkflowStep` enum entries: `mtl_preprocessing`, `mtl_glossary_enforcement`, `mtl_structural_polish`, `mtl_anti_ai`, `mtl_qe`. Thêm intent: `mtl_polish_chapter`, `mtl_polish_batch`. State machine khớp `use_workflow_session_store`.

## Data Contracts
```ts
// src/types/mtl.ts
export type MtlSourceLanguage = 'zh-hans' | 'zh-hant' | 'en';
export type MtlTargetLanguage = 'vi';

export interface MtlMeta {
  sourceLanguage: MtlSourceLanguage;
  targetLanguage: MtlTargetLanguage;
  rawSourceHash: string;
  glossaryId: string;
  polishStandard: 'viet-chuyen-nghiep-v3.1' | 'fiction-default';
  upstreamMt?: 'manual' | 'google' | 'deepseek' | 'qwen' | 'unknown';
  createdAt: string;
}

export type MtlGlossaryCategory =
  | 'person' | 'sect' | 'place' | 'item' | 'skill'
  | 'realm' | 'title' | 'term' | 'idiom';

export interface MtlGlossaryEntry {
  id: string;
  category: MtlGlossaryCategory;
  source: string;          // 玄天宗
  target: string;          // Huyền Thiên Tông
  altTargets?: string[];   // bản dịch khác cần thay
  pinyin?: string;
  hanViet?: string;
  note?: string;
  locked: boolean;
  confidence: number;      // 0-1
  firstSeenChapterIndex?: number;
  occurrences: number;
}

export interface MtlGlossary {
  id: string;
  projectId: string;
  entries: MtlGlossaryEntry[];
  updatedAt: string;
}

export interface ChapterMtlMeta {
  rawSourceText?: string;
  rawSourceHash?: string;
  polishStatus: 'raw' | 'polishing' | 'polished' | 'review' | 'approved';
  polishLastRunAt?: string;
  polishVersion: number;
  qeReport?: MtlQeReport;
}

export interface MtlQeReport {
  termConsistencyViolations: TermViolation[];
  antiAiViolations: AntiAiViolation[];
  zeroPronounWarnings: ZeroPronounWarning[];
  punctuationIssues: PunctuationIssue[];
  ditingScore?: DitingScore;
  generatedAt: string;
  runId: string;
}
```

`Project.mtlMeta?: MtlMeta` và `Chapter.mtl?: ChapterMtlMeta` là optional — projects hiện có không bị ảnh hưởng.

## Style Standards — Attribution
Universal Vietnamese rules được port từ skill `viet-chuyen-nghiep v3.1` (duytung.vn/tai-nguyen/viet-chuyen-nghiep, update 19/05/2026). Chỉ port universal rules; SKIP journalism-only content (42 patterns BEHAVIORAL_HOOK/DATA_ANCHOR/LEGAL_SYLLOGISM/ACADEMIC_CITATION, debunk/hook-close/reframe/facebook publishing). File `src/lib/ai/style_standards/*.ts` cite nguồn ở header comment.

Apply:
- Stage 3 (Structural Polish): system prompt inject 3 rule sets
- Stage 4 (Anti-AI Pass): augment existing `anti_ai_tic` mode
- Stage 5 (QE): deterministic checkers chạy regex/fuzzy

## Code Style
Domain-explicit naming (no generic utils):
```ts
const draft = await prepareMtlSourceDraft(file, { onParseProgress });
const polished = await orchestrator.polishChapter(chapterId, { qualityMode: 'balanced' });
const report = await runMtlQeChecks(polished, glossary, styleStandards);
```

Type-first, no `any`. Glossary entries ALWAYS go through `glossary_enforcer.ts` — không inline regex trong polish prompts. Style rules ALWAYS từ `style_standards/*` — không hard-code inline.

## Testing Strategy
- Unit test `mtl_chapter_splitter.ts`, `glossary_enforcer.ts`, mỗi checker với fixtures Zh+Vi
- Unit test `MtlPolishOrchestrator` stage-by-stage với mock `callAiProxy`
- Integration test: 1 file `.txt` 3000-word fixture → full pipeline → assert polished output có term apply + báo cáo QE non-empty
- UI changes (Adaptation tab MTL, Review MTL panel) verify bằng build + type check; browser smoke chỉ khi user yêu cầu

## Boundaries
- Always: route mọi LLM call qua `model_router` với task type cụ thể (`mtl_structural_polish`, `mtl_glossary_extract`, `mtl_qe`)
- Always: glossary entry `locked: true` thì AI KHÔNG suggest sửa; chỉ surface warning nếu phát hiện inconsistency
- Always: rawSourceText lưu trong `ChapterMtlMeta` (client-only mặc định), không sync cloud trừ khi user explicit consent
- Ask first: thêm dependency mới (LASER embeddings, COMET-Kiwi QE binding), đổi `narrative_db` schema vượt v5, thay đổi `model_router` task profile của task khác
- Never: tạo top-level tab mới; commit raw Chinese fixtures lớn vào repo; persist provider API keys; subclone `.agent-skills` (đã removed); chat-first UI
- Never: tự sửa term đã `locked` mà không có user consent

## Phase Plan
- **P0 — Foundation** (validate concept): types + Dexie v5 + `AdaptationPage` MTL tab + chapter splitter + glossary extractor + glossary CRUD UI + `MtlPolishOrchestrator` skeleton + stage 1-4 + smoke 1 chương E2E
- **P1 — QE + Batch** (MVP ship-ready): port style standards + 3 checker đầu (term/punctuation/anti-ai) + `MtlQeReport` UI trong `review` + batch polish action + glossary lock UX + opt-in memory bridge
- **P2 — Advanced QE** (research-driven): zero-pronoun checker (LLM) + DITING 6-dim score + sentence alignment Zh↔Vi (LASER, optional khi có raw Chinese) + Critic-Surgeon loop cho MTL
- **P3 — Polish UX**: diff view raw↔polished trong `writer` + term-suggest hover popup + footnote export (.docx/.epub) + glossary share giữa projects

## Open Decisions — Defaults Locked
12 decision đã chốt theo defaults (per user approval `mặc định`):
1. P0 chỉ Zh→Vi; En→Vi đợi P2
2. Chapter splitter: regex `第\d+章` + manual fallback
3. Glossary auto-extract: first 5 chương → top 50 entities
4. Polish model default: DeepSeek V3 (per DITING benchmark + cost efficiency)
5. Token budget target: <$0.005/chương ~3000 từ
6. Glossary lock model: per-entry user lock + auto-suggest unlocked
7. Surface MTL Polish ở `adaptation` tab new source type
8. viet-chuyen-nghiep license: port rules only (no raw .md), attribute source ở file header
9. Fiction sensitivity: rhythm 70-20-10 advisory only (dialog-heavy chương không strict)
10. Diff view: defer tới P3
11. Memory bridge: opt-in per project (default off)
12. Storage: per-chapter `rawSourceText`, client-only mặc định

## Success Criteria
- [ ] User upload file `.txt` 100KB convert Trung→Việt → tạo được project MTL với `Project.mtlMeta` populated
- [ ] Glossary auto-extract trả về ≥30 entry với confidence visible
- [ ] User edit/lock 5 entry → polish 1 chương 3000 từ qua 6-stage pipeline
- [ ] Output chương polish: tên/thuật ngữ trong glossary apply đúng ≥95% occurrences
- [ ] `workflow_session_store` log đầy đủ 6 GATE evidence
- [ ] Không tạo top-level tab mới; route khớp `docs/CANONICAL_AGENT_SPEC.md` (`adaptation` + 9 project tab giữ nguyên)
- [ ] `npm run test:run -- src/lib/mtl/`, `npm run lint`, `npm run build` đều pass
- [ ] P0 deliverable: 1 chương E2E polished với evidence (workflow session log + QE report stub)

## References
- Brainstorm gốc: `viettruyen-brainstorm.md` (session artifact)
- Research brief: `viettruyen-research-brief.md` (session artifact, 20+ papers, RouteLLM, DITING, ConStory-Bench, Re3, ComoRAG)
- Existing audit: `viettruyen-existing-vs-brainstorm.md` (session artifact)
- Full MTL design v0.1: `viettruyen-mtl-design.md` (session artifact, 12 open decisions chi tiết)
- viet-chuyen-nghiep v3.1: https://duytung.vn/tai-nguyen/viet-chuyen-nghiep
- DITING benchmark: arXiv:2510.09116
- Related specs: `writer-continuity-core.md`, `story-graph-rag.md`, `9router-model-sync.md`, `auto-model-routing.md`
