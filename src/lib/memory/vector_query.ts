import { getProjectArcs, getProjectMemoryEmbeddings, replaceProjectMemoryEmbeddings } from '../../db/narrative_db';
import type {
  MemoryEmbeddingContentType,
  MemoryEmbeddingRecord,
  MemorySearchHit,
} from '../../types/memory_embedding';
import type { Project, StoryFact } from '../../types/story';
import type { Arc, Chapter, Character, WorldRules } from '../../types/story';
import {
  cosineSimilarity,
  getDefaultEmbeddingAdapter,
  reuseExistingEmbedding,
  type EmbeddingProviderAdapter,
} from './embedding_adapter';
import { getActiveEmbeddingDimension } from './embedding_initializer';
import { mirrorProjectMemoryEmbeddings } from '../supabase/memory_embedding_service';

function hashString(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function normalizeLookup(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function buildRecordId(projectId: string, scope: string): string {
  return `${projectId}:memory:${scope}`;
}

function buildSourceTextHash(sourceText: string): string {
  return hashString(normalizeLookup(sourceText));
}

interface EmbeddingSource {
  id: string;
  projectId: string;
  chapterId?: string;
  sceneId?: string;
  entityIds: string[];
  arcIds: string[];
  contentType: MemoryEmbeddingContentType;
  sourceText: string;
  sourceTextHash: string;
  chapterIndex: number;
}

function truncateText(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildSceneTexts(chapter: Chapter): string[] {
  const paragraphs = splitParagraphs(chapter.content || '');
  if (paragraphs.length >= 2) {
    return paragraphs;
  }

  const sentences = splitSentences(chapter.content || '');
  if (sentences.length === 0) {
    return [];
  }

  const groups: string[] = [];
  for (let index = 0; index < sentences.length; index += 3) {
    groups.push(sentences.slice(index, index + 3).join(' '));
  }
  return groups;
}

function getArcIdsForChapter(arcs: Arc[], chapterIndex: number): string[] {
  return arcs
    .filter((arc) => chapterIndex >= arc.chapterStart && chapterIndex <= arc.chapterEnd)
    .map((arc) => arc.id);
}

function buildSceneSources(project: Project, chapter: Chapter, arcIds: string[]): EmbeddingSource[] {
  const chapterIndex = chapter.sequenceNumber ?? 0;
  return buildSceneTexts(chapter).map((sceneText, index) => {
    const sourceText = truncateText(sceneText, 700);
    return {
      id: buildRecordId(project.id, `scene:${chapter.id}:${index}`),
      projectId: project.id,
      chapterId: chapter.id,
      sceneId: `${chapter.id}:scene:${index}`,
      entityIds: [],
      arcIds,
      contentType: 'scene',
      sourceText,
      sourceTextHash: buildSourceTextHash(sourceText),
      chapterIndex,
    };
  });
}

function buildChapterSummarySource(project: Project, chapter: Chapter, arcIds: string[]): EmbeddingSource[] {
  if (!chapter.summary?.trim()) return [];
  const sourceText = truncateText(chapter.summary, 500);
  return [
    {
      id: buildRecordId(project.id, `chapter-summary:${chapter.id}`),
      projectId: project.id,
      chapterId: chapter.id,
      entityIds: [],
      arcIds,
      contentType: 'chapter_summary',
      sourceText,
      sourceTextHash: buildSourceTextHash(sourceText),
      chapterIndex: chapter.sequenceNumber ?? 0,
    },
  ];
}

function buildCharacterNoteSource(project: Project, character: Character): EmbeddingSource[] {
  const noteParts = [
    `${character.name} (${character.role})`,
    character.currentStage && `Cảnh giới: ${character.currentStage}`,
    character.traits && `Tính cách: ${character.traits}`,
    character.psychology?.deepFear && `Nỗi sợ sâu: ${character.psychology.deepFear}`,
    character.psychology?.hiddenDesire && `Mong muốn ẩn: ${character.psychology.hiddenDesire}`,
    character.psychology?.selfDeception && `Tự lừa mình: ${character.psychology.selfDeception}`,
    character.arc && `Arc: ${character.arc}`,
    character.aliases?.length ? `Bí danh: ${character.aliases.join(', ')}` : '',
  ].filter(Boolean);

  if (noteParts.length === 0) return [];

  const sourceText = noteParts.join(' | ');
  return [
    {
      id: buildRecordId(project.id, `character-note:${character.id}`),
      projectId: project.id,
      entityIds: [character.id],
      arcIds: [],
      contentType: 'character_note',
      sourceText,
      sourceTextHash: buildSourceTextHash(sourceText),
      chapterIndex: 0,
    },
  ];
}

function buildStoryFactSources(
  projectId: string,
  entityId: string,
  prefix: string,
  contentType: 'canon_fact',
  facts: StoryFact[]
): EmbeddingSource[] {
  return facts
    .filter((fact) => fact.value?.trim())
    .map((fact) => {
      const sourceText = `${prefix} ${fact.key}: ${fact.value}`.trim();
      return {
        id: buildRecordId(projectId, `canon-fact:${entityId}:${fact.id || fact.key}`),
        projectId,
        entityIds: entityId ? [entityId] : [],
        arcIds: [],
        contentType,
        sourceText,
        sourceTextHash: buildSourceTextHash(sourceText),
        chapterIndex: 0,
      };
    });
}

function buildWorldNoteSource(project: Project, world: WorldRules): EmbeddingSource[] {
  const sourceText = [
    project.worldSetting && `Thiết lập: ${project.worldSetting}`,
    world.geography && `Địa lý: ${world.geography}`,
    world.magicSystem && `Hệ thống: ${world.magicSystem}`,
    world.techLevel && `Mức công nghệ: ${world.techLevel}`,
    world.currency && `Tiền tệ: ${world.currency}`,
    world.rules && `Luật lệ: ${world.rules}`,
    world.factions.length ? `Phe phái: ${world.factions.join(', ')}` : '',
    project.notes && `Ghi chú: ${truncateText(project.notes, 180)}`,
  ]
    .filter(Boolean)
    .join(' | ');

  if (!sourceText) return [];

  return [
    {
      id: buildRecordId(project.id, 'world-note:root'),
      projectId: project.id,
      entityIds: ['world_rules'],
      arcIds: [],
      contentType: 'world_note',
      sourceText,
      sourceTextHash: buildSourceTextHash(sourceText),
      chapterIndex: 0,
    },
  ];
}

async function buildEmbeddingSources(project: Project): Promise<EmbeddingSource[]> {
  const arcs = await getProjectArcs(project.id).catch(() => []);
  const sources: EmbeddingSource[] = [];

  for (const chapter of project.chapters || []) {
    const chapterIndex = chapter.sequenceNumber ?? 0;
    const arcIds = getArcIdsForChapter(arcs, chapterIndex);
    sources.push(...buildSceneSources(project, chapter, arcIds));
    sources.push(...buildChapterSummarySource(project, chapter, arcIds));
  }

  for (const character of project.characters || []) {
    sources.push(...buildCharacterNoteSource(project, character));
    sources.push(
      ...buildStoryFactSources(project.id, character.id, `${character.name}`, 'canon_fact', character.facts || [])
    );
  }

  sources.push(...buildWorldNoteSource(project, project.world));
  sources.push(
    ...buildStoryFactSources(project.id, 'world_rules', 'Thế giới', 'canon_fact', project.world.facts || [])
  );

  return sources.filter((source) => source.sourceText.trim().length > 0);
}

function finalizeRecord(source: EmbeddingSource, embedding: number[]): MemoryEmbeddingRecord {
  return {
    ...source,
    embedding,
    updatedAt: new Date().toISOString(),
  };
}

export async function upsertMemoryEmbeddings(
  project: Project,
  opts?: { adapter?: EmbeddingProviderAdapter; mirror?: boolean }
): Promise<void> {
  const adapter = opts?.adapter ?? getDefaultEmbeddingAdapter();
  const existingRecords = await getProjectMemoryEmbeddings(project.id);
  const existingById = new Map(existingRecords.map((record) => [record.id, record]));
  const nextSources = await buildEmbeddingSources(project);
  const nextRecords: MemoryEmbeddingRecord[] = [];

  const sourcesNeedingEmbeddings: EmbeddingSource[] = [];
  const expectedDimension = getActiveEmbeddingDimension();
  for (const source of nextSources) {
    const existing = existingById.get(source.id);
    const reused = reuseExistingEmbedding(existing, source.sourceTextHash, expectedDimension);
    if (reused) {
      nextRecords.push(finalizeRecord(source, reused));
      continue;
    }
    sourcesNeedingEmbeddings.push(source);
  }

  if (sourcesNeedingEmbeddings.length > 0) {
    const embeddings = await adapter.embed(sourcesNeedingEmbeddings.map((source) => source.sourceText));
    sourcesNeedingEmbeddings.forEach((source, index) => {
      nextRecords.push(finalizeRecord(source, embeddings[index] || []));
    });
  }

  nextRecords.sort((left, right) => left.id.localeCompare(right.id));
  await replaceProjectMemoryEmbeddings(project.id, nextRecords);

  if (opts?.mirror !== false) {
    await mirrorProjectMemoryEmbeddings(project.id, nextRecords);
  }
}

export async function searchMemoryEmbeddings(
  projectId: string,
  query: string,
  opts?: {
    adapter?: EmbeddingProviderAdapter;
    chapterIndex?: number;
    limit?: number;
    contentTypes?: MemoryEmbeddingContentType[];
  }
): Promise<MemorySearchHit[]> {
  if (!query.trim()) return [];

  const adapter = opts?.adapter ?? getDefaultEmbeddingAdapter();
  const [queryEmbedding] = await adapter.embed([query]);
  const allRecords = await getProjectMemoryEmbeddings(projectId);

  const filteredRecords = allRecords.filter((record) => {
    if (opts?.contentTypes?.length && !opts.contentTypes.includes(record.contentType)) {
      return false;
    }
    if (opts?.chapterIndex != null && record.chapterIndex > 0 && record.chapterIndex > opts.chapterIndex) {
      return false;
    }
    return true;
  });

  const hits = filteredRecords
    .map((record) => {
      const vectorScore = cosineSimilarity(queryEmbedding, record.embedding);
      const proximityScore =
        opts?.chapterIndex == null
          ? 0
          : record.chapterIndex <= 0
            ? 0.2
            : 1 / (1 + Math.abs(opts.chapterIndex - record.chapterIndex));
      const finalScore = vectorScore * 0.8 + proximityScore * 0.2;
      return { record, score: finalScore, vectorScore, proximityScore };
    })
    .filter((hit) => hit.score > 0)
    .sort((left, right) => right.score - left.score || left.record.id.localeCompare(right.record.id));

  return hits.slice(0, opts?.limit ?? 5);
}
