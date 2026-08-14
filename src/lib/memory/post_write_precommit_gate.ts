import type { ChapterSummary, Scene } from '../../types/chapter_summary';
import { validateSceneTimelineMarkers, type SceneTimelineIssue } from './scene_timeline_gate';

export interface PostWritePrecommitDecision {
  verdict: 'PASS' | 'HOLD';
  reasons: string[];
  timelineIssues: SceneTimelineIssue[];
}

/**
 * Pure validation phase. Must run after extraction/chunking and before any
 * authoritative narrative-state, pending-hook, embedding or projection write.
 */
export function evaluatePostWritePrecommit(params: {
  summary: ChapterSummary | null;
  scenes: Scene[];
  contentHash: string;
}): PostWritePrecommitDecision {
  const reasons: string[] = [];
  const timelineIssues = validateSceneTimelineMarkers(params.scenes);

  if (!params.contentHash.trim()) reasons.push('content_hash_missing');
  if (!params.summary) reasons.push('summary_missing');
  if (params.scenes.length === 0) reasons.push('scenes_missing');
  if (timelineIssues.length > 0) reasons.push('deterministic_timeline_conflict');

  return {
    verdict: reasons.length === 0 ? 'PASS' : 'HOLD',
    reasons,
    timelineIssues,
  };
}
