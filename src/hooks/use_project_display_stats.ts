import { useMemo } from 'react';
import type { Project } from '../types/story';
import {
  buildProjectDisplayStats,
  type ProjectDisplayStats,
} from '../lib/project/project_display_stats';

type ProjectDisplayStatsMap = Record<string, ProjectDisplayStats>;

export function useProjectDisplayStats(projects: Project[]): ProjectDisplayStatsMap {
  return useMemo(
    () => Object.fromEntries(
      projects.map((project) => [project.id, buildProjectDisplayStats(project)])
    ),
    [projects],
  );
}
