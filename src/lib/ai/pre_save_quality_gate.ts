/**
 * File: pre_save_quality_gate.ts
 * Purpose: Final AI quality gate before generated chapter text is persisted
 * Layer: Application (AI)
 * Domain: AI -> [pre-save review, natural prose, continuity]
 */
import type { Project } from '../../types/story';
import type { AiTaskType } from './model_router';
import { sortChaptersBySequence } from '../memory/chapter_order';
import { callAiModelTracked } from './tracked_ai_client';

interface PreSaveQualityModel {
  provider: string;
  modelId: string;
  name: string;
  baseUrl?: string;
}

export interface PreSaveQualityIssue {
  type:
    | 'ai_tone'
    | 'previous_continuity'
    | 'chapter_cohesion'
    | 'trait_literalization'
    | 'character_context_mismatch';
  severity: 'low' | 'medium' | 'high';
  description: string;
  fix: string;
}

export interface PreSaveQualityReport {
  approved: boolean;
  originalScore: number;
  revisedScore: number;
  issues: PreSaveQualityIssue[];
  appliedChanges: string[];
}

export interface PreSaveQualityResult {
  content: string;
  report: PreSaveQualityReport;
}

interface PreSaveQualityGateOptions {
  project: Project;
  targetChapterIndex: number;
  chapterTitle: string;
  chapterContent: string;
  chapterSummary?: string;
  model: PreSaveQualityModel;
  pipelineSessionId?: string;
  taskType?: AiTaskType;
}

interface RawPreSaveQualityResponse {
  revisedContent?: unknown;
  approved?: unknown;
  originalScore?: unknown;
  revisedScore?: unknown;
  issues?: unknown;
  appliedChanges?: unknown;
}

const MAX_PREVIOUS_CHAPTER_CHARS = 5200;
const MAX_STORY_CONTEXT_CHARS = 9000;

export async function runPreSaveQualityGate(
  opts: PreSaveQualityGateOptions,
): Promise<PreSaveQualityResult> {
  const response = await callAiModelTracked({
    provider: opts.model.provider,
    modelId: opts.model.modelId,
    modelName: opts.model.name,
    baseUrl: opts.model.baseUrl,
    taskType: opts.taskType ?? 'write_chapter',
    responseFormat: 'json_object',
    skipCache: true,
    pipelineSessionId: opts.pipelineSessionId,
    pipelineStep: 'pre_save_quality_gate',
    systemPrompt: buildPreSaveSystemPrompt(),
    userPrompt: buildPreSaveUserPrompt(opts),
  });

  return parsePreSaveQualityResponse(response, opts.chapterContent);
}

export function parsePreSaveQualityResponse(
  responseText: string,
  fallbackContent: string,
): PreSaveQualityResult {
  const parsed = JSON.parse(cleanJsonObject(responseText)) as RawPreSaveQualityResponse;
  const revisedContent = String(parsed.revisedContent || '').trim();
  const content = revisedContent || fallbackContent;

  return {
    content,
    report: {
      approved: Boolean(parsed.approved),
      originalScore: clampScore(parsed.originalScore),
      revisedScore: clampScore(parsed.revisedScore),
      issues: normalizeIssues(parsed.issues),
      appliedChanges: normalizeStringList(parsed.appliedChanges),
    },
  };
}

function buildPreSaveSystemPrompt(): string {
  return [
    'You are the final pre-save editor for a Vietnamese novel-writing app.',
    'Your job is to review AI-generated prose before it is persisted.',
    'Improve only when needed. Preserve plot facts, point of view, character intent, and event order.',
    'Primary checks:',
    '1. Remove obvious AI tone: generic summaries, repeated sentence rhythm, over-explaining, sterile transitions, slogan-like phrasing.',
    '2. Previous-chapter continuity: the opening must connect naturally to the previous chapter state.',
    '3. Whole-chapter cohesion: each paragraph must support the chapter intent, with no contradiction, dangling transition, or abrupt motivation shift.',
    '4. Character behavior must be context-resolved. A profile trait is a tendency, not a performance requirement. Do not force every listed trait into every scene, line of dialogue, gesture, or internal thought.',
    '5. Detect trait literalization / over-expression: e.g. a mildly humorous character joking in every scene; a cautious character interrogating everyone; an intelligent character constantly producing checklist-like analysis; a cold character suppressing all emotion regardless of stakes.',
    '6. For each meaningful scene, judge behavior from current goal, stakes, relationship, emotional/physical state, knowledge, social setting, and immediate danger. Traits may be active, secondary, suppressed, or irrelevant.',
    '7. Do not mark a character OOC merely because a trait is absent in a scene. Absence is valid when the context suppresses or does not activate that trait.',
    '8. If a trait is contextually over-expressed, revise only the affected spans. Preserve character identity while reducing forced performance.',
    'Return JSON only.',
  ].join('\n');
}

function buildPreSaveUserPrompt(opts: PreSaveQualityGateOptions): string {
  const sortedChapters = sortChaptersBySequence(opts.project.chapters || []);
  const currentChapterNumber = opts.targetChapterIndex + 1;
  const previousChapter = sortedChapters[opts.targetChapterIndex - 1];
  const previousSource = previousChapter
    ? [previousChapter.summary, previousChapter.content].filter(Boolean).join('\n\n')
    : '';
  const storyContext = buildStoryContext(sortedChapters, opts.targetChapterIndex);
  const chapterIntent = opts.project.outline[opts.targetChapterIndex];

  return [
    `Project: ${opts.project.title || 'Untitled'}`,
    `Genre: ${opts.project.genre || 'Unknown'}`,
    `Writing style: ${opts.project.writingStyle || opts.project.tone || 'Not specified'}`,
    `Current chapter: ${currentChapterNumber}${opts.chapterTitle ? ` - ${opts.chapterTitle}` : ''}`,
    opts.chapterSummary ? `Draft summary: ${opts.chapterSummary}` : '',
    chapterIntent
      ? `Chapter intent: ${[chapterIntent.title, chapterIntent.summary, chapterIntent.focus].filter(Boolean).join(' | ')}`
      : '',
    '',
    'Character behavior audit rule:',
    'Treat character traits as latent tendencies. For each scene infer which traits are ACTIVE, SECONDARY, SUPPRESSED, or IRRELEVANT from scene context. Flag trait_literalization when prose repeatedly performs a trait without contextual need. Flag character_context_mismatch when behavior ignores current stakes/state/relationship even if the behavior technically matches the static profile.',
    '',
    'Previous chapter tail/summary:',
    '"""',
    clampTail(previousSource || 'No previous chapter.', MAX_PREVIOUS_CHAPTER_CHARS),
    '"""',
    '',
    'Whole-story context:',
    '"""',
    storyContext || 'No additional chapter context.',
    '"""',
    '',
    'Generated chapter draft to check before saving:',
    '"""',
    opts.chapterContent,
    '"""',
    '',
    'Return this JSON shape:',
    JSON.stringify({
      approved: true,
      originalScore: 0,
      revisedScore: 0,
      issues: [
        {
          type: 'trait_literalization',
          severity: 'medium',
          description: 'short issue',
          fix: 'short fix',
        },
      ],
      appliedChanges: ['short change summary'],
      revisedContent: 'full revised chapter text only',
    }),
  ].filter(Boolean).join('\n');
}

function buildStoryContext(
  chapters: Project['chapters'],
  targetChapterIndex: number,
): string {
  const blocks = chapters
    .map((chapter, index) => {
      if (index === targetChapterIndex) return null;
      const chapterNumber = chapter.sequenceNumber ?? index + 1;
      const source = chapter.summary?.trim() || chapter.content?.trim();
      if (!source) return null;
      const label = index < targetChapterIndex ? 'before' : 'after';
      return `Chapter ${chapterNumber} (${label}): ${chapter.title || 'Untitled'}\n${clampText(source, 1200)}`;
    })
    .filter((block): block is string => block !== null);

  return clampText(blocks.join('\n\n'), MAX_STORY_CONTEXT_CHARS);
}

function cleanJsonObject(text: string): string {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Pre-save quality gate returned invalid JSON.');
  }
  return cleaned.slice(firstBrace, lastBrace + 1);
}

function normalizeIssues(value: unknown): PreSaveQualityIssue[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): PreSaveQualityIssue | null => {
      if (!item || typeof item !== 'object') return null;
      const issue = item as Record<string, unknown>;
      const type = normalizeIssueType(issue.type);
      const severity = normalizeSeverity(issue.severity);
      const description = String(issue.description || '').trim();
      const fix = String(issue.fix || '').trim();
      if (!description && !fix) return null;
      return { type, severity, description, fix };
    })
    .filter((issue): issue is PreSaveQualityIssue => issue !== null);
}

function normalizeIssueType(value: unknown): PreSaveQualityIssue['type'] {
  if (
    value === 'previous_continuity'
    || value === 'chapter_cohesion'
    || value === 'trait_literalization'
    || value === 'character_context_mismatch'
  ) return value;
  return 'ai_tone';
}

function normalizeSeverity(value: unknown): PreSaveQualityIssue['severity'] {
  if (value === 'low' || value === 'high') return value;
  return 'medium';
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function clampScore(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function clampTail(text: string, limit: number): string {
  const normalized = text.trim();
  if (normalized.length <= limit) return normalized;
  return normalized.slice(-limit);
}

function clampText(text: string, limit: number): string {
  const normalized = text.trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 120)).trim()}\n...[truncated]...\n${normalized.slice(-100).trim()}`;
}
