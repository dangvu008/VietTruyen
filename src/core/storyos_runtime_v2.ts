import type { Character, OutlineBeat, Project, WorldRules } from '../types/story';

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

const tail = (text: string, maxChars: number) => {
  const value = text.trim();
  if (value.length <= maxChars) return value;
  return value.slice(value.length - maxChars).replace(/^\S*\s/, '').trim();
};

const compact = (text: string, maxChars: number) => {
  const value = text.replace(/\s+/g, ' ').trim();
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars).trim()}…`;
};

const scoreBeat = (beat: OutlineBeat, input: RuntimeWriterInput) => {
  const haystack = `${input.prompt} ${input.notes} ${input.sourceText}`.toLowerCase();
  const words = `${beat.title} ${beat.summary} ${beat.focus}`
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 4);
  return words.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0);
};

/**
 * Compile the bounded context a Writer is allowed to see in StoryOS v2.
 * This intentionally excludes chapter archives and global review/checker policy.
 */
export const compileMinimalWriterPacket = (input: RuntimeWriterInput): MinimalWriterPacket => {
  const rankedOutline = [...input.project.outline]
    .map((beat, index) => ({ beat, index, score: scoreBeat(beat, input) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .map(({ beat }) => beat);

  return {
    runtimeVersion: 'storyos_v2',
    projectId: input.project.id,
    storyTitle: input.project.title,
    mode: input.mode,
    objective: compact(input.prompt || input.project.currentFocus || input.project.mainPlot || '', 1200),
    currentFocus: compact(input.project.currentFocus || input.notes || '', 800),
    directSeam: tail(input.sourceText, 1800),
    relevantCharacters: input.project.characters.slice(0, 6),
    relevantOutline: rankedOutline,
    world: input.project.world,
    continuityNotes: compact(input.notes, 1200),
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
    // Accepted prose archives do not belong in the Writer context. Direct seam is explicit.
    chapters: [],
    notes: packet.continuityNotes,
    currentFocus: packet.currentFocus,
  };

  return {
    ...request,
    sourceText: packet.directSeam,
    notes: packet.continuityNotes,
    project: boundedProject,
  };
};

/**
 * A separate literary read. It reports weaknesses but never mutates prose.
 * Semantic/canon validation belongs to authority-backed invariant validators.
 */
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
 * Local validator is deliberately conservative. It only blocks technical/output invariants
 * that can be proven without authoritative Notion story state.
 */
export const validateLocalInvariants = (output: string): InvariantValidationResult => {
  const violations: InvariantViolation[] = [];
  const text = output.trim();

  if (!text) {
    violations.push({ code: 'EMPTY_OUTPUT', message: 'Writer output is empty.' });
  }

  if (/\b(?:SYSTEM|ASSISTANT|PRE-FLIGHT RECEIPT|CHAIN OF THOUGHT)\b/i.test(text)) {
    violations.push({ code: 'META_LEAK', message: 'Runtime/meta instruction leaked into prose.' });
  }

  if (/\b(?:TODO|TBD|PLACEHOLDER)\b/i.test(text)) {
    violations.push({ code: 'PLACEHOLDER_OUTPUT', message: 'Placeholder text remains in prose.' });
  }

  return { pass: violations.length === 0, violations };
};
