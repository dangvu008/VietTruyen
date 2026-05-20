# MTL Polish — Comprehensive Design

Trạng thái: Design v1.0 — chốt sau khi user duyệt 12 defaults (`mặc định`).
Spec compact tương ứng: `docs/specs/mtl-polish-pipeline.md`.
Tài liệu này là blueprint chi tiết cho implementation P0 → P3.

---

## 1. Tóm tắt & định vị

**MTL Polish** = pipeline biến output của các engine máy dịch convert (Trung → Việt web novel) thành bản đọc được, có term consistency, có khử AI-tic, có gate đánh giá chất lượng. Không phải dịch máy gốc — VietTruyen polish OUTPUT của Google/DeepSeek/Qwen MT.

- **Reuse 80%**: 9router proxy, `model_router`, `novel_polish` (mode `anti_ai_tic`), narrative memory indexer, document import, `workflow_session_store`.
- **Build 20%**: glossary system Zh↔Vi, MTL chapter splitter, structural polish prompt, QE checkers, style standards porting, `MtlPolishOrchestrator`.
- **Canonical IA**: extend `adaptation` tab với source type `mtl-polish`. KHÔNG tạo top-level tab. KHÔNG đổi 9 project tabs.
- **Phase**: P0 foundation → P1 QE + batch → P2 zero-pronoun + DITING + alignment → P3 diff view + term hover + footnote export.
- **Style standards**: port universal Vietnamese rules từ `viet-chuyen-nghiep v3.1` (duytung.vn). SKIP journalism-only.

Tham chiếu chéo:
- `docs/CANONICAL_AGENT_SPEC.md` — navigation contract
- `docs/AI_NATIVE_TECHNICAL_DESIGN.md` — orchestrator pattern, memory bridge
- `docs/VIETTRUYEN_OVERALL_DESIGN.md` — product positioning
- `docs/specs/mtl-polish-pipeline.md` — tight spec
- `docs/specs/story-graph-rag.md` — memory retrieval (downstream consumer của glossary entities)

---

## 2. Bối cảnh & gap analysis

Codebase đã có `adaptation` pipeline cho **Vietnamese → Vietnamese rewriting** (reskin, what-if, era-shift, surgery, hybrid). Có 8 polish mode (`novel_polish.ts`) trong đó `anti_ai_tic` đã là deep 5-pass. Có 9router gateway cho multi-provider model routing. Có narrative memory + graph RAG. Có document import (.docx/.pdf/.epub/.txt).

**Cái thiếu cho user case "polish bản convert Trung → Việt":**

| Gap | Trạng thái | Cần build |
|---|---|---|
| Pipeline chuyên cho convert Zh→Vi (input là máy dịch thô) | ❌ | `MtlPolishOrchestrator` |
| Glossary Zh↔Vi term enforcement | ❌ (chỉ có `Character.aliases` cho entity nội bộ) | `MtlGlossary*` types + extractor + enforcer |
| Chapter splitter từ raw `.txt` (markers `第\d+章` / `Chương \d+`) | ❌ | `mtl_chapter_splitter.ts` |
| Zero-pronoun restoration (Trung lược chủ ngữ, Việt phải restore) | ❌ | Prompt design Stage 3 (P0) + LLM checker (P2) |
| Vietnamese-side QE (punctuation, anti-AI, naturalness) | ⚠️ rải rác trong `novel_polish` | Style standards module + 3 checker mới |
| DITING 6-dim score | ❌ | P2 LLM checker |
| Sentence alignment Zh↔Vi | ❌ | P2 (LASER embeddings hoặc fallback length-based) |

User cũng share `duytung.vn/tai-nguyen/viet-chuyen-nghiep v3.1` — skill bundle 28 file. Đã đọc full:

| Phần | Apply MTL fiction? | Action |
|---|---|---|
| `review/punctuation.md` (Oxford comma, em-dash, dấu câu) | ✅ universal | **PORT** vào `vi_punctuation_rules.ts` |
| `review/anti-ai.md` (Title Case, "Key insights:", over-formatting) | ✅ universal | **PORT** vào `vi_anti_ai_rules.ts` |
| `review/natural.md` (whitelist English terms, đa dạng nối câu) | ✅ universal | **PORT** vào `vi_natural_rules.ts` |
| `editorial/rhythm.md` (70-20-10 paragraph distribution) | ⚠️ loose for fiction | **PORT advisory** vào `vi_rhythm_rules.ts` |
| `archive/pattern-catalog.md` (42 patterns BEHAVIORAL_HOOK, DATA_ANCHOR, LEGAL_SYLLOGISM, ACADEMIC_CITATION...) | ❌ journalism only | **SKIP** |
| `editorial/story-core`, `hook-close`, `debunk`, `metaphor`, `reframe`, `emphasis`, `technical` | ❌ op-ed essay structure | **SKIP** |
| `publishing/facebook.md` | ❌ kênh khác | **SKIP** |
| `research/`, `development/` | ❌ out of scope | **SKIP** |
| **TBT/Lead/Staff + GATE workflow** (4 flow shape: tuần tự / song song / điều kiện / vòng lặp) | 🔥 pattern reusable | **APPLY** làm `MtlPolishOrchestrator` (sequential + conditional ở MVP) |

---

## 3. Non-goals

- ❌ KHÔNG dịch trực tiếp Zh→Vi từ raw Chinese (đó là job của Google/DeepSeek MT API — VietTruyen polish OUTPUT).
- ❌ KHÔNG scrape qidian/sangtacviet/truyenfull (DMCA-sensitive, personal use only).
- ❌ KHÔNG đổi 9 project tab canonical hoặc tạo top-level tab mới.
- ❌ KHÔNG biến chat thành center của workflow (anti chat-first).
- ❌ KHÔNG support real-time MT streaming ở P0 (batch-only).
- ❌ KHÔNG dùng skill viet-chuyen-nghiep cho story-core/editorial/hook-close (journalism, không hợp fiction).
- ❌ KHÔNG động `.agent-skills` (đã removed) hoặc subclone bundle vào repo.
- ❌ KHÔNG tự sửa term đã `locked` mà không có user consent.

---

## 4. Personas & user journeys

### Persona A — MTL Editor (primary)

User có file `.txt` convert Trung → Việt từ engine bên ngoài. Muốn polish thành bản đọc được giữ nguyên cốt truyện, term consistency, văn phong Việt tự nhiên.

```
1. Mở app → tab "Phóng tác" (adaptation, canonical)
2. Chọn source type "MTL Polish" (mới, bên cạnh "Tải lên" / "Từ project hiện có")
3. Upload file .txt convert thô → preview text + stats (số chương, độ dài, mật độ tên riêng, ratio Hán Việt)
4. Auto-detect language confidence (zh-hans / zh-hant / vi mixing)
5. AI extract glossary candidates từ 5 chương đầu → top-50 entity
   (person/sect/place/item/skill/realm/title/term/idiom)
6. Glossary editor: user duyệt/sửa/lock/xoá entry; thêm thủ công nếu thiếu
7. Confirm → tạo project mới:
   - Project.adaptationType = 'mtl-polish' (new value)
   - Project.mtlMeta = { sourceLanguage, targetLanguage: 'vi', glossaryId, ... }
8. Vào project workspace (9 tab canonical, không thêm tab)
9. Tab `chapters` → list chương với polish status badge (raw/polishing/polished/review/approved)
10. Click chương → polish 1 chương qua 6-stage pipeline, hoặc bulk-select → batch polish
11. Tab `writer` → đọc/sửa bản polished (sau P3 có diff view raw↔polished)
12. Tab `review` → xem MtlQeReport panel: term violations, anti-AI hits, punctuation issues, zero-pronoun warnings
13. Tab `export` → xuất .docx/.epub (có footnote term mapping ở P3)
```

### Persona B — Reader-Editor sửa tình tiết bản dịch

Đã có MTL project polished. Muốn sửa scene cụ thể ("nữ chính không chết") → reuse `adaptation surgery` mode đã có (`src/lib/adaptation/reader_edit_engine.ts`). Continuity guard chạy → blast radius report. **Không phải feature mới — chỉ confirm path tồn tại.**

### Persona C — Author polish nhẹ (không phải MTL)

Project sáng tác từ đầu, không liên quan MTL. Reuse 8-mode polish hiện có. **Out of scope.**

---

## 5. Canonical IA placement

```
GLOBAL SHELL (5 canonical tab)
├── dashboard
├── projects
├── adaptation ← EXTEND
│   └── source types:
│       ├── "Tải lên" (đã có) — fiction reskin/what-if/era-shift/surgery/hybrid
│       ├── "Từ project hiện có" (đã có)
│       └── 🆕 "MTL Polish" — for raw machine translation cleanup
│              ↓
│              tạo Project với adaptationType='mtl-polish' + mtlMeta
├── community
└── ai-settings

PROJECT WORKSPACE (9 canonical tab, KHÔNG ĐỔI)
├── bible          ← skip ở P0 (MTL không cần worldbuilding)
├── characters     ← auto-populate từ glossary entries category='person' (opt-in)
├── world          ← auto-populate từ glossary entries category='sect'|'place' (opt-in)
├── outline        ← optional — extract beat từ chương đầu nếu user muốn
├── writer         ← Mode MTL: hiển thị polished text; P3 thêm diff raw↔polished
├── chapters       ← Chapter list + polish status badge + batch polish action
├── storymap       ← unchanged (graph view, auto reflect MTL entities)
├── review         ← EXTEND: MtlQeReport panel cạnh ContinuityIssue
└── export         ← unchanged P0; P3 thêm inline term footnote
```

Conform `docs/CANONICAL_AGENT_SPEC.md` § "Navigation Contracts".

---

## 6. System architecture

### 6.1 Layers

```
┌─────────────────────────────────────────────────────────────┐
│ UI (React components — extend AdaptationPage / WriterPage / │
│      ChaptersPage / ReviewPage)                              │
├─────────────────────────────────────────────────────────────┤
│ Application orchestration                                    │
│ - MtlPolishOrchestrator (new) ── 6-stage GATE                │
│ - prepareMtlSourceDraft() (new) — parallel với               │
│   prepareAdaptationSourceDraft()                             │
│ - workflow_session_store (reuse) — log GATE evidence         │
├─────────────────────────────────────────────────────────────┤
│ Domain libs                                                  │
│ - src/lib/mtl/* (new): chapter_splitter, glossary_extractor, │
│   glossary_enforcer, source_preprocessor                     │
│ - src/lib/ai/style_standards/* (new): vi_punctuation_rules,  │
│   vi_anti_ai_rules, vi_natural_rules, vi_rhythm_rules        │
│ - src/core/checkers/* (extend): term_consistency_checker,    │
│   vi_punctuation_checker, vi_anti_ai_checker,                │
│   zero_pronoun_checker (P2)                                  │
├─────────────────────────────────────────────────────────────┤
│ AI gateway (reuse)                                           │
│ - model_router.ts → add task types                           │
│ - nine_router_catalog.ts (no change)                         │
│ - novel_polish.ts → augment anti_ai_tic mode                 │
├─────────────────────────────────────────────────────────────┤
│ Persistence (reuse + extend)                                 │
│ - Dexie narrative_db: schema v4→v5                           │
│   add tables: mtlGlossaries, mtlQeReports                    │
│ - use_project_store: extend với glossary CRUD + mtlMeta      │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Module boundaries

```
src/
├── types/
│   ├── mtl.ts                          ← new (200 lines, types only)
│   ├── story.ts                        ← extend Project.mtlMeta?
│   ├── chapter.ts (or story.ts)        ← extend Chapter.mtl?
│   └── workflow.ts                     ← extend WorkflowStep + intent enum
├── lib/
│   ├── mtl/                            ← new domain (~6 modules)
│   │   ├── mtl_chapter_splitter.ts
│   │   ├── mtl_source_preprocessor.ts
│   │   ├── glossary_extractor.ts
│   │   ├── glossary_enforcer.ts
│   │   ├── glossary_store.ts
│   │   └── mtl_source_pipeline.ts      ← exports prepareMtlSourceDraft()
│   ├── workflow/
│   │   └── mtl_polish_pipeline.ts      ← new, MtlPolishOrchestrator
│   └── ai/
│       ├── model_router.ts             ← extend AiTaskType + profiles
│       ├── novel_polish.ts             ← extend anti_ai_tic
│       └── style_standards/            ← new domain
│           ├── vi_punctuation_rules.ts
│           ├── vi_anti_ai_rules.ts
│           ├── vi_natural_rules.ts
│           ├── vi_rhythm_rules.ts
│           └── index.ts                ← exports applyStyleStandards()
├── core/checkers/                      ← extend
│   ├── term_consistency_checker.ts     ← new
│   ├── vi_punctuation_checker.ts       ← new
│   ├── vi_anti_ai_checker.ts           ← new
│   └── zero_pronoun_checker.ts         ← new (P2)
├── components/
│   ├── pages/
│   │   ├── AdaptationPage.tsx          ← extend (MTL source type)
│   │   ├── ChaptersPage.tsx            ← extend (polish status + batch action)
│   │   ├── WriterPage.tsx              ← extend (P3 diff view)
│   │   └── ReviewPage.tsx              ← extend (MtlQeReport panel)
│   └── mtl/                            ← new feature components
│       ├── MtlSourceUpload.tsx
│       ├── MtlGlossaryEditor.tsx
│       ├── MtlGlossaryEntryRow.tsx
│       ├── MtlPolishStatusBadge.tsx
│       ├── MtlBatchPolishDialog.tsx
│       └── MtlQeReportPanel.tsx
├── store/
│   ├── use_project_store.ts            ← extend với mtlMeta CRUD
│   └── use_mtl_glossary_store.ts       ← new (or fold vào project store)
└── db/
    └── narrative_db.ts                 ← bump schema v5
```

---

## 7. Data contracts

### 7.1 Core types (`src/types/mtl.ts`)

```ts
// src/types/mtl.ts

export type MtlSourceLanguage = 'zh-hans' | 'zh-hant' | 'en';
export type MtlTargetLanguage = 'vi';

export type MtlPolishStandard = 'viet-chuyen-nghiep-v3.1' | 'fiction-default';

export type MtlUpstreamEngine =
  | 'manual' | 'google' | 'deepseek' | 'qwen' | 'unknown';

export interface MtlMeta {
  sourceLanguage: MtlSourceLanguage;
  targetLanguage: MtlTargetLanguage;
  rawSourceHash: string;          // sha256 của raw file gốc (per-project)
  glossaryId: string;
  polishStandard: MtlPolishStandard;
  upstreamMt?: MtlUpstreamEngine;
  memoryBridgeEnabled: boolean;   // opt-in cho narrative memory indexing
  createdAt: string;
  updatedAt: string;
}

export type MtlGlossaryCategory =
  | 'person'   // nhân vật
  | 'sect'     // môn phái / dòng họ
  | 'place'    // địa danh
  | 'item'     // pháp bảo / đồ vật
  | 'skill'    // công pháp / kỹ thuật
  | 'realm'    // cảnh giới tu luyện
  | 'title'    // chức danh
  | 'term'     // thuật ngữ chung
  | 'idiom';   // thành ngữ / điển cố

export interface MtlGlossaryEntry {
  id: string;
  category: MtlGlossaryCategory;
  source: string;                 // 玄天宗
  target: string;                 // Huyền Thiên Tông
  altTargets?: string[];          // bản dịch khác cần thay thành target
  pinyin?: string;                // Xuán Tiān Zōng (optional)
  hanViet?: string;               // Huyền Thiên Tông (Hán Việt phonetic)
  note?: string;                  // user-facing note (vd: "do user xác nhận")
  locked: boolean;                // true → AI KHÔNG suggest sửa
  confidence: number;             // 0-1 nếu auto-extracted
  firstSeenChapterIndex?: number;
  occurrences: number;
  context?: string;               // disambiguation snippet (2 nhân vật cùng tên)
  createdAt: string;
  updatedAt: string;
}

export interface MtlGlossary {
  id: string;
  projectId: string;
  entries: MtlGlossaryEntry[];
  version: number;                // bump khi user save
  updatedAt: string;
}

export type MtlPolishStatus =
  | 'raw' | 'polishing' | 'polished' | 'review' | 'approved';

export interface ChapterMtlMeta {
  rawSourceText?: string;         // per-chapter raw (client-only mặc định)
  rawSourceHash?: string;
  polishStatus: MtlPolishStatus;
  polishLastRunAt?: string;
  polishVersion: number;
  qeReportId?: string;            // FK vào mtlQeReports
}

// QE report
export interface TermViolation {
  entryId: string;
  expectedTarget: string;
  actualText: string;
  paragraphIndex: number;
  charIndex: number;
  severity: 'error' | 'warning';
}

export interface AntiAiViolation {
  patternId: string;              // 'oxford_comma' | 'title_case' | 'ai_label' | ...
  description: string;
  paragraphIndex: number;
  excerpt: string;
}

export interface PunctuationIssue {
  ruleId: string;
  description: string;
  paragraphIndex: number;
  charIndex: number;
}

export interface ZeroPronounWarning {
  paragraphIndex: number;
  excerpt: string;
  suggestion?: string;
}

export interface DitingScore {
  idiom: number;                  // 0-5
  lexicalAmbiguity: number;
  terminologyLocalization: number;
  tense: number;
  zeroPronoun: number;
  culturalSafety: number;
  overall: number;                // weighted average
}

export interface MtlQeReport {
  id: string;
  chapterId: string;
  runId: string;
  termConsistencyViolations: TermViolation[];
  antiAiViolations: AntiAiViolation[];
  zeroPronounWarnings: ZeroPronounWarning[];
  punctuationIssues: PunctuationIssue[];
  ditingScore?: DitingScore;      // P2 only
  generatedAt: string;
}
```

### 7.2 Project/Chapter extensions (`src/types/story.ts`)

```ts
// extend Project
export interface Project {
  // ... existing fields ...
  mtlMeta?: MtlMeta;              // optional — projects hiện có không ảnh hưởng
}

// extend Chapter
export interface Chapter {
  // ... existing fields ...
  mtl?: ChapterMtlMeta;
}

// extend AdaptationType union (src/types/adaptation.ts)
export type AdaptationType =
  | 'reskin' | 'what-if' | 'new-pov' | 'era-shift'
  | 'surgery' | 'custom' | 'hybrid'
  | 'mtl-polish';                 // new
```

### 7.3 Workflow extensions (`src/types/workflow.ts`)

```ts
// extend WorkflowStep
export type WorkflowStep =
  | 'idle' | 'planning' | 'drafting' | 'reviewing' | 'refining'
  | 'persisting' | 'completed' | 'failed' | 'cancelled'
  | 'context_building' | 'polishing' | 'data_processing' | 'syncing'
  // MTL additions
  | 'mtl_preprocessing'
  | 'mtl_glossary_enforcement'
  | 'mtl_structural_polish'
  | 'mtl_anti_ai_polish'
  | 'mtl_qe_evaluation';

// extend WorkflowIntentType
export type WorkflowIntentType =
  | 'plan_chapter_branches' | 'write_chapter_from_branch' | 'full_write_pipeline'
  // MTL additions
  | 'mtl_polish_chapter'
  | 'mtl_polish_batch'
  | 'mtl_extract_glossary';
```

### 7.4 Dexie schema migration (v4 → v5)

```ts
// src/db/narrative_db.ts (excerpt)

class NarrativeDb extends Dexie {
  // ... existing tables ...
  mtlGlossaries!: Table<MtlGlossary, string>;
  mtlQeReports!: Table<MtlQeReport, string>;

  constructor() {
    super('viettruyen-narrative');

    // v1 - v4 ... existing migrations ...

    this.version(5).stores({
      // ... keep all v4 stores ...
      mtlGlossaries: 'id, projectId, updatedAt',
      mtlQeReports: 'id, chapterId, runId, generatedAt',
      // index Chapter.mtl.polishStatus implicit qua chapters table
    });
  }
}
```

Migration script là **additive**, không drop bất kỳ store nào hiện có. Test bằng IndexedDB E2E: create v4 DB → reload với v5 schema → verify tables thêm + data cũ giữ nguyên.

---

## 8. Pipeline — 6-stage GATE (TBT/Lead/Staff pattern)

```
USER INTENT: mtl_polish_chapter { chapterId, qualityMode }
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  MtlPolishOrchestrator (src/lib/workflow/mtl_polish_pipeline.ts)
│  └─ pattern: TBT giao mục tiêu, không chọn staff
│     Lead (orchestrator) tự chọn staff (stage function), log GATE
└─────────────────────────────────────────────────────────────┘
    │
    ▼
STAGE 1: PREPROCESS (deterministic, ~10ms)
    │  Input:  Chapter.mtl.rawSourceText | Chapter.content
    │  Tasks:  - strip BOM, normalize \r\n→\n
    │          - normalize spaces (NBSP, fullwidth → half)
    │          - split paragraphs (empty lines as boundary)
    │          - detect language confidence (zh-hans/hant/vi mixing)
    │  Output: PreprocessedChapter { paragraphs[], langConfidence }
    │  ⛔ GATE: workflow_session.appendEvidence({stage: 'mtl_preprocessing', ...})
    │
    ▼
STAGE 2: GLOSSARY ENFORCEMENT (deterministic regex + fuzzy, ~50ms)
    │  Input:  PreprocessedChapter + MtlGlossary (filter occurrences > 0
    │          hoặc firstSeenChapterIndex <= current)
    │  Tasks:  - cho mỗi entry: scan paragraphs for source/altTargets
    │          - tag với markers <<term:entry-id>>...<</term>>
    │          - fuzzy match (Levenshtein ≤2) cho variant spelling
    │          - record gaps: term từ glossary KHÔNG xuất hiện trong text
    │            (warning, không halt)
    │          - record orphan: chuỗi nghi là term nhưng KHÔNG match entry
    │            (heuristic: capitalized run-on, repeated pattern)
    │  Output: TaggedChapter { taggedParagraphs[], gaps[], orphans[] }
    │  Halt condition: nếu orphans > 20% capitalized tokens → user prompt
    │  ⛔ GATE: workflow_session.appendEvidence({stage: 'mtl_glossary_enforcement', ...})
    │
    ▼
STAGE 3: STRUCTURAL POLISH (LLM, ~3-8s, balanced tier)
    │  Input:  TaggedChapter + glossary lock list + chapter context capsule
    │  Model:  model_router.getModelForTask('mtl_structural_polish', ...)
    │          (defaults to balanced tier: DeepSeek V3 hoặc tương đương)
    │  System prompt: inject vi_punctuation + vi_anti_ai + vi_natural rules
    │  Task description:
    │    - PRESERVE all tagged terms <<term:id>>...<</term>> EXACTLY
    │    - Khôi phục chủ ngữ/đối tượng bị lược (zero-pronoun restore)
    │    - Rewrite văn phong Việt tự nhiên (không "thì/là/rằng" cứng)
    │    - Giữ NGUYÊN sự kiện, không thêm/bớt plot
    │    - Tuân thủ punctuation rules (no Oxford comma, no em-dash, ...)
    │  Output: StructuralPolishedChapter { paragraphs[], tokensUsed }
    │  Post-validate: assert ALL <<term:id>> markers vẫn còn → nếu thiếu, reprompt
    │  ⛔ GATE: workflow_session.appendEvidence({stage: 'mtl_structural_polish', ...})
    │
    ▼
STAGE 4: ANTI-AI PASS (LLM, ~2-4s, fast tier)
    │  Input:  StructuralPolishedChapter
    │  Strategy: REUSE novel_polish.ts mode 'anti_ai_tic' deep 5-pass
    │             AUGMENT với patterns từ vi_anti_ai_rules
    │             (Title Case detection, transition overuse, AI label scan)
    │  Output: AntiAiPolishedChapter { paragraphs[] }
    │  Strip term markers <<term:id>>...<</term>> → flat text Vietnamese
    │  ⛔ GATE: workflow_session.appendEvidence({stage: 'mtl_anti_ai_polish', ...})
    │
    ▼
STAGE 5: QE REPORT (deterministic + LLM critic)
    │  Run 4 checker song song:
    │    - term_consistency_checker (regex/fuzzy, ~20ms)
    │    - vi_punctuation_checker (regex, ~10ms)
    │    - vi_anti_ai_checker (regex + frequency, ~10ms)
    │    - (P2) zero_pronoun_checker (LLM, ~2s)
    │  (P2) Run DITING 6-dim scorer (LLM, ~3s, quality tier)
    │  Output: MtlQeReport
    │  ⛔ GATE: workflow_session.appendEvidence({stage: 'mtl_qe_evaluation', ...})
    │
    ▼
STAGE 6: PERSIST + REVIEW HANDOFF
    │  - Chapter.content ← AntiAiPolishedChapter.flatText
    │  - Chapter.mtl.rawSourceText giữ nguyên
    │  - Chapter.mtl.polishStatus = 'polished' (or 'review' nếu QE flag > threshold)
    │  - Chapter.mtl.polishVersion += 1
    │  - mtlQeReports.put(report)
    │  - if Project.mtlMeta.memoryBridgeEnabled:
    │      memory_indexer.indexChapter(chapterId)  // existing call
    │  ⛔ GATE: workflow_session.appendEvidence({stage: 'completed', ...})
    │
    ▼
DONE: emit event 'mtl-chapter-polished' → UI refresh
```

**Halt / retry strategy:**
- Stage 2 orphans > 20% → halt, surface UI: "Phát hiện X term lạ, hãy thêm vào glossary trước khi polish."
- Stage 3 LLM trả về text mất term markers → reprompt 1 lần với instruction explicit; fail thứ 2 → fallback skip Stage 3 (giữ raw, log warning).
- Stage 5 QE score < threshold → mark chapter as `review` thay vì `polished`, user phải duyệt manual.

**Batch mode:** `mtl_polish_batch` chạy concurrent với max 3 chapter cùng lúc (configurable). Mỗi chapter là 1 workflow session độc lập.

---

## 9. Glossary system

### 9.1 Lifecycle

```
[CREATE PROJECT]
  └→ glossary_extractor.extractFromChapters(firstNChapters, n=5)
       (LLM call: task='mtl_extract_glossary', balanced tier)
       Returns: candidate entries (top-50, confidence-ranked)
  └→ user GlossaryEditor UI: review/edit/lock/delete
  └→ glossary_store.save(glossary) → Dexie mtlGlossaries

[POLISH CHAPTER]
  └→ glossary_enforcer.tagChapter(rawText, glossary)
       1. cho mỗi entry: regex word-boundary scan source + altTargets
       2. tag inline: <<term:entry-id>>matched-text<</term>>
       3. fuzzy match phụ (Levenshtein ≤2) cho variant
       4. update entry.occurrences += count
       5. record gaps (entries có occurrences=0 trong chapter)
       6. record orphans (Vietnamese capitalized run-on không match entry)
       Returns: TaggedChapter + GlossaryGapList + OrphanList

[USER EDIT GLOSSARY]
  └→ Lock entry: locked=true
       → enforcer KHÔNG suggest sửa target
       → checker vẫn flag violation nếu polished text khác target
  └→ Unlock entry + edit target
       → enforcer apply target mới ở polish lần kế tiếp
       → existing polished chapters KHÔNG auto re-polish
         (user phải bấm re-polish manual)

[MEMORY BRIDGE] (opt-in per project, default off)
  └→ glossary entries category='person' → seed Character entity
       (Character.name = target, Character.aliases = [source, pinyin?, hanViet?])
  └→ glossary entries category='sect'|'place' → seed WorldRules.locations
  └→ Pipeline: glossary edit → if memoryBridgeEnabled → sync entity → memory_indexer
```

### 9.2 Extractor prompt (Stage glossary)

```
SYSTEM:
Bạn là chuyên gia thuật ngữ truyện convert Trung→Việt. Đọc các chương sau và
trích xuất top-50 entity quan trọng. Trả JSON array đúng schema.

Categories cho phép:
- person (nhân vật)
- sect (môn phái / dòng họ)
- place (địa danh)
- item (pháp bảo / đồ vật)
- skill (công pháp)
- realm (cảnh giới)
- title (chức danh)
- term (thuật ngữ chung)
- idiom (thành ngữ)

Chỉ trích entity:
- Xuất hiện ≥ 3 lần trong corpus
- Có dạng tên riêng / chuyên ngành (không phải từ phổ thông)
- Hoặc đã có bản dịch không nhất quán (vd 3 chỗ dùng 3 cách khác nhau)

Trả về:
[
  {
    "category": "person",
    "source": "玄天宗主",  // tiếng Trung NẾU có trong text (có thể không)
    "target": "Tông chủ Huyền Thiên",  // bản dịch xuất hiện nhiều nhất / hợp lý nhất
    "altTargets": ["chủ nhân Huyền Thiên Tông"],  // các biến thể cần thay
    "hanViet": "Huyền Thiên Tông chủ",
    "confidence": 0.85,
    "firstSeenChapterIndex": 0,
    "occurrences": 12,
    "context": "Người đứng đầu Huyền Thiên Tông"
  },
  ...
]

USER:
[5 chương convert thô, mỗi chương cách nhau ===]
```

### 9.3 Enforcer pseudocode

```ts
// src/lib/mtl/glossary_enforcer.ts (excerpt)

export function tagChapter(
  raw: PreprocessedChapter,
  glossary: MtlGlossary,
): TaggedChapter {
  const taggedParagraphs: string[] = [];
  const gaps = new Map<string, number>();
  const orphans: OrphanCandidate[] = [];

  // sort entries by source length desc → ưu tiên match longest first
  const sortedEntries = [...glossary.entries].sort(
    (a, b) => b.source.length - a.source.length,
  );

  for (const paragraph of raw.paragraphs) {
    let tagged = paragraph;

    for (const entry of sortedEntries) {
      // 1. exact source match
      const sourceRegex = buildWordBoundaryRegex(entry.source);
      tagged = tagged.replace(
        sourceRegex,
        (m) => `<<term:${entry.id}>>${m}<</term>>`,
      );

      // 2. altTargets match (replace với target chuẩn)
      for (const alt of entry.altTargets ?? []) {
        const altRegex = buildWordBoundaryRegex(alt);
        tagged = tagged.replace(
          altRegex,
          `<<term:${entry.id}>>${entry.target}<</term>>`,
        );
      }
    }

    // 3. orphan detection: chuỗi capitalized run-on không tag
    const orphanCandidates = detectCapitalizedRuns(tagged);
    orphans.push(...orphanCandidates);

    taggedParagraphs.push(tagged);
  }

  // 4. gap calculation: entries có occurrences=0 trong chapter này
  for (const entry of glossary.entries) {
    const count = countTagOccurrences(taggedParagraphs, entry.id);
    if (count === 0 && entry.firstSeenChapterIndex !== undefined) {
      gaps.set(entry.id, 0);
    }
  }

  return { taggedParagraphs, gaps, orphans };
}
```

### 9.4 Lock model

- `entry.locked: true` → AI orchestrator KHÔNG đề xuất sửa `entry.target` ở các re-extraction lần sau.
- Checker (Stage 5) vẫn flag inconsistency nếu polished text khác `entry.target` → user xem report manual.
- UI: hiển thị icon khóa khi locked; bulk-lock action; lock-by-category.
- Default policy: entries từ auto-extract đều unlocked (confidence < 1.0). User explicit lock.

---

## 10. Style standards porting

### 10.1 File mapping

| Source (viet-chuyen-nghiep v3.1) | Target (`src/lib/ai/style_standards/`) | Output type |
|---|---|---|
| `review/punctuation.md` | `vi_punctuation_rules.ts` | `PunctuationRule[]` constant + regex registry |
| `review/anti-ai.md` | `vi_anti_ai_rules.ts` | `AntiAiPattern[]` constant + regex/frequency |
| `review/natural.md` | `vi_natural_rules.ts` | `NaturalityRule[]` constant + whitelists |
| `editorial/rhythm.md` | `vi_rhythm_rules.ts` | `RhythmTarget` constant (advisory only) |

### 10.2 Sample rule extraction

```ts
// src/lib/ai/style_standards/vi_punctuation_rules.ts
//
// Source: duytung.vn/tai-nguyen/viet-chuyen-nghiep v3.1
// (review/punctuation.md, update 19/05/2026)
// Ported: universal Vietnamese punctuation rules only.

export interface PunctuationRule {
  id: string;
  description: string;
  forbiddenRegex?: RegExp;
  forbidden?: string;
  suggestion?: string;
  severity: 'error' | 'warning';
}

export const VI_PUNCTUATION_RULES: PunctuationRule[] = [
  {
    id: 'no_oxford_comma',
    description: 'Cấm Oxford comma trước "và", "hoặc"',
    forbiddenRegex: /,\s+(và|hoặc)\b/g,
    suggestion: 'Bỏ dấu phẩy trước "và" / "hoặc"',
    severity: 'error',
  },
  {
    id: 'no_em_dash_tight',
    description: 'Cấm em-dash dính liền',
    forbiddenRegex: /\w—\w/g,
    suggestion: 'Dùng " - " (hai phía cách)',
    severity: 'error',
  },
  {
    id: 'space_after_punct',
    description: 'Dấu câu phải sát trước, cách sau',
    forbiddenRegex: /\s+[,.!?;:](\S)/g,
    suggestion: 'Bỏ space trước dấu câu',
    severity: 'warning',
  },
  // ... thêm rule từ punctuation.md
];

export function getVietnamesePunctuationPrompt(): string {
  return [
    '## Dấu câu tiếng Việt:',
    '- KHÔNG dùng Oxford comma (không có dấu phẩy trước "và", "hoặc")',
    '- KHÔNG dùng em-dash (—). Dùng " - " (dấu gạch ngang có cách 2 phía)',
    '- Hạn chế dấu hai chấm (:). Ưu tiên "là", "rằng", "như sau"',
    '- Dấu câu phải sát từ trước, cách từ sau',
  ].join('\n');
}
```

### 10.3 Anti-AI patterns

```ts
// src/lib/ai/style_standards/vi_anti_ai_rules.ts (excerpt)

export const VI_ANTI_AI_PATTERNS: AntiAiPattern[] = [
  {
    id: 'no_title_case',
    description: 'Cấm Title Case trong văn tiếng Việt',
    detector: (text) => detectTitleCase(text),
    severity: 'warning',
  },
  {
    id: 'no_ai_labels',
    description: 'Cấm nhãn AI ("Key insights:", "Note:", "Summary:")',
    forbiddenRegex: /\b(Key insights?:|Note:|Summary:|Tóm lại:|Nhìn chung:)\s*/gi,
    severity: 'error',
  },
  {
    id: 'limit_transition_overuse',
    description: 'Hạn chế "Tuy nhiên" lặp >3 lần / 1000 từ',
    detector: (text) => detectTransitionOveruse(text, /Tuy nhiên/g, 3),
    severity: 'warning',
  },
  // ... thêm pattern từ anti-ai.md
];
```

### 10.4 Application

```ts
// src/lib/ai/style_standards/index.ts

export function buildStructuralPolishSystemPrompt(opts: {
  glossarySnapshot: MtlGlossaryEntry[];
  preserveTags: boolean;
  fictionSensitive: boolean;  // true → relax rhythm
}): string {
  return [
    'Bạn là biên tập viên tiếng Việt chuyên polish bản dịch web novel.',
    '',
    '## Mục tiêu:',
    '- Khôi phục chủ ngữ/đối tượng bị lược (zero-pronoun)',
    '- Văn phong Việt tự nhiên (không "thì/là/rằng" cứng)',
    '- GIỮ NGUYÊN tất cả sự kiện, không thêm/bớt plot',
    '',
    opts.preserveTags
      ? '- GIỮ NGUYÊN các marker <<term:id>>...<</term>> CHÍNH XÁC'
      : '',
    '',
    getVietnamesePunctuationPrompt(),
    '',
    getVietnameseAntiAiPrompt(),
    '',
    getVietnameseNaturalPrompt(),
    '',
    opts.fictionSensitive
      ? '## Nhịp đoạn:\nNhịp 70-20-10 chỉ là hướng dẫn, đối thoại có thể có chuỗi câu ngắn.'
      : getVietnameseRhythmPrompt(),
    '',
    '## Glossary (chỉ tham khảo, các term đã được tag inline):',
    opts.glossarySnapshot
      .slice(0, 30)
      .map((e) => `- ${e.source} → ${e.target}`)
      .join('\n'),
  ].join('\n');
}
```

---

## 11. Model routing

### 11.1 New AiTaskType entries

Extend `src/lib/ai/model_router.ts`:

```ts
export type AiTaskType =
  | 'summarize' | 'classify' | 'extract_metadata' | 'analyze_retcon'
  | 'answer_plot' | 'brainstorm' | 'plan_chapter' | 'write_chapter'
  | 'polish_style' | 'editor' | 'chat'
  // MTL additions
  | 'mtl_extract_glossary'
  | 'mtl_structural_polish'
  | 'mtl_anti_ai_polish'
  | 'mtl_qe_critic';

const TASK_TIER_PREFERENCE: Record<AiTaskType, AiModelTier[]> = {
  // ... existing ...
  mtl_extract_glossary:  ['balanced', 'fast', 'quality'],
  mtl_structural_polish: ['balanced', 'quality', 'fast'],
  mtl_anti_ai_polish:    ['fast', 'balanced', 'quality'],
  mtl_qe_critic:         ['quality', 'balanced', 'fast'],
};

const TASK_ROUTING_PROFILE: Record<AiTaskType, TaskRoutingProfile> = {
  // ... existing ...
  mtl_extract_glossary: {
    expectedInputTokens: 12000,       // 5 chương ~ 12K tokens
    expectedOutputTokens: 2500,       // top-50 entries JSON
    requiredContextTokens: 20000,
    costWeight: 1800,
    capabilityWeights: { cheap: 14, json_mode: 16, long_context: 12, multilingual: 14 },
  },
  mtl_structural_polish: {
    expectedInputTokens: 4500,        // 1 chương + glossary
    expectedOutputTokens: 4500,
    requiredContextTokens: 12000,
    costWeight: 2000,
    capabilityWeights: { multilingual: 18, creative: 10, instruction_following: 14 },
  },
  mtl_anti_ai_polish: {
    expectedInputTokens: 4500,
    expectedOutputTokens: 4500,
    requiredContextTokens: 10000,
    costWeight: 2400,                 // cheaper preferred
    capabilityWeights: { cheap: 16, instruction_following: 12 },
  },
  mtl_qe_critic: {
    expectedInputTokens: 5000,
    expectedOutputTokens: 800,
    requiredContextTokens: 10000,
    costWeight: 1200,
    capabilityWeights: { analysis: 18, multilingual: 14 },
  },
};
```

### 11.2 Default tier mapping

| Task | Default tier | Default provider (per 9router catalog) |
|---|---|---|
| `mtl_extract_glossary` | balanced | DeepSeek V3 / Gemini Flash |
| `mtl_structural_polish` | balanced | DeepSeek V3 (DITING winner + cost) |
| `mtl_anti_ai_polish` | fast | Gemini Flash / GPT-4o-mini |
| `mtl_qe_critic` (P2) | quality | Claude Sonnet 4 / Gemini Pro |

User vẫn override được trong AI Settings (existing `TaskModelOverrideMap`).

### 11.3 Cost target (per chapter ~3000 từ)

| Stage | Tokens (in/out) | Cost @ DeepSeek V3 ($0.27/$1.10 per M) |
|---|---|---|
| Glossary extract (5 chương amortized → /50 chương project) | 12K/2.5K / 50 = 240/50 in-out | ~$0.0001 |
| Structural polish | 4.5K/4.5K | ~$0.0061 |
| Anti-AI polish | 4.5K/4.5K | ~$0.0061 |
| QE critic (P2 only) | 5K/0.8K | ~$0.0022 |
| **Total / chapter (P0)** | ~9K/9K | **~$0.012** |

> Mục tiêu user accepted: **<$0.005/chapter**. Cần optimize: skip Anti-AI khi Structural Polish output đã pass checker; hoặc dùng Gemini Flash cho Stage 4 (rẻ hơn 5x). Đầu P1 sẽ tune lại.

---

## 12. UX flows

### 12.1 MTL source upload (Adaptation tab extension)

```
[AdaptationPage]
├── Tab selector: "Tải lên" | "Từ project hiện có" | 🆕 "MTL Polish"
└── (MTL Polish selected)
    ├── Step 1: Upload .txt / .docx file
    │            → progress bar parse
    │            → preview text (first 200 lines)
    │            → stats: số chương detected, độ dài, % Hán Việt
    ├── Step 2: Settings
    │            - sourceLanguage: zh-hans (default) | zh-hant | en
    │            - polishStandard: viet-chuyen-nghiep-v3.1 (default) | fiction-default
    │            - memoryBridgeEnabled: off (default)
    │            - Estimate token cost cho 5 chương đầu
    ├── Step 3: Auto-extract glossary (5 chương đầu)
    │            → progress bar LLM call
    │            → glossary table (50 row) với edit/lock/delete
    ├── Step 4: Confirm → tạo Project
    │            - title: prompt user
    │            - adaptationType: 'mtl-polish'
    │            - mtlMeta: { sourceLanguage, glossaryId, polishStandard, ... }
    │            - chapters: pre-populated với chapter splits (status='raw')
    └── Redirect: /projects/:id/chapters
```

### 12.2 Polish action (Chapters tab)

```
[ChaptersPage] (MTL project)
├── Chapter list với badge polish status: raw / polishing / polished / review / approved
├── Per-chapter actions:
│   ├── "Polish" → confirm dialog → enqueue intent mtl_polish_chapter
│   └── "Re-polish" (if polished) → revision warning
└── Bulk action: select multiple → "Polish batch"
    └── Batch dialog: confirm count + estimate cost + start
        → progress UI (X/Y polished, real-time)
        → cancel button (graceful abort)
```

### 12.3 Glossary editor (Project workspace, accessible từ chapters or characters tab)

```
[MtlGlossaryEditor]
├── Header: total entries, locked count, last updated
├── Filter: by category (person/sect/place/...), by lock status, by confidence
├── Table:
│   | category | source (zh) | target (vi) | altTargets | confidence | locked | actions |
│   ...
├── Per-row actions: edit / lock-toggle / delete
├── Footer: "+ Add entry" + "Bulk lock by category" + "Re-extract from chapter N"
└── Save → glossary_store.save() → bumps glossary.version
```

### 12.4 QE report panel (Review tab)

```
[ReviewPage] (existing ContinuityIssue panel) → thêm 1 panel mới:

[MtlQeReportPanel]
├── Chapter selector
├── Tab: Term violations | Anti-AI | Punctuation | Zero-pronoun (P2)
├── Per-violation card:
│   - Excerpt (highlight vị trí)
│   - Severity (error/warning)
│   - Suggestion
│   - Action: "Mark as OK" | "Edit chapter" | "Re-polish"
└── Footer: DITING score chart (P2 only, radar 6-axis)
```

---

## 13. Reuse vs build matrix

| Concern | Reuse (no change) | Reuse (extend) | Build new |
|---|---|---|---|
| Document parse (.txt/.docx/.epub) | `src/lib/document/*` (mammoth, pdfjs-dist, parse_epub_browser) | — | `mtl_chapter_splitter.ts` |
| Project create flow | — | `AdaptationPage.tsx` thêm MTL source type | — |
| Adaptation source pipeline | `prepareAdaptationSourceDraft()` pattern | — | `prepareMtlSourceDraft()` parallel |
| Project storage | `use_project_store`, Dexie | Schema v5 migration | — |
| Glossary | — | — | `glossary_extractor`, `glossary_enforcer`, `glossary_store` |
| Polish modes | `novel_polish.ts` `anti_ai_tic` | (P1) augment với vi_anti_ai patterns | — |
| Workflow orchestration | `use_workflow_session_store`, `writer_orchestrator` pattern | — | `MtlPolishOrchestrator` |
| Model router | `model_router.ts`, 9router proxy | Add 4 AiTaskType + profiles | — |
| Quality checkers | `src/core/checkers/*` framework | — | 3 checker P0 + 1 P2 |
| Memory/graph | `memory_indexer`, `narrative_graph_builder` | Glossary persons → seed Character (opt-in) | — |
| Review page | — | Render `MtlQeReportPanel` | — |
| Export | existing `src/lib/export/*` | (P3) inline term footnote | — |
| Style standards | — | — | 4 file `vi_*_rules.ts` |

~80% reuse, ~20% build new.

---

## 14. Phase plan

### P0 — Foundation (1-2 sprint, validate concept)
**Deliverable: 1 chương 3000-từ polished E2E qua 4-stage pipeline với 50-entry glossary.**

- [ ] Types: `src/types/mtl.ts` (200 LOC); extend `story.ts`, `chapter.ts`, `workflow.ts`, `adaptation.ts`
- [ ] DB: Dexie v5 migration (mtlGlossaries, mtlQeReports tables)
- [ ] `src/lib/mtl/mtl_chapter_splitter.ts` — regex `第\d+章` / `Chương \d+` + manual fallback
- [ ] `src/lib/mtl/mtl_source_preprocessor.ts` — normalize whitespace, detect language
- [ ] `src/lib/mtl/glossary_extractor.ts` — LLM call, top-50 entries
- [ ] `src/lib/mtl/glossary_enforcer.ts` — regex tag, fuzzy match, orphan detect
- [ ] `src/lib/mtl/glossary_store.ts` — Dexie CRUD
- [ ] `src/lib/mtl/mtl_source_pipeline.ts` — `prepareMtlSourceDraft()`
- [ ] `src/lib/workflow/mtl_polish_pipeline.ts` — orchestrator skeleton (stage 1-4 + stage 6)
- [ ] `src/lib/ai/model_router.ts` — extend AiTaskType + profiles (4 entries)
- [ ] `src/components/pages/AdaptationPage.tsx` — MTL source type tab
- [ ] `src/components/mtl/` — `MtlSourceUpload`, `MtlGlossaryEditor`, `MtlGlossaryEntryRow`, `MtlPolishStatusBadge`
- [ ] `src/components/pages/ChaptersPage.tsx` — polish action button + status badge
- [ ] Unit tests: `mtl_chapter_splitter`, `glossary_enforcer` (with fixtures)
- [ ] Integration test: full pipeline 1 chương fixture
- [ ] Smoke E2E: user upload .txt 100KB → polish 1 chương → assert ≥95% term apply

### P1 — QE + Batch (2-3 sprint, MVP ship-ready)

- [ ] `src/lib/ai/style_standards/` — 4 file `vi_*_rules.ts` (port viet-chuyen-nghiep v3.1)
- [ ] `src/core/checkers/term_consistency_checker.ts`
- [ ] `src/core/checkers/vi_punctuation_checker.ts`
- [ ] `src/core/checkers/vi_anti_ai_checker.ts`
- [ ] Stage 5 (QE report) integrate vào orchestrator
- [ ] `src/components/mtl/MtlQeReportPanel.tsx` → render trong `ReviewPage`
- [ ] `src/components/mtl/MtlBatchPolishDialog.tsx` → batch action UI
- [ ] Batch orchestration (concurrent max 3 chapter)
- [ ] Glossary bulk-lock UX
- [ ] Memory bridge implementation (opt-in toggle, sync glossary persons → Character)
- [ ] Augment `novel_polish.ts` `anti_ai_tic` mode với patterns mới
- [ ] Cost optimization: tune Stage 4 model selection cho budget <$0.005/chapter

### P2 — Advanced QE (research-driven)

- [ ] `src/core/checkers/zero_pronoun_checker.ts` (LLM-based)
- [ ] DITING 6-dim scorer (LLM, quality tier)
- [ ] `DitingScore` UI radar chart trong `MtlQeReportPanel`
- [ ] Sentence alignment Zh↔Vi (LASER embeddings, optional khi có raw Chinese per-chapter)
- [ ] En→Vi MTL support (extend `MtlSourceLanguage`)
- [ ] Critic-Surgeon loop riêng cho MTL (reuse pattern từ `novel_polish.ts` Pro mode)

### P3 — Polish UX

- [ ] Diff view raw↔polished trong `WriterPage` (side-by-side, sync scroll)
- [ ] Term-suggest hover popup (hover từ → show glossary entry detail)
- [ ] Export inline term footnote (.docx, .epub formats)
- [ ] Glossary share giữa projects (per-genre/per-author template)
- [ ] Style Card UI: user chọn polish standard (viet-chuyen-nghiep / fiction / ngôn tình / kiếm hiệp)

---

## 15. Open decisions — defaults locked

User approved all defaults (`mặc định`):

| # | Decision | Default | Rationale |
|---|---|---|---|
| 1 | Source language scope | Zh→Vi ở P0; En→Vi ở P2 | Use case chính của user |
| 2 | Chapter splitter | Regex `第\d+章` / `Chương \d+` + manual fallback | LLM split tốn token; regex cover 90% |
| 3 | Glossary auto-extract scope | First 5 chương → top-50 entities | Đủ cover canon chính; user add sau |
| 4 | Polish model default | DeepSeek V3 (per DITING + cost) | Research brief winner; rẻ hơn Claude 11x |
| 5 | Polish per chapter cost target | <$0.005/chapter (~3000 từ) | Sustainable personal use; sẽ optimize P1 |
| 6 | Glossary edit lock model | Per-entry user lock + auto-suggest cho unlocked | Tránh AI tự sửa tên user đã chốt |
| 7 | UI placement | `adaptation` tab new source type | Khớp canonical IA, không tạo tab mới |
| 8 | viet-chuyen-nghiep license | Port rules only (no raw .md), attribute source ở file header + README | Tôn trọng tác giả + giữ repo gọn |
| 9 | Fiction rhythm sensitivity | 70-20-10 advisory only | Đối thoại nhiều câu ngắn — strict rule sẽ phá flow |
| 10 | Diff view UI | P3 (sau khi pipeline ổn) | P0 validate pipeline trước UX |
| 11 | Memory bridge per project | Opt-in toggle (default off) | Tránh rác memory cho 1-shot polish |
| 12 | Storage rawSourceText | Per-chapter (`ChapterMtlMeta.rawSourceText`), client-only mặc định | Permit per-chapter re-polish; DMCA-safe |

---

## 16. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Glossary auto-extract trả sai term phổ biến → polish bị ép sai | High | User review trước polish; per-entry lock; confidence visible; re-extract action |
| Polish làm mất nghĩa gốc (drift plot) | Critical | Prompt explicit "preserve all events"; P2 thêm sentence alignment để verify; QE flag inconsistency |
| Token cost vượt budget cho 500-chương project | Medium | Batch UI estimate trước; per-project budget cap (extend AI Settings); cost optimization P1 |
| Style rule áp lên dialog → unnatural | Medium | Fiction-sensitive mode (rhythm advisory); prompt phân biệt dialog vs narrative |
| Glossary conflict 2 nhân vật cùng tên | Medium | Disambiguation context field; enforcer ưu tiên entry có context match; user manual fix |
| Memory bridge "rác" cho 1-shot polish | Low | Opt-in toggle (default off); cleanup action khi tắt |
| DMCA risk lưu raw Chinese | Medium | Default client-only; user explicit consent trước cloud sync; opt-in per project |
| Vi phạm GUARDRAILS canonical | High | All UI dưới `adaptation`/`writer`/`review`; spec format theo template; PR review check |
| LLM mất term markers ở Stage 3 | High | Post-validate markers count; reprompt 1 lần; fallback skip stage với log |
| Schema migration v4→v5 break IndexedDB | High | Migration additive only; integration test với v4 DB load → v5 schema |

---

## 17. Acceptance criteria

### P0 MVP
- [ ] User upload file `.txt` 100KB convert Trung→Việt → tạo được project MTL với `Project.mtlMeta` populated
- [ ] Glossary auto-extract trả về ≥30 entry với confidence visible
- [ ] User edit/lock 5 entry → polish 1 chương 3000 từ qua 4-stage pipeline (P0 không có Stage 5 QE đầy đủ)
- [ ] Output chương polish: tên/thuật ngữ trong glossary apply đúng ≥95% occurrences
- [ ] `workflow_session_store` log đầy đủ 4 GATE evidence (preprocess, glossary_enforcement, structural_polish, anti_ai)
- [ ] KHÔNG tạo top-level tab mới; route khớp `docs/CANONICAL_AGENT_SPEC.md`
- [ ] `npm run test:run -- src/lib/mtl/`, `npm run lint`, `npm run build` đều pass
- [ ] Spec file `docs/specs/mtl-polish-pipeline.md` đã tạo (✅ done, PR #2)

### P1 MVP ship
- [ ] 3 QE checker (term/punctuation/anti-AI) chạy ở Stage 5, output `MtlQeReport`
- [ ] Batch polish 10 chương concurrent max 3 → progress UI hiển thị real-time
- [ ] Style standards port hoàn chỉnh, có header attribution
- [ ] Cost per chapter polish thực tế <$0.005 (measure qua `token_tracker.ts` existing)

### P2 Advanced
- [ ] Zero-pronoun checker LLM detect ≥80% recall trên benchmark set 100 đoạn fixture
- [ ] DITING score correlation với expert annotation ≥0.7 (Spearman)
- [ ] Sentence alignment recall ≥85% khi có raw Chinese

### P3 UX
- [ ] Diff view raw↔polished sync scroll smooth, không lag với chương 10K từ
- [ ] Footnote export render đúng trong .docx (Word) và .epub (Calibre / Apple Books)

---

## 18. Open questions (future)

Không blocking P0 implementation, nhưng cần thảo luận trước khi P2/P3:

- En→Vi MTL: có cần style standards riêng (English source) hay reuse vi_* rules?
- Glossary share: cơ chế (file export/import? cloud sync per genre? community share?)
- DITING benchmark: có cần build mini benchmark VietTruyen-specific (10-20 chương đại diện)?
- Memory bridge: khi user polish lại chương đã polish, có invalidate Character entity cũ?
- Per-project budget cap: cần UI riêng hay reuse AI Settings global budget?
- Polish standard "ngôn tình" / "kiếm hiệp" / "đô thị" — có cần style preset riêng?

---

## 19. References

### Codebase
- Canonical IA: `docs/CANONICAL_AGENT_SPEC.md`
- Technical foundation: `docs/AI_NATIVE_TECHNICAL_DESIGN.md`
- Product positioning: `docs/VIETTRUYEN_OVERALL_DESIGN.md`
- Spec template: `docs/specs/writer-continuity-core.md`, `docs/specs/9router-model-sync.md`
- Memory architecture: `docs/specs/story-graph-rag.md`
- Routing: `docs/specs/auto-model-routing.md`
- Polish modes: `src/lib/ai/novel_polish.ts`
- Model router: `src/lib/ai/model_router.ts`
- Adaptation pipeline: `src/lib/adaptation/*`
- Workflow store: `src/store/use_workflow_session_store.ts`
- Document import: `src/lib/document/*`

### External
- viet-chuyen-nghiep v3.1: https://duytung.vn/tai-nguyen/viet-chuyen-nghiep
- DITING benchmark: arXiv:2510.09116 — Web novel MT evaluation
- RouteLLM: arXiv:2406.18665 — LLM routing, 85% cost reduction
- Re3 (Plan→Draft→Revise): arXiv:2210.06774
- ConStory-Bench: arXiv:2603.05890v1 — consistency taxonomy
- WHAT-IF branching: arXiv:2412.10582
- ComoRAG: AAAI 2026 — iterative RAG for long fiction
- Tiptap tracked changes: https://tiptap.dev/docs/editor/extensions/functionality/tracked-changes
- Dinu et al. ACL 2019: terminology-constrained NMT

### Session artifacts (research backup, không commit)
- `viettruyen-brainstorm.md`
- `viettruyen-research-brief.md`
- `viettruyen-existing-vs-brainstorm.md`
- `viettruyen-mtl-design.md` (v0.1 draft, tiền thân của file này)
