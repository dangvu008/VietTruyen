import type { HybridMemoryResult } from '../../types/memory_embedding';
import type { Project } from '../../types/story';
import {
  compileStoryContext,
  renderCompiledStoryContext,
  type CompiledStoryContext,
  type ContextCompilerOptions,
} from './context_compiler';
import { retrieveForPlotQa, retrieveForWriting } from './hybrid_memory_query';

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
 * Canonical facade between agents and Narrative Memory.
 *
 * Agents should ask this resolver for a bounded, policy-labelled working set
 * instead of reading Drive/Notion/raw chapter history ad hoc. The resolver does
 * not create a second source of truth: it compiles the existing authoritative
 * project-scoped memory stores into temporary working memory.
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
    ? await retrieveForPlotQa(project, query)
    : await retrieveForWriting(project, targetChapterIndex, query);
  const compiled = compileStoryContext(memory, request.compilerOptions);
  const promptBlock = renderCompiledStoryContext(compiled);

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
        state: memory.statePack.length,
        knowledge: memory.knowledgePack?.length ?? 0,
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
