/**
 * File: use_story_timeline_data.ts
 * Purpose: Query IndexedDB narrative memory → real timeline data per chapter
 * Layer: Hooks
 * Domain: StoryMap → [timeline, read-only]
 * Deps: narrative_db, narrative_memory types
 */
import { useCallback, useEffect, useState } from 'react';
import {
  getEntityDefinitions,
  getProjectChapterMetadata,
  getProjectIndexState,
  getProjectNarrativeStateFacts,
  getProjectNarrativeStateMutations,
} from '../db/narrative_db';
import type { EntityType, NarrativeStateMutationType } from '../types/narrative_memory';

// ─── Public Types ───────────────────────────────────────────

export interface TimelineMutation {
  entityName: string;
  entityType: EntityType;
  mutationType: NarrativeStateMutationType;
  predicate: string;
  beforeValue?: string;
  afterValue: string;
  evidenceText: string;
  confidence: number;
}

export interface TimelineEntityAppearance {
  entityId: string;
  name: string;
  type: EntityType;
  attributeKeys: string[];
  importance: 'critical' | 'moderate' | 'minor';
}

export interface TimelineFactSpan {
  entityName: string;
  entityType: EntityType;
  predicate: string;
  value: string;
  fromChapter: number;
  toChapter: number | null;
  status: string;
}

export interface TimelineChapterData {
  chapterId: string;
  chapterIndex: number;
  entityAppearances: TimelineEntityAppearance[];
  mutations: TimelineMutation[];
  entityRefCount: number;
}

export interface StoryTimelineData {
  chaptersData: Map<string, TimelineChapterData>;
  factSpans: TimelineFactSpan[];
  entityCount: number;
  mutationCount: number;
  isLoading: boolean;
  hasData: boolean;
  lastIndexedAt: string | null;
  reload: () => void;
}

// ─── Mutation type labels ───────────────────────────────────

export const MUTATION_LABELS: Record<NarrativeStateMutationType, string> = {
  create: 'Xuất hiện',
  update: 'Thay đổi',
  reveal: 'Tiết lộ',
  conceal: 'Che giấu',
  transfer: 'Chuyển giao',
  resolve: 'Giải quyết',
  invalidate: 'Vô hiệu',
};

export const MUTATION_ICONS: Record<NarrativeStateMutationType, string> = {
  create: '✦',
  update: '→',
  reveal: '👁',
  conceal: '🔒',
  transfer: '⇄',
  resolve: '✓',
  invalidate: '✗',
};

// ─── Hook ───────────────────────────────────────────────────

export function useStoryTimelineData(projectId: string): StoryTimelineData {
  const [chaptersData, setChaptersData] = useState<Map<string, TimelineChapterData>>(new Map());
  const [factSpans, setFactSpans] = useState<TimelineFactSpan[]>([]);
  const [entityCount, setEntityCount] = useState(0);
  const [mutationCount, setMutationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [lastIndexedAt, setLastIndexedAt] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    async function loadData() {
      setIsLoading(true);

      try {
        // [Domain:StoryMap] STEP 1 — Check index state
        const indexState = await getProjectIndexState(projectId);
        if (cancelled) return;

        // [Domain:StoryMap] STEP 2 — Load entity definitions for name lookups
        const entityDefs = await getEntityDefinitions(projectId);
        const entityNameMap = new Map(entityDefs.map((d) => [d.entityId, d.canonicalName]));
        const entityTypeMap = new Map(entityDefs.map((d) => [d.entityId, d.entityType]));
        if (cancelled) return;

        // [Domain:StoryMap] STEP 3 — Load chapter metadata → entity appearances
        const chapterMetas = await getProjectChapterMetadata(projectId);
        if (cancelled) return;

        // [Domain:StoryMap] STEP 4 — Load mutations → real events per chapter
        const mutations = await getProjectNarrativeStateMutations(projectId);
        if (cancelled) return;

        // [Domain:StoryMap] STEP 5 — Load fact spans → cross-chapter entity state
        const facts = await getProjectNarrativeStateFacts(projectId);
        if (cancelled) return;

        // Build chapter data map
        const dataMap = new Map<string, TimelineChapterData>();
        let totalMutations = 0;

        // Populate entity appearances from chapterMetadata
        for (const meta of chapterMetas) {
          const appearances: TimelineEntityAppearance[] = (meta.entityRefs || []).map((ref) => ({
            entityId: ref.entityId,
            name: ref.entityName || entityNameMap.get(ref.entityId) || ref.entityId,
            type: ref.entityType,
            attributeKeys: ref.attributeKeys || [],
            importance: ref.importance,
          }));

          dataMap.set(meta.chapterId, {
            chapterId: meta.chapterId,
            chapterIndex: meta.chapterIndex,
            entityAppearances: appearances,
            mutations: [],
            entityRefCount: appearances.length,
          });
        }

        // Populate mutations per chapter
        for (const mut of mutations) {
          const existing = dataMap.get(mut.chapterId);
          const entry: TimelineMutation = {
            entityName: entityNameMap.get(mut.subjectId) || mut.subjectId,
            entityType: entityTypeMap.get(mut.subjectId) || 'character',
            mutationType: mut.mutationType,
            predicate: mut.predicate,
            beforeValue: mut.beforeValue,
            afterValue: mut.afterValue,
            evidenceText: mut.evidenceText,
            confidence: mut.confidence,
          };

          if (existing) {
            existing.mutations.push(entry);
          } else {
            dataMap.set(mut.chapterId, {
              chapterId: mut.chapterId,
              chapterIndex: 0,
              entityAppearances: [],
              mutations: [entry],
              entityRefCount: 0,
            });
          }
          totalMutations += 1;
        }

        // Build fact spans for visualization
        const spans: TimelineFactSpan[] = facts
          .filter((f) => f.status === 'active')
          .map((f) => ({
            entityName: entityNameMap.get(f.subjectId) || f.subjectId,
            entityType: entityTypeMap.get(f.subjectId) || 'character',
            predicate: f.predicate,
            value: f.value,
            fromChapter: f.validFromChapter,
            toChapter: f.validToChapter ?? null,
            status: f.status,
          }));

        if (cancelled) return;

        setChaptersData(dataMap);
        setFactSpans(spans);
        setEntityCount(entityDefs.length);
        setMutationCount(totalMutations);
        setHasData(dataMap.size > 0 || spans.length > 0);
        setLastIndexedAt(indexState?.lastIndexedAt ?? null);
      } catch (err) {
        console.error('[useStoryTimelineData] Load error:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [projectId, version]);

  return {
    chaptersData,
    factSpans,
    entityCount,
    mutationCount,
    isLoading,
    hasData,
    lastIndexedAt,
    reload,
  };
}
