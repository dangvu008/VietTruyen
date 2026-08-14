import type { MemorySearchHit, RetrievalPackItem } from '../../types/memory_embedding';
import type { RelevantNarrativeCommunity } from './memory_query';
import type { NarrativeStateFact, PendingHook, PropagationTask } from '../../types/narrative_memory';
import { stateFactToCharacterKnowledge } from './character_knowledge_state';

function truncateText(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

export function createPackItem(
  id: string,
  title: string,
  body: string,
  score: number,
  sourceType: string,
  opts?: Pick<RetrievalPackItem, 'nodeIds' | 'chapterIndex'>
): RetrievalPackItem {
  return {
    id,
    title,
    body,
    score,
    sourceType,
    nodeIds: opts?.nodeIds,
    chapterIndex: opts?.chapterIndex,
  };
}

export function buildGraphPack(
  communities: RelevantNarrativeCommunity[],
  limit = 2
): RetrievalPackItem[] {
  return communities
    .slice(0, limit)
    .map((entry, index) => {
      const nodeSummary = entry.nodes
        .map((node) => `${node.label} (${node.nodeType})`)
        .join(' | ');

      return createPackItem(
        `graph:${index}:${entry.community.id}`,
        entry.community.label,
        nodeSummary ? `- Trọng tâm: ${truncateText(nodeSummary, 220)}` : '',
        entry.score,
        'community',
        {
          nodeIds: entry.community.memberNodeIds,
        }
      );
    });
}

export function buildStatePack(
  facts: NarrativeStateFact[],
  limit = 4
): RetrievalPackItem[] {
  return facts
    .slice(0, limit)
    .map((fact, index) =>
      createPackItem(
        `state:${fact.subjectId}:${fact.predicate}:${index}`,
        `${fact.subjectId} · ${fact.predicate}`,
        `- ${fact.subjectId}: ${fact.predicate} = ${truncateText(fact.value, 140)} (từ Ch.${fact.validFromChapter})`,
        Math.max(0.6, Math.min(1, fact.confidence)),
        'state_fact',
        {
          chapterIndex: fact.validFromChapter,
        }
      )
    );
}

/**
 * Character knowledge is an epistemic constraint, not objective canon.
 * Keep belief and world truth side-by-side so the writer can reason about both
 * without silently upgrading suspicion/belief into knowledge.
 */
export function buildKnowledgePack(
  facts: NarrativeStateFact[],
  targetChapterIndex: number,
  limit = 6
): RetrievalPackItem[] {
  return facts
    .map(stateFactToCharacterKnowledge)
    .filter((entry): entry is NonNullable<ReturnType<typeof stateFactToCharacterKnowledge>> => entry !== null)
    .filter((entry) => (entry.learnedAtChapter ?? 0) <= targetChapterIndex)
    .filter((entry) => entry.forgottenAtChapter == null || entry.forgottenAtChapter > targetChapterIndex)
    .sort((left, right) => {
      const leftChapter = left.lastConfirmedAtChapter ?? left.learnedAtChapter ?? 0;
      const rightChapter = right.lastConfirmedAtChapter ?? right.learnedAtChapter ?? 0;
      if (rightChapter !== leftChapter) return rightChapter - leftChapter;
      return right.confidence - left.confidence;
    })
    .slice(0, limit)
    .map((entry) => {
      const learnedAt = entry.learnedAtChapter != null ? `Ch.${entry.learnedAtChapter}` : 'chưa xác định';
      const confirmedAt = entry.lastConfirmedAtChapter != null ? `; xác nhận gần nhất Ch.${entry.lastConfirmedAtChapter}` : '';
      const scoreByBelief = {
        knows: 1,
        believes: 0.9,
        suspects: 0.84,
        disbelieves: 0.88,
        unknown: 0.6,
      } as const;
      const score = Math.max(0.6, Math.min(1, Math.min(entry.confidence, scoreByBelief[entry.belief])));
      const body = [
        `- Mệnh đề: ${truncateText(entry.proposition, 180)}`,
        `- Nhận thức của nhân vật: ${entry.belief}; sự thật thế giới: ${entry.worldTruth}`,
        `- Có hiệu lực từ ${learnedAt}${confirmedAt}.`,
        '- RÀNG BUỘC: hành vi/lời thoại của nhân vật phải theo nhận thức của nhân vật, không theo sự thật thế giới nếu hai lớp khác nhau.',
      ].join('\n');

      return createPackItem(
        `knowledge:${entry.characterId}:${entry.propositionId}`,
        `${entry.characterId} · knowledge · ${entry.propositionId}`,
        body,
        score,
        'character_knowledge',
        {
          chapterIndex: entry.learnedAtChapter ?? entry.lastConfirmedAtChapter,
        }
      );
    });
}

export function buildHookPack(
  hooks: PendingHook[],
  limit = 4
): RetrievalPackItem[] {
  return hooks
    .slice(0, limit)
    .map((hook, index) => {
      const payoff = hook.expectedPayoffBy ? ` | payoff trước Ch.${hook.expectedPayoffBy}` : '';
      return createPackItem(
        `hook:${hook.id}:${index}`,
        `Hook mở từ Ch.${hook.plantedChapterIndex}`,
        `- ${truncateText(hook.description, 160)}${payoff}`,
        Math.max(0.6, Math.min(1, hook.confidence)),
        'pending_hook',
        {
          chapterIndex: hook.plantedChapterIndex,
        }
      );
    });
}

export function buildRiskPack(
  warnings: PropagationTask[],
  limit = 3
): RetrievalPackItem[] {
  return warnings
    .slice(0, limit)
    .map((warning, index) => {
      const context = [warning.reason, warning.dependencyContext]
        .filter(Boolean)
        .map((item) => truncateText(item, 120))
        .join(' | ');

      const body = [
        `Continuity: ${warning.recommendedAction}`,
        context ? `Ngữ cảnh: ${context}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      return createPackItem(
        `risk:${warning.chapterIndex}:${index}`,
        `Continuity risk Ch.${warning.chapterIndex}`,
        body,
        warning.severity === 'breaking' ? 1 : warning.severity === 'warning' ? 0.85 : 0.7,
        'continuity_warning',
        {
          chapterIndex: warning.chapterIndex,
        }
      );
    });
}

export function buildSemanticPack(
  semanticHits: MemorySearchHit[],
  limit = 4
): RetrievalPackItem[] {
  return semanticHits.slice(0, limit).map((hit) => {
    const prefix = hit.record.contentType.replace(/_/g, ' ');
    return createPackItem(
      `semantic:${hit.record.id}`,
      prefix,
      `- [${prefix}] ${truncateText(hit.record.sourceText, 180)}`,
      hit.score,
      hit.record.contentType,
      {
        chapterIndex: hit.record.chapterIndex,
      }
    );
  });
}

export function renderPackSection(
  heading: string,
  items: RetrievalPackItem[],
  opts?: { limit?: number; bodyMaxChars?: number; includeTitles?: boolean }
): string {
  const limit = opts?.limit ?? items.length;
  const includeTitles = opts?.includeTitles ?? false;
  const selected = items.slice(0, limit);
  if (selected.length === 0) return '';

  const lines: string[] = [heading];
  selected.forEach((item, index) => {
    if (includeTitles && item.title.trim()) {
      lines.push(`${index + 1}. ${item.title.trim()}`);
    }
    if (item.body.trim()) {
      lines.push(opts?.bodyMaxChars ? truncateText(item.body, opts.bodyMaxChars) : item.body);
    }
  });

  return lines.join('\n');
}

export function extractPackBodies(items: RetrievalPackItem[], limit: number): string[] {
  return items
    .slice(0, limit)
    .map((item) => item.body.trim())
    .filter(Boolean);
}
