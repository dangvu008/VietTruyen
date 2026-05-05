/**
 * File: memory_ai_enricher.ts
 * Purpose: AI enrichment layer on top of deterministic memory extraction.
 *          Discovers new entities, relationship pairs, and implicit state changes
 *          that regex/keyword matching cannot capture.
 * Layer: Infra → Memory
 * Domain: Narrative Memory
 * Deps: ai_client (via callAiModelTracked), narrative_memory types
 *
 * Design: Additive-only. Never mutates existing high-confidence extractions.
 *         Only operates on ambiguous deps (confidence < 0.75) or unmapped passages.
 */
import { createId } from '../../core/id';
import type {
  AttributeDependency,
  EntityDefinition,
  TimelineFact,
} from '../../types/narrative_memory';
import type { AiModel, Chapter } from '../../types/story';
import { callAiModelTracked } from '../ai/tracked_ai_client';
import { quickTruncate } from '../ai/token_estimator';
import { MEMORY_EXTRACTOR_VERSION } from './memory_registry';
import { mergeDependencies, mergeTimelineFacts } from './delta_merge';

export interface AiEnrichmentParams {
  projectId: string;       // Explicit — Chapter type does not carry projectId
  chapter: Chapter;
  entityDefinitions: EntityDefinition[];
  dependencies: AttributeDependency[];
  timelineFacts: TimelineFact[];
  /** Pass full AiModel for correct provider + modelName metadata in token tracking */
  model?: AiModel;
  /** @deprecated legacy path — prefer model */
  apiKey?: string;
  /** @deprecated legacy path — prefer model */
  modelId?: string;
}

export interface AiEnrichmentResult {
  dependencies: AttributeDependency[];
  timelineFacts: TimelineFact[];
  warnings: string[];
}

// [Domain:NarrativeMemory] STEP 1 — Raw AI output contract
interface EnrichmentAiResponse {
  newRelationships: Array<{
    sourceEntityName: string;
    targetEntityName: string;
    relationshipType: string;         // e.g. "đối địch", "đồng minh", "thầy-trò"
    evidence: string;                 // quote from chapter proving this
    confidence: number;               // 0-1
  }>;
  implicitStateChanges: Array<{
    entityName: string;
    attributeKey: string;             // e.g. "location", "status", "factions"
    inferredValue: string;
    evidence: string;
    confidence: number;
  }>;
  newEntityMentions: Array<{
    name: string;
    entityType: 'character' | 'location' | 'organization' | 'item';
    evidence: string;
    confidence: number;
  }>;
}

const ENRICHER_SYSTEM_PROMPT = `Bạn là bộ phân tích narrative cho truyện chữ tiếng Việt.
Nhiệm vụ: trích xuất thông tin ngầm định mà regex KHÔNG thể bắt được.

LUẬT BẮT BUỘC:
1. Chỉ trích xuất từ văn bản đã cho. KHÔNG suy đoán ngoài văn bản.
2. "evidence" phải là đoạn TRÍCH NGUYÊN VĂN, tối đa 100 ký tự.
3. confidence: 0.9 = chắc chắn, 0.7 = khả năng cao, 0.5 = có thể.
4. Chỉ liệt kê những quan hệ/thay đổi THỰC SỰ xuất hiện trong chương này.
5. Trả về JSON hợp lệ, không có markdown wrapper.`;

function buildEnrichmentPrompt(
  chapterText: string,
  entityNames: string[],
  ambiguousPassages: string[]
): string {
  const entityList = entityNames.slice(0, 20).join(', ');
  // [Domain:NarrativeMemory] Longer verbatim snippets (MemPalace Drawer preservation)
  // 500 chars per passage (up from 150) — retains more narrative context
  const passages = ambiguousPassages
    .slice(0, 5)
    .map((p, i) => `[${i + 1}] ${quickTruncate(p, 500)}`)
    .join('\n');

  return `THỰC THỂ ĐÃ BIẾT: ${entityList || 'Không có'}

ĐOẠN VĂN CẦN PHÂN TÍCH:
${quickTruncate(chapterText, 4000)}

ĐOẠN VĂN ĐỘ TIN CẬY THẤP (cần xác minh):
${passages || 'Không có'}

YÊU CẦU: Trả về JSON theo đúng schema sau:
{
  "newRelationships": [
    { "sourceEntityName": "...", "targetEntityName": "...", "relationshipType": "...", "evidence": "...", "confidence": 0.0 }
  ],
  "implicitStateChanges": [
    { "entityName": "...", "attributeKey": "...", "inferredValue": "...", "evidence": "...", "confidence": 0.0 }
  ],
  "newEntityMentions": [
    { "name": "...", "entityType": "character|location|organization|item", "evidence": "...", "confidence": 0.0 }
  ]
}`;
}

function parseAiResponse(raw: string): EnrichmentAiResponse | null {
  const trimmed = raw.trim();
  // Strip markdown fences if model adds them despite instructions
  const jsonBody = trimmed.startsWith('{')
    ? trimmed
    : trimmed.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  try {
    return JSON.parse(jsonBody) as EnrichmentAiResponse;
  } catch {
    return null;
  }
}

// [Domain:NarrativeMemory] STEP 2 — Map AI response to AttributeDependency records
function mapRelationshipsToDependencies(
  relationships: EnrichmentAiResponse['newRelationships'],
  existingDeps: AttributeDependency[],
  projectId: string,
  chapter: Chapter,
  entityDefinitions: EntityDefinition[]
): AttributeDependency[] {
  const now = new Date().toISOString();
  const existingIds = new Set(existingDeps.map((d) => d.id));
  const entityMap = new Map(
    entityDefinitions.map((e) => [e.canonicalName.toLowerCase(), e])
  );

  const newDeps: AttributeDependency[] = [];

  for (const rel of relationships) {
    if (rel.confidence < 0.5) continue;

    const source = entityMap.get(rel.sourceEntityName.toLowerCase());
    if (!source) continue;

    const depId = `${chapter.id}:${source.entityId}:relationship:${rel.targetEntityName.toLowerCase()}`;
    if (existingIds.has(depId)) continue;

    newDeps.push({
      id: createId(),
      chapterId: chapter.id,
      projectId,
      chapterIndex: chapter.sequenceNumber ?? 0,
      entityId: source.entityId,
      entityType: source.entityType,
      attributeKey: `relationship_${rel.targetEntityName.toLowerCase().replace(/\s+/g, '_')}`,
      importance: rel.confidence >= 0.8 ? 'moderate' : 'minor',
      context: rel.evidence,
      snippets: [rel.evidence],
      dependencyStatus: 'fresh',
      confidence: rel.confidence,
      contentHash: '',
      createdAt: now,
      updatedAt: now,
    });
  }

  return newDeps;
}

// [Domain:NarrativeMemory] STEP 3 — Map implicit state changes to TimelineFact
function mapStateChangesToFacts(
  stateChanges: EnrichmentAiResponse['implicitStateChanges'],
  projectId: string,
  chapter: Chapter,
  entityDefinitions: EntityDefinition[]
): TimelineFact[] {
  const now = new Date().toISOString();
  const entityMap = new Map(
    entityDefinitions.map((e) => [e.canonicalName.toLowerCase(), e])
  );

  const newFacts: TimelineFact[] = [];

  for (const change of stateChanges) {
    if (change.confidence < 0.6) continue;

    const entity = entityMap.get(change.entityName.toLowerCase());
    if (!entity) continue;

    newFacts.push({
      id: createId(),
      entityId: entity.entityId,
      projectId,
      entityType: entity.entityType,
      attributeKey: change.attributeKey,
      value: change.inferredValue,
      chapterFrom: chapter.sequenceNumber ?? 0,
      chapterTo: undefined,
      sourceChapterId: chapter.id,
      sourceType: 'chapter_extract',
      confidence: change.confidence,
      reviewSuggested: change.confidence < 0.8,
      extractorVersion: MEMORY_EXTRACTOR_VERSION,
      createdAt: now,
      updatedAt: now,
    });
  }

  return newFacts;
}

export async function enrichChapterMemoryWithAi(
  params: AiEnrichmentParams
): Promise<AiEnrichmentResult> {
  // [Domain:NarrativeMemory] STEP 0 — Skip conditions
  const ambiguous = params.dependencies.filter((d) => d.confidence < 0.75);
  const chapterText = `${params.chapter.summary || ''}\n${params.chapter.content || ''}`.trim();

  // [Domain:NarrativeMemory] STEP 0b — Resolve model config (prefer AiModel object)
  const resolvedModel = params.model;
  const resolvedModelId = resolvedModel?.modelId ?? params.modelId;
  const resolvedProvider = resolvedModel?.provider ?? 'openai';
  const resolvedModelName = resolvedModel?.name ?? resolvedModelId ?? 'unknown';
  const resolvedBaseUrl = resolvedModel?.baseUrl;

  const canRunAi = resolvedModelId && chapterText;
  if (!canRunAi) {
    return {
      dependencies: params.dependencies,
      timelineFacts: params.timelineFacts,
      warnings: ambiguous.length > 0
        ? ['AI enrichment bỏ qua — chưa có model được cấu hình']
        : [],
    };
  }

  const entityNames = params.entityDefinitions.map((e) => e.canonicalName);
  const ambiguousPassages = ambiguous.map((d) => d.context).filter(Boolean);

  let rawResponse: string;
  try {
    rawResponse = await callAiModelTracked({
      provider: resolvedProvider,
      modelId: resolvedModelId!,
      modelName: resolvedModelName,
      baseUrl: resolvedBaseUrl,
      systemPrompt: ENRICHER_SYSTEM_PROMPT,
      userPrompt: buildEnrichmentPrompt(chapterText, entityNames, ambiguousPassages),
      taskType: 'chat',
    });
  } catch (err) {
    return {
      dependencies: params.dependencies,
      timelineFacts: params.timelineFacts,
      warnings: [`AI enrichment thất bại: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const parsed = parseAiResponse(rawResponse);
  if (!parsed) {
    return {
      dependencies: params.dependencies,
      timelineFacts: params.timelineFacts,
      warnings: ['AI enrichment: response không parse được, bỏ qua'],
    };
  }

  // [Domain:NarrativeMemory] STEP 4 — Merge enriched data (additive only)
  const newDeps = mapRelationshipsToDependencies(
    parsed.newRelationships ?? [],
    params.dependencies,
    params.projectId,
    params.chapter,
    params.entityDefinitions
  );

  const newFacts = mapStateChangesToFacts(
    parsed.implicitStateChanges ?? [],
    params.projectId,
    params.chapter,
    params.entityDefinitions
  );

  const warnings: string[] = [];
  if ((parsed.newEntityMentions ?? []).length > 0) {
    // Log new entity mentions — not yet creating EntityDefinitions automatically
    // (requires user confirmation to prevent hallucination pollution)
    const mentions = parsed.newEntityMentions
      .filter((m) => m.confidence >= 0.7)
      .map((m) => `${m.name} (${m.entityType})`)
      .join(', ');
    if (mentions) {
      warnings.push(`Phát hiện thực thể mới chưa đăng ký: ${mentions}. Cân nhắc thêm vào Bible.`);
    }
  }

  return {
    dependencies: mergeDependencies(params.dependencies, newDeps),
    timelineFacts: mergeTimelineFacts(params.timelineFacts, newFacts),
    warnings,
  };
}
