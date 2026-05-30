# Adaptation Studio — Brainstorm Document
> Generated: 2026-05-23 | Session: rune-brainstorm
> Status: APPROVED — ready for rune-plan

---

## Decision Summary

**Architecture:** Mode-Layered Studio (Option A) — extend AdaptationPage với 3 Track độc lập.
**Approved design:** Track 1 (Translation Workshop) + Track 2 (Deep Edit Workshop) + Track 3 (Phóng Tác Pro)

---

## Track 1: Translation Workshop

### Must-Have (MVP)
| # | Feature | AI | Note |
|---|---------|----|----|
| T1 | Import bản dịch thô (txt/docx) | 🟢 | Entry point |
| T2 | Glossary Manager — canonical + aliases | 🟢 | Extend adaptationGlossaries table (NEW) |
| T3 | Find & Replace theo Glossary | 🟢 | Batch apply trên tất cả chapters |
| T4 | Side-by-side Editor — gốc vs bản dịch | 🟢 | Split panel UI |
| T5 | Terminology Synchronizer | 🟢 | Synonym map → batch normalize |
| T6 | Pinyin Detector | 🟢+🔴 | Known: dict; Unknown: AI flag |
| T7 | Hán Việt Density Meter | 🟢 | Đếm ratio per chapter |
| T8 | Polish từng đoạn (on-demand) | 🔴 | ~800 tokens/đoạn |
| T9 | Naturalness Score | 🔴 | ~500 tokens/chapter |

### Phase 2
| T10 | Register Checker (sai ngữ cảnh) | 🔴 | On-demand per chapter |
| T11 | Batch polish cả chapter | 🔴 | Cost cap required |

### Hán Việt Problem Taxonomy
1. **Thiếu đồng bộ thuật ngữ** — "linh khí" / "linh lực" / "nguyên lực" → 🟢 Terminology Synchronizer
2. **Pinyin sót lại** — "dantian" → "đan điền" → 🟢 dict / 🔴 unknown
3. **Hán Việt sai ngữ cảnh** — nông dân nói văn từ → 🔴 Register Checker
4. **Density quá cao/thấp** — mất cân bằng đọc → 🟢 Density Meter

---

## Track 2: Deep Edit Workshop

### Must-Have (MVP)
| # | Feature | AI | Note |
|---|---------|----|----|
| E1 | Story Health Dashboard — 6 chiều | 🟢 | Aggregate existing checkers |
| E2 | Chapter Heatmap — màu theo severity | 🟢 | Visual per chapter |
| E3 | Foreshadowing Tracker — resolved/dangling | 🟢 | Query project.foreshadowings[] |
| E4 | Arc Timeline — nhân vật × chapter | 🟢 | In-memory scan |
| E5 | Structural Ops — merge/split/reorder | 🟢 | Tái dùng Surgery + Retcon |
| E6 | Batch Scanner — phát hiện lỗi hàng loạt | 🟢 | Pattern + dict + regex |
| E7 | Pattern Dictionary — từ hay sai, dấu câu, MTL | 🟢 | Pre-built + user custom |
| E8 | Batch Fix by Category | 🟢 | Apply corrections theo loại |
| E9 | Custom Rules Editor (StyleRules) | 🟢 | Extend existing styleRules table |
| E10 | Prose Elevator — rewrite chapter | 🔴 | ~2-3K tokens/chapter |
| E11 | OOC Quick Scan | 🔴 | Expose existing checker via UI |

### Phase 2
| E12 | Foreshadowing Resolution Suggest | 🔴 | ~600 tokens/item |
| E13 | Arc patch suggestion | 🔴 | ~800 tokens/nhân vật |
| E14 | Style Harmonizer batch | 🔴 | Cost cap required |

### Content Hash Cache Gate
```
if (chapterMetadata.contentHash === newHash && scanResult exists):
  → skip re-scan → free
else:
  → run scan → update adaptationScanResults
```

---

## Track 3: Phóng Tác Pro

### Must-Have (MVP)
| # | Feature | AI | Note |
|---|---------|----|----|
| A1 | Source Import — project hoặc text | 🟢 | Entry point |
| A2 | Divergence Level Picker (0-100%) | 🟢 | Config slider |
| A3 | Giữ/Bỏ Selector — characters/world/plot | 🟢 | Extend AdaptationConfig |
| A4 | Character Remap table | 🟢 | A(source) → A'(new) |
| A5 | Source DNA Scanner | 🔴 | ~1.5K tokens, 1x per project |
| A6 | Generate New Bible | 🔴 | ~3K tokens, 1x per project |
| A7 | Giữ 6 modes hiện có | 🟢/🔴 | Backward compatible |

### Phase 2
| A8 | Divergence Tracker per chapter | 🟢 | Text similarity score |
| A9 | Copyright-Safe Meter | 🟢 | % similarity remaining |

---

## Storage Requirements

### DB Schema — Version 12 (2 tables mới)
```typescript
adaptationGlossaries:
  'id, projectId, [projectId+category], createdAt'
  // {id, projectId, canonical, aliases[], category, pinyinSource?, notes?}

adaptationScanResults:
  'id, projectId, trackId, [projectId+trackId], status, createdAt'
  // {id, projectId, chapterId, issueType, severity, position, suggestedFix, contentHash}
```

### Tables tái dùng (không cần migrate)
- `styleRules` → Glossary rules, custom correction rules
- `styleCorrections` → Correction history
- `rewriteTasks` → Prose Elevator queue
- `chapterMetadata.contentHash` → AI cache gate
- `surgerySpecs` / `impactScans` → Batch edit jobs
- `sourceImportJobs` → Source import tracking

---

## Token Tracking

### New PipelineStepLabels cần thêm
```typescript
| 'translation_polish'
| 'prose_elevation'
| 'source_dna_scan'
| 'batch_correction'
| 'ooc_scan'
| 'naturalness_score'
```

### Cost Estimates per operation
| Action | Tokens est. | Frequency |
|--------|-------------|-----------|
| Source DNA Scanner | ~1.5K | 1x/project |
| Generate New Bible | ~3K | 1x/project |
| Prose Elevator (1 ch) | ~2-3K | On-demand |
| OOC Quick Scan (1 ch) | ~1K | On-demand |
| Naturalness Score | ~500 | Per chapter |
| Polish đoạn văn | ~800 | Per đoạn |

### Cost Control Mechanisms
1. **Lazy AI** — Free tier scan trước, AI chỉ khi user click
2. **Content hash cache** — Không re-run AI nếu chapter không đổi
3. **Cost preview** — Hiển thị ước tính token trước batch job
4. **Token budget per session** — User set max, auto-stop

---

## Memory System Integration

VietTruyen đã có Hybrid Memory system (5 layers):
- Layer 1: Structured KG (entityDefinitions, timelineFacts, narrativeStateFacts)
- Layer 2: Narrative Graph (narrativeNodes, narrativeEdges, narrativeCommunities)
- Layer 3: Vector RAG (memoryEmbeddings + Gemini/OpenRouter embedding)
- Layer 4: HSC — Hierarchical Summary Cache (3-tier: chapter/arc/global)
- Layer 5: Hybrid Query Orchestrator (retrieveHybridMemory())

**Adaptation Studio dùng memory system này để:**
- Track 1: entityDefinitions → Glossary canonical lookup
- Track 2: narrativeStateFacts + pendingHooks → Health Dashboard
- Track 3: HSC global + entity snapshot → Source DNA context

---

## Delivery Roadmap (Option A tiered)

| Tier | Timeline | Track | Deliverable |
|------|----------|-------|-------------|
| Quick Win | 0-30 ngày | Track 1 | Translation Workshop MVP (T1-T9) |
| Differentiation | 1-3 tháng | Track 2 | Deep Edit Workshop MVP (E1-E11) |
| Long-term Moat | 3-6 tháng | Track 3 | Phóng Tác Pro MVP (A1-A7) |
