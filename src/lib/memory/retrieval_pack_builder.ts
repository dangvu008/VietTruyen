import type { MemorySearchHit, RetrievalPackItem } from '../../types/memory_embedding';
import type { RelevantNarrativeCommunity } from './memory_query';
import type { PropagationTask } from '../../types/narrative_memory';

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
