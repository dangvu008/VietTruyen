import type { HybridMemoryResult } from '../../types/memory_embedding';
import type { Project } from '../../types/story';
import {
  compileStoryContext,
  renderCompiledStoryContext,
  type CompiledStoryContext,
  type ContextCompilerOptions,
} from './context_compiler';
import { retrieveForPlotQaRaw, retrieveForWritingRaw } from './hybrid_memory_raw';

export type StoryMemoryIntent = 'write_chapter' | 'plot_qa';

export interface StoryMemoryResolveRequest {
  project: Project;
  targetChapterIndex: number;
  query: string;
  intent?: StoryMemoryIntent;
  compilerOptions?: ContextCompilerOptions;
}

export interface StoryMemoryDiagnostics {
  projectId: string;
  targetChapterIndex: number;
  sourceCounts: {
    canon: number;
    state: number;
    knowledge: number;
    hooks: number;
    graph: number;
    semantic: number;
    risk: number;
    provenance: number;
  };
  compiledItems: number;
  runtimeWarnings: string[];
  isolationRejections: number;
}

export interface StoryMemoryEnvelope {
  projectId: string;
  targetChapterIndex: number;
  intent: StoryMemoryIntent;
  query: string;
  memory: HybridMemoryResult;
  compiled: CompiledStoryContext;
  promptBlock: string;
  diagnostics: StoryMemoryDiagnostics;
}

function countIsolationRejections(warnings: string[]): number {
  return warnings.reduce((total, warning) => {
    const match = warning.match(/rejected\s+(\d+)\s+cross-project\/future memory candidate/i);
    return total + (match ? Number(match[1]) : 0);
  }, 0);
}

/**
 * Canonical agent-facing facade for long-form memory.
 *
 * Objective story state and character knowledge reuse the same project-scoped
 * NarrativeStateFact store but remain separate semantic namespaces. Character
 * knowledge is transported with sourceType=character_knowledge and compiled by
 * an epistemic policy so suspicion/rumor cannot silently become world truth.
 */
export async function resolveStoryMemory(
  request: StoryMemoryResolveRequest,
): Promise<StoryMemoryEnvelope> {
  const { project, targetChapterIndex, query } = request;
  const intent = request.intent ?? 'write_chapter';

  if (!project.id) throw new Error('StoryMemoryResolver requires project.id.');
  if (!Number.isFinite(targetChapterIndex) || targetChapterIndex < 1) {
    throw new Error('StoryMemoryResolver requires targetChapterIndex >= 1.');
  }

  const memory = intent === 'plot_qa'
    ? await retrieveForPlotQaRaw(project, query)
    : await retrieveForWritingRaw(project, targetChapterIndex, query);
  const compiled = compileStoryContext(memory, request.compilerOptions);
  const promptBlock = renderCompiledStoryContext(compiled);
  const knowledgeCount = memory.statePack.filter((item) => item.sourceType === 'character_knowledge').length;

  return {
    projectId: project.id,
    targetChapterIndex,
    intent,
    query,
    memory,
    compiled,
    promptBlock,
    diagnostics: {
      projectId: project.id,
      targetChapterIndex,
      sourceCounts: {
        canon: memory.canonPack.length,
        state: Math.max(0, memory.statePack.length - knowledgeCount),
        knowledge: knowledgeCount,
        hooks: memory.hookPack.length,
        graph: memory.graphPack.length,
        semantic: memory.semanticPack.length,
        risk: memory.riskPack.length,
        provenance: memory.provenancePack.length,
      },
      compiledItems: compiled.totalItems,
      runtimeWarnings: [...memory.warnings],
      isolationRejections: countIsolationRejections(memory.warnings),
    },
  };
}
