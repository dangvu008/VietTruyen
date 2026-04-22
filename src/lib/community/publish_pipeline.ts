import {
  getProjectNarrativeCommunities,
  getProjectNarrativeEdges,
  getProjectNarrativeNodes,
} from '../../db/narrative_db';
import { getProjectSnapshot } from '../../store/use_project_store';
import type {
  PublishKnowledgeCaptureResult,
  PublishStoryInput,
  PublishStoryResult,
} from '../../types/community';
import { rebuildHsc } from '../memory/hierarchical_summary_cache';
import { syncProjectMemoryBridge } from '../memory/memory_sync_bridge';
import * as communityService from '../supabase/community_service';

function formatCaptureWarning(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Knowledge capture failed during publish.';
}

export async function captureProjectKnowledgeForPublish(
  projectId: string
): Promise<PublishKnowledgeCaptureResult> {
  const project = await getProjectSnapshot(projectId);
  if (!project) {
    return {
      status: 'skipped',
      reason: 'project_not_found',
    };
  }

  await syncProjectMemoryBridge(project);
  const summaryEntriesUpdated = await rebuildHsc(project);
  const [nodes, edges, communities] = await Promise.all([
    getProjectNarrativeNodes(project.id),
    getProjectNarrativeEdges(project.id),
    getProjectNarrativeCommunities(project.id),
  ]);

  return {
    status: 'captured',
    indexedChapterCount: project.chapters.length,
    summaryEntriesUpdated,
    graphNodeCount: nodes.length,
    graphEdgeCount: edges.length,
    graphCommunityCount: communities.length,
  };
}

export async function publishStoryWithKnowledgeCapture(
  userId: string,
  input: PublishStoryInput
): Promise<PublishStoryResult> {
  const knowledgeCapturePromise = captureProjectKnowledgeForPublish(input.project_id).catch((error) => ({
    status: 'warning' as const,
    warning: formatCaptureWarning(error),
  }));

  const [story, knowledgeCapture] = await Promise.all([
    communityService.publishStory(userId, input),
    knowledgeCapturePromise,
  ]);

  return {
    story,
    knowledgeCapture,
  };
}
