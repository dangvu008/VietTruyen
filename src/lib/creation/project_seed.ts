import type { AcceptedChapter } from '../../types/creation_chat';
import type { BrainstormResult } from '../../types/narrative_memory';
import type { Chapter, Foreshadowing, OutlineBeat, Project } from '../../types/story';

interface BuildCreationProjectSeedParams {
  framework: BrainstormResult | null;
  acceptedChapters: AcceptedChapter[];
  createId: () => string;
  nowIso?: string;
}

interface CreationProjectSeed {
  projectPatch: Partial<Project>;
  chapters: Chapter[];
}

interface ChapterShell {
  title: string;
  summary: string;
}

function sortAcceptedChapters(chapters: AcceptedChapter[]): AcceptedChapter[] {
  return [...chapters].sort((left, right) => {
    if (left.chapterIndex !== right.chapterIndex) {
      return left.chapterIndex - right.chapterIndex;
    }
    return left.createdAt.localeCompare(right.createdAt);
  });
}

function buildOutline(
  framework: BrainstormResult | null,
  createId: () => string,
): OutlineBeat[] {
  return (framework?.outline || []).map((item) => ({
    id: createId(),
    title: item.title,
    summary: item.summary,
    focus: item.focus || '',
  }));
}

function buildCharacters(
  framework: BrainstormResult | null,
  createId: () => string,
) {
  return (framework?.characters || []).map((character) => ({
    id: createId(),
    name: character.name,
    role: character.role || 'main',
    traits: character.traits,
    arc: character.arc,
    currentStage: character.currentStage || '',
    psychology: character.psychology,
  }));
}

function buildForeshadowings(
  framework: BrainstormResult | null,
  createId: () => string,
  nowIso: string,
): Foreshadowing[] {
  return (framework?.foreshadowings || []).map((item) => ({
    id: createId(),
    description: item.description,
    isResolved: false,
    createdAt: nowIso,
  }));
}

function buildProjectChapters(
  framework: BrainstormResult | null,
  acceptedChapters: AcceptedChapter[],
  createId: () => string,
  nowIso: string,
): Chapter[] {
  const acceptedByIndex = new Map(
    sortAcceptedChapters(acceptedChapters).map((chapter) => [chapter.chapterIndex, chapter] as const),
  );

  const shellByIndex = new Map<number, ChapterShell>();
  (framework?.outline || []).forEach((item, index) => {
    shellByIndex.set(index, {
      title: item.title || `Chương ${index + 1}`,
      summary: item.summary || '',
    });
  });
  (framework?.chapterSkeleton || []).forEach((item, index) => {
    const current = shellByIndex.get(index);
    shellByIndex.set(index, {
      title: item.title || current?.title || `Chương ${index + 1}`,
      summary: item.summary || current?.summary || '',
    });
  });

  const highestAcceptedIndex = acceptedChapters.reduce(
    (max, chapter) => Math.max(max, chapter.chapterIndex),
    -1,
  );
  const totalCount = Math.max(shellByIndex.size, highestAcceptedIndex + 1);

  return Array.from({ length: totalCount }, (_, chapterIndex) => {
    const accepted = acceptedByIndex.get(chapterIndex);
    const shell = shellByIndex.get(chapterIndex);

    return {
      id: createId(),
      title: accepted?.title || shell?.title || `Chương ${chapterIndex + 1}`,
      content: accepted?.content || '',
      summary: shell?.summary || '',
      sequenceNumber: chapterIndex + 1,
      status: 'draft',
      createdAt: accepted?.createdAt || nowIso,
      updatedAt: accepted?.updatedAt || nowIso,
    };
  });
}

export function buildCreationProjectSeed({
  framework,
  acceptedChapters,
  createId,
  nowIso = new Date().toISOString(),
}: BuildCreationProjectSeedParams): CreationProjectSeed {
  const seededChapters = buildProjectChapters(framework, acceptedChapters, createId, nowIso);
  const targetChapterCount = Math.max(
    seededChapters.length,
    framework?.chapterSkeleton?.length || 0,
    framework?.outline?.length || 0,
    acceptedChapters.length,
    1,
  );

  return {
    projectPatch: {
      title: framework?.bible?.title || 'Truyện mới',
      status: framework ? 'ongoing' : acceptedChapters.length > 0 ? 'ongoing' : 'draft',
      logline: framework?.bible?.logline || '',
      genre: framework?.bible?.genre || '',
      subGenre: framework?.bible?.subGenre || [],
      writingStyle: framework?.bible?.writingStyle || '',
      endgame: framework?.bible?.endgame || '',
      mainCharacterCount: framework?.bible?.mainCharacterCount || 2,
      supportCharacterCount: framework?.bible?.supportCharacterCount || 3,
      characterSetup: framework?.bible?.characterSetup || '',
      worldSetting: framework?.bible?.worldSetting || '',
      mainPlot: framework?.bible?.mainPlot || '',
      characters: buildCharacters(framework, createId),
      world: {
        geography: framework?.world?.geography || '',
        magicSystem: framework?.world?.magicSystem || '',
        techLevel: framework?.world?.techLevel || '',
        currency: framework?.world?.currency || '',
        factions: framework?.world?.factions || [],
        rules: framework?.world?.rules || '',
      },
      targetChapters: targetChapterCount || 60,
      outline: buildOutline(framework, createId),
      foreshadowings: buildForeshadowings(framework, createId, nowIso),
    },
    chapters: seededChapters,
  };
}
