import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { narrativeDb } from '../../db/narrative_db';
import type {
  NarrativeStateEvidence,
  NarrativeStateFact,
  NarrativeStateMutation,
  PendingHook,
} from '../../types/narrative_memory';
import { commitAcceptedChapterMemory } from './accepted_memory_transaction';

const PROJECT_ID = 'project-atomic-memory';
const CHAPTER_ID = 'chapter-12';

beforeEach(async () => {
  if (!narrativeDb.isOpen()) await narrativeDb.open();
});

afterEach(async () => {
  await narrativeDb.delete();
});

function records(version: string) {
  const evidence: NarrativeStateEvidence = {
    id: `evidence-${version}`,
    projectId: PROJECT_ID,
    chapterId: CHAPTER_ID,
    sourceText: `evidence ${version}`,
    sourceHash: `hash-${version}`,
    extractorVersion: 'atomic-test',
    confidence: 0.95,
    createdAt: '2026-08-15T00:00:00.000Z',
  };
  const mutation: NarrativeStateMutation = {
    id: `mutation-${version}`,
    projectId: PROJECT_ID,
    chapterId: CHAPTER_ID,
    mutationType: 'update',
    subjectId: 'char-main',
    subjectType: 'character',
    predicate: 'location',
    afterValue: `place-${version}`,
    confidence: 0.95,
    evidenceId: evidence.id,
    evidenceText: evidence.sourceText,
    reviewStatus: 'auto_accepted',
    createdAt: '2026-08-15T00:00:00.000Z',
  };
  const fact: NarrativeStateFact = {
    id: `fact-${version}`,
    projectId: PROJECT_ID,
    subjectId: 'char-main',
    subjectType: 'character',
    predicate: 'location',
    value: `place-${version}`,
    valueType: 'string',
    status: 'active',
    validFromChapter: 12,
    confidence: 0.95,
    evidenceIds: [evidence.id],
    mutationIds: [mutation.id],
    updatedAt: '2026-08-15T00:00:00.000Z',
  };
  const hook: PendingHook = {
    id: `hook-${version}`,
    projectId: PROJECT_ID,
    plantedChapterId: CHAPTER_ID,
    plantedChapterIndex: 12,
    description: `hook ${version}`,
    relatedEntityIds: ['char-main'],
    status: 'open',
    confidence: 0.9,
    source: 'ai_detected',
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z',
  };
  return { evidence, mutation, fact, hook };
}

describe('commitAcceptedChapterMemory', () => {
  it('commits state and pending hooks together', async () => {
    const r = records('v1');
    await commitAcceptedChapterMemory({
      projectId: PROJECT_ID,
      chapterId: CHAPTER_ID,
      chapterIndex: 12,
      facts: [r.fact],
      mutations: [r.mutation],
      evidence: [r.evidence],
      hooks: [r.hook],
    });

    expect(await narrativeDb.narrativeStateFacts.get(r.fact.id)).toBeTruthy();
    expect(await narrativeDb.narrativeStateMutations.get(r.mutation.id)).toBeTruthy();
    expect(await narrativeDb.narrativeStateEvidence.get(r.evidence.id)).toBeTruthy();
    expect(await narrativeDb.pendingHooks.get(r.hook.id)).toBeTruthy();
  });

  it('replaces the accepted chapter set without leaving prior hook/state rows', async () => {
    const v1 = records('v1');
    const v2 = records('v2');
    await commitAcceptedChapterMemory({
      projectId: PROJECT_ID,
      chapterId: CHAPTER_ID,
      chapterIndex: 12,
      facts: [v1.fact], mutations: [v1.mutation], evidence: [v1.evidence], hooks: [v1.hook],
    });
    await commitAcceptedChapterMemory({
      projectId: PROJECT_ID,
      chapterId: CHAPTER_ID,
      chapterIndex: 12,
      facts: [v2.fact], mutations: [v2.mutation], evidence: [v2.evidence], hooks: [v2.hook],
    });

    expect(await narrativeDb.narrativeStateFacts.get(v1.fact.id)).toBeUndefined();
    expect(await narrativeDb.narrativeStateMutations.get(v1.mutation.id)).toBeUndefined();
    expect(await narrativeDb.narrativeStateEvidence.get(v1.evidence.id)).toBeUndefined();
    expect(await narrativeDb.pendingHooks.get(v1.hook.id)).toBeUndefined();
    expect(await narrativeDb.pendingHooks.get(v2.hook.id)).toBeTruthy();
  });

  it('rejects cross-project records before mutation', async () => {
    const r = records('bad');
    const badHook = { ...r.hook, projectId: 'other-project' };

    await expect(commitAcceptedChapterMemory({
      projectId: PROJECT_ID,
      chapterId: CHAPTER_ID,
      chapterIndex: 12,
      facts: [r.fact], mutations: [r.mutation], evidence: [r.evidence], hooks: [badHook],
    })).rejects.toThrow('Cross-project accepted-memory record blocked');

    expect(await narrativeDb.narrativeStateFacts.count()).toBe(0);
    expect(await narrativeDb.pendingHooks.count()).toBe(0);
  });
});
