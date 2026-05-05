import JSZip from 'jszip';
import type { Chapter, Character, Foreshadowing, OutlineBeat, Project } from '../../types/story';

export interface CanonBundleOptions {
  includeBible: boolean;
  includeWorld: boolean;
  includeCharacters: boolean;
  includeOutline: boolean;
  includeChapters: boolean;
  includeNotes: boolean;
}

export interface CanonBundleFile {
  path: string;
  content: string;
  kind: 'markdown' | 'json';
  tags: string[];
  relatedIds?: string[];
}

export interface CanonContextMapEntry {
  path: string;
  kind: CanonBundleFile['kind'];
  tags: string[];
  relatedIds: string[];
}

export interface CanonGraphNode {
  id: string;
  type: 'project' | 'world' | 'character' | 'chapter' | 'outline' | 'foreshadowing';
  label: string;
}

export interface CanonGraphEdge {
  type:
    | 'has_world'
    | 'has_character'
    | 'has_chapter'
    | 'has_outline'
    | 'has_foreshadowing'
    | 'precedes'
    | 'mentions_character'
    | 'relates_to_character';
  from: string;
  to: string;
}

export interface CanonBundleManifest {
  format: 'viettruyen-canon-v1';
  projectId: string;
  title: string;
  exportedAt: string;
  includedSections: CanonBundleOptions;
  stats: {
    chapterCount: number;
    characterCount: number;
    outlineBeatCount: number;
    foreshadowingCount: number;
    totalWords: number;
  };
  files: string[];
}

export interface CanonBundle {
  manifest: CanonBundleManifest;
  files: CanonBundleFile[];
  suggestedFilename: string;
}

const DEFAULT_OPTIONS: CanonBundleOptions = {
  includeBible: true,
  includeWorld: true,
  includeCharacters: true,
  includeOutline: true,
  includeChapters: true,
  includeNotes: true,
};

export function buildCanonBundle(
  project: Project,
  options?: Partial<CanonBundleOptions>,
): CanonBundle {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const exportedAt = new Date().toISOString();
  const files: CanonBundleFile[] = [];

  pushFile(files, {
    path: 'README.md',
    kind: 'markdown',
    tags: ['readme', 'canon', 'rag'],
    content: buildReadme(project),
    relatedIds: [project.id],
  });

  pushFile(files, {
    path: 'data/project.snapshot.json',
    kind: 'json',
    tags: ['snapshot', 'project'],
    content: stableJson({
      ...project,
      chapters: project.chapters,
    }),
    relatedIds: [project.id],
  });

  pushFile(files, {
    path: 'data/chapters.snapshot.json',
    kind: 'json',
    tags: ['snapshot', 'chapters'],
    content: stableJson(project.chapters),
    relatedIds: project.chapters.map((chapter) => chapter.id),
  });

  if (resolvedOptions.includeBible) {
    pushFile(files, {
      path: 'canon/series-bible.md',
      kind: 'markdown',
      tags: ['canon', 'project', 'bible'],
      content: buildSeriesBible(project),
      relatedIds: [project.id],
    });
  }

  if (resolvedOptions.includeWorld) {
    pushFile(files, {
      path: 'canon/world.md',
      kind: 'markdown',
      tags: ['canon', 'world'],
      content: buildWorldMarkdown(project),
      relatedIds: [project.id],
    });
  }

  if (resolvedOptions.includeNotes && project.notes.trim()) {
    pushFile(files, {
      path: 'canon/notes.md',
      kind: 'markdown',
      tags: ['canon', 'notes'],
      content: `# Notes\n\n${project.notes.trim()}\n`,
      relatedIds: [project.id],
    });
  }

  if (resolvedOptions.includeCharacters) {
    project.characters.forEach((character, index) => {
      pushFile(files, {
        path: `characters/${pad(index + 1, 2)}-${slugify(character.name)}.md`,
        kind: 'markdown',
        tags: ['character'],
        content: buildCharacterMarkdown(character),
        relatedIds: [character.id],
      });
    });
  }

  if (resolvedOptions.includeOutline) {
    project.outline.forEach((beat, index) => {
      pushFile(files, {
        path: `outline/${pad(index + 1, 2)}-${slugify(beat.title)}.md`,
        kind: 'markdown',
        tags: ['outline', 'beat'],
        content: buildOutlineMarkdown(beat, index),
        relatedIds: [beat.id],
      });
    });
  }

  if (resolvedOptions.includeChapters) {
    project.chapters
      .slice()
      .sort((left, right) => (left.sequenceNumber ?? 0) - (right.sequenceNumber ?? 0))
      .forEach((chapter, index, chapters) => {
        const characterRefs = collectChapterCharacterRefs(project, chapter);
        pushFile(files, {
          path: `chapters/${pad(chapter.sequenceNumber ?? index + 1, 3)}-${slugify(chapter.title)}.md`,
          kind: 'markdown',
          tags: ['chapter', 'draft', chapter.status],
          content: buildChapterMarkdown(chapter, characterRefs),
          relatedIds: [chapter.id, ...characterRefs],
        });

        if (index > 0) {
          // No-op; edge is created in graph.
          void chapters;
        }
      });
  }

  if (project.foreshadowings.length > 0) {
    project.foreshadowings.forEach((entry, index) => {
      pushFile(files, {
        path: `foreshadowing/${pad(index + 1, 2)}-${slugify(entry.description.slice(0, 48))}.md`,
        kind: 'markdown',
        tags: ['foreshadowing'],
        content: buildForeshadowingMarkdown(entry),
        relatedIds: compactIds([entry.id, entry.relatedEntityId]),
      });
    });
  }

  const contextMap = files.map<CanonContextMapEntry>((file) => ({
    path: file.path,
    kind: file.kind,
    tags: file.tags,
    relatedIds: file.relatedIds || [],
  }));

  pushFile(files, {
    path: 'indexes/context-map.json',
    kind: 'json',
    tags: ['index', 'context-map', 'rag'],
    content: stableJson(contextMap),
    relatedIds: [project.id],
  });

  pushFile(files, {
    path: 'indexes/characters.json',
    kind: 'json',
    tags: ['index', 'characters'],
    content: stableJson(
      project.characters.map((character) => ({
        id: character.id,
        name: character.name,
        role: character.role,
        arc: character.arc,
        currentStage: character.currentStage,
        aliases: character.aliases || [],
        factCount: character.facts?.length || 0,
      })),
    ),
    relatedIds: project.characters.map((character) => character.id),
  });

  pushFile(files, {
    path: 'indexes/chapters.json',
    kind: 'json',
    tags: ['index', 'chapters'],
    content: stableJson(
      project.chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        sequenceNumber: chapter.sequenceNumber ?? null,
        status: chapter.status,
        summary: chapter.summary || '',
        updatedAt: chapter.updatedAt,
        wordCount: countWords(chapter.content),
        characterRefs: collectChapterCharacterRefs(project, chapter),
        timeAnchor: chapter.meta?.timeConstraint?.timeAnchor || null,
        endingLocation: chapter.meta?.ending?.location || null,
        bridgePoint: chapter.meta?.summary?.bridgePoint || null,
      })),
    ),
    relatedIds: project.chapters.map((chapter) => chapter.id),
  });

  pushFile(files, {
    path: 'indexes/outline.json',
    kind: 'json',
    tags: ['index', 'outline'],
    content: stableJson(project.outline),
    relatedIds: project.outline.map((beat) => beat.id),
  });

  const graph = buildCanonGraph(project);
  pushFile(files, {
    path: 'indexes/graph.json',
    kind: 'json',
    tags: ['index', 'graph'],
    content: stableJson(graph),
    relatedIds: [project.id],
  });

  const manifest: CanonBundleManifest = {
    format: 'viettruyen-canon-v1',
    projectId: project.id,
    title: project.title,
    exportedAt,
    includedSections: resolvedOptions,
    stats: {
      chapterCount: project.chapters.length,
      characterCount: project.characters.length,
      outlineBeatCount: project.outline.length,
      foreshadowingCount: project.foreshadowings.length,
      totalWords: project.chapters.reduce((sum, chapter) => sum + countWords(chapter.content), 0),
    },
    files: [],
  };

  pushFile(files, {
    path: 'manifest.json',
    kind: 'json',
    tags: ['manifest'],
    content: stableJson({
      ...manifest,
      files: files.map((file) => file.path),
    }),
    relatedIds: [project.id],
  });

  manifest.files = files.map((file) => file.path);

  return {
    manifest,
    files,
    suggestedFilename: `${slugify(project.title)}-canon.zip`,
  };
}

export async function generateCanonBundleArchive(
  project: Project,
  options?: Partial<CanonBundleOptions>,
): Promise<Blob> {
  const bundle = buildCanonBundle(project, options);
  const zip = new JSZip();

  bundle.files.forEach((file) => {
    zip.file(file.path, file.content);
  });

  return zip.generateAsync({ type: 'blob' });
}

function buildReadme(project: Project): string {
  return [
    `# ${project.title} Canon Bundle`,
    '',
    'Markdown là nguồn đọc/chỉnh sửa chính cho người viết.',
    'JSON snapshot và indexes là lớp chính xác cho backend, importer, và AI retrieval.',
    'Graph JSON là lớp quan hệ nhẹ để truy vấn nhanh chapter/character/foreshadowing.',
    '',
    '## Suggested Usage',
    '',
    '- Read `canon/series-bible.md` first for project-wide truth.',
    '- Read `canon/world.md` plus `characters/*.md` before drafting new scenes.',
    '- Use `indexes/context-map.json` to choose the smallest relevant context for AI.',
    '- Treat `data/project.snapshot.json` as the exact machine-readable snapshot.',
    '',
  ].join('\n');
}

function buildSeriesBible(project: Project): string {
  return [
    renderFrontmatter({
      id: project.id,
      title: project.title,
      genre: project.genre,
      subGenre: project.subGenre,
      tone: project.tone,
      canonVersion: project.canonVersion,
      targetChapters: project.targetChapters,
      updatedAt: project.updatedAt,
    }),
    `# ${project.title}`,
    '',
    `## Logline`,
    '',
    project.logline || 'Chưa có logline.',
    '',
    '## Main Plot',
    '',
    project.mainPlot || 'Chưa có main plot.',
    '',
    '## Character Setup',
    '',
    project.characterSetup || 'Chưa có mô tả nhân vật.',
    '',
    '## World Setting',
    '',
    project.worldSetting || 'Chưa có mô tả thế giới.',
    '',
    '## Endgame',
    '',
    project.endgame || 'Chưa có endgame.',
    '',
  ].join('\n');
}

function buildWorldMarkdown(project: Project): string {
  const factLines = project.world.facts?.map((fact) => `- ${fact.key}: ${fact.value}`) || ['- Chưa có facts.'];

  return [
    renderFrontmatter({
      projectId: project.id,
      geography: project.world.geography,
      techLevel: project.world.techLevel,
      currency: project.world.currency,
      factions: project.world.factions,
    }),
    '# World Rules',
    '',
    '## Geography',
    '',
    project.world.geography || 'Chưa có mô tả địa lý.',
    '',
    '## Magic System',
    '',
    project.world.magicSystem || 'Chưa có hệ thống năng lượng.',
    '',
    '## Rules',
    '',
    project.world.rules || 'Chưa có luật thế giới.',
    '',
    '## Facts',
    '',
    ...factLines,
    '',
  ].join('\n');
}

function buildCharacterMarkdown(character: Character): string {
  const factLines = character.facts?.map((fact) => `- ${fact.key}: ${fact.value}`) || ['- Chưa có facts.'];

  return [
    renderFrontmatter({
      id: character.id,
      name: character.name,
      role: character.role,
      arc: character.arc,
      currentStage: character.currentStage,
      aliases: character.aliases || [],
    }),
    `# ${character.name}`,
    '',
    '## Traits',
    '',
    character.traits || 'Chưa có traits.',
    '',
    '## Arc',
    '',
    character.arc || 'Chưa có arc.',
    '',
    '## Current Stage',
    '',
    character.currentStage || 'Chưa có current stage.',
    '',
    '## Facts',
    '',
    ...factLines,
    '',
  ].join('\n');
}

function buildOutlineMarkdown(beat: OutlineBeat, index: number): string {
  return [
    renderFrontmatter({
      id: beat.id,
      order: index + 1,
      title: beat.title,
      focus: beat.focus,
    }),
    `# ${beat.title}`,
    '',
    '## Summary',
    '',
    beat.summary || 'Chưa có summary.',
    '',
    '## Focus',
    '',
    beat.focus || 'Chưa có focus.',
    '',
  ].join('\n');
}

function buildChapterMarkdown(chapter: Chapter, characterRefs: string[]): string {
  return [
    renderFrontmatter({
      id: chapter.id,
      title: chapter.title,
      sequenceNumber: chapter.sequenceNumber ?? null,
      status: chapter.status,
      updatedAt: chapter.updatedAt,
      summary: chapter.summary || '',
      characters: chapter.meta?.summary?.characters || resolveCharacterNames(characterRefs),
      timeAnchor: chapter.meta?.timeConstraint?.timeAnchor || '',
      endingLocation: chapter.meta?.ending?.location || '',
      bridgePoint: chapter.meta?.summary?.bridgePoint || '',
    }),
    `# ${chapter.title}`,
    '',
    chapter.content.trim() || 'Chưa có nội dung.',
    '',
  ].join('\n');
}

function buildForeshadowingMarkdown(entry: Foreshadowing): string {
  return [
    renderFrontmatter({
      id: entry.id,
      relatedEntityId: entry.relatedEntityId || '',
      isResolved: entry.isResolved,
      createdAt: entry.createdAt,
    }),
    '# Foreshadowing',
    '',
    entry.description,
    '',
  ].join('\n');
}

function buildCanonGraph(project: Project): { nodes: CanonGraphNode[]; edges: CanonGraphEdge[] } {
  const nodes: CanonGraphNode[] = [
    { id: `project:${project.id}`, type: 'project', label: project.title },
    { id: `world:${project.id}`, type: 'world', label: 'World' },
  ];
  const edges: CanonGraphEdge[] = [
    { type: 'has_world', from: `project:${project.id}`, to: `world:${project.id}` },
  ];

  project.characters.forEach((character) => {
    nodes.push({
      id: `character:${character.id}`,
      type: 'character',
      label: character.name,
    });
    edges.push({
      type: 'has_character',
      from: `project:${project.id}`,
      to: `character:${character.id}`,
    });
  });

  project.outline.forEach((beat, index) => {
    nodes.push({
      id: `outline:${beat.id}`,
      type: 'outline',
      label: beat.title,
    });
    edges.push({
      type: 'has_outline',
      from: `project:${project.id}`,
      to: `outline:${beat.id}`,
    });
    if (index > 0) {
      edges.push({
        type: 'precedes',
        from: `outline:${project.outline[index - 1].id}`,
        to: `outline:${beat.id}`,
      });
    }
  });

  project.chapters
    .slice()
    .sort((left, right) => (left.sequenceNumber ?? 0) - (right.sequenceNumber ?? 0))
    .forEach((chapter, index, chapters) => {
      nodes.push({
        id: `chapter:${chapter.id}`,
        type: 'chapter',
        label: chapter.title,
      });
      edges.push({
        type: 'has_chapter',
        from: `project:${project.id}`,
        to: `chapter:${chapter.id}`,
      });
      if (index > 0) {
        edges.push({
          type: 'precedes',
          from: `chapter:${chapters[index - 1].id}`,
          to: `chapter:${chapter.id}`,
        });
      }
      collectChapterCharacterRefs(project, chapter).forEach((characterId) => {
        edges.push({
          type: 'mentions_character',
          from: `chapter:${chapter.id}`,
          to: `character:${characterId}`,
        });
      });
    });

  project.foreshadowings.forEach((entry) => {
    nodes.push({
      id: `foreshadowing:${entry.id}`,
      type: 'foreshadowing',
      label: truncate(entry.description, 80),
    });
    edges.push({
      type: 'has_foreshadowing',
      from: `project:${project.id}`,
      to: `foreshadowing:${entry.id}`,
    });
    if (entry.relatedEntityId) {
      edges.push({
        type: 'relates_to_character',
        from: `foreshadowing:${entry.id}`,
        to: `character:${entry.relatedEntityId}`,
      });
    }
  });

  return { nodes, edges };
}

function collectChapterCharacterRefs(project: Project, chapter: Chapter): string[] {
  const namesFromMeta = chapter.meta?.summary?.characters || [];
  const normalizedNames = new Set(namesFromMeta.map(normalizeText));
  const content = normalizeText(`${chapter.title}\n${chapter.summary || ''}\n${chapter.content}`);

  return project.characters
    .filter((character) => {
      const allNames = [character.name, ...(character.aliases || [])];
      return allNames.some((name) => {
        const normalized = normalizeText(name);
        return normalizedNames.has(normalized) || content.includes(normalized);
      });
    })
    .map((character) => character.id);
}

function resolveCharacterNames(characterIds: string[]): string[] {
  return characterIds;
}

function renderFrontmatter(values: Record<string, unknown>): string {
  const lines = Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${formatFrontmatterValue(value)}`);
  return ['---', ...lines, '---', ''].join('\n');
}

function formatFrontmatterValue(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

function pushFile(target: CanonBundleFile[], file: CanonBundleFile): void {
  target.push(file);
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase('vi-VN');
}

function compactIds(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value));
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit).trim()}...`;
}
