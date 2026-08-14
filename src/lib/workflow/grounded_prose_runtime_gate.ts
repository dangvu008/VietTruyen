import { createId } from '../../core/id';
import { hashString } from '../memory/memory_indexer';
import { callAiModelTracked } from '../ai/tracked_ai_client';
import { getModelForTask } from '../ai/model_router';
import { useAiStore } from '../../store/use_ai_store';
import type { Project } from '../../types/story';
import {
  GROUNDED_PROSE_CAUSALITY_SCHEMA,
  GROUNDED_PROSE_COLD_READER_SCHEMA,
  GROUNDED_PROSE_GATE_SCHEMA,
  GROUNDED_PROSE_LINE_AUDIT_SCHEMA,
  type BlindColdReaderArtifact,
  type CausalityBeatArtifact,
  type CausalitySkeletonArtifact,
  type ColdReaderFindingArtifact,
  type GroundedProseFindingCategory,
  type GroundedProseRuntimeGateArtifact,
  type GroundedProseSeverity,
  type LineAuditAction,
  type LineAuditArtifact,
  type LineAuditVerdictArtifact,
} from '../../types/grounded_prose';

const FINDING_CATEGORIES = new Set<GroundedProseFindingCategory>([
  'confusion',
  'author_intrusion',
  'forced_meaning',
  'unnatural_phrase',
  'decorative_glue',
  'unsupported_emotion',
  'metadata_feel',
  'interrogation_feel',
  'behavior_template_feel',
  'semantic_opacity',
]);

const SEVERITIES = new Set<GroundedProseSeverity>(['low', 'medium', 'high']);
const LINE_ACTIONS = new Set<LineAuditAction>(['KEEP_WITH_REASON', 'DELETE', 'REWRITE']);

interface RuntimeGateOptions {
  project: Project;
  targetChapterIndex: number;
  chapterTitle: string;
  chapterContent: string;
  pipelineSessionId?: string;
}

interface ResolvedModel {
  provider: string;
  modelId: string;
  name: string;
  baseUrl?: string;
}

export class GroundedProseGateError extends Error {
  readonly code = 'grounded_prose_gate_failed';
  readonly gate: GroundedProseRuntimeGateArtifact;

  constructor(gate: GroundedProseRuntimeGateArtifact) {
    super(
      gate.blockers.length > 0
        ? `Grounded prose gate blocked chapter: ${gate.blockers.join('; ')}`
        : 'Grounded prose gate blocked chapter.',
    );
    this.name = 'GroundedProseGateError';
    this.gate = gate;
  }
}

export function buildGroundedProseHash(content: string): string {
  return hashString(String(content || '').replace(/\r\n/g, '\n').trim());
}

export async function runGroundedProseRuntimeGate(
  opts: RuntimeGateOptions,
): Promise<GroundedProseRuntimeGateArtifact> {
  const prose = String(opts.chapterContent || '').trim();
  const chapterNumber = opts.targetChapterIndex + 1;
  const proseHash = buildGroundedProseHash(prose);

  if (!prose) {
    return buildGateResult({
      chapterNumber,
      proseHash,
      causalitySkeleton: null,
      coldReader: null,
      lineAudit: null,
      extraBlockers: ['empty_prose'],
    });
  }

  const model = resolveReviewModel();
  if (!model) {
    return buildGateResult({
      chapterNumber,
      proseHash,
      causalitySkeleton: null,
      coldReader: null,
      lineAudit: null,
      extraBlockers: ['grounded_prose_review_model_unavailable'],
    });
  }

  let causalitySkeleton: CausalitySkeletonArtifact | null = null;
  let coldReader: BlindColdReaderArtifact | null = null;
  let lineAudit: LineAuditArtifact | null = null;
  const runtimeBlockers: string[] = [];

  try {
    const raw = await trackedJsonCall({
      model,
      pipelineSessionId: opts.pipelineSessionId,
      systemPrompt: buildCausalitySystemPrompt(),
      userPrompt: buildCausalityUserPrompt(opts, proseHash),
    });
    causalitySkeleton = parseCausalityArtifact(raw, chapterNumber, proseHash);
  } catch (error) {
    runtimeBlockers.push(`causality_artifact_error:${errorMessage(error)}`);
  }

  try {
    const raw = await trackedJsonCall({
      model,
      pipelineSessionId: opts.pipelineSessionId,
      systemPrompt: buildColdReaderSystemPrompt(),
      userPrompt: buildColdReaderUserPrompt(chapterNumber, proseHash, prose),
    });
    coldReader = parseColdReaderArtifact(raw, chapterNumber, proseHash);
  } catch (error) {
    runtimeBlockers.push(`cold_reader_artifact_error:${errorMessage(error)}`);
  }

  if (coldReader) {
    try {
      const raw = await trackedJsonCall({
        model,
        pipelineSessionId: opts.pipelineSessionId,
        systemPrompt: buildLineAuditSystemPrompt(),
        userPrompt: buildLineAuditUserPrompt(chapterNumber, proseHash, prose, coldReader),
      });
      lineAudit = parseLineAuditArtifact(raw, chapterNumber, proseHash);
    } catch (error) {
      runtimeBlockers.push(`line_audit_artifact_error:${errorMessage(error)}`);
    }
  } else {
    runtimeBlockers.push('line_audit_skipped_without_cold_reader');
  }

  return buildGateResult({
    chapterNumber,
    proseHash,
    causalitySkeleton,
    coldReader,
    lineAudit,
    extraBlockers: runtimeBlockers,
  });
}

export function assertGroundedProseRuntimeGate(
  gate: GroundedProseRuntimeGateArtifact,
): void {
  if (gate.decision !== 'PASS') {
    throw new GroundedProseGateError(gate);
  }
}

export function evaluateGroundedProseRuntimeGate(input: {
  chapterNumber: number;
  proseHash: string;
  causalitySkeleton: CausalitySkeletonArtifact | null;
  coldReader: BlindColdReaderArtifact | null;
  lineAudit: LineAuditArtifact | null;
  extraBlockers?: string[];
}): string[] {
  const blockers = [...(input.extraBlockers || [])].filter(Boolean);
  const { chapterNumber, proseHash, causalitySkeleton, coldReader, lineAudit } = input;

  if (!causalitySkeleton) {
    blockers.push('missing_causality_skeleton');
  } else {
    if (causalitySkeleton.schemaVersion !== GROUNDED_PROSE_CAUSALITY_SCHEMA) blockers.push('invalid_causality_schema');
    if (causalitySkeleton.chapterNumber !== chapterNumber) blockers.push('causality_chapter_mismatch');
    if (causalitySkeleton.proseHash !== proseHash) blockers.push('causality_stale_prose_hash');
    if (!causalitySkeleton.pass) blockers.push(...prefixBlockers('causality', causalitySkeleton.blockers));
    if (causalitySkeleton.beats.length === 0) blockers.push('causality_no_beats');

    const beatIds = new Set<string>();
    for (const beat of causalitySkeleton.beats) {
      if (!beat.id || beatIds.has(beat.id)) blockers.push('causality_duplicate_or_missing_beat_id');
      beatIds.add(beat.id);
      if (!beat.stimulus.trim()) blockers.push(`causality_missing_stimulus:${beat.id || 'unknown'}`);
      if (!beat.perception.trim()) blockers.push(`causality_missing_perception:${beat.id || 'unknown'}`);
      if (!beat.response.trim()) blockers.push(`causality_missing_response:${beat.id || 'unknown'}`);
      if (!beat.consequence.trim()) blockers.push(`causality_missing_consequence:${beat.id || 'unknown'}`);
    }
  }

  if (!coldReader) {
    blockers.push('missing_blind_cold_reader');
  } else {
    if (coldReader.schemaVersion !== GROUNDED_PROSE_COLD_READER_SCHEMA) blockers.push('invalid_cold_reader_schema');
    if (coldReader.chapterNumber !== chapterNumber) blockers.push('cold_reader_chapter_mismatch');
    if (coldReader.proseHash !== proseHash) blockers.push('cold_reader_stale_prose_hash');
    if (!coldReader.pass) blockers.push(...prefixBlockers('cold_reader', coldReader.blockers));
    for (const finding of coldReader.findings) {
      if (finding.severity === 'high') blockers.push(`cold_reader_high:${finding.id}`);
      if (!finding.excerpt.trim()) blockers.push(`cold_reader_missing_excerpt:${finding.id}`);
      if (!finding.reason.trim()) blockers.push(`cold_reader_missing_reason:${finding.id}`);
    }
  }

  if (!lineAudit) {
    blockers.push('missing_line_audit');
  } else {
    if (lineAudit.schemaVersion !== GROUNDED_PROSE_LINE_AUDIT_SCHEMA) blockers.push('invalid_line_audit_schema');
    if (lineAudit.chapterNumber !== chapterNumber) blockers.push('line_audit_chapter_mismatch');
    if (lineAudit.proseHash !== proseHash) blockers.push('line_audit_stale_prose_hash');
    if (!lineAudit.pass) blockers.push(...prefixBlockers('line_audit', lineAudit.blockers));
  }

  if (coldReader && lineAudit) {
    const findingsById = new Map(coldReader.findings.map((finding) => [finding.id, finding]));
    const verdictsByFinding = new Map<string, LineAuditVerdictArtifact[]>();

    for (const verdict of lineAudit.verdicts) {
      const list = verdictsByFinding.get(verdict.findingId) || [];
      list.push(verdict);
      verdictsByFinding.set(verdict.findingId, list);

      if (!findingsById.has(verdict.findingId)) blockers.push(`line_audit_unknown_finding:${verdict.findingId}`);
      if (!verdict.reason.trim()) blockers.push(`line_audit_missing_reason:${verdict.findingId}`);
      if (verdict.action === 'DELETE' || verdict.action === 'REWRITE') {
        blockers.push(`line_audit_unapplied_${verdict.action.toLowerCase()}:${verdict.findingId}`);
      }
      if (verdict.action === 'KEEP_WITH_REASON' && !String(verdict.sceneFunction || '').trim()) {
        blockers.push(`line_audit_keep_without_scene_function:${verdict.findingId}`);
      }
    }

    for (const finding of coldReader.findings) {
      const verdicts = verdictsByFinding.get(finding.id) || [];
      if (verdicts.length === 0) blockers.push(`line_audit_missing_finding:${finding.id}`);
      if (verdicts.length > 1) blockers.push(`line_audit_duplicate_finding:${finding.id}`);
    }
  }

  return Array.from(new Set(blockers));
}

function buildGateResult(input: {
  chapterNumber: number;
  proseHash: string;
  causalitySkeleton: CausalitySkeletonArtifact | null;
  coldReader: BlindColdReaderArtifact | null;
  lineAudit: LineAuditArtifact | null;
  extraBlockers?: string[];
}): GroundedProseRuntimeGateArtifact {
  const blockers = evaluateGroundedProseRuntimeGate(input);
  return {
    schemaVersion: GROUNDED_PROSE_GATE_SCHEMA,
    chapterNumber: input.chapterNumber,
    proseHash: input.proseHash,
    decision: blockers.length === 0 ? 'PASS' : 'FAIL',
    blockers,
    causalitySkeleton: input.causalitySkeleton,
    coldReader: input.coldReader,
    lineAudit: input.lineAudit,
    createdAt: new Date().toISOString(),
  };
}

function resolveReviewModel(): ResolvedModel | null {
  const aiStore = useAiStore.getState();
  const model = getModelForTask(
    'write_chapter',
    aiStore.models,
    undefined,
    aiStore.activeModelId,
    aiStore.taskModelOverrides,
    aiStore.modelHealth,
    [],
    aiStore.preferredProvider,
  );
  if (!model) return null;
  return {
    provider: model.provider,
    modelId: model.modelId,
    name: model.name,
    baseUrl: model.baseUrl,
  };
}

async function trackedJsonCall(opts: {
  model: ResolvedModel;
  pipelineSessionId?: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<string> {
  return callAiModelTracked({
    provider: opts.model.provider,
    modelId: opts.model.modelId,
    modelName: opts.model.name,
    baseUrl: opts.model.baseUrl,
    taskType: 'write_chapter',
    responseFormat: 'json_object',
    skipCache: true,
    pipelineSessionId: opts.pipelineSessionId,
    pipelineStep: 'review_checkers',
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
  });
}

function buildCausalitySystemPrompt(): string {
  return [
    'You are a strict causal-structure auditor for Vietnamese fiction.',
    'Read the prose as written. Do not repair missing links by inventing motives or events.',
    'Map meaningful beats as stimulus -> POV perception -> response/action -> consequence/change.',
    'A beat fails if emotion, analysis, caution, mystery, or transition appears without a concrete scene-level cause.',
    'Do not reward literary tone. Judge whether the prose is causally grounded.',
    'Return JSON only.',
  ].join('\n');
}

function buildCausalityUserPrompt(opts: RuntimeGateOptions, proseHash: string): string {
  const chapterNumber = opts.targetChapterIndex + 1;
  const outlineBeat = opts.project.outline[opts.targetChapterIndex];
  return [
    `Chapter number: ${chapterNumber}`,
    `Chapter title: ${opts.chapterTitle || outlineBeat?.title || 'Untitled'}`,
    `Prose hash: ${proseHash}`,
    outlineBeat ? `Declared chapter intent: ${[outlineBeat.title, outlineBeat.summary, outlineBeat.focus].filter(Boolean).join(' | ')}` : '',
    '',
    'PROSE:',
    '"""',
    opts.chapterContent,
    '"""',
    '',
    'Return exactly this shape:',
    JSON.stringify({
      pass: true,
      blockers: [],
      beats: [{ id: 'beat-1', stimulus: 'concrete trigger', perception: 'what POV notices/understands', response: 'what POV does/thinks/feels because of it', consequence: 'what changes next' }],
    }),
  ].filter(Boolean).join('\n');
}

function buildColdReaderSystemPrompt(): string {
  return [
    'You are a blind cold reader. You receive prose only and must not infer hidden canon, outline, writer intent, or rationale.',
    'Flag exact spans that feel confusing, author-intrusive, forced in meaning, unnatural, decorative, emotionally unsupported, metadata-like, interrogation-like, behavior-template-like, or semantically opaque.',
    'A sentence that only works after someone explains the writer intention is a failure.',
    'Do not rewrite. Do not defend the writer. Return JSON only.',
  ].join('\n');
}

function buildColdReaderUserPrompt(chapterNumber: number, proseHash: string, prose: string): string {
  return [
    `Chapter number: ${chapterNumber}`,
    `Prose hash: ${proseHash}`,
    '',
    'PROSE ONLY:',
    '"""',
    prose,
    '"""',
    '',
    'Allowed categories:',
    Array.from(FINDING_CATEGORIES).join(', '),
    '',
    'Return exactly this shape:',
    JSON.stringify({
      pass: true,
      blockers: [],
      findings: [{ id: 'f-1', category: 'decorative_glue', severity: 'medium', excerpt: 'exact short excerpt', reason: 'why a cold reader is disrupted' }],
    }),
    'If there are no findings, return findings: [] and pass: true.',
  ].join('\n');
}

function buildLineAuditSystemPrompt(): string {
  return [
    'You are an adversarial line auditor for Vietnamese fiction.',
    'For every cold-reader finding, choose exactly one action: KEEP_WITH_REASON, DELETE, or REWRITE.',
    'KEEP_WITH_REASON is allowed only when the exact span has a concrete scene function and causal support visible in the prose itself.',
    'Reasons such as "creates atmosphere", "fits personality", "builds mystery", or "sounds literary" are insufficient by themselves.',
    'If any finding needs DELETE or REWRITE, pass must be false because the current prose has not yet applied that fix.',
    'Do not edit the prose. Return JSON only.',
  ].join('\n');
}

function buildLineAuditUserPrompt(
  chapterNumber: number,
  proseHash: string,
  prose: string,
  coldReader: BlindColdReaderArtifact,
): string {
  return [
    `Chapter number: ${chapterNumber}`,
    `Prose hash: ${proseHash}`,
    '',
    'PROSE:',
    '"""',
    prose,
    '"""',
    '',
    'COLD READER FINDINGS:',
    JSON.stringify(coldReader.findings),
    '',
    'Return exactly this shape:',
    JSON.stringify({
      pass: true,
      blockers: [],
      verdicts: [{ findingId: 'f-1', action: 'KEEP_WITH_REASON', reason: 'concrete causal justification', sceneFunction: 'specific image/action/transition/character effect' }],
    }),
    'Return one and only one verdict for every finding id. If findings are empty, return verdicts: [] and pass: true.',
  ].join('\n');
}

function parseCausalityArtifact(raw: string, chapterNumber: number, proseHash: string): CausalitySkeletonArtifact {
  const parsed = parseJsonObject(raw);
  const beatsRaw = Array.isArray(parsed.beats) ? parsed.beats : [];
  const beats = beatsRaw.map(normalizeCausalityBeat).filter((beat): beat is CausalityBeatArtifact => Boolean(beat));
  return {
    schemaVersion: GROUNDED_PROSE_CAUSALITY_SCHEMA,
    chapterNumber,
    proseHash,
    pass: parsed.pass === true,
    beats,
    blockers: normalizeStringList(parsed.blockers),
  };
}

function parseColdReaderArtifact(raw: string, chapterNumber: number, proseHash: string): BlindColdReaderArtifact {
  const parsed = parseJsonObject(raw);
  const findingsRaw = Array.isArray(parsed.findings) ? parsed.findings : [];
  const findings = findingsRaw.map(normalizeFinding).filter((finding): finding is ColdReaderFindingArtifact => Boolean(finding));
  return {
    schemaVersion: GROUNDED_PROSE_COLD_READER_SCHEMA,
    chapterNumber,
    proseHash,
    pass: parsed.pass === true,
    findings,
    blockers: normalizeStringList(parsed.blockers),
  };
}

function parseLineAuditArtifact(raw: string, chapterNumber: number, proseHash: string): LineAuditArtifact {
  const parsed = parseJsonObject(raw);
  const verdictsRaw = Array.isArray(parsed.verdicts) ? parsed.verdicts : [];
  const verdicts = verdictsRaw.map(normalizeVerdict).filter((verdict): verdict is LineAuditVerdictArtifact => Boolean(verdict));
  return {
    schemaVersion: GROUNDED_PROSE_LINE_AUDIT_SCHEMA,
    chapterNumber,
    proseHash,
    pass: parsed.pass === true,
    verdicts,
    blockers: normalizeStringList(parsed.blockers),
  };
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const cleaned = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first === -1 || last <= first) throw new Error('invalid_json_object');
  const parsed = JSON.parse(cleaned.slice(first, last + 1));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('json_not_object');
  return parsed as Record<string, unknown>;
}

function normalizeCausalityBeat(value: unknown): CausalityBeatArtifact | null {
  if (!value || typeof value !== 'object') return null;
  const beat = value as Record<string, unknown>;
  const id = String(beat.id || createId()).trim();
  return {
    id,
    stimulus: String(beat.stimulus || '').trim(),
    perception: String(beat.perception || '').trim(),
    response: String(beat.response || '').trim(),
    consequence: String(beat.consequence || '').trim(),
  };
}

function normalizeFinding(value: unknown): ColdReaderFindingArtifact | null {
  if (!value || typeof value !== 'object') return null;
  const finding = value as Record<string, unknown>;
  const category = String(finding.category || '') as GroundedProseFindingCategory;
  const severity = String(finding.severity || '') as GroundedProseSeverity;
  if (!FINDING_CATEGORIES.has(category) || !SEVERITIES.has(severity)) return null;
  return {
    id: String(finding.id || createId()).trim(),
    category,
    severity,
    excerpt: String(finding.excerpt || '').trim(),
    reason: String(finding.reason || '').trim(),
  };
}

function normalizeVerdict(value: unknown): LineAuditVerdictArtifact | null {
  if (!value || typeof value !== 'object') return null;
  const verdict = value as Record<string, unknown>;
  const action = String(verdict.action || '') as LineAuditAction;
  if (!LINE_ACTIONS.has(action)) return null;
  return {
    findingId: String(verdict.findingId || '').trim(),
    action,
    reason: String(verdict.reason || '').trim(),
    sceneFunction: String(verdict.sceneFunction || '').trim() || undefined,
  };
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function prefixBlockers(prefix: string, blockers: string[]): string[] {
  return blockers.length > 0 ? blockers.map((blocker) => `${prefix}:${blocker}`) : [`${prefix}:reported_fail`];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'unknown_error');
}
