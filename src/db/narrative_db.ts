/**
 * File: narrative_db.ts
 * Purpose: Dexie IndexedDB database cho Narrative Memory Engine
 * Layer: Infrastructure (Database)
 * Domain: NarrativeMemory → [timeline, dependencies, propagation, style learning]
 *
 * Data Contract:
 * - Input: CRUD operations từ services
 * - Output: Typed records từ IndexedDB
 * - Scale: Thiết kế cho 1000+ chương, triệu chữ
 */

import Dexie from 'dexie';
import type { Table } from 'dexie';
import type {
  AttributeDependency,
  CanonicalEdit,
  ChapterDependency,
  ChapterMetadata,
  EntityDefinition,
  EntitySnapshot,
  IndexJob,
  ProjectIndexState,
  PropagationResult,
  PropagationTask,
  TimelineFact,
} from '../types/narrative_memory';
import type {
  NarrativeCommunity,
  NarrativeEdge,
  NarrativeNode,
} from '../types/narrative_graph';
import type { MemoryEmbeddingRecord } from '../types/memory_embedding';
import type { Arc, Chapter } from '../types/story';
import type {
  ImpactScanResult,
  RewriteTask,
  SourceImportJob,
  SurgerySpec,
} from '../types/surgery';
import type { StyleCorrection, StyleRule } from '../types/style_learning';
import type { CachedSummary } from '../types/summary_cache';

export interface StoredChapter extends Chapter {
  projectId: string;
  index: number;
  [key: string]: any;
}

type DexieCompatible<T> = T & { [key: string]: any };

class NarrativeDatabase extends Dexie {
  chapters!: Table<DexieCompatible<StoredChapter>>;

  // Legacy compatibility tables
  entitySnapshots!: Table<DexieCompatible<EntitySnapshot>>;
  chapterDeps!: Table<DexieCompatible<ChapterDependency>>;

  // Phase 1 memory tables
  entityDefinitions!: Table<DexieCompatible<EntityDefinition>>;
  timelineFacts!: Table<DexieCompatible<TimelineFact>>;
  chapterDependencies!: Table<DexieCompatible<AttributeDependency>>;
  chapterMetadata!: Table<DexieCompatible<ChapterMetadata>>;
  canonicalEdits!: Table<DexieCompatible<CanonicalEdit>>;
  propagationTasks!: Table<DexieCompatible<PropagationTask>>;
  propagationLogs!: Table<DexieCompatible<PropagationResult>>;
  indexJobs!: Table<DexieCompatible<IndexJob>>;
  projectIndexState!: Table<DexieCompatible<ProjectIndexState>>;

  // Style learning tables
  styleCorrections!: Table<DexieCompatible<StyleCorrection>>;
  styleRules!: Table<DexieCompatible<StyleRule>>;

  // Surgery workflow tables
  projectArcs!: Table<DexieCompatible<Arc>>;
  surgerySpecs!: Table<DexieCompatible<SurgerySpec>>;
  impactScans!: Table<DexieCompatible<ImpactScanResult>>;
  rewriteTasks!: Table<DexieCompatible<RewriteTask>>;
  sourceImportJobs!: Table<DexieCompatible<SourceImportJob>>;

  // Narrative graph tables
  narrativeNodes!: Table<DexieCompatible<NarrativeNode>>;
  narrativeEdges!: Table<DexieCompatible<NarrativeEdge>>;
  narrativeCommunities!: Table<DexieCompatible<NarrativeCommunity>>;

  // HSC (Hierarchical Summary Cache) table
  summaryCache!: Table<DexieCompatible<CachedSummary>>;
  memoryEmbeddings!: Table<DexieCompatible<MemoryEmbeddingRecord>>;

  constructor() {
    super('narrative-memory-db');

    this.version(1).stores({
      chapters: 'id, projectId, [projectId+index], status, updatedAt',
      entitySnapshots: 'id, entityId, projectId, [projectId+entityId], [entityId+chapterIndex], chapterId',
      chapterDeps: 'id, chapterId, entityId, projectId, [projectId+chapterId], [projectId+entityId]',
      chapterMetadata: 'chapterId, projectId',
      propagationLogs: 'id, projectId, entityId, status, createdAt',
    });

    this.version(2).stores({
      chapters: 'id, projectId, [projectId+index], status, updatedAt',
      entitySnapshots: 'id, entityId, projectId, [projectId+entityId], [entityId+chapterIndex], chapterId',
      chapterDeps: 'id, chapterId, entityId, projectId, [projectId+chapterId], [projectId+entityId]',
      chapterMetadata: 'chapterId, projectId',
      propagationLogs: 'id, projectId, entityId, status, createdAt',
      styleCorrections: 'id, projectId, chapterId, category, status, [projectId+status], [projectId+chapterId]',
      styleRules: 'id, projectId, category, weight, [projectId+category]',
    });

    this.version(3).stores({
      chapters: 'id, projectId, [projectId+index], [projectId+sequenceNumber], status, updatedAt',
      entitySnapshots: 'id, entityId, projectId, [projectId+entityId], [entityId+chapterIndex], chapterId',
      chapterDeps: 'id, chapterId, entityId, projectId, [projectId+chapterId], [projectId+entityId]',
      entityDefinitions: 'id, entityId, projectId, [projectId+entityId], entityType, canonicalName, updatedAt',
      timelineFacts: 'id, entityId, projectId, [projectId+entityId], [projectId+entityId+attributeKey], [projectId+sourceChapterId], chapterFrom, chapterTo, sourceType',
      chapterDependencies: 'id, chapterId, projectId, [projectId+chapterId], [projectId+entityId], [projectId+entityId+attributeKey], chapterIndex, dependencyStatus',
      chapterMetadata: 'chapterId, projectId, [projectId+chapterIndex], contentHash, extractedAt',
      canonicalEdits: 'id, projectId, entityId, [projectId+entityId], [projectId+entityId+attributeKey], effectiveFromChapter, propagationStatus, createdAt',
      propagationTasks: 'id, projectId, chapterId, [projectId+chapterId], [projectId+entityId], [projectId+canonicalEditId], status, chapterIndex, updatedAt',
      propagationLogs: 'id, projectId, entityId, status, createdAt',
      indexJobs: 'id, projectId, [projectId+status], jobType, updatedAt',
      projectIndexState: 'projectId, updatedAt, lastIndexedAt',
      styleCorrections: 'id, projectId, chapterId, category, status, [projectId+status], [projectId+chapterId]',
      styleRules: 'id, projectId, category, weight, [projectId+category]',
    });

    this.version(4).stores({
      chapters: 'id, projectId, [projectId+index], [projectId+sequenceNumber], status, updatedAt',
      entitySnapshots: 'id, entityId, projectId, [projectId+entityId], [entityId+chapterIndex], chapterId',
      chapterDeps: 'id, chapterId, entityId, projectId, [projectId+chapterId], [projectId+entityId]',
      entityDefinitions: 'id, entityId, projectId, [projectId+entityId], entityType, canonicalName, updatedAt',
      timelineFacts: 'id, entityId, projectId, [projectId+entityId], [projectId+entityId+attributeKey], [projectId+sourceChapterId], chapterFrom, chapterTo, sourceType',
      chapterDependencies: 'id, chapterId, projectId, [projectId+chapterId], [projectId+entityId], [projectId+entityId+attributeKey], chapterIndex, dependencyStatus',
      chapterMetadata: 'chapterId, projectId, [projectId+chapterIndex], contentHash, extractedAt',
      canonicalEdits: 'id, projectId, entityId, [projectId+entityId], [projectId+entityId+attributeKey], effectiveFromChapter, propagationStatus, createdAt',
      propagationTasks: 'id, projectId, chapterId, [projectId+chapterId], [projectId+entityId], [projectId+canonicalEditId], status, chapterIndex, updatedAt',
      propagationLogs: 'id, projectId, entityId, status, createdAt',
      indexJobs: 'id, projectId, [projectId+status], jobType, updatedAt',
      projectIndexState: 'projectId, updatedAt, lastIndexedAt',
      styleCorrections: 'id, projectId, chapterId, category, status, [projectId+status], [projectId+chapterId]',
      styleRules: 'id, projectId, category, weight, [projectId+category]',
      projectArcs: 'id, projectId, [projectId+index], [projectId+chapterStart], updatedAt',
      surgerySpecs: 'id, projectId, status, updatedAt, createdAt',
      impactScans: 'id, projectId, specId, status, updatedAt, createdAt',
      rewriteTasks: 'id, projectId, scanId, specId, status, [projectId+status], [projectId+arcId], [projectId+chapterId], updatedAt',
      sourceImportJobs: 'id, projectId, status, updatedAt, createdAt',
    });

    this.version(5).stores({
      chapters: 'id, projectId, [projectId+index], [projectId+sequenceNumber], status, updatedAt',
      entitySnapshots: 'id, entityId, projectId, [projectId+entityId], [entityId+chapterIndex], chapterId',
      chapterDeps: 'id, chapterId, entityId, projectId, [projectId+chapterId], [projectId+entityId]',
      entityDefinitions: 'id, entityId, projectId, [projectId+entityId], entityType, canonicalName, updatedAt',
      timelineFacts: 'id, entityId, projectId, [projectId+entityId], [projectId+entityId+attributeKey], [projectId+sourceChapterId], chapterFrom, chapterTo, sourceType',
      chapterDependencies: 'id, chapterId, projectId, [projectId+chapterId], [projectId+entityId], [projectId+entityId+attributeKey], chapterIndex, dependencyStatus',
      chapterMetadata: 'chapterId, projectId, [projectId+chapterIndex], contentHash, extractedAt',
      canonicalEdits: 'id, projectId, entityId, [projectId+entityId], [projectId+entityId+attributeKey], effectiveFromChapter, propagationStatus, createdAt',
      propagationTasks: 'id, projectId, chapterId, [projectId+chapterId], [projectId+entityId], [projectId+canonicalEditId], status, chapterIndex, updatedAt',
      propagationLogs: 'id, projectId, entityId, status, createdAt',
      indexJobs: 'id, projectId, [projectId+status], jobType, updatedAt',
      projectIndexState: 'projectId, updatedAt, lastIndexedAt',
      styleCorrections: 'id, projectId, chapterId, category, status, [projectId+status], [projectId+chapterId]',
      styleRules: 'id, projectId, category, weight, [projectId+category]',
      projectArcs: 'id, projectId, [projectId+index], [projectId+chapterStart], updatedAt',
      surgerySpecs: 'id, projectId, status, updatedAt, createdAt',
      impactScans: 'id, projectId, specId, status, updatedAt, createdAt',
      rewriteTasks: 'id, projectId, scanId, specId, status, [projectId+status], [projectId+arcId], [projectId+chapterId], updatedAt',
      sourceImportJobs: 'id, projectId, status, updatedAt, createdAt',
      narrativeNodes: 'id, projectId, nodeType, refId, [projectId+nodeType], updatedAt',
      narrativeEdges: 'id, projectId, edgeType, [projectId+fromNodeId], [projectId+toNodeId], updatedAt',
      narrativeCommunities: 'id, projectId, [projectId+score], updatedAt',
    });

    this.version(6).stores({
      chapters: 'id, projectId, [projectId+index], [projectId+sequenceNumber], status, updatedAt',
      entitySnapshots: 'id, entityId, projectId, [projectId+entityId], [entityId+chapterIndex], chapterId',
      chapterDeps: 'id, chapterId, entityId, projectId, [projectId+chapterId], [projectId+entityId]',
      entityDefinitions: 'id, entityId, projectId, [projectId+entityId], entityType, canonicalName, updatedAt',
      timelineFacts: 'id, entityId, projectId, [projectId+entityId], [projectId+entityId+attributeKey], [projectId+sourceChapterId], chapterFrom, chapterTo, sourceType',
      chapterDependencies: 'id, chapterId, projectId, [projectId+chapterId], [projectId+entityId], [projectId+entityId+attributeKey], chapterIndex, dependencyStatus',
      chapterMetadata: 'chapterId, projectId, [projectId+chapterIndex], contentHash, extractedAt',
      canonicalEdits: 'id, projectId, entityId, [projectId+entityId], [projectId+entityId+attributeKey], effectiveFromChapter, propagationStatus, createdAt',
      propagationTasks: 'id, projectId, chapterId, [projectId+chapterId], [projectId+entityId], [projectId+canonicalEditId], status, chapterIndex, updatedAt',
      propagationLogs: 'id, projectId, entityId, status, createdAt',
      indexJobs: 'id, projectId, [projectId+status], jobType, updatedAt',
      projectIndexState: 'projectId, updatedAt, lastIndexedAt',
      styleCorrections: 'id, projectId, chapterId, category, status, [projectId+status], [projectId+chapterId]',
      styleRules: 'id, projectId, category, weight, [projectId+category]',
      projectArcs: 'id, projectId, [projectId+index], [projectId+chapterStart], updatedAt',
      surgerySpecs: 'id, projectId, status, updatedAt, createdAt',
      impactScans: 'id, projectId, specId, status, updatedAt, createdAt',
      rewriteTasks: 'id, projectId, scanId, specId, status, [projectId+status], [projectId+arcId], [projectId+chapterId], updatedAt',
      sourceImportJobs: 'id, projectId, status, updatedAt, createdAt',
      narrativeNodes: 'id, projectId, nodeType, refId, [projectId+nodeType], updatedAt',
      narrativeEdges: 'id, projectId, edgeType, [projectId+fromNodeId], [projectId+toNodeId], updatedAt',
      narrativeCommunities: 'id, projectId, [projectId+score], updatedAt',
      summaryCache: 'id, projectId, tier, [projectId+tier], rangeKey, updatedAt',
    });

    this.version(7).stores({
      chapters: 'id, projectId, [projectId+index], [projectId+sequenceNumber], status, updatedAt',
      entitySnapshots: 'id, entityId, projectId, [projectId+entityId], [entityId+chapterIndex], chapterId',
      chapterDeps: 'id, chapterId, entityId, projectId, [projectId+chapterId], [projectId+entityId]',
      entityDefinitions: 'id, entityId, projectId, [projectId+entityId], entityType, canonicalName, updatedAt',
      timelineFacts: 'id, entityId, projectId, [projectId+entityId], [projectId+entityId+attributeKey], [projectId+sourceChapterId], chapterFrom, chapterTo, sourceType',
      chapterDependencies: 'id, chapterId, projectId, [projectId+chapterId], [projectId+entityId], [projectId+entityId+attributeKey], chapterIndex, dependencyStatus',
      chapterMetadata: 'chapterId, projectId, [projectId+chapterIndex], contentHash, extractedAt',
      canonicalEdits: 'id, projectId, entityId, [projectId+entityId], [projectId+entityId+attributeKey], effectiveFromChapter, propagationStatus, createdAt',
      propagationTasks: 'id, projectId, chapterId, [projectId+chapterId], [projectId+entityId], [projectId+canonicalEditId], status, chapterIndex, updatedAt',
      propagationLogs: 'id, projectId, entityId, status, createdAt',
      indexJobs: 'id, projectId, [projectId+status], jobType, updatedAt',
      projectIndexState: 'projectId, updatedAt, lastIndexedAt',
      styleCorrections: 'id, projectId, chapterId, category, status, [projectId+status], [projectId+chapterId]',
      styleRules: 'id, projectId, category, weight, [projectId+category]',
      projectArcs: 'id, projectId, [projectId+index], [projectId+chapterStart], updatedAt',
      surgerySpecs: 'id, projectId, status, updatedAt, createdAt',
      impactScans: 'id, projectId, specId, status, updatedAt, createdAt',
      rewriteTasks: 'id, projectId, scanId, specId, status, [projectId+status], [projectId+arcId], [projectId+chapterId], updatedAt',
      sourceImportJobs: 'id, projectId, status, updatedAt, createdAt',
      narrativeNodes: 'id, projectId, nodeType, refId, [projectId+nodeType], updatedAt',
      narrativeEdges: 'id, projectId, edgeType, [projectId+fromNodeId], [projectId+toNodeId], updatedAt',
      narrativeCommunities: 'id, projectId, [projectId+score], updatedAt',
      summaryCache: 'id, projectId, tier, [projectId+tier], rangeKey, updatedAt',
      memoryEmbeddings: 'id, projectId, [projectId+contentType], [projectId+chapterId], chapterIndex, updatedAt',
    });
  }
}

export const narrativeDb = new NarrativeDatabase();

export async function storeChapter(chapter: StoredChapter): Promise<void> {
  await narrativeDb.chapters.put(chapter);
}

export async function storeChapters(chapters: StoredChapter[]): Promise<void> {
  if (chapters.length === 0) return;
  await narrativeDb.chapters.bulkPut(chapters);
}

export async function getChapter(id: string): Promise<StoredChapter | undefined> {
  return narrativeDb.chapters.get(id);
}

export async function getProjectChapters(projectId: string): Promise<StoredChapter[]> {
  return narrativeDb.chapters.where('projectId').equals(projectId).sortBy('sequenceNumber');
}

export async function replaceProjectMemoryEmbeddings(
  projectId: string,
  records: MemoryEmbeddingRecord[]
): Promise<void> {
  await narrativeDb.transaction('rw', [narrativeDb.memoryEmbeddings], async () => {
    await narrativeDb.memoryEmbeddings.where('projectId').equals(projectId).delete();
    if (records.length > 0) {
      await narrativeDb.memoryEmbeddings.bulkPut(records);
    }
  });
}

export async function getProjectMemoryEmbeddings(projectId: string): Promise<MemoryEmbeddingRecord[]> {
  return narrativeDb.memoryEmbeddings.where('projectId').equals(projectId).toArray();
}

export async function replaceProjectChapters(projectId: string, chapters: StoredChapter[]): Promise<void> {
  await narrativeDb.transaction('rw', [narrativeDb.chapters], async () => {
    await narrativeDb.chapters.where('projectId').equals(projectId).delete();
    if (chapters.length > 0) {
      await narrativeDb.chapters.bulkPut(chapters);
    }
  });
}

export async function deleteChapter(id: string): Promise<void> {
  await narrativeDb.transaction(
    'rw',
    [
      narrativeDb.chapters,
      narrativeDb.chapterDeps,
      narrativeDb.chapterMetadata,
      narrativeDb.chapterDependencies,
      narrativeDb.timelineFacts,
      narrativeDb.propagationTasks,
    ],
    async () => {
      await narrativeDb.chapters.delete(id);
      await narrativeDb.chapterDeps.where('chapterId').equals(id).delete();
      await narrativeDb.chapterMetadata.where('chapterId').equals(id).delete();
      await narrativeDb.chapterDependencies.where('chapterId').equals(id).delete();
      await narrativeDb.timelineFacts
        .filter((fact) => fact.sourceChapterId === id)
        .delete();
      await narrativeDb.propagationTasks.where('chapterId').equals(id).delete();
    }
  );
}

export async function storeEntityDefinitions(definitions: EntityDefinition[]): Promise<void> {
  await narrativeDb.entityDefinitions.bulkPut(definitions);
}

export async function getEntityDefinitions(projectId: string): Promise<EntityDefinition[]> {
  return narrativeDb.entityDefinitions.where('projectId').equals(projectId).toArray();
}

export async function getEntityDefinition(
  projectId: string,
  entityId: string
): Promise<EntityDefinition | undefined> {
  return narrativeDb.entityDefinitions.where('[projectId+entityId]').equals([projectId, entityId]).first();
}

export async function searchEntityDefinitions(
  projectId: string,
  query: string
): Promise<EntityDefinition[]> {
  const normalized = query.trim().toLowerCase();
  const definitions = await getEntityDefinitions(projectId);
  if (!normalized) return definitions;
  return definitions.filter((definition) => {
    const haystacks = [
      definition.canonicalName,
      ...definition.aliases,
      ...Object.keys(definition.attributes),
      ...Object.values(definition.attributes),
    ].map((value) => value.toLowerCase());
    return haystacks.some((value) => value.includes(normalized));
  });
}

export async function replaceTimelineFactsForChapter(
  projectId: string,
  chapterId: string,
  facts: TimelineFact[]
): Promise<void> {
  await narrativeDb.transaction('rw', [narrativeDb.timelineFacts], async () => {
    await narrativeDb.timelineFacts
      .where('[projectId+sourceChapterId]')
      .between([projectId, chapterId], [projectId, chapterId], true, true)
      .delete();
    if (facts.length > 0) {
      await narrativeDb.timelineFacts.bulkPut(facts);
    }
  });
}

export async function storeTimelineFacts(facts: TimelineFact[]): Promise<void> {
  if (facts.length === 0) return;
  await narrativeDb.timelineFacts.bulkPut(facts);
}

export async function getTimelineFactsForEntity(
  projectId: string,
  entityId: string
): Promise<TimelineFact[]> {
  return narrativeDb.timelineFacts
    .where('[projectId+entityId]')
    .equals([projectId, entityId])
    .sortBy('chapterFrom');
}

export async function getActiveTimelineFactsAtChapter(
  projectId: string,
  entityId: string,
  chapterIndex: number
): Promise<TimelineFact[]> {
  const facts = await getTimelineFactsForEntity(projectId, entityId);
  return facts.filter((fact) => fact.chapterFrom <= chapterIndex && (fact.chapterTo == null || fact.chapterTo >= chapterIndex));
}

export async function replaceChapterDependencies(
  projectId: string,
  chapterId: string,
  dependencies: AttributeDependency[]
): Promise<void> {
  await narrativeDb.transaction('rw', [narrativeDb.chapterDependencies], async () => {
    await narrativeDb.chapterDependencies
      .where('[projectId+chapterId]')
      .equals([projectId, chapterId])
      .delete();
    if (dependencies.length > 0) {
      await narrativeDb.chapterDependencies.bulkPut(dependencies);
    }
  });
}

export async function storeChapterMetadata(metadata: ChapterMetadata): Promise<void> {
  await narrativeDb.chapterMetadata.put(metadata);
}

export async function getChapterMetadata(chapterId: string): Promise<ChapterMetadata | undefined> {
  return narrativeDb.chapterMetadata.get(chapterId);
}

export async function getProjectChapterMetadata(projectId: string): Promise<ChapterMetadata[]> {
  return narrativeDb.chapterMetadata.where('projectId').equals(projectId).sortBy('chapterIndex');
}

export async function storeProjectArcs(arcs: Arc[]): Promise<void> {
  if (arcs.length === 0) return;
  await narrativeDb.projectArcs.bulkPut(arcs);
}

export async function replaceProjectArcs(projectId: string, arcs: Arc[]): Promise<void> {
  await narrativeDb.transaction('rw', [narrativeDb.projectArcs], async () => {
    await narrativeDb.projectArcs.where('projectId').equals(projectId).delete();
    if (arcs.length > 0) {
      await narrativeDb.projectArcs.bulkPut(arcs);
    }
  });
}

export async function getProjectArcs(projectId: string): Promise<Arc[]> {
  return narrativeDb.projectArcs.where('projectId').equals(projectId).sortBy('index');
}

export async function getArcById(arcId: string): Promise<Arc | undefined> {
  return narrativeDb.projectArcs.get(arcId);
}

export async function storeSurgerySpec(spec: SurgerySpec): Promise<void> {
  await narrativeDb.surgerySpecs.put(spec);
}

export async function getSurgerySpec(specId: string): Promise<SurgerySpec | undefined> {
  return narrativeDb.surgerySpecs.get(specId);
}

export async function getProjectSurgerySpecs(projectId: string): Promise<SurgerySpec[]> {
  return narrativeDb.surgerySpecs.where('projectId').equals(projectId).sortBy('updatedAt');
}

export async function storeImpactScan(scan: ImpactScanResult): Promise<void> {
  await narrativeDb.impactScans.put(scan);
}

export async function getImpactScan(scanId: string): Promise<ImpactScanResult | undefined> {
  return narrativeDb.impactScans.get(scanId);
}

export async function getProjectImpactScans(projectId: string): Promise<ImpactScanResult[]> {
  return narrativeDb.impactScans.where('projectId').equals(projectId).sortBy('updatedAt');
}

export async function replaceProjectRewriteTasks(projectId: string, tasks: RewriteTask[]): Promise<void> {
  await narrativeDb.transaction('rw', [narrativeDb.rewriteTasks], async () => {
    await narrativeDb.rewriteTasks.where('projectId').equals(projectId).delete();
    if (tasks.length > 0) {
      await narrativeDb.rewriteTasks.bulkPut(tasks);
    }
  });
}

export async function storeRewriteTasks(tasks: RewriteTask[]): Promise<void> {
  if (tasks.length === 0) return;
  await narrativeDb.rewriteTasks.bulkPut(tasks);
}

export async function getProjectRewriteTasks(projectId: string): Promise<RewriteTask[]> {
  return narrativeDb.rewriteTasks.where('projectId').equals(projectId).sortBy('updatedAt');
}

export async function getScanRewriteTasks(scanId: string): Promise<RewriteTask[]> {
  return narrativeDb.rewriteTasks.where('scanId').equals(scanId).toArray();
}

export async function getRewriteTask(taskId: string): Promise<RewriteTask | undefined> {
  return narrativeDb.rewriteTasks.get(taskId);
}

export async function updateRewriteTask(taskId: string, patch: Partial<RewriteTask>): Promise<void> {
  await narrativeDb.rewriteTasks.update(taskId, {
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

export async function storeSourceImportJob(job: SourceImportJob): Promise<void> {
  await narrativeDb.sourceImportJobs.put(job);
}

export async function getLatestSourceImportJob(projectId: string): Promise<SourceImportJob | undefined> {
  const jobs = await narrativeDb.sourceImportJobs.where('projectId').equals(projectId).sortBy('updatedAt');
  return jobs[jobs.length - 1];
}

export async function updateSourceImportJob(jobId: string, patch: Partial<SourceImportJob>): Promise<void> {
  await narrativeDb.sourceImportJobs.update(jobId, {
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

export async function getChapterDependencies(
  projectId: string,
  chapterId: string
): Promise<AttributeDependency[]> {
  return narrativeDb.chapterDependencies
    .where('[projectId+chapterId]')
    .equals([projectId, chapterId])
    .sortBy('chapterIndex');
}

export async function getEntityDependencies(
  projectId: string,
  entityId: string
): Promise<AttributeDependency[]> {
  return narrativeDb.chapterDependencies
    .where('[projectId+entityId]')
    .equals([projectId, entityId])
    .sortBy('chapterIndex');
}

export async function getProjectAttributeDependencies(
  projectId: string
): Promise<AttributeDependency[]> {
  return narrativeDb.chapterDependencies.where('projectId').equals(projectId).sortBy('chapterIndex');
}

export async function getAttributeDependencies(
  projectId: string,
  entityId: string,
  attributeKey: string
): Promise<AttributeDependency[]> {
  return narrativeDb.chapterDependencies
    .where('[projectId+entityId+attributeKey]')
    .equals([projectId, entityId, attributeKey])
    .sortBy('chapterIndex');
}

export async function storeCanonicalEdit(edit: CanonicalEdit): Promise<void> {
  await narrativeDb.canonicalEdits.put(edit);
}

export async function storeCanonicalEdits(edits: CanonicalEdit[]): Promise<void> {
  if (edits.length === 0) return;
  await narrativeDb.canonicalEdits.bulkPut(edits);
}

export async function getEntityCanonicalEdits(
  projectId: string,
  entityId: string
): Promise<CanonicalEdit[]> {
  return narrativeDb.canonicalEdits
    .where('[projectId+entityId]')
    .equals([projectId, entityId])
    .sortBy('effectiveFromChapter');
}

export async function getProjectCanonicalEdits(
  projectId: string
): Promise<CanonicalEdit[]> {
  return narrativeDb.canonicalEdits.where('projectId').equals(projectId).sortBy('effectiveFromChapter');
}

export async function getAttributeCanonicalEdits(
  projectId: string,
  entityId: string,
  attributeKey: string
): Promise<CanonicalEdit[]> {
  return narrativeDb.canonicalEdits
    .where('[projectId+entityId+attributeKey]')
    .equals([projectId, entityId, attributeKey])
    .sortBy('effectiveFromChapter');
}

export async function storePropagation(result: PropagationResult): Promise<void> {
  await narrativeDb.propagationLogs.put(result);
}

export async function storePropagationTasks(tasks: PropagationTask[]): Promise<void> {
  if (tasks.length === 0) return;
  await narrativeDb.propagationTasks.bulkPut(tasks);
}

export async function getPendingPropagations(projectId: string): Promise<PropagationResult[]> {
  return narrativeDb.propagationLogs
    .where('projectId')
    .equals(projectId)
    .filter((item) => item.status === 'pending' || item.status === 'ready')
    .toArray();
}

export async function getProjectPropagationTasks(projectId: string): Promise<PropagationTask[]> {
  return narrativeDb.propagationTasks.where('projectId').equals(projectId).sortBy('chapterIndex');
}

export async function getChapterPropagationTasks(
  projectId: string,
  chapterId: string
): Promise<PropagationTask[]> {
  return narrativeDb.propagationTasks
    .where('[projectId+chapterId]')
    .equals([projectId, chapterId])
    .toArray();
}

export async function getCanonicalEditTasks(
  projectId: string,
  canonicalEditId: string
): Promise<PropagationTask[]> {
  return narrativeDb.propagationTasks
    .where('[projectId+canonicalEditId]')
    .equals([projectId, canonicalEditId])
    .toArray();
}

export async function updatePropagationTaskStatus(
  taskId: string,
  status: PropagationTask['status']
): Promise<void> {
  await narrativeDb.propagationTasks.update(taskId, {
    status,
    updatedAt: new Date().toISOString(),
  });
}

export async function storeIndexJob(job: IndexJob): Promise<void> {
  await narrativeDb.indexJobs.put(job);
}

export async function updateIndexJob(jobId: string, patch: Partial<IndexJob>): Promise<void> {
  await narrativeDb.indexJobs.update(jobId, {
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

export async function getProjectIndexJobs(projectId: string): Promise<IndexJob[]> {
  return narrativeDb.indexJobs.where('projectId').equals(projectId).sortBy('updatedAt');
}

export async function getLatestProjectIndexJob(projectId: string): Promise<IndexJob | undefined> {
  const jobs = await getProjectIndexJobs(projectId);
  return jobs[jobs.length - 1];
}

export async function storeProjectIndexState(state: ProjectIndexState): Promise<void> {
  await narrativeDb.projectIndexState.put(state);
}

export async function getProjectIndexState(projectId: string): Promise<ProjectIndexState | undefined> {
  return narrativeDb.projectIndexState.get(projectId);
}

export async function replaceProjectNarrativeGraph(
  projectId: string,
  nodes: NarrativeNode[],
  edges: NarrativeEdge[],
  communities: NarrativeCommunity[]
): Promise<void> {
  await narrativeDb.transaction(
    'rw',
    [narrativeDb.narrativeNodes, narrativeDb.narrativeEdges, narrativeDb.narrativeCommunities],
    async () => {
      await narrativeDb.narrativeNodes.where('projectId').equals(projectId).delete();
      await narrativeDb.narrativeEdges.where('projectId').equals(projectId).delete();
      await narrativeDb.narrativeCommunities.where('projectId').equals(projectId).delete();

      if (nodes.length > 0) {
        await narrativeDb.narrativeNodes.bulkPut(nodes);
      }
      if (edges.length > 0) {
        await narrativeDb.narrativeEdges.bulkPut(edges);
      }
      if (communities.length > 0) {
        await narrativeDb.narrativeCommunities.bulkPut(communities);
      }
    }
  );
}

export async function getProjectNarrativeNodes(projectId: string): Promise<NarrativeNode[]> {
  return narrativeDb.narrativeNodes.where('projectId').equals(projectId).toArray();
}

export async function getProjectNarrativeEdges(projectId: string): Promise<NarrativeEdge[]> {
  return narrativeDb.narrativeEdges.where('projectId').equals(projectId).toArray();
}

export async function getProjectNarrativeCommunities(projectId: string): Promise<NarrativeCommunity[]> {
  return narrativeDb.narrativeCommunities
    .where('projectId')
    .equals(projectId)
    .sortBy('score')
    .then((communities) => communities.reverse());
}

export async function storeSnapshot(snapshot: EntitySnapshot): Promise<void> {
  await narrativeDb.entitySnapshots.put(snapshot);
}

export async function getEntityTimeline(
  entityId: string,
  projectId?: string
): Promise<EntitySnapshot[]> {
  let query;
  if (projectId) {
    query = narrativeDb.entitySnapshots.where('[projectId+entityId]').equals([projectId, entityId]);
  } else {
    query = narrativeDb.entitySnapshots.where('entityId').equals(entityId);
  }
  return query.sortBy('chapterIndex');
}

export async function getEntityAtChapter(
  entityId: string,
  chapterIndex: number
): Promise<EntitySnapshot | undefined> {
  const snapshots = await narrativeDb.entitySnapshots
    .where('[entityId+chapterIndex]')
    .between([entityId, Dexie.minKey], [entityId, chapterIndex], true, true)
    .sortBy('chapterIndex');

  return snapshots[snapshots.length - 1];
}

export async function storeDependency(dep: ChapterDependency): Promise<void> {
  await narrativeDb.chapterDeps.put(dep);
}

export async function storeDependencies(deps: ChapterDependency[]): Promise<void> {
  if (deps.length === 0) return;
  await narrativeDb.chapterDeps.bulkPut(deps);
}

export async function getChapterDeps(
  chapterId: string,
  projectId: string
): Promise<ChapterDependency[]> {
  return narrativeDb.chapterDeps.where('[projectId+chapterId]').equals([projectId, chapterId]).toArray();
}

export async function getEntityUsages(
  entityId: string,
  projectId: string
): Promise<ChapterDependency[]> {
  return narrativeDb.chapterDeps.where('[projectId+entityId]').equals([projectId, entityId]).toArray();
}

export async function getAttributeUsages(
  entityId: string,
  projectId: string,
  attributeKey: string
): Promise<ChapterDependency[]> {
  const dependencies = await getEntityUsages(entityId, projectId);
  return dependencies.filter((item) => item.attributeKeys.includes(attributeKey));
}

export async function deleteProjectData(projectId: string): Promise<void> {
  await narrativeDb.transaction(
    'rw',
    [
      narrativeDb.chapters,
      narrativeDb.entitySnapshots,
      narrativeDb.chapterDeps,
      narrativeDb.entityDefinitions,
      narrativeDb.timelineFacts,
      narrativeDb.chapterDependencies,
      narrativeDb.chapterMetadata,
      narrativeDb.canonicalEdits,
      narrativeDb.propagationTasks,
      narrativeDb.propagationLogs,
      narrativeDb.indexJobs,
      narrativeDb.projectIndexState,
      narrativeDb.projectArcs,
      narrativeDb.surgerySpecs,
      narrativeDb.impactScans,
      narrativeDb.rewriteTasks,
      narrativeDb.sourceImportJobs,
      narrativeDb.narrativeNodes,
      narrativeDb.narrativeEdges,
      narrativeDb.narrativeCommunities,
      narrativeDb.summaryCache,
      narrativeDb.memoryEmbeddings,
    ],
    async () => {
      await narrativeDb.chapters.where('projectId').equals(projectId).delete();
      await narrativeDb.entitySnapshots.where('projectId').equals(projectId).delete();
      await narrativeDb.chapterDeps.where('projectId').equals(projectId).delete();
      await narrativeDb.entityDefinitions.where('projectId').equals(projectId).delete();
      await narrativeDb.timelineFacts.where('projectId').equals(projectId).delete();
      await narrativeDb.chapterDependencies.where('projectId').equals(projectId).delete();
      await narrativeDb.chapterMetadata.where('projectId').equals(projectId).delete();
      await narrativeDb.canonicalEdits.where('projectId').equals(projectId).delete();
      await narrativeDb.propagationTasks.where('projectId').equals(projectId).delete();
      await narrativeDb.propagationLogs.where('projectId').equals(projectId).delete();
      await narrativeDb.indexJobs.where('projectId').equals(projectId).delete();
      await narrativeDb.projectIndexState.delete(projectId);
      await narrativeDb.projectArcs.where('projectId').equals(projectId).delete();
      await narrativeDb.surgerySpecs.where('projectId').equals(projectId).delete();
      await narrativeDb.impactScans.where('projectId').equals(projectId).delete();
      await narrativeDb.rewriteTasks.where('projectId').equals(projectId).delete();
      await narrativeDb.sourceImportJobs.where('projectId').equals(projectId).delete();
      await narrativeDb.narrativeNodes.where('projectId').equals(projectId).delete();
      await narrativeDb.narrativeEdges.where('projectId').equals(projectId).delete();
      await narrativeDb.narrativeCommunities.where('projectId').equals(projectId).delete();
      await narrativeDb.summaryCache.where('projectId').equals(projectId).delete();
      await narrativeDb.memoryEmbeddings.where('projectId').equals(projectId).delete();
    }
  );
}

export async function clearDerivedMemoryProjectData(projectId: string): Promise<void> {
  await narrativeDb.transaction(
    'rw',
    [
      narrativeDb.entityDefinitions,
      narrativeDb.timelineFacts,
      narrativeDb.chapterDependencies,
      narrativeDb.chapterMetadata,
      narrativeDb.canonicalEdits,
      narrativeDb.propagationTasks,
      narrativeDb.propagationLogs,
      narrativeDb.indexJobs,
      narrativeDb.projectIndexState,
      narrativeDb.projectArcs,
      narrativeDb.impactScans,
      narrativeDb.rewriteTasks,
      narrativeDb.sourceImportJobs,
      narrativeDb.narrativeNodes,
      narrativeDb.narrativeEdges,
      narrativeDb.narrativeCommunities,
      narrativeDb.summaryCache,
      narrativeDb.memoryEmbeddings,
    ],
    async () => {
      await narrativeDb.entityDefinitions.where('projectId').equals(projectId).delete();
      await narrativeDb.timelineFacts.where('projectId').equals(projectId).delete();
      await narrativeDb.chapterDependencies.where('projectId').equals(projectId).delete();
      await narrativeDb.chapterMetadata.where('projectId').equals(projectId).delete();
      await narrativeDb.canonicalEdits.where('projectId').equals(projectId).delete();
      await narrativeDb.propagationTasks.where('projectId').equals(projectId).delete();
      await narrativeDb.propagationLogs.where('projectId').equals(projectId).delete();
      await narrativeDb.indexJobs.where('projectId').equals(projectId).delete();
      await narrativeDb.projectIndexState.delete(projectId);
      await narrativeDb.projectArcs.where('projectId').equals(projectId).delete();
      await narrativeDb.impactScans.where('projectId').equals(projectId).delete();
      await narrativeDb.rewriteTasks.where('projectId').equals(projectId).delete();
      await narrativeDb.sourceImportJobs.where('projectId').equals(projectId).delete();
      await narrativeDb.narrativeNodes.where('projectId').equals(projectId).delete();
      await narrativeDb.narrativeEdges.where('projectId').equals(projectId).delete();
      await narrativeDb.narrativeCommunities.where('projectId').equals(projectId).delete();
      await narrativeDb.summaryCache.where('projectId').equals(projectId).delete();
      await narrativeDb.memoryEmbeddings.where('projectId').equals(projectId).delete();
    }
  );
}

export async function clearProjectChapterDerivedMemory(projectId: string): Promise<void> {
  await narrativeDb.transaction(
    'rw',
    [
      narrativeDb.entityDefinitions,
      narrativeDb.timelineFacts,
      narrativeDb.chapterDependencies,
      narrativeDb.chapterMetadata,
      narrativeDb.narrativeNodes,
      narrativeDb.narrativeEdges,
      narrativeDb.narrativeCommunities,
      narrativeDb.summaryCache,
      narrativeDb.memoryEmbeddings,
    ],
    async () => {
      await narrativeDb.entityDefinitions.where('projectId').equals(projectId).delete();
      await narrativeDb.timelineFacts.where('projectId').equals(projectId).delete();
      await narrativeDb.chapterDependencies.where('projectId').equals(projectId).delete();
      await narrativeDb.chapterMetadata.where('projectId').equals(projectId).delete();
      await narrativeDb.narrativeNodes.where('projectId').equals(projectId).delete();
      await narrativeDb.narrativeEdges.where('projectId').equals(projectId).delete();
      await narrativeDb.narrativeCommunities.where('projectId').equals(projectId).delete();
      await narrativeDb.summaryCache.where('projectId').equals(projectId).delete();
      await narrativeDb.memoryEmbeddings.where('projectId').equals(projectId).delete();
    }
  );
}

export async function storeCorrection(correction: StyleCorrection): Promise<void> {
  await narrativeDb.styleCorrections.put(correction);
}

export async function storeCorrections(corrections: StyleCorrection[]): Promise<void> {
  if (corrections.length === 0) return;
  await narrativeDb.styleCorrections.bulkPut(corrections);
}

export async function getProjectCorrections(
  projectId: string,
  status?: StyleCorrection['status']
): Promise<StyleCorrection[]> {
  if (status) {
    return narrativeDb.styleCorrections
      .where('[projectId+status]')
      .equals([projectId, status])
      .toArray();
  }
  return narrativeDb.styleCorrections.where('projectId').equals(projectId).toArray();
}

export async function getChapterCorrections(
  projectId: string,
  chapterId: string
): Promise<StyleCorrection[]> {
  return narrativeDb.styleCorrections
    .where('[projectId+chapterId]')
    .equals([projectId, chapterId])
    .toArray();
}

export async function updateCorrectionStatus(
  id: string,
  status: StyleCorrection['status']
): Promise<void> {
  await narrativeDb.styleCorrections.update(id, { status });
}

export async function storeRule(rule: StyleRule): Promise<void> {
  await narrativeDb.styleRules.put(rule);
}

export async function storeRules(rules: StyleRule[]): Promise<void> {
  if (rules.length === 0) return;
  await narrativeDb.styleRules.bulkPut(rules);
}

export async function getProjectRules(projectId: string): Promise<StyleRule[]> {
  return narrativeDb.styleRules
    .where('projectId')
    .equals(projectId)
    .sortBy('weight')
    .then((rules) => rules.reverse());
}

export async function deleteProjectStyleData(projectId: string): Promise<void> {
  await narrativeDb.transaction(
    'rw',
    [narrativeDb.styleCorrections, narrativeDb.styleRules],
    async () => {
      await narrativeDb.styleCorrections.where('projectId').equals(projectId).delete();
      await narrativeDb.styleRules.where('projectId').equals(projectId).delete();
    }
  );
}

// ─── HSC (Hierarchical Summary Cache) CRUD ────────────────

export async function getSummaryCacheEntries(projectId: string): Promise<CachedSummary[]> {
  return narrativeDb.summaryCache.where('projectId').equals(projectId).toArray();
}

export async function getSummaryCacheEntry(id: string): Promise<CachedSummary | undefined> {
  return narrativeDb.summaryCache.get(id);
}

export async function putSummaryCacheEntries(entries: CachedSummary[]): Promise<void> {
  if (entries.length === 0) return;
  await narrativeDb.summaryCache.bulkPut(entries);
}

export async function clearProjectSummaryCache(projectId: string): Promise<void> {
  await narrativeDb.summaryCache.where('projectId').equals(projectId).delete();
}
