import { createId } from '../../core/id';
import type {
  SupportedWorkflowIntent,
  WorkflowSession,
  WorkflowSessionError,
} from '../../types/workflow';
import {
  planChapterBranchesWithEngine,
  writeChapterFromBranchWithEngine,
} from './workflow_engine';
import { executeFullWritePipeline } from './full_write_pipeline';
import {
  GroundedProseGateError,
  assertGroundedProseRuntimeGate,
  runGroundedProseRuntimeGate,
} from './grounded_prose_runtime_gate';
import { saveGroundedProseGateReceipt } from './grounded_prose_receipt_store';
import { buildDeepWritingNotes, isDeepWritingMode } from '../ai/deep_writing_mode';

interface ExecuteWorkflowIntentOptions {
  onUpdate?: (session: WorkflowSession) => void;
  /** Real-time chunk callback for streaming write step */
  onChunk?: (chunk: string, accumulated: string) => void;
  /** AbortSignal to cancel streaming */
  signal?: AbortSignal;
}

function buildWorkflowError(error: unknown): WorkflowSessionError {
  if (error instanceof GroundedProseGateError) {
    return {
      code: error.code,
      message: error.message,
      retryable: true,
    };
  }

  return {
    code: 'workflow_execution_failed',
    message: error instanceof Error ? error.message : 'Workflow execution thất bại.',
    retryable: true,
  };
}

function mergeSession(
  session: WorkflowSession,
  patch: Partial<WorkflowSession>,
): WorkflowSession {
  return {
    ...session,
    ...patch,
    artifacts: {
      ...session.artifacts,
      ...patch.artifacts,
    },
    metrics: {
      ...session.metrics,
      ...patch.metrics,
    },
  };
}

function emitSession(
  current: WorkflowSession,
  patch: Partial<WorkflowSession>,
  onUpdate?: (session: WorkflowSession) => void,
): WorkflowSession {
  const next = mergeSession(current, patch);
  onUpdate?.(next);
  return next;
}

function createWorkflowSession(intent: SupportedWorkflowIntent): WorkflowSession {
  return {
    id: createId(),
    intent,
    step: 'idle',
    artifacts: {},
    metrics: {
      startedAt: new Date().toISOString(),
    },
  };
}

export async function executeWorkflowIntent(
  intent: SupportedWorkflowIntent,
  options: ExecuteWorkflowIntentOptions = {},
): Promise<WorkflowSession> {
  const startedAtMs = Date.now();
  let session = createWorkflowSession(intent);
  options.onUpdate?.(session);

  try {
    switch (intent.type) {
      case 'plan_chapter_branches': {
        const payload = intent.payload;
        session = emitSession(
          session,
          {
            step: 'planning',
            statusMessage: 'Đang tạo 3 hướng branch...',
          },
          options.onUpdate,
        );

        const planningResult = await planChapterBranchesWithEngine(
          payload.workflowEngine,
          payload,
        );

        return emitSession(
          session,
          {
            step: 'completed',
            statusMessage: 'Đã tạo xong 3 hướng branch.',
            artifacts: {
              planningResult,
              selectedBranchId: planningResult.recommendedBranchId ?? undefined,
            },
            metrics: {
              startedAt: session.metrics.startedAt,
              finishedAt: new Date().toISOString(),
              latencyMs: Date.now() - startedAtMs,
            },
            error: undefined,
          },
          options.onUpdate,
        );
      }

      case 'write_chapter_from_branch': {
        const payload = intent.payload;
        session = emitSession(
          session,
          {
            step: 'drafting',
            statusMessage: 'Đang viết chương theo branch đã chọn...',
          },
          options.onUpdate,
        );

        const chapterWriteResult = await writeChapterFromBranchWithEngine(
          payload.workflowEngine,
          payload,
        );

        session = emitSession(
          session,
          {
            step: 'reviewing',
            statusMessage: 'Đang chạy Grounded Prose Runtime Gate...',
          },
          options.onUpdate,
        );

        const groundedProseGate = await runGroundedProseRuntimeGate({
          project: payload.project,
          targetChapterIndex: payload.targetChapterIndex,
          chapterTitle: chapterWriteResult.title,
          chapterContent: chapterWriteResult.content,
        });
        assertGroundedProseRuntimeGate(groundedProseGate);
        saveGroundedProseGateReceipt(
          payload.project.id,
          payload.targetChapterIndex + 1,
          groundedProseGate,
        );

        return emitSession(
          session,
          {
            step: 'completed',
            statusMessage: 'Đã viết xong chương và Grounded Prose Gate đã PASS.',
            artifacts: {
              chapterWriteResult,
              draftText: chapterWriteResult.content,
              selectedBranchId: payload.branch.id,
              divergenceReport: chapterWriteResult.divergence,
              groundedProseGate,
            },
            metrics: {
              startedAt: session.metrics.startedAt,
              finishedAt: new Date().toISOString(),
              latencyMs: Date.now() - startedAtMs,
            },
            error: undefined,
          },
          options.onUpdate,
        );
      }

      case 'full_write_pipeline': {
        const payload = intent.payload;
        const deepWritingActive = isDeepWritingMode(payload);
        const effectiveNotes = deepWritingActive
          ? buildDeepWritingNotes(payload.notes)
          : payload.notes;

        const stepToWorkflowStep: Record<number, WorkflowSession['step']> = {
          1: 'context_building',
          2: 'drafting',
          3: 'reviewing',
          4: 'polishing',
          5: 'data_processing',
          6: 'syncing',
          7: 'persisting',
        };

        const pipelineResult = await executeFullWritePipeline({
          project: payload.project,
          targetChapterIndex: payload.targetChapterIndex,
          mode: payload.mode,
          tensionLevel: payload.tensionLevel,
          prompt: payload.prompt,
          notes: effectiveNotes,
          sourceOverride: payload.sourceOverride,
          styleInstruction: payload.styleInstruction,
          // Deep Writing is intentionally the full craft path. It cannot be
          // silently downgraded by skip flags because that would make the mode
          // label lie to the user.
          skipReview: deepWritingActive ? false : payload.skipReview,
          skipPolish: deepWritingActive ? false : payload.skipPolish,
          qualityMode: payload.qualityMode,
          onChunk: options.onChunk,
          signal: options.signal,
          onProgress: (progress) => {
            const wfStep = stepToWorkflowStep[progress.step] || 'planning';
            session = emitSession(
              session,
              {
                step: wfStep,
                statusMessage: deepWritingActive
                  ? `[Deep Writing ${progress.step}/${progress.totalSteps}] ${progress.label}`
                  : `[${progress.step}/${progress.totalSteps}] ${progress.label}`,
              },
              options.onUpdate,
            );
          },
        });

        const artifacts = {
          chapterWriteResult: pipelineResult.writeResult,
          draftText: pipelineResult.content,
          selectedBranchId: pipelineResult.selectedBranch.id,
          divergenceReport: pipelineResult.writeResult.divergence,
          reviewReport: pipelineResult.reviewReport ?? undefined,
          styleAnalysis: pipelineResult.styleAnalysis ?? undefined,
          pipelineStepTimings: pipelineResult.stepTimings,
          groundedProseGate: pipelineResult.groundedProseGate ?? undefined,
          acceptanceDecision: pipelineResult.acceptanceDecision,
        };

        // Fast mode is intentionally candidate-only. It may complete as a
        // drafting workflow, but never mutates accepted state or memory.
        const effectiveQualityMode = payload.qualityMode ?? 'quality';
        if (effectiveQualityMode === 'fast') {
          return emitSession(
            session,
            {
              step: 'completed',
              statusMessage: `Candidate-only hoàn tất trong ${Math.round(pipelineResult.totalDurationMs / 1000)}s; không promote memory.`,
              artifacts,
              metrics: {
                startedAt: session.metrics.startedAt,
                finishedAt: new Date().toISOString(),
                latencyMs: Date.now() - startedAtMs,
              },
              error: undefined,
            },
            options.onUpdate,
          );
        }

        // For balanced/quality modes, HOLD/FAIL is a workflow-level block.
        // Candidate prose remains available for revision, but downstream code
        // must not mistake it for an accepted/persistable result.
        if (pipelineResult.acceptanceDecision.verdict !== 'PASS') {
          return emitSession(
            session,
            {
              step: 'failed',
              statusMessage: deepWritingActive
                ? `Deep Writing ${pipelineResult.acceptanceDecision.verdict}: candidate được giữ lại nhưng không promote.`
                : `Pipeline ${pipelineResult.acceptanceDecision.verdict}: candidate được giữ lại nhưng không promote.`,
              artifacts,
              error: {
                code: pipelineResult.acceptanceDecision.verdict === 'FAIL'
                  ? 'pipeline_acceptance_failed'
                  : 'pipeline_acceptance_hold',
                message: pipelineResult.acceptanceDecision.reasons.join(' | ') || 'Acceptance evidence incomplete.',
                retryable: true,
              },
              metrics: {
                startedAt: session.metrics.startedAt,
                finishedAt: new Date().toISOString(),
                latencyMs: Date.now() - startedAtMs,
              },
            },
            options.onUpdate,
          );
        }

        return emitSession(
          session,
          {
            step: 'completed',
            statusMessage: deepWritingActive
              ? `Deep Writing PASS; accepted memory được phép cập nhật trong ${Math.round(pipelineResult.totalDurationMs / 1000)}s.`
              : `Pipeline PASS và accepted memory đã được phép cập nhật trong ${Math.round(pipelineResult.totalDurationMs / 1000)}s.`,
            artifacts,
            metrics: {
              startedAt: session.metrics.startedAt,
              finishedAt: new Date().toISOString(),
              latencyMs: Date.now() - startedAtMs,
            },
            error: undefined,
          },
          options.onUpdate,
        );
      }
    }
  } catch (error) {
    const groundedProseGate = error instanceof GroundedProseGateError
      ? error.gate
      : undefined;

    return emitSession(
      session,
      {
        step: 'failed',
        statusMessage: groundedProseGate
          ? 'Grounded Prose Runtime Gate chặn bản thảo trước khi lưu.'
          : 'Workflow thất bại.',
        artifacts: groundedProseGate ? { groundedProseGate } : undefined,
        error: buildWorkflowError(error),
        metrics: {
          startedAt: session.metrics.startedAt,
          finishedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAtMs,
        },
      },
      options.onUpdate,
    );
  }

  return session;
}
