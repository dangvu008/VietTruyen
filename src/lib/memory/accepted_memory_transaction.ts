import { narrativeDb } from '../../db/narrative_db';
import type {
  NarrativeStateEvidence,
  NarrativeStateFact,
  NarrativeStateMutation,
  PendingHook,
} from '../../types/narrative_memory';

export interface AcceptedMemoryCommitInput {
  projectId: string;
  chapterId: string;
  chapterIndex: number;
  facts: NarrativeStateFact[];
  mutations: NarrativeStateMutation[];
  evidence: NarrativeStateEvidence[];
  hooks: PendingHook[];
}

/**
 * Single authoritative commit boundary for one accepted chapter.
 *
 * State facts/mutations/evidence and Pending Hooks are replaced together in a
 * single Dexie transaction. If any write fails, Dexie aborts the whole
 * transaction rather than leaving accepted long-term memory half promoted.
 */
export async function commitAcceptedChapterMemory(input: AcceptedMemoryCommitInput): Promise<void> {
  const { projectId, chapterId, chapterIndex, facts, mutations, evidence, hooks } = input;

  for (const record of [...facts, ...mutations, ...evidence, ...hooks]) {
    if (record.projectId !== projectId) {
      throw new Error(`Cross-project accepted-memory record blocked: ${record.projectId} != ${projectId}`);
    }
  }

  await narrativeDb.transaction(
    'rw',
    [
      narrativeDb.narrativeStateFacts,
      narrativeDb.narrativeStateMutations,
      narrativeDb.narrativeStateEvidence,
      narrativeDb.pendingHooks,
    ],
    async () => {
      const existingMutations = await narrativeDb.narrativeStateMutations
        .where('[projectId+chapterId]')
        .equals([projectId, chapterId])
        .toArray();
      const existingMutationIds = new Set(existingMutations.map((mutation) => mutation.id));

      await narrativeDb.narrativeStateMutations
        .where('[projectId+chapterId]')
        .equals([projectId, chapterId])
        .delete();
      await narrativeDb.narrativeStateEvidence
        .where('[projectId+chapterId]')
        .equals([projectId, chapterId])
        .delete();

      const existingFacts = await narrativeDb.narrativeStateFacts
        .where('projectId')
        .equals(projectId)
        .toArray();
      const incomingEvidenceIds = new Set(evidence.map((item) => item.id));
      const factIdsToDelete = existingFacts
        .filter((fact) => {
          if (fact.validFromChapter !== chapterIndex) return false;
          if (fact.mutationIds.some((mutationId) => existingMutationIds.has(mutationId))) return true;
          return fact.evidenceIds.some((evidenceId) => incomingEvidenceIds.has(evidenceId));
        })
        .map((fact) => fact.id);
      if (factIdsToDelete.length > 0) {
        await narrativeDb.narrativeStateFacts.bulkDelete(factIdsToDelete);
      }

      const existingHooks = await narrativeDb.pendingHooks
        .where('plantedChapterId')
        .equals(chapterId)
        .toArray();
      if (existingHooks.length > 0) {
        await narrativeDb.pendingHooks.bulkDelete(existingHooks.map((hook) => hook.id));
      }

      if (evidence.length > 0) await narrativeDb.narrativeStateEvidence.bulkPut(evidence);
      if (mutations.length > 0) await narrativeDb.narrativeStateMutations.bulkPut(mutations);
      if (facts.length > 0) await narrativeDb.narrativeStateFacts.bulkPut(facts);
      if (hooks.length > 0) await narrativeDb.pendingHooks.bulkPut(hooks);
    },
  );
}
