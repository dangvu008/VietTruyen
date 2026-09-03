import type { Project, Character, OutlineBeat, WorldRules } from '../types/story';
import { styleById, stylePresets } from '../data/style_presets';
import { buildConsistencyReport, buildFixParagraph, selfReflect } from './reflection';
import { writerStrategyRegistry } from './writer_strategies/index';
import { applyStyle } from './style_engine';
import type { SolAdvisorSkillRegistry } from './sol_advisor';
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
  /** Optional Notion-/adapter-backed registry. sol-advisor selects from manifests before bodies enter context. */
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

export interface WriterRuntimeReport {
  version: StoryOsRuntimeVersion;
  writerPacket?: MinimalWriterPacket;
  literaryCritic?: LiteraryCriticResult;
  invariantValidation?: InvariantValidationResult;
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

  // StoryOS v2: compile bounded Writer context before generation.
  const writerPacket = compileMinimalWriterPacket(request);
  const boundedRequest = buildV2WriterRequest(request, writerPacket);
  const response = strategy.execute({ request: boundedRequest, style });

  // Critic and invariant validation are separate reads. Neither is allowed to mutate prose.
  const literaryCritic = runLiteraryCritic(response.output);
  const invariantValidation = validateLocalInvariants(response.output);

  // Optional compatibility report remains observational only in v2.
  const consistencyReport = request.consistency
    ? buildConsistencyReport(
        response.output,
        writerPacket.relevantCharacters,
        writerPacket.relevantOutline,
        writerPacket.world,
      )
    : undefined;

  return {
    ...response,
    output: response.output,
    consistencyReport,
    runtime: {
      version: 'storyos_v2',
      writerPacket,
      literaryCritic,
      invariantValidation,
    },
  };
};
