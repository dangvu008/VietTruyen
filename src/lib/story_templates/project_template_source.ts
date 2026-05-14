import { sortChaptersBySequence } from '../memory/chapter_order';
import type { Chapter, Project } from '../../types/story';

export interface ProjectTemplateDraftOverrides {
  contents?: Record<string, string>;
  titles?: Record<string, string>;
}

function joinNonEmptyLines(lines: Array<string | null | undefined>): string {
  return lines
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

function formatList(label: string, values: string[] | undefined): string | null {
  const items = values?.map((value) => value.trim()).filter(Boolean) ?? [];
  return items.length > 0 ? `${label}: ${items.join(', ')}` : null;
}

function resolveChapterWithDrafts(
  chapter: Chapter,
  overrides: ProjectTemplateDraftOverrides,
): Chapter {
  return {
    ...chapter,
    title: overrides.titles?.[chapter.id] ?? chapter.title,
    content: overrides.contents?.[chapter.id] ?? chapter.content,
  };
}

function formatChapters(
  chapters: Chapter[],
  overrides: ProjectTemplateDraftOverrides,
): string {
  return sortChaptersBySequence(chapters)
    .map((chapter) => resolveChapterWithDrafts(chapter, overrides))
    .filter((chapter) => chapter.content.trim())
    .map((chapter, index) =>
      joinNonEmptyLines([
        `### ${chapter.title.trim() || `Chương ${index + 1}`}`,
        chapter.summary ? `Tóm tắt: ${chapter.summary}` : null,
        chapter.content,
      ]),
    )
    .join('\n\n');
}

export function countProjectTemplateChapterContentChars(
  project: Project,
  overrides: ProjectTemplateDraftOverrides = {},
): number {
  return project.chapters.reduce((total, chapter) => {
    const content = overrides.contents?.[chapter.id] ?? chapter.content;
    return total + content.trim().length;
  }, 0);
}

export function buildProjectTemplateSourceText(
  project: Project,
  overrides: ProjectTemplateDraftOverrides = {},
): string {
  const characterText = project.characters
    .map((character) =>
      joinNonEmptyLines([
        `- ${character.name}`,
        character.role ? `  Vai trò: ${character.role}` : null,
        character.traits ? `  Tính cách: ${character.traits}` : null,
        character.psychology?.selfDeception ? `  Tự lừa mình: ${character.psychology.selfDeception}` : null,
        character.psychology?.deepFear ? `  Nỗi sợ sâu: ${character.psychology.deepFear}` : null,
        character.arc ? `  Arc: ${character.arc}` : null,
      ]),
    )
    .filter(Boolean)
    .join('\n');

  const outlineText = project.masterOutline?.volumes.length
    ? project.masterOutline.volumes
        .map((volume) =>
          joinNonEmptyLines([
            `- ${volume.title} (${volume.chapterRange[0]}-${volume.chapterRange[1]})`,
            volume.premise ? `  Tiền đề: ${volume.premise}` : null,
            volume.escalation ? `  Leo thang: ${volume.escalation}` : null,
            volume.climax ? `  Cao trào: ${volume.climax}` : null,
          ]),
        )
        .join('\n')
    : project.outline
        .map((beat) =>
          joinNonEmptyLines([
            `- ${beat.title}`,
            beat.summary ? `  Tóm tắt: ${beat.summary}` : null,
            beat.focus ? `  Trọng tâm: ${beat.focus}` : null,
          ]),
        )
        .filter(Boolean)
        .join('\n');

  const chapterText = formatChapters(project.chapters, overrides);

  return [
    '# STORY TEMPLATE SOURCE',
    joinNonEmptyLines([
      `Title: ${project.title}`,
      project.genre ? `Genre: ${project.genre}` : null,
      formatList('Subgenres', project.subGenre),
      project.writingStyle ? `Writing style: ${project.writingStyle}` : null,
      project.tone ? `Tone: ${project.tone}` : null,
      project.logline ? `Logline: ${project.logline}` : null,
      project.mainPlot ? `Main plot: ${project.mainPlot}` : null,
      project.endgame ? `Endgame: ${project.endgame}` : null,
    ]),
    joinNonEmptyLines([
      '## WORLD',
      project.worldSetting,
      project.world?.geography ? `Geography: ${project.world.geography}` : null,
      project.world?.magicSystem ? `Power system: ${project.world.magicSystem}` : null,
      project.world?.techLevel ? `Tech level: ${project.world.techLevel}` : null,
      project.world?.currency ? `Currency: ${project.world.currency}` : null,
      formatList('Factions', project.world?.factions),
      project.world?.rules ? `Rules: ${project.world.rules}` : null,
    ]),
    characterText ? `## CHARACTERS\n${characterText}` : '',
    outlineText ? `## OUTLINE\n${outlineText}` : '',
    chapterText ? `## CHAPTERS\n${chapterText}` : '',
    project.notes?.trim() ? `## NOTES\n${project.notes.trim()}` : '',
  ]
    .map((section) => section.trim())
    .filter(Boolean)
    .join('\n\n');
}
