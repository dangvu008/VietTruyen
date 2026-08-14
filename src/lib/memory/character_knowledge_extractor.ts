import { createId } from '../../core/id';
import type {
  EntityDefinition,
  NarrativeStateEvidence,
  NarrativeStateFact,
  NarrativeStateMutation,
} from '../../types/narrative_memory';
import type { Scene } from '../../types/chapter_summary';
import { hashString } from './memory_indexer';
import type { BeliefStatus, CharacterKnowledgeEntry } from './character_knowledge_ledger';
import { characterKnowledgeToStateFact } from './character_knowledge_state';

export interface ExtractedCharacterKnowledge {
  entry: CharacterKnowledgeEntry;
  sourceText: string;
  sceneId?: string;
}

const KNOWLEDGE_PATTERNS: Array<{ belief: BeliefStatus; regex: RegExp }> = [
  { belief: 'knows', regex: /\b(?:biết rằng|biết được|nhận ra rằng|nhận ra|phát hiện rằng|phát hiện|hiểu ra rằng|hiểu ra|xác nhận rằng)\s+(.+)/i },
  { belief: 'suspects', regex: /\b(?:nghi ngờ rằng|nghi ngờ|hoài nghi rằng|hoài nghi|đoán rằng)\s+(.+)/i },
  { belief: 'disbelieves', regex: /\b(?:không tin rằng|không tin)\s+(.+)/i },
  { belief: 'believes', regex: /\b(?:tin rằng|cho rằng)\s+(.+)/i },
];

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function splitSentences(text: string): string[] {
  return String(text || '')
    .split(/(?<=[.!?…\n])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function propositionFromSentence(sentence: string): { belief: BeliefStatus; proposition: string } | null {
  for (const pattern of KNOWLEDGE_PATTERNS) {
    const match = sentence.match(pattern.regex);
    const proposition = String(match?.[1] || '').replace(/[.!?…]+$/g, '').trim();
    if (proposition.length >= 8) {
      return { belief: pattern.belief, proposition: proposition.slice(0, 260) };
    }
  }
  return null;
}

/**
 * Conservative extractor: only explicit named-character knowledge statements
 * are promoted automatically. Pronoun-only or implied inference is ignored so
 * the system prefers missing a weak signal over inventing character knowledge.
 */
export function extractExplicitCharacterKnowledge(params: {
  projectId: string;
  chapterId: string;
  chapterIndex: number;
  entityDefinitions: EntityDefinition[];
  scenes: Scene[];
}): ExtractedCharacterKnowledge[] {
  const output: ExtractedCharacterKnowledge[] = [];
  const seen = new Set<string>();

  for (const scene of params.scenes) {
    for (const sentence of splitSentences([scene.summary, scene.content].filter(Boolean).join('\n'))) {
      const normalizedSentence = normalize(sentence);
      const knowledge = propositionFromSentence(sentence);
      if (!knowledge) continue;

      for (const entity of params.entityDefinitions.filter((item) => item.entityType === 'character')) {
        const aliases = [entity.canonicalName, ...(entity.aliases || [])].filter(Boolean);
        const matched = aliases.some((alias) => normalizedSentence.includes(normalize(alias)));
        if (!matched) continue;

        const propositionId = `prop-${hashString(normalize(knowledge.proposition))}`;
        const key = `${entity.entityId}:${propositionId}:${knowledge.belief}`;
        if (seen.has(key)) continue;
        seen.add(key);

        output.push({
          entry: {
            id: createId(),
            projectId: params.projectId,
            characterId: entity.entityId,
            propositionId,
            proposition: knowledge.proposition,
            worldTruth: 'unknown',
            belief: knowledge.belief,
            learnedAtChapter: params.chapterIndex,
            lastConfirmedAtChapter: params.chapterIndex,
            sourceChapterId: params.chapterId,
            confidence: knowledge.belief === 'knows' ? 0.86 : 0.72,
          },
          sourceText: sentence,
          sceneId: scene.id,
        });
      }
    }
  }

  return output;
}

export function characterKnowledgeCandidatesToStateRecords(params: {
  candidates: ExtractedCharacterKnowledge[];
  chapterId: string;
}): {
  facts: NarrativeStateFact[];
  mutations: NarrativeStateMutation[];
  evidence: NarrativeStateEvidence[];
} {
  const facts: NarrativeStateFact[] = [];
  const mutations: NarrativeStateMutation[] = [];
  const evidence: NarrativeStateEvidence[] = [];
  const now = new Date().toISOString();

  for (const candidate of params.candidates) {
    const evidenceId = createId();
    const mutationId = createId();
    evidence.push({
      id: evidenceId,
      projectId: candidate.entry.projectId,
      chapterId: params.chapterId,
      sceneId: candidate.sceneId,
      sourceText: candidate.sourceText,
      sourceHash: `${params.chapterId}:knowledge:${candidate.entry.propositionId}:${candidate.entry.characterId}`,
      extractorVersion: 'character-knowledge-explicit-v1',
      confidence: candidate.entry.confidence,
      createdAt: now,
    });
    mutations.push({
      id: mutationId,
      projectId: candidate.entry.projectId,
      chapterId: params.chapterId,
      sceneId: candidate.sceneId,
      mutationType: 'update',
      subjectId: candidate.entry.characterId,
      subjectType: 'character',
      predicate: `character_knowledge:${candidate.entry.propositionId}`,
      afterValue: JSON.stringify({
        proposition: candidate.entry.proposition,
        worldTruth: candidate.entry.worldTruth,
        belief: candidate.entry.belief,
      }),
      confidence: candidate.entry.confidence,
      evidenceId,
      evidenceText: candidate.sourceText,
      reviewStatus: candidate.entry.confidence >= 0.8 ? 'auto_accepted' : 'needs_review',
      createdAt: now,
    });
    facts.push(characterKnowledgeToStateFact(candidate.entry, {
      factId: createId(),
      mutationIds: [mutationId],
      evidenceIds: [evidenceId],
      updatedAt: now,
    }));
  }

  return { facts, mutations, evidence };
}
