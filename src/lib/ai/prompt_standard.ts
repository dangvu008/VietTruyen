/**
 * File: prompt_standard.ts
 * Purpose: Shared prompt builders for concise, English-first runtime prompts.
 * Layer: Application (AI)
 * Domain: AI -> [prompt normalization, token efficiency]
 */

type PromptOutputKind = 'text' | 'json_object' | 'json_array';

interface PromptSystemOptions {
  role: string;
  task: string;
  output: PromptOutputKind;
  outputLanguage?: string;
  rules?: string[];
}

function buildOutputLine(output: PromptOutputKind, outputLanguage?: string): string {
  if (output === 'json_object') return 'Output: valid JSON object only. No markdown. No extra text.';
  if (output === 'json_array') return 'Output: valid JSON array only. No markdown. No extra text.';
  return `Output: ${outputLanguage || 'plain text'} only. No markdown unless requested.`;
}

export function buildPromptSystem(options: PromptSystemOptions): string {
  const lines = [
    `Role: ${options.role}.`,
    `Task: ${options.task}.`,
    buildOutputLine(options.output, options.outputLanguage),
  ];

  if (options.rules?.length) {
    lines.push('Rules:');
    lines.push(...options.rules.map((rule) => `- ${rule}`));
  }

  return lines.join('\n');
}

export function buildVietnameseTextSystem(
  role: string,
  task: string,
  rules: string[] = [],
): string {
  return buildPromptSystem({
    role,
    task,
    output: 'text',
    outputLanguage: 'Vietnamese prose',
    rules: [
      'Write in natural Vietnamese.',
      ...rules,
    ],
  });
}

export function buildJsonObjectSystem(
  role: string,
  task: string,
  rules: string[] = [],
): string {
  return buildPromptSystem({
    role,
    task,
    output: 'json_object',
    rules,
  });
}

export function buildJsonArraySystem(
  role: string,
  task: string,
  rules: string[] = [],
): string {
  return buildPromptSystem({
    role,
    task,
    output: 'json_array',
    rules,
  });
}
