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

interface PreSaveQualityModel { provider: string; modelId: string; name: string; baseUrl?: string; }

export interface PreSaveQualityIssue {
  type:
    | 'ai_tone' | 'previous_continuity' | 'chapter_cohesion'
    | 'trait_literalization' | 'character_context_mismatch'
    | 'proceduralized_characterization' | 'semantic_obscurity' | 'pseudo_coinage'
    | 'reader_orientation_failure' | 'epistemic_prose_leak' | 'repetitive_investigation_structure'
    | 'creative_overreach' | 'complexity_escalation' | 'unplanned_mystery'
    | 'knowledge_leak' | 'forced_symbolism';
  severity: 'low' | 'medium' | 'high';
  description: string;
  fix: string;
}
export interface PreSaveQualityReport { approved: boolean; originalScore: number; revisedScore: number; issues: PreSaveQualityIssue[]; appliedChanges: string[]; }
export interface PreSaveQualityResult { content: string; report: PreSaveQualityReport; }
interface PreSaveQualityGateOptions { project: Project; targetChapterIndex: number; chapterTitle: string; chapterContent: string; chapterSummary?: string; model: PreSaveQualityModel; pipelineSessionId?: string; taskType?: AiTaskType; }
interface RawPreSaveQualityResponse { revisedContent?: unknown; approved?: unknown; originalScore?: unknown; revisedScore?: unknown; issues?: unknown; appliedChanges?: unknown; }
const MAX_PREVIOUS_CHAPTER_CHARS = 5200;
const MAX_STORY_CONTEXT_CHARS = 9000;

export async function runPreSaveQualityGate(opts: PreSaveQualityGateOptions): Promise<PreSaveQualityResult> {
  const response = await callAiModelTracked({ provider: opts.model.provider, modelId: opts.model.modelId, modelName: opts.model.name, baseUrl: opts.model.baseUrl, taskType: opts.taskType ?? 'write_chapter', responseFormat: 'json_object', skipCache: true, pipelineSessionId: opts.pipelineSessionId, pipelineStep: 'pre_save_quality_gate', systemPrompt: buildPreSaveSystemPrompt(), userPrompt: buildPreSaveUserPrompt(opts) });
  return parsePreSaveQualityResponse(response, opts.chapterContent);
}

export function parsePreSaveQualityResponse(responseText: string, fallbackContent: string): PreSaveQualityResult {
  const parsed = JSON.parse(cleanJsonObject(responseText)) as RawPreSaveQualityResponse;
  const revisedContent = String(parsed.revisedContent || '').trim();
  return { content: revisedContent || fallbackContent, report: { approved: Boolean(parsed.approved), originalScore: clampScore(parsed.originalScore), revisedScore: clampScore(parsed.revisedScore), issues: normalizeIssues(parsed.issues), appliedChanges: normalizeStringList(parsed.appliedChanges) } };
}

function buildPreSaveSystemPrompt(): string {
  return [
    'You are the final pre-save editor for a Vietnamese novel-writing app.',
    'Your job is to find defects, not opportunities to make the chapter more clever, dramatic, mysterious, or ornate.',
    'Improve only when needed. Preserve plot facts, point of view, character intent, event order, intentional mystery, quiet moments, and valid simple solutions.',
    'Primary checks:',
    '1. Remove obvious AI tone: generic summaries, repeated sentence rhythm, over-explaining, sterile transitions, slogan-like phrasing.',
    '2. Previous-chapter continuity and whole-chapter cohesion must be natural.',
    '3. Character traits are latent tendencies, not performance requirements. Detect trait_literalization and character_context_mismatch.',
    '4. Detect proceduralized_characterization: intelligence, caution, calmness, suspicion, observation or similar traits are repeatedly converted into detective/checklist routines such as observe -> check -> verify -> compare -> infer -> eliminate possibilities, without a concrete scene-level reason.',
    '5. Judge the pattern, not isolated verbs. Checking a location, wound, object or clue is valid when the immediate situation makes that check materially necessary. Do not flag normal practical behavior.',
    '6. Prefer human salience: after waking, danger, grief, injury, surprise or reunion, attention should normally be pulled by the most immediate sensory/emotional/practical concern. Do not make a character perform analytical verification merely to prove they are cautious or smart.',
    '7. If proceduralized characterization is found, remove only unnecessary verification/explanation and replace it with context-driven perception, reaction or action. Preserve genuine competence and necessary investigation.',
    '8. READER ORIENTATION GATE: mystery may hide the cause, true identity, hidden mechanism or future consequence, but must not hide basic experiential information the POV already knows and a cold reader needs to understand the current scene. Detect reader_orientation_failure when the reader cannot tell the practical frame of a recurring phenomenon, transition, location, relationship or situation even though the POV already understands that frame.',
    '9. Apply the rule “hide the answer, not the question”. In an opening or major transition, establish the minimum known baseline early enough that the reader can understand why the POV reacts as they do. Do not dump lore; one or two natural anchors are usually enough.',
    '10. Detect epistemic_prose_leak when internal agent/reviewer discipline leaks into narration or character thought: repeated evidence standards, hypothesis language, source-validation language, lists of alternative explanations, “not enough to prove”, “one sample is not a rule”, or explicit reminders not to infer. Uncertainty may remain, but express it like human perception/thought, not a research protocol.',
    '11. Detect repetitive_investigation_structure when nearby chapters/scenes repeatedly use substantially the same dramatic machine — clue/object -> question/expert -> test/compare -> eliminate possibilities -> conclude unknown — without a new relationship, risk, decision, irreversible consequence or materially different experience. Vary scene engines rather than merely swapping the object being examined.',
    '12. Mystery may hide facts but not the basic semantic meaning of a sentence. Detect semantic_obscurity and pseudo_coinage.',
    '13. Apply the Meaning Reconstruction Test: suspicious wording must be paraphrasable in plain Vietnamese without adding information.',
    '14. Detect creative_overreach when the draft invents lore, factions, powers, identities, motives, prophecy, long-term goals, foreshadowing, secrets, or plot machinery not required by canon/chapter intent.',
    '15. Detect complexity_escalation when a simple causal path is expanded into extra steps, investigations, hidden meanings, nested motives, or side complications that add canon debt without necessary scene value.',
    '16. Detect unplanned_mystery when an ordinary detail is upgraded into a clue, omen, signal, suspicious anomaly, or question only to manufacture intrigue.',
    '17. Detect forced_symbolism when objects, gestures, weather, dreams, repeated wording, or imagery are made symbolically significant without support from the existing story.',
    '18. Detect knowledge_leak when a character reasons from author-only information or reaches a conclusion not justified by what that character actually knows and observes on the page.',
    '19. Minimum Necessary Invention: if the scene still works after removing a new invention, prefer removal/simplification unless the outline or canon clearly needs it.',
    '20. Atmospheric detail is allowed to remain merely atmospheric. Do not convert it into foreshadowing during revision.',
    '21. Hook, cliffhanger, twist, coolpoint, reveal, philosophy, symbolism, and micro-payoff are NOT mandatory in every chapter. Never add one merely because the draft lacks it.',
    '22. Revise only affected spans. Prefer deletion/simplification over adding replacement lore. Do not create new metaphor, mystery, plot device, worldbuilding, character backstory, or foreshadowing while editing.',
    '23. Do not punish valid canon-backed worldbuilding terms or intentional mystery.',
    'Return JSON only.',
  ].join('\n');
}

function buildPreSaveUserPrompt(opts: PreSaveQualityGateOptions): string {
  const sortedChapters = sortChaptersBySequence(opts.project.chapters || []);
  const currentChapterNumber = opts.targetChapterIndex + 1;
  const previousChapter = sortedChapters[opts.targetChapterIndex - 1];
  const previousSource = previousChapter ? [previousChapter.summary, previousChapter.content].filter(Boolean).join('\n\n') : '';
  const storyContext = buildStoryContext(sortedChapters, opts.targetChapterIndex);
  const chapterIntent = opts.project.outline[opts.targetChapterIndex];
  return [
    `Project: ${opts.project.title || 'Untitled'}`,
    `Genre: ${opts.project.genre || 'Unknown'}`,
    `Writing style: ${opts.project.writingStyle || opts.project.tone || 'Not specified'}`,
    `Current chapter: ${currentChapterNumber}${opts.chapterTitle ? ` - ${opts.chapterTitle}` : ''}`,
    opts.chapterSummary ? `Draft summary: ${opts.chapterSummary}` : '',
    chapterIntent ? `Chapter intent: ${[chapterIntent.title, chapterIntent.summary, chapterIntent.focus].filter(Boolean).join(' | ')}` : '',
    chapterIntent?.chapterRole ? `Chapter role: ${chapterIntent.chapterRole}` : '',
    chapterIntent?.suspenseLevel ? `Planned suspense: ${chapterIntent.suspenseLevel}/5` : '',
    chapterIntent?.plotTwistLevel ? `Planned twist: ${chapterIntent.plotTwistLevel}/5` : '',
    chapterIntent?.foreshadowingHint ? `Planned foreshadow only: ${chapterIntent.foreshadowingHint}` : 'Planned foreshadow only: none declared',
    '',
    'Character behavior audit rule:',
    'Resolve behavior from the immediate scene before applying static traits. Flag trait_literalization when prose performs a trait without contextual need; character_context_mismatch when static-profile behavior ignores current stakes/state/relationship; proceduralized_characterization when the character repeatedly behaves like an investigator or checklist engine (observe/check/verify/compare/infer/eliminate) merely to demonstrate intelligence, caution, calmness or suspicion. A single necessary check is not a violation. Ask: would this exact verification still be the most natural next action if the profile label were hidden? If no, rewrite toward the scene salience.',
    '',
    'Reader orientation audit rule:',
    `Chapter ${currentChapterNumber} must give a cold reader the minimum practical frame needed to understand the scene. Especially in chapter 1, a recurring phenomenon, unusual transition, second world, established relationship, or familiar danger already known to the POV must be oriented early instead of being withheld as if it were itself the mystery. Preserve the deeper unknown cause/mechanism. Rule: hide the answer, not the question.`,
    '',
    'Epistemic prose audit rule:',
    'Keep evidence discipline in the writer/reviewer reasoning layer, not in the finished prose. Flag repeated formal uncertainty statements, explicit hypothesis management, source-validation talk, enumerated alternative explanations, and verification methodology unless the scene specifically requires a character to perform that professional task. Replace with the shortest natural perception, hesitation, emotion or action that preserves the same uncertainty.',
    '',
    'Chapter-pattern audit rule:',
    'Use nearby chapter context to detect repeated scene engines. If several chapters keep doing clue/object -> ask/check -> expert/test -> compare -> rule out -> still unknown, do not merely polish the wording. Flag repetitive_investigation_structure and compress, merge or change the dramatic carrier so that relationship, risk, choice, discovery, loss, desire or consequence bears more of the chapter.',
    '',
    'Creative restraint audit rule:',
    'Use the chapter intent as a scope boundary. Ask for every new mystery/lore/secret/foreshadow/plot device: was this required by existing canon or the declared chapter intent? If not, and the scene works without it, remove or neutralize it. Do not replace one unnecessary invention with another. A plain causal explanation is preferred over an unsupported clever one. Characters may be wrong or uncertain; they must not reason from author-only knowledge.',
    '',
    'Semantic clarity audit rule:',
    'Mystery may obscure facts but not sentence meaning. Flag semantic_obscurity or pseudo_coinage when meaning cannot be stably reconstructed in plain Vietnamese without adding information.',
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
    JSON.stringify({ approved: true, originalScore: 0, revisedScore: 0, issues: [{ type: 'reader_orientation_failure', severity: 'high', description: 'short issue', fix: 'add only the minimum POV-known orientation without revealing the hidden cause' }], appliedChanges: ['short change summary'], revisedContent: 'full revised chapter text only' }),
  ].filter(Boolean).join('\n');
}

function buildStoryContext(chapters: Project['chapters'], targetChapterIndex: number): string {
  const blocks = chapters.map((chapter, index) => { if (index === targetChapterIndex) return null; const chapterNumber = chapter.sequenceNumber ?? index + 1; const source = chapter.summary?.trim() || chapter.content?.trim(); if (!source) return null; const label = index < targetChapterIndex ? 'before' : 'after'; return `Chapter ${chapterNumber} (${label}): ${chapter.title || 'Untitled'}\n${clampText(source, 1200)}`; }).filter((block): block is string => block !== null);
  return clampText(blocks.join('\n\n'), MAX_STORY_CONTEXT_CHARS);
}

function cleanJsonObject(text: string): string { const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, ''); const firstBrace = cleaned.indexOf('{'); const lastBrace = cleaned.lastIndexOf('}'); if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) throw new Error('Pre-save quality gate returned invalid JSON.'); return cleaned.slice(firstBrace, lastBrace + 1); }

function normalizeIssues(value: unknown): PreSaveQualityIssue[] { if (!Array.isArray(value)) return []; return value.map((item): PreSaveQualityIssue | null => { if (!item || typeof item !== 'object') return null; const issue = item as Record<string, unknown>; const type = normalizeIssueType(issue.type); const severity = normalizeSeverity(issue.severity); const description = String(issue.description || '').trim(); const fix = String(issue.fix || '').trim(); if (!description && !fix) return null; return { type, severity, description, fix }; }).filter((issue): issue is PreSaveQualityIssue => issue !== null); }

function normalizeIssueType(value: unknown): PreSaveQualityIssue['type'] {
  if (
    value === 'previous_continuity' || value === 'chapter_cohesion' ||
    value === 'trait_literalization' || value === 'character_context_mismatch' ||
    value === 'proceduralized_characterization' || value === 'semantic_obscurity' ||
    value === 'pseudo_coinage' || value === 'reader_orientation_failure' ||
    value === 'epistemic_prose_leak' || value === 'repetitive_investigation_structure' ||
    value === 'creative_overreach' || value === 'complexity_escalation' || value === 'unplanned_mystery' ||
    value === 'knowledge_leak' || value === 'forced_symbolism'
  ) return value;
  return 'ai_tone';
}

function normalizeSeverity(value: unknown): PreSaveQualityIssue['severity'] { if (value === 'low' || value === 'high') return value; return 'medium'; }
function normalizeStringList(value: unknown): string[] { if (!Array.isArray(value)) return []; return value.map((item) => String(item || '').trim()).filter(Boolean); }
function clampScore(value: unknown): number { const parsed = Number(value); if (!Number.isFinite(parsed)) return 0; return Math.max(0, Math.min(100, Math.round(parsed))); }
function clampTail(text: string, limit: number): string { const normalized = text.trim(); return normalized.length <= limit ? normalized : normalized.slice(-limit); }
function clampText(text: string, limit: number): string { const normalized = text.trim(); if (normalized.length <= limit) return normalized; return `${normalized.slice(0, Math.max(0, limit - 120)).trim()}\n...[truncated]...\n${normalized.slice(-100).trim()}`; }