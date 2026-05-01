import type { MemoryEmbeddingContentType } from '../../types/memory_embedding';
import type { Project } from '../../types/story';

export type MemoryRetrievalIntent =
  | 'writing'
  | 'writing_scene'
  | 'continuation'
  | 'adaptation'
  | 'plot_qa'
  | 'retcon_review';

export interface MemoryRetrievalProfile {
  candidateLimit: number;
  finalLimit: number;
  contentTypes: MemoryEmbeddingContentType[];
}

const WORLD_KEYWORDS = [
  'boi canh',
  'dia hinh',
  'dia ly',
  'he thong',
  'luat',
  'phe phai',
  'the gioi',
  'bi canh',
  'di tich',
  'truyen thua',
  'quy tac',
];

const TEMPORAL_SCENE_KEYWORDS = [
  'vua roi',
  'gan nhat',
  'moi nhat',
  'xay ra',
  'o dau',
  'khi nao',
  'ra sao',
  'the nao',
];

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function queryMentionsCharacter(project: Project, query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return (project.characters || []).some((character) =>
    [character.name, ...(character.aliases || [])]
      .map((value) => normalizeText(value))
      .filter(Boolean)
      .some((name) => normalizedQuery.includes(name))
  );
}

function dedupeContentTypes(contentTypes: MemoryEmbeddingContentType[]): MemoryEmbeddingContentType[] {
  return Array.from(new Set(contentTypes));
}

export function buildMemoryRetrievalProfile(
  intent: MemoryRetrievalIntent,
  project: Project,
  query: string
): MemoryRetrievalProfile {
  const normalizedIntent = intent === 'writing' ? 'writing_scene' : intent;
  const normalizedQuery = normalizeText(query);
  const mentionsCharacter = queryMentionsCharacter(project, query);
  const mentionsWorld = matchesAny(normalizedQuery, WORLD_KEYWORDS);
  const asksForRecentScene = matchesAny(normalizedQuery, TEMPORAL_SCENE_KEYWORDS);

  if (normalizedIntent === 'plot_qa') {
    const contentTypes: MemoryEmbeddingContentType[] = ['canon_fact', 'character_note', 'chapter_summary'];
    if (mentionsWorld) {
      contentTypes.push('world_note');
    }
    if (asksForRecentScene) {
      contentTypes.push('scene');
    }

    return {
      candidateLimit: 20,
      finalLimit: 4,
      contentTypes: dedupeContentTypes(contentTypes),
    };
  }

  const contentTypes: MemoryEmbeddingContentType[] = ['scene', 'chapter_summary'];
  if (normalizedIntent === 'continuation') {
    contentTypes.push('character_note', 'canon_fact');
  }
  if (normalizedIntent === 'adaptation') {
    contentTypes.push('character_note', 'canon_fact', 'source_span', 'adaptation_note');
  }
  if (normalizedIntent === 'retcon_review') {
    contentTypes.push('canon_fact', 'retcon_note');
  }
  if (mentionsCharacter) {
    contentTypes.push('character_note', 'canon_fact');
  }
  if (mentionsWorld) {
    contentTypes.push('world_note', 'canon_fact');
  }

  return {
    candidateLimit: 24,
    finalLimit: 4,
    contentTypes: dedupeContentTypes(contentTypes),
  };
}
