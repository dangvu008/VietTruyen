import { useEffect, useMemo, useState } from 'react';
import { getProjectSnapshot } from '../store/use_project_store';
import type { Project } from '../types/story';
import {
  buildProjectDisplayStats,
  hasLoadedChapterContent,
  type ProjectDisplayStats,
} from '../lib/project/project_display_stats';

type ProjectDisplayStatsMap = Record<string, ProjectDisplayStats>;

function buildProjectSignature(projects: Project[]): string {
  return projects
    .map((project) => [
      project.id,
      project.updatedAt,
      project.chapters.length,
      project.characters.length,
      project.outline.length,
      project.status || '',
      project.adaptationType || '',
    ].join(':'))
    .join('|');
}

export function useProjectDisplayStats(projects: Project[]): ProjectDisplayStatsMap {
  const signature = useMemo(() => buildProjectSignature(projects), [projects]);
  const [statsByProjectId, setStatsByProjectId] = useState<ProjectDisplayStatsMap>(() =>
    Object.fromEntries(
      projects.map((project) => [project.id, buildProjectDisplayStats(project)])
    )
  );

  useEffect(() => {
    setStatsByProjectId(
      Object.fromEntries(
        projects.map((project) => [project.id, buildProjectDisplayStats(project)])
      )
    );
  }, [signature, projects]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateStats() {
      const entries = await Promise.all(
        projects.map(async (project) => {
          if (project.chapters.length === 0 || hasLoadedChapterContent(project.chapters)) {
            return [project.id, buildProjectDisplayStats(project)] as const;
          }

          try {
            const snapshot = await getProjectSnapshot(project.id);
            if (!snapshot) {
              return [project.id, buildProjectDisplayStats(project)] as const;
            }
            return [project.id, buildProjectDisplayStats(snapshot, { chapters: snapshot.chapters })] as const;
          } catch {
            return [project.id, buildProjectDisplayStats(project)] as const;
          }
        })
      );

      if (cancelled) return;
      setStatsByProjectId(Object.fromEntries(entries));
    }

    void hydrateStats();

    return () => {
      cancelled = true;
    };
  }, [signature, projects]);

  return statsByProjectId;
}
