import type { Character, OutlineBeat, Project, WorldRules } from '../types/story';
import { adviseWriterContext, type SolAdvisorContext } from './sol_advisor';

export type StoryOsRuntimeVersion = 'legacy' | 'storyos_v2';

export interface RuntimeWriterInput {
  mode: 'create' | 'rewrite' | 'continue' | 'polish';
  prompt: string;
  sourceText: string;
  notes: string;
  project: Project;
}

export interface MinimalWriterPacket {
  runtimeVersion: 'storyos_v2';
  contextPolicy: SolAdvisorContext['policy'];
  projectId: string;
  storyTitle: string;
  mode: RuntimeWriterInput['mode'];
  objective: string;
  currentFocus: string;
  directSeam: string;
  relevantCharacters: Character[];
  relevantOutline: OutlineBeat[];
  world: WorldRules;
  continuityNotes: string;
}

export interface LiteraryCriticResult {
  pass: boolean;
  findings: string[];
}

export interface InvariantViolation {
  code: 'EMPTY_OUTPUT' | 'META_LEAK' | 'PLACEHOLDER_OUTPUT';
  message: string;
}

export interface InvariantValidationResult {
  pass: boolean;
  violations: InvariantViolation[];
}

/** Compile the bounded context a Writer is allowed to see in StoryOS v2. */
export const compileMinimalWriterPacket = (input: RuntimeWriterInput): MinimalWriterPacket => {
  const advised = adviseWriterContext({
    prompt: input.prompt,
    sourceText: input.sourceText,
    notes: input.notes,
    currentFocus: input.project.currentFocus,
    mainPlot: input.project.mainPlot,
    characters: input.project.characters,
    outline: input.project.outline,
    world: input.project.world,
  });

  return {
    runtimeVersion: 'storyos_v2',
    contextPolicy: advised.policy,
    projectId: input.project.id,
    storyTitle: input.project.title,
    mode: input.mode,
    objective: advised.objective,
    currentFocus: advised.currentFocus,
    directSeam: advised.directSeam,
    relevantCharacters: advised.relevantCharacters,
    relevantOutline: advised.relevantOutline,
    world: advised.world,
    continuityNotes: advised.continuityNotes,
  };
};

export const buildV2WriterRequest = <T extends RuntimeWriterInput>(
  request: T,
  packet: MinimalWriterPacket,
): T => {
  const boundedProject: Project = {
    ...request.project,
    characters: packet.relevantCharacters,
    outline: packet.relevantOutline,
    world: packet.world,
    // Accepted prose archives do not belong in Writer context. The direct seam is explicit.
    chapters: [],
    notes: packet.continuityNotes,
    currentFocus: packet.currentFocus,
  };

  return {
    ...request,
    prompt: packet.objective,
    sourceText: packet.directSeam,
    notes: packet.continuityNotes,
    project: boundedProject,
  } as T;
};

/** A separate literary read. It reports weaknesses but never mutates prose. */
export const runLiteraryCritic = (output: string): LiteraryCriticResult => {
  const findings: string[] = [];
  const text = output.trim();

  if (!text) {
    findings.push('Không có prose để đọc.');
    return { pass: false, findings };
  }

  const paragraphs = text.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const metaPatterns = [
    /nhịp kế tiếp mở ra\s*:/i,
    /từ dư âm của\s*[“"]?/i,
    /theo (?:outline|dàn ý|chapter contract)/i,
  ];

  if (metaPatterns.some((pattern) => pattern.test(text))) {
    findings.push('Prose lộ dấu vết template hoặc lời điều phối thay vì kể chuyện trực tiếp.');
  }

  if (paragraphs.length >= 3 && paragraphs.every((paragraph) => paragraph.length < 180)) {
    findings.push('Các đoạn đều rất ngắn và đồng dạng; nhịp có nguy cơ cơ học.');
  }

  const sentences = text.split(/[.!?…]+/).map((item) => item.trim()).filter(Boolean);
  if (sentences.length >= 6) {
    const avgLength = sentences.reduce((sum, sentence) => sum + sentence.length, 0) / sentences.length;
    if (avgLength < 35) findings.push('Nhịp câu quá đều/ngắn; cần kiểm tra độ liền mạch và sức nặng cảnh.');
  }

  return { pass: findings.length === 0, findings };
};

/**
 * Local validation is deliberately conservative: only invariants provable without
 * authoritative Notion story state are hard-blocked here.
 */
export const validateLocalInvariants = (output: string): InvariantValidationResult => {
  const violations: InvariantViolation[] = [];
  const text = output.trim();

  if (!text) violations.push({ code: 'EMPTY_OUTPUT', message: 'Writer output is empty.' });

  if (/\b(?:SYSTEM|ASSISTANT|PRE-FLIGHT RECEIPT|CHAIN OF THOUGHT)\b/i.test(text)) {
    violations.push({ code: 'META_LEAK', message: 'Runtime/meta instruction leaked into prose.' });
  }

  if (/\b(?:TODO|TBD|PLACEHOLDER)\b/i.test(text)) {
    violations.push({ code: 'PLACEHOLDER_OUTPUT', message: 'Placeholder text remains in prose.' });
  }

  return { pass: violations.length === 0, violations };
};
