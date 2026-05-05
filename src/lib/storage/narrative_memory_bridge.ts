/**
 * File: narrative_memory_bridge.ts
 * Purpose: Bridge between IndexedDB narrative memory and StorageProvider
 *          Serializes graph data, HSC cache, and embeddings for migration
 * Layer: Infrastructure (Migration)
 * Domain: Storage → [narrative memory snapshot export for provider persistence]
 *
 * Data Contract:
 * - Input:  projectId → reads from IndexedDB (narrative_db)
 * - Output: NarrativeMemorySnapshot → JSON-serializable snapshot
 * - Called by: migrate_indexeddb_to_provider.ts
 *
 * Design: Snapshot-only (one-time copy). Does NOT establish real-time sync.
 */

import {
  getProjectNarrativeNodes,
  getProjectNarrativeEdges,
  getProjectNarrativeCommunities,
  getProjectChapters,
  getProjectIndexState,
} from '../../db/narrative_db';
import { narrativeDb } from '../../db/narrative_db';
import type {
  NarrativeNode,
  NarrativeEdge,
  NarrativeCommunity,
} from '../../types/narrative_graph';
import type {
  NarrativePredicateDefinition,
  NarrativeStateEvidence,
  NarrativeStateFact,
  NarrativeStateMutation,
  ProjectIndexState,
} from '../../types/narrative_memory';
import type { StorageProvider } from './storage_provider';

// ── Types ────────────────────────────────────────────────────

export interface NarrativeMemorySnapshot {
  projectId: string;
  capturedAt: string;
  graph: {
    nodes: NarrativeNode[];
    edges: NarrativeEdge[];
    communities: NarrativeCommunity[];
  };
  state: {
    predicateDefinitions: NarrativePredicateDefinition[];
    facts: NarrativeStateFact[];
    mutations: NarrativeStateMutation[];
    evidence: NarrativeStateEvidence[];
  };
  summaryCache: SummaryCacheEntry[];
  indexState: ProjectIndexState | null;
  embeddingCount: number;
  chapterCount: number;
}

interface SummaryCacheEntry {
  id: string;
  projectId: string;
  tier: string;
  rangeKey: string;
  summary: string;
  sourceHash: string;
  updatedAt: string;
}

// ── Core Functions ───────────────────────────────────────────

/**
 * Capture a snapshot of all narrative memory data for a project.
 * Reads from IndexedDB (Dexie) and returns a JSON-serializable object.
 *
 * This is a READ-ONLY operation — does not modify any data.
 */
export async function captureNarrativeMemorySnapshot(
  projectId: string,
): Promise<NarrativeMemorySnapshot> {
  // [Domain:Migration] STEP 1 — Read graph data
  const [nodes, edges, communities, predicateDefinitions, stateFacts, stateMutations, stateEvidence] = await Promise.all([
    getProjectNarrativeNodes(projectId),
    getProjectNarrativeEdges(projectId),
    getProjectNarrativeCommunities(projectId),
    narrativeDb.narrativePredicateDefinitions.where('projectId').equals(projectId).toArray() as Promise<NarrativePredicateDefinition[]>,
    narrativeDb.narrativeStateFacts.where('projectId').equals(projectId).toArray() as Promise<NarrativeStateFact[]>,
    narrativeDb.narrativeStateMutations.where('projectId').equals(projectId).toArray() as Promise<NarrativeStateMutation[]>,
    narrativeDb.narrativeStateEvidence.where('projectId').equals(projectId).toArray() as Promise<NarrativeStateEvidence[]>,
  ]);

  // [Domain:Migration] STEP 2 — Read HSC summary cache
  const summaryCache = await narrativeDb.summaryCache
    .where('projectId')
    .equals(projectId)
    .toArray() as unknown as SummaryCacheEntry[];

  // [Domain:Migration] STEP 3 — Read index state
  const indexState = await getProjectIndexState(projectId) ?? null;

  // [Domain:Migration] STEP 4 — Count embeddings (don't export full vectors)
  const embeddingCount = await narrativeDb.memoryEmbeddings
    .where('projectId')
    .equals(projectId)
    .count();

  // [Domain:Migration] STEP 5 — Count chapters in IndexedDB
  const chapters = await getProjectChapters(projectId);

  return {
    projectId,
    capturedAt: new Date().toISOString(),
    graph: { nodes, edges, communities },
    state: {
      predicateDefinitions,
      facts: stateFacts,
      mutations: stateMutations,
      evidence: stateEvidence,
    },
    summaryCache,
    indexState,
    embeddingCount,
    chapterCount: chapters.length,
  };
}

/**
 * Migrate narrative memory for a single project during provider migration.
 *
 * For Git provider: saves snapshot as `.viettruyen/memory/<projectId>.json`
 * For Online provider: logs the snapshot stats (Supabase narrative tables TBD)
 *
 * Returns stats for the migration report.
 */
export async function migrateProjectNarrativeMemory(
  projectId: string,
  provider: StorageProvider,
): Promise<NarrativeMemoryMigrationResult> {
  const snapshot = await captureNarrativeMemorySnapshot(projectId);

  if (
    snapshot.graph.nodes.length === 0 &&
    snapshot.summaryCache.length === 0 &&
    snapshot.state.facts.length === 0 &&
    snapshot.state.mutations.length === 0
  ) {
    return {
      projectId,
      status: 'skipped',
      reason: 'no_narrative_data',
      stats: buildEmptyStats(),
    };
  }

  // [Domain:Migration] For now, we log the snapshot stats.
  // Future: GitStorageProvider can write to .viettruyen/memory/<id>.json
  // Future: OnlineStorageProvider can write to narrative_* Supabase tables
  console.info(
    `[NarrativeMemoryBridge] Project ${projectId}: ` +
    `${snapshot.graph.nodes.length} nodes, ` +
      `${snapshot.graph.edges.length} edges, ` +
      `${snapshot.graph.communities.length} communities, ` +
      `${snapshot.state.facts.length} state facts, ` +
      `${snapshot.state.mutations.length} state mutations, ` +
      `${snapshot.summaryCache.length} HSC entries, ` +
      `${snapshot.embeddingCount} embeddings`,
  );

  return {
    projectId,
    status: 'captured',
    stats: {
      nodeCount: snapshot.graph.nodes.length,
      edgeCount: snapshot.graph.edges.length,
      communityCount: snapshot.graph.communities.length,
      hscEntryCount: snapshot.summaryCache.length,
      embeddingCount: snapshot.embeddingCount,
      chapterCount: snapshot.chapterCount,
    },
  };
}

/**
 * Migrate narrative memory for ALL projects during full provider migration.
 */
export async function migrateAllNarrativeMemory(
  projectIds: string[],
  provider: StorageProvider,
): Promise<NarrativeMemoryMigrationResult[]> {
  const results: NarrativeMemoryMigrationResult[] = [];

  for (const projectId of projectIds) {
    try {
      const result = await migrateProjectNarrativeMemory(projectId, provider);
      results.push(result);
    } catch (error) {
      results.push({
        projectId,
        status: 'error',
        reason: error instanceof Error ? error.message : String(error),
        stats: buildEmptyStats(),
      });
    }
  }

  return results;
}

// ── Types ────────────────────────────────────────────────────

export interface NarrativeMemoryMigrationResult {
  projectId: string;
  status: 'captured' | 'skipped' | 'error';
  reason?: string;
  stats: NarrativeMemoryStats;
}

interface NarrativeMemoryStats {
  nodeCount: number;
  edgeCount: number;
  communityCount: number;
  hscEntryCount: number;
  embeddingCount: number;
  chapterCount: number;
}

function buildEmptyStats(): NarrativeMemoryStats {
  return {
    nodeCount: 0,
    edgeCount: 0,
    communityCount: 0,
    hscEntryCount: 0,
    embeddingCount: 0,
    chapterCount: 0,
  };
}
