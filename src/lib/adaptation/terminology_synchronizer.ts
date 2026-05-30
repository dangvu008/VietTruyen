/**
 * File: terminology_synchronizer.ts
 * Purpose: Detect and fix terminology inconsistencies across chapters (No AI)
 * Layer: Application (Service)
 * Domain: AdaptationStudio → [Translation Workshop, terminology consistency]
 */

import type {
  AdaptationGlossary,
  AdaptationScanIssue,
  TerminologyGroup,
} from '../../types/adaptation_studio';

export function buildTerminologyGroups(glossaries: AdaptationGlossary[]): TerminologyGroup[] {
  return glossaries.map((g) => ({
    canonical: g.canonical,
    aliases: g.aliases,
    category: g.category,
    occurrences: {},
  }));
}

export interface ChapterText {
  chapterId: string;
  content: string;
  contentHash: string;
}

export function scanTerminologyInconsistency(
  projectId: string,
  chapters: ChapterText[],
  groups: TerminologyGroup[],
): AdaptationScanIssue[] {
  const issues: AdaptationScanIssue[] = [];

  for (const group of groups) {
    for (const alias of group.aliases) {
      if (alias === group.canonical) continue;

      const regex = new RegExp(escapeRegex(alias), 'gi');

      for (const chapter of chapters) {
        let match: RegExpExecArray | null;
        while ((match = regex.exec(chapter.content)) !== null) {
          issues.push({
            id: `term-${chapter.chapterId}-${match.index}`,
            projectId,
            chapterId: chapter.chapterId,
            trackId: 'translation',
            issueType: 'terminology_inconsistent',
            severity: 'warning',
            position: { offset: match.index, length: alias.length },
            originalText: chapter.content.slice(match.index, match.index + alias.length),
            suggestedFix: group.canonical,
            contentHash: chapter.contentHash,
            status: 'open',
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  return issues;
}

export interface PatchResult {
  chapterId: string;
  patchedContent: string;
  replacementCount: number;
}

export function batchReplaceTerminology(
  chapters: ChapterText[],
  group: TerminologyGroup,
): PatchResult[] {
  const results: PatchResult[] = [];

  for (const chapter of chapters) {
    let content = chapter.content;
    let count = 0;

    for (const alias of group.aliases) {
      if (alias === group.canonical) continue;
      const regex = new RegExp(escapeRegex(alias), 'gi');
      const matches = content.match(regex);
      if (matches) {
        count += matches.length;
        content = content.replace(regex, group.canonical);
      }
    }

    if (count > 0) {
      results.push({
        chapterId: chapter.chapterId,
        patchedContent: content,
        replacementCount: count,
      });
    }
  }

  return results;
}

export function countOccurrences(
  chapters: ChapterText[],
  groups: TerminologyGroup[],
): TerminologyGroup[] {
  return groups.map((group) => {
    const occurrences: Record<string, number> = {};
    const allTerms = [group.canonical, ...group.aliases];

    for (const chapter of chapters) {
      let count = 0;
      for (const term of allTerms) {
        const regex = new RegExp(escapeRegex(term), 'gi');
        const matches = chapter.content.match(regex);
        if (matches) count += matches.length;
      }
      if (count > 0) {
        occurrences[chapter.chapterId] = count;
      }
    }

    return { ...group, occurrences };
  });
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
