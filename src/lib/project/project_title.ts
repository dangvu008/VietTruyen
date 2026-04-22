import type { Project } from '../../types/story';

const TITLE_LOCALE = 'vi-VN';

export function normalizeProjectTitle(title?: string): string {
  return (title || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase(TITLE_LOCALE);
}

export function findProjectByTitle(
  projects: Project[],
  title?: string,
  options?: { excludeProjectId?: string },
): Project | undefined {
  const normalizedTitle = normalizeProjectTitle(title);
  if (!normalizedTitle) return undefined;

  return projects.find((project) => {
    if (options?.excludeProjectId && project.id === options.excludeProjectId) {
      return false;
    }

    return normalizeProjectTitle(project.title) === normalizedTitle;
  });
}

export function hasDuplicateProjectTitle(
  projects: Project[],
  title?: string,
  options?: { excludeProjectId?: string },
): boolean {
  return Boolean(findProjectByTitle(projects, title, options));
}

export function createUniqueProjectTitleSuggestion(
  projects: Project[],
  requestedTitle?: string,
  options?: { excludeProjectId?: string },
): string {
  const baseTitle = (requestedTitle || '').trim() || 'Tác phẩm mới';
  let candidate = baseTitle;
  let suffix = 2;

  while (hasDuplicateProjectTitle(projects, candidate, options)) {
    candidate = `${baseTitle} ${suffix}`;
    suffix += 1;
  }

  return candidate;
}
