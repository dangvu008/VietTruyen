/**
 * File: narrative_db.ts
 * Purpose: Dexie IndexedDB database cho Narrative Memory Engine
 * Layer: Infrastructure (Database)
 * Domain: NarrativeMemory → [chapters storage, entity snapshots, dependency graph, propagation logs, style learning]
 *
 * Data Contract:
 * - Input:  CRUD operations từ services
 * - Output: Typed records từ IndexedDB
 *
 * Scale: Thiết kế cho 1000+ chương, triệu chữ
 * Allowed Deps: Dexie, types ONLY. NO UI imports.
 */

import Dexie from 'dexie';
import type { Table } from 'dexie';
import type {
  EntitySnapshot,
  ChapterDependency,
  ChapterMetadata,
  PropagationResult,
} from '../types/narrative_memory';
import type { Chapter } from '../types/story';
import type { StyleCorrection, StyleRule } from '../types/style_learning';

// ─── Extended Chapter for IndexedDB (includes full content) ──
export interface StoredChapter extends Chapter {
  projectId: string;
  index: number; // chapter order within project
  [key: string]: any; // Dexie v4 index signature
}

// Dexie v4 compatible interfaces (require index signature)
type DexieCompatible<T> = T & { [key: string]: any };

// ─── Database Definition ────────────────────────────────────
class NarrativeDatabase extends Dexie {
  chapters!: Table<DexieCompatible<StoredChapter>>;
  entitySnapshots!: Table<DexieCompatible<EntitySnapshot>>;
  chapterDeps!: Table<DexieCompatible<ChapterDependency>>;
  chapterMetadata!: Table<DexieCompatible<ChapterMetadata>>;
  propagationLogs!: Table<DexieCompatible<PropagationResult>>;
  styleCorrections!: Table<DexieCompatible<StyleCorrection>>;
  styleRules!: Table<DexieCompatible<StyleRule>>;

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
      styleCorrections: 'id, projectId, chapterId, category, status, [projectId+status], [projectId+chapterId]',
      styleRules: 'id, projectId, category, weight, [projectId+category]',
    });
  }
}

// ─── Singleton Instance ─────────────────────────────────────
export const narrativeDb = new NarrativeDatabase();

// ─── Helper: Chapter CRUD ───────────────────────────────────

export async function storeChapter(chapter: StoredChapter): Promise<void> {
  await narrativeDb.chapters.put(chapter);
}

export async function getChapter(id: string): Promise<StoredChapter | undefined> {
  return narrativeDb.chapters.get(id);
}

export async function getProjectChapters(projectId: string): Promise<StoredChapter[]> {
  return narrativeDb.chapters
    .where('projectId')
    .equals(projectId)
    .sortBy('index');
}

export async function deleteChapter(id: string): Promise<void> {
  await narrativeDb.transaction('rw', [narrativeDb.chapters, narrativeDb.chapterDeps, narrativeDb.chapterMetadata], async () => {
    await narrativeDb.chapters.delete(id);
    await narrativeDb.chapterDeps.where('chapterId').equals(id).delete();
    await narrativeDb.chapterMetadata.where('chapterId').equals(id).delete();
  });
}

// ─── Helper: Entity Snapshot CRUD ───────────────────────────

export async function storeSnapshot(snapshot: EntitySnapshot): Promise<void> {
  await narrativeDb.entitySnapshots.put(snapshot);
}

export async function getEntityTimeline(
  entityId: string,
  projectId?: string
): Promise<EntitySnapshot[]> {
  let query;
  if (projectId) {
    query = narrativeDb.entitySnapshots
      .where('[projectId+entityId]')
      .equals([projectId, entityId]);
  } else {
    query = narrativeDb.entitySnapshots
      .where('entityId')
      .equals(entityId);
  }
  return query.sortBy('chapterIndex');
}

export async function getEntityAtChapter(
  entityId: string,
  chapterIndex: number
): Promise<EntitySnapshot | undefined> {
  // Get the latest snapshot AT or BEFORE this chapter index
  const snapshots = await narrativeDb.entitySnapshots
    .where('[entityId+chapterIndex]')
    .between([entityId, Dexie.minKey], [entityId, chapterIndex], true, true)
    .sortBy('chapterIndex');

  return snapshots[snapshots.length - 1]; // latest one at or before target
}

// ─── Helper: Dependency Graph CRUD ──────────────────────────

export async function storeDependency(dep: ChapterDependency): Promise<void> {
  await narrativeDb.chapterDeps.put(dep);
}

export async function storeDependencies(deps: ChapterDependency[]): Promise<void> {
  await narrativeDb.chapterDeps.bulkPut(deps);
}

export async function getChapterDeps(
  chapterId: string,
  projectId: string
): Promise<ChapterDependency[]> {
  return narrativeDb.chapterDeps
    .where('[projectId+chapterId]')
    .equals([projectId, chapterId])
    .toArray();
}

export async function getEntityUsages(
  entityId: string,
  projectId: string
): Promise<ChapterDependency[]> {
  return narrativeDb.chapterDeps
    .where('[projectId+entityId]')
    .equals([projectId, entityId])
    .toArray();
}

export async function getAttributeUsages(
  entityId: string,
  projectId: string,
  attributeKey: string
): Promise<ChapterDependency[]> {
  // Get all deps for this entity, then filter by attribute key
  const deps = await getEntityUsages(entityId, projectId);
  return deps.filter((d) => d.attributeKeys.includes(attributeKey));
}

// ─── Helper: Chapter Metadata ───────────────────────────────

export async function storeChapterMetadata(metadata: ChapterMetadata): Promise<void> {
  await narrativeDb.chapterMetadata.put(metadata);
}

export async function getChapterMetadata(chapterId: string): Promise<ChapterMetadata | undefined> {
  return narrativeDb.chapterMetadata.get(chapterId);
}

// ─── Helper: Propagation Logs ───────────────────────────────

export async function storePropagation(result: PropagationResult): Promise<void> {
  await narrativeDb.propagationLogs.put(result);
}

export async function getPendingPropagations(projectId: string): Promise<PropagationResult[]> {
  return narrativeDb.propagationLogs
    .where('projectId')
    .equals(projectId)
    .filter((p) => p.status === 'pending' || p.status === 'ready')
    .toArray();
}

// ─── Helper: Project Cleanup ────────────────────────────────

export async function deleteProjectData(projectId: string): Promise<void> {
  await narrativeDb.transaction(
    'rw',
    [
      narrativeDb.chapters,
      narrativeDb.entitySnapshots,
      narrativeDb.chapterDeps,
      narrativeDb.chapterMetadata,
      narrativeDb.propagationLogs,
    ],
    async () => {
      await narrativeDb.chapters.where('projectId').equals(projectId).delete();
      await narrativeDb.entitySnapshots.where('projectId').equals(projectId).delete();
      await narrativeDb.chapterDeps.where('projectId').equals(projectId).delete();
      await narrativeDb.chapterMetadata.where('projectId').equals(projectId).delete();
      await narrativeDb.propagationLogs.where('projectId').equals(projectId).delete();
    }
  );
}

// ─── Helper: Style Correction CRUD ──────────────────────────

export async function storeCorrection(correction: StyleCorrection): Promise<void> {
  await narrativeDb.styleCorrections.put(correction);
}

export async function storeCorrections(corrections: StyleCorrection[]): Promise<void> {
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
  return narrativeDb.styleCorrections
    .where('projectId')
    .equals(projectId)
    .toArray();
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

// ─── Helper: Style Rule CRUD ────────────────────────────────

export async function storeRule(rule: StyleRule): Promise<void> {
  await narrativeDb.styleRules.put(rule);
}

export async function storeRules(rules: StyleRule[]): Promise<void> {
  await narrativeDb.styleRules.bulkPut(rules);
}

export async function getProjectRules(projectId: string): Promise<StyleRule[]> {
  return narrativeDb.styleRules
    .where('projectId')
    .equals(projectId)
    .sortBy('weight')
    .then((rules) => rules.reverse()); // highest weight first
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
