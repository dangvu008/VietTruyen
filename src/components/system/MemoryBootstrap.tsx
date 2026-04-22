import React, { useEffect, useMemo } from 'react';
import type { Project } from '../../types/story';
import { scheduleProjectMemorySync } from '../../lib/memory/memory_sync_bridge';

interface MemoryBootstrapProps {
  project: Project;
}

const MemoryBootstrap: React.FC<MemoryBootstrapProps> = ({ project }) => {
  const syncKey = useMemo(() => {
    const chapterCount = project.chapters?.length ?? 0;
    const latestChapterUpdatedAt = (project.chapters || []).reduce<string>(
      (latest, chapter) => {
        if (!chapter.updatedAt) return latest;
        return chapter.updatedAt > latest ? chapter.updatedAt : latest;
      },
      ''
    );

    return `${project.id}:${project.updatedAt}:${chapterCount}:${latestChapterUpdatedAt}`;
  }, [project.id, project.updatedAt, project.chapters]);

  useEffect(() => {
    let cancelled = false;

    void scheduleProjectMemorySync(project).catch((error) => {
      if (!cancelled) {
        console.error('[MemoryBootstrap] Failed to sync project memory:', error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [syncKey]);

  return null;
};

export default MemoryBootstrap;
