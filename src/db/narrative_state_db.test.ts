import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteProjectData,
  getActiveNarrativeStateFactsAtChapter,
  getNarrativePredicateDefinition,
  getProjectNarrativeStateEvidence,
  getProjectNarrativeStateFacts,
  getProjectNarrativeStateMutations,
  storeNarrativePredicateDefinitions,
  storeNarrativeStateEvidence,
  storeNarrativeStateFacts,
  storeNarrativeStateMutations,
  narrativeDb,
} from './narrative_db';
import type {
  NarrativePredicateDefinition,
  NarrativeStateEvidence,
  NarrativeStateFact,
  NarrativeStateMutation,
} from '../types/narrative_memory';

const PROJECT_ID = 'project-state-db';

afterEach(async () => {
  await narrativeDb.delete();
});

beforeEach(async () => {
  if (!narrativeDb.isOpen()) {
    await narrativeDb.open();
  }
});

describe('narrative state db', () => {
  it('stores state records and resolves active facts by chapter', async () => {
    const predicateDefinitions: NarrativePredicateDefinition[] = [
      {
        id: 'pred-core-owner',
        predicate: 'item.owner',
        label: 'Item owner',
        domain: 'item',
        valueType: 'entity_ref',
        aliases: ['held_by'],
        mergePolicy: 'overwrite',
        isCore: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'pred-project-secret',
        projectId: PROJECT_ID,
        predicate: 'secret.reveal_status',
        label: 'Secret reveal status',
        domain: 'plot',
        valueType: 'enum',
        allowedValues: ['hidden', 'revealed'],
        aliases: ['secret.status'],
        mergePolicy: 'timeline',
        isCore: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const evidence: NarrativeStateEvidence[] = [
      {
        id: 'evidence-owner',
        projectId: PROJECT_ID,
        chapterId: 'ch_12',
        sceneId: 'ch_12:scene:0',
        sourceText: 'Thanh kiem duoc giao cho Tieu Viem.',
        sourceHash: 'hash-owner',
        extractorVersion: 'state-v1',
        confidence: 0.95,
        createdAt: '2026-01-12T00:00:00.000Z',
      },
    ];

    const mutations: NarrativeStateMutation[] = [
      {
        id: 'mutation-owner',
        projectId: PROJECT_ID,
        chapterId: 'ch_12',
        sceneId: 'ch_12:scene:0',
        mutationType: 'transfer',
        subjectId: 'item_sword',
        subjectType: 'item',
        predicate: 'item.owner',
        beforeValue: 'char_master',
        afterValue: 'char_tieu_viem',
        confidence: 0.95,
        evidenceId: 'evidence-owner',
        evidenceText: 'Thanh kiem duoc giao cho Tieu Viem.',
        reviewStatus: 'auto_accepted',
        createdAt: '2026-01-12T00:00:00.000Z',
      },
    ];

    const facts: NarrativeStateFact[] = [
      {
        id: 'fact-owner-old',
        projectId: PROJECT_ID,
        subjectId: 'item_sword',
        subjectType: 'item',
        predicate: 'item.owner',
        value: 'char_master',
        valueType: 'entity_ref',
        status: 'superseded',
        validFromChapter: 1,
        validToChapter: 11,
        confidence: 0.8,
        evidenceIds: [],
        mutationIds: [],
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'fact-owner-new',
        projectId: PROJECT_ID,
        subjectId: 'item_sword',
        subjectType: 'item',
        predicate: 'item.owner',
        value: 'char_tieu_viem',
        valueType: 'entity_ref',
        status: 'active',
        validFromChapter: 12,
        confidence: 0.95,
        evidenceIds: ['evidence-owner'],
        mutationIds: ['mutation-owner'],
        updatedAt: '2026-01-12T00:00:00.000Z',
      },
    ];

    await storeNarrativePredicateDefinitions(predicateDefinitions);
    await storeNarrativeStateEvidence(evidence);
    await storeNarrativeStateMutations(mutations);
    await storeNarrativeStateFacts(facts);

    const ownerDefinition = await getNarrativePredicateDefinition(PROJECT_ID, 'item.owner');
    const earlyFacts = await getActiveNarrativeStateFactsAtChapter(PROJECT_ID, 11);
    const currentFacts = await getActiveNarrativeStateFactsAtChapter(PROJECT_ID, 12);

    expect(ownerDefinition?.mergePolicy).toBe('overwrite');
    expect(earlyFacts).toHaveLength(0);
    expect(currentFacts).toHaveLength(1);
    expect(currentFacts[0]?.value).toBe('char_tieu_viem');
    expect(currentFacts[0]?.evidenceIds).toEqual(['evidence-owner']);
  });

  it('clears narrative state records when project data is deleted', async () => {
    await storeNarrativePredicateDefinitions([
      {
        id: 'pred-project-goal',
        projectId: PROJECT_ID,
        predicate: 'character.goal.current',
        label: 'Current goal',
        domain: 'character',
        valueType: 'string',
        aliases: [],
        mergePolicy: 'overwrite',
        isCore: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await storeNarrativeStateEvidence([
      {
        id: 'evidence-goal',
        projectId: PROJECT_ID,
        chapterId: 'ch_1',
        sourceText: 'Muc tieu la tro lai tong mon.',
        sourceHash: 'hash-goal',
        extractorVersion: 'state-v1',
        confidence: 0.9,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await storeNarrativeStateMutations([
      {
        id: 'mutation-goal',
        projectId: PROJECT_ID,
        chapterId: 'ch_1',
        mutationType: 'create',
        subjectId: 'char_tieu_viem',
        subjectType: 'character',
        predicate: 'character.goal.current',
        afterValue: 'tro_lai_tong_mon',
        confidence: 0.9,
        evidenceText: 'Muc tieu la tro lai tong mon.',
        reviewStatus: 'auto_accepted',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await storeNarrativeStateFacts([
      {
        id: 'fact-goal',
        projectId: PROJECT_ID,
        subjectId: 'char_tieu_viem',
        subjectType: 'character',
        predicate: 'character.goal.current',
        value: 'tro_lai_tong_mon',
        valueType: 'string',
        status: 'active',
        validFromChapter: 1,
        confidence: 0.9,
        evidenceIds: ['evidence-goal'],
        mutationIds: ['mutation-goal'],
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    await deleteProjectData(PROJECT_ID);

    expect(await getProjectNarrativeStateFacts(PROJECT_ID)).toHaveLength(0);
    expect(await getProjectNarrativeStateMutations(PROJECT_ID)).toHaveLength(0);
    expect(await getProjectNarrativeStateEvidence(PROJECT_ID)).toHaveLength(0);
  });
});
