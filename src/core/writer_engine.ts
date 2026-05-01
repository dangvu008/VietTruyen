import type { Project, Character, OutlineBeat, WorldRules } from '../types/story';
import { styleById, stylePresets } from '../data/style_presets';
import { buildConsistencyReport, buildFixParagraph, selfReflect } from './reflection';
import { writerStrategyRegistry } from './writer_strategies/index';
import { applyStyle } from './style_engine';

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
}

export interface WriterGeneratedData {
  world?: WorldRules;
  characters?: Character[];
  outline?: OutlineBeat[];
  chapterTitle?: string;
  chapterContent?: string;
}

export interface WriterResponse {
  output: string;
  report?: ReturnType<typeof selfReflect>['report'];
  consistencyReport?: ReturnType<typeof buildConsistencyReport>;
  generated?: WriterGeneratedData;
}

// Re-export applyStyle to not break backward compatibility
export { applyStyle };

export const runWriter = (request: WriterRequest): WriterResponse => {
  const style = styleById[request.styleId] ?? stylePresets[0];
  
  const strategy = writerStrategyRegistry.getStrategy(request.mode);
  if (!strategy) {
    throw new Error(`Strategy not found for mode: ${request.mode}`);
  }

  // Execute the specific mode logic
  const response = strategy.execute({ request, style });
  let output = response.output;

  // Global post-processing: Self Reflection & Consistency
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

  return { ...response, output, report, consistencyReport };
};
