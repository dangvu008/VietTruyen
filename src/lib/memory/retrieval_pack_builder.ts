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
    .map((fact, index) => {
      const knowledge = stateFactToCharacterKnowledge(fact);
      if (knowledge) {
        return createPackItem(
          `knowledge:${knowledge.characterId}:${knowledge.propositionId}:${index}`,
          `${knowledge.characterId} · character knowledge`,
          `- ${knowledge.characterId}: ${truncateText(knowledge.proposition, 150)} | belief=${knowledge.belief} | worldTruth=${knowledge.worldTruth} (từ Ch.${knowledge.learnedAtChapter ?? fact.validFromChapter})`,
          Math.max(0.72, Math.min(1, fact.confidence)),
          'character_knowledge',
          { chapterIndex: fact.validFromChapter },
        );
      }

      return createPackItem(
        `state:${fact.subjectId}:${fact.predicate}:${index}`,
        `${fact.subjectId} · ${fact.predicate}`,
        `- ${fact.subjectId}: ${fact.predicate} = ${truncateText(fact.value, 140)} (từ Ch.${fact.validFromChapter})`,
        Math.max(0.6, Math.min(1, fact.confidence)),
        'state_fact',
        {
          chapterIndex: fact.validFromChapter,
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
