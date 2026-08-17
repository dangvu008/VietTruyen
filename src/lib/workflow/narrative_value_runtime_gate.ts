import type { Project } from '../../types/story';
import { callAiModelTracked } from '../ai/tracked_ai_client';
import { getModelForTask } from '../ai/model_router';
import { useAiStore } from '../../store/use_ai_store';
import { buildGroundedProseHash } from './grounded_prose_runtime_gate';
import {
  evaluateNarrativeValueGate,
  type NarrativeChangeKind,
  type RemovalImpact,
  type SceneNarrativeValueEvidence,
} from './narrative_value_gate';

const CHANGE_KINDS = new Set<NarrativeChangeKind>([
  'decision',
  'relationship',
  'knowledge',
  'risk',
  'goal',
  'world_state',
  'character_state',
  'setup',
  'payoff',
]);
const REMOVAL_IMPACTS = new Set<RemovalImpact>(['none', 'low', 'medium', 'high']);

export interface NarrativeValueRuntimeArtifact {
  chapterNumber: number;
  proseHash: string;
  verdict: 'PASS' | 'HOLD';
  blockers: string[];
  warnings: string[];
  scenes: SceneNarrativeValueEvidence[];
  createdAt: string;
}

interface RuntimeOptions {
  project: Project;
  targetChapterIndex: number;
  chapterTitle: string;
  chapterContent: string;
  pipelineSessionId?: string;
}

interface RawResponse {
  scenes?: unknown;
}

export async function runNarrativeValueRuntimeGate(
  opts: RuntimeOptions,
): Promise<NarrativeValueRuntimeArtifact> {
  const proseHash = buildGroundedProseHash(opts.chapterContent);
  const chapterNumber = opts.targetChapterIndex + 1;
  const model = resolveReviewModel();

  if (!model) {
    return {
      chapterNumber,
      proseHash,
      verdict: 'HOLD',
      blockers: ['Narrative-value review model unavailable.'],
      warnings: [],
      scenes: [],
      createdAt: new Date().toISOString(),
    };
  }

  try {
    const raw = await callAiModelTracked({
      provider: model.provider,
      modelId: model.modelId,
      modelName: model.name,
      baseUrl: model.baseUrl,
      taskType: 'write_chapter',
      responseFormat: 'json_object',
      skipCache: true,
      pipelineSessionId: opts.pipelineSessionId,
      // Narrative-value review is part of the pre-save quality phase. Reuse
      // the existing label so token analytics remain exhaustive without
      // forcing every dashboard/report consumer to learn a one-off label.
      pipelineStep: 'pre_save_quality_gate',
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt(opts),
    });

    const parsed = JSON.parse(cleanJsonObject(raw)) as RawResponse;
    const scenes = normalizeScenes(parsed.scenes);
    const result = evaluateNarrativeValueGate({ scenes });

    return {
      chapterNumber,
      proseHash,
      verdict: result.verdict,
      blockers: result.blockers,
      warnings: result.warnings,
      scenes,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      chapterNumber,
      proseHash,
      verdict: 'HOLD',
      blockers: [`Narrative-value artifact error: ${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
      scenes: [],
      createdAt: new Date().toISOString(),
    };
  }
}

function resolveReviewModel() {
  const aiStore = useAiStore.getState();
  return getModelForTask(
    'write_chapter',
    aiStore.models,
    undefined,
    aiStore.activeModelId,
    aiStore.taskModelOverrides,
    aiStore.modelHealth,
    [],
    aiStore.preferredProvider,
  );
}

function buildSystemPrompt(): string {
  return [
    'You are a scene-necessity reviewer for Vietnamese fiction.',
    'Do not rewrite prose and do not reward surface style.',
    'Split the chapter into functional scenes/beats and ask: if this scene were removed, what concrete narrative value would disappear?',
    'A scene may be quiet and still valuable through relationship, decision, knowledge, risk, goal, world/character state, setup, payoff, or a necessary bridge.',
    'Do NOT require a twist, hook, payoff, or spectacle in every scene.',
    'Mark removalImpact=none only when deletion causes no meaningful narrative loss.',
    'Use redundantWithSceneIds only when another scene already performs substantially the same function.',
    'Return JSON only.',
  ].join('\n');
}

function buildUserPrompt(opts: RuntimeOptions): string {
  const intent = opts.project.outline?.[opts.targetChapterIndex];
  return [
    `Project: ${opts.project.title}`,
    `Chapter: ${opts.targetChapterIndex + 1} - ${opts.chapterTitle}`,
    intent ? `Chapter intent: ${[intent.title, intent.summary, intent.focus].filter(Boolean).join(' | ')}` : '',
    '',
    'Chapter prose:',
    '"""',
    opts.chapterContent,
    '"""',
    '',
    'Return JSON shape:',
    JSON.stringify({
      scenes: [
        {
          sceneId: 's1',
          summary: 'short factual scene summary',
          changes: [{ kind: 'decision', description: 'concrete change' }],
          removalImpact: 'medium',
          bridgeNecessary: false,
          setupOrPayoffNecessary: false,
          redundantWithSceneIds: [],
        },
      ],
    }),
  ].filter(Boolean).join('\n');
}

function normalizeScenes(value: unknown): SceneNarrativeValueEvidence[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): SceneNarrativeValueEvidence | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const sceneId = String(raw.sceneId || `s${index + 1}`).trim();
      const summary = String(raw.summary || '').trim();
      const removalImpact = REMOVAL_IMPACTS.has(raw.removalImpact as RemovalImpact)
        ? raw.removalImpact as RemovalImpact
        : 'none';
      const changes = Array.isArray(raw.changes)
        ? raw.changes.map((change) => {
          if (!change || typeof change !== 'object') return null;
          const entry = change as Record<string, unknown>;
          const kind = CHANGE_KINDS.has(entry.kind as NarrativeChangeKind)
            ? entry.kind as NarrativeChangeKind
            : null;
          const description = String(entry.description || '').trim();
          return kind && description ? { kind, description } : null;
        }).filter((change): change is { kind: NarrativeChangeKind; description: string } => change !== null)
        : [];
      const redundantWithSceneIds = Array.isArray(raw.redundantWithSceneIds)
        ? raw.redundantWithSceneIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];

      return {
        sceneId,
        summary,
        changes,
        removalImpact,
        bridgeNecessary: raw.bridgeNecessary === true,
        setupOrPayoffNecessary: raw.setupOrPayoffNecessary === true,
        redundantWithSceneIds,
      };
    })
    .filter((scene): scene is SceneNarrativeValueEvidence => scene !== null);
}

function cleanJsonObject(text: string): string {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) throw new Error('Narrative-value reviewer returned invalid JSON.');
  return cleaned.slice(firstBrace, lastBrace + 1);
}
