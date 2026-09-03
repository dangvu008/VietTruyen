import type { Project, Character, OutlineBeat, WorldRules } from '../types/story';
import { styleById, stylePresets } from '../data/style_presets';
import { buildConsistencyReport, buildFixParagraph, selfReflect } from './reflection';
import { writerStrategyRegistry } from './writer_strategies/index';
import { applyStyle } from './style_engine';
import type { SolAdvisorSkillRegistry } from './sol_advisor';
import { storyOsBuiltinBodies, storyOsBuiltinManifests } from './storyos_builtin_skills';
import { buildStoryOsReviewPacket, type StoryOsReviewPacket } from './storyos_review_v2';
import {
  buildV2WriterRequest,
  compileMinimalWriterPacket,
  runLiteraryCritic,
  validateLocalInvariants,
  type InvariantValidationResult,
  type LiteraryCriticResult,
  type MinimalWriterPacket,
  type StoryOsRuntimeVersion,
} from './storyos_runtime_v2';

// Ensure all strategies are registered
import './writer_strategies/create_strategy';
import './writer_strategies/rewrite_strategy';
import './writer_strategies/continue_strategy';
import './writer_strategies/polish_strategy';

export type WriterMode = 'create' | 'rewrite' | 'continue' | 'polish';

export interface WriterRequest {
  mode: WriterMode;
  prompt: string;
  sourceText: string;
  notes: string;
  styleId: string;
  intensity: number;
  selfReflection: boolean;
  consistency: boolean;
  project: Project;
  /** External registry snapshot (e.g. compiled from Notion). Built-ins are the fallback. */
  skillRegistry?: SolAdvisorSkillRegistry;
  /** StoryOS v2 is the default. Set legacy explicitly only for compatibility/debugging. */
  runtimeVersion?: StoryOsRuntimeVersion;
}

export interface WriterGeneratedData {
  world?: WorldRules;
  characters?: Character[];
  outline?: OutlineBeat[];
  chapterTitle?: string;
  chapterContent?: string;
}

export interface StoryOsExecutionReceipt {
  policy: 'storyos-execution-receipt-v1';
  projectId: string;
  canonVersion: number;
  contextPolicy: MinimalWriterPacket['contextPolicy'];
  skillPolicy?: MinimalWriterPacket['skills'] extends infer T
    ? T extends { policy: infer P } ? P : never
    : never;
  writerSkills: Array<{ skillId: string; version: string }>;
  reviewSkills: Array<{ skillId: string; version: string }>;
}

export interface WriterRuntimeReport {
  version: StoryOsRuntimeVersion;
  writerPacket?: MinimalWriterPacket;
  reviewPacket?: StoryOsReviewPacket;
  literaryCritic?: LiteraryCriticResult;
  invariantValidation?: InvariantValidationResult;
  receipt?: StoryOsExecutionReceipt;
}

export interface WriterResponse {
  output: string;
  report?: ReturnType<typeof selfReflect>['report'];
  consistencyReport?: ReturnType<typeof buildConsistencyReport>;
  generated?: WriterGeneratedData;
  runtime?: WriterRuntimeReport;
}

// Re-export applyStyle to not break backward compatibility
export { applyStyle };

const runLegacyWriter = (
  request: WriterRequest,
  response: WriterResponse,
  style: (typeof stylePresets)[number],
): WriterResponse => {
  let output = response.output;
  let report: WriterResponse['report'];

  if (request.selfReflection) {
    const reflection = selfReflect(output, request.project.outline, request.project.characters, style);
    report = reflection.report;
    if (reflection.report.issues.length) {
      const fixParagraph = buildFixParagraph(reflection.fixes);
      if (fixParagraph) {
        output = applyStyle(`${output}\n\n${fixParagraph}`, style, request.intensity);
      }
    }
  }

  const consistencyReport = request.consistency
    ? buildConsistencyReport(output, request.project.characters, request.project.outline, request.project.world)
    : undefined;

  return {
    ...response,
    output,
    report,
    consistencyReport,
    runtime: { version: 'legacy' },
  };
};

export const runWriter = (request: WriterRequest): WriterResponse => {
  const style = styleById[request.styleId] ?? stylePresets[0];
  const runtimeVersion: StoryOsRuntimeVersion = request.runtimeVersion ?? 'storyos_v2';

  const strategy = writerStrategyRegistry.getStrategy(request.mode);
  if (!strategy) {
    throw new Error(`Strategy not found for mode: ${request.mode}`);
  }

  if (runtimeVersion === 'legacy') {
    const response = strategy.execute({ request, style });
    return runLegacyWriter(request, response, style);
  }

  const skillRegistry: SolAdvisorSkillRegistry = request.skillRegistry ?? {
    manifests: storyOsBuiltinManifests,
    bodies: storyOsBuiltinBodies,
  };
  const effectiveRequest: WriterRequest = { ...request, skillRegistry };

  // StoryOS v2: compile bounded authority + selected Writer skills before generation.
  const writerPacket = compileMinimalWriterPacket(effectiveRequest);
  const boundedRequest = buildV2WriterRequest(effectiveRequest, writerPacket);
  const response = strategy.execute({ request: boundedRequest, style });

  // Review has its own bounded packet; review instructions never contaminate the Writer prompt.
  const reviewPacket = buildStoryOsReviewPacket(response.output, writerPacket, skillRegistry);
  const literaryCritic = runLiteraryCritic(response.output);
  const invariantValidation = validateLocalInvariants(response.output);

  const consistencyReport = request.consistency
    ? buildConsistencyReport(
        response.output,
        writerPacket.relevantCharacters,
        writerPacket.relevantOutline,
        writerPacket.world,
      )
    : undefined;

  const receipt: StoryOsExecutionReceipt = {
    policy: 'storyos-execution-receipt-v1',
    projectId: request.project.id,
    canonVersion: request.project.canonVersion ?? 0,
    contextPolicy: writerPacket.contextPolicy,
    skillPolicy: writerPacket.skills?.policy,
    writerSkills: writerPacket.skills?.selected.map(({ skillId, version }) => ({ skillId, version })) ?? [],
    reviewSkills: reviewPacket.skills.selected.map(({ skillId, version }) => ({ skillId, version })),
  };

  return {
    ...response,
    output: response.output,
    consistencyReport,
    runtime: {
      version: 'storyos_v2',
      writerPacket,
      reviewPacket,
      literaryCritic,
      invariantValidation,
      receipt,
    },
  };
};
