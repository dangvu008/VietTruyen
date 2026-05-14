import React, { useEffect, useMemo, useRef } from 'react';
import type { Project } from '../../types/story';
import { scheduleProjectMemorySync } from '../../lib/memory/memory_sync_bridge';

interface MemoryBootstrapProps {
  project: Project;
}

// djb2 — cheap non-cryptographic hash. We use it to compress a per-project
// content signature into a single 32-bit number so the syncKey stays short
// even for projects with thousands of chapters.
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

// [Wave 2] Builds a signature that flips ONLY when memory-relevant data
// changes: chapter set, chapter content length/updatedAt, character set,
// world facts, foreshadowings count. Pure metadata edits (title, theme,
// project.updatedAt) intentionally do not appear here.
export function computeMemorySyncSignature(project: Project): string {
  const chapterSig = (project.chapters || [])
    .map((c) => `${c.id}:${c.updatedAt ?? ''}:${(c.content ?? '').length}`)
    .join('|');

  const characterSig = (project.characters || [])
    .map(
      (c) =>
        `${c.id}:${(c.traits ?? '').length}:${(c.facts ?? []).length}:${(c.arc ?? '').length}`,
    )
    .join('|');

  const worldSig =
    `${(project.world?.facts ?? []).length}:${(project.world?.rules ?? '').length}:` +
    `${(project.world?.factions ?? []).length}`;

  const foreshadowingsSig = `${(project.foreshadowings ?? []).length}`;

  const composite = `${chapterSig}#${characterSig}#${worldSig}#${foreshadowingsSig}`;
  return `${project.id}:${djb2(composite).toString(36)}`;
}

const MemoryBootstrap: React.FC<MemoryBootstrapProps> = ({ project }) => {
  const syncKey = useMemo(
    () => computeMemorySyncSignature(project),
    [
      project.id,
      project.chapters,
      project.characters,
      project.world,
      project.foreshadowings,
    ],
  );

  const previousKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const reason = previousKeyRef.current === null ? 'initial-mount' : 'signature-change';
    previousKeyRef.current = syncKey;

    if (typeof console !== 'undefined' && console.debug) {
      console.debug(`[MemoryBootstrap] sync triggered: reason=${reason} key=${syncKey}`);
    }

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
