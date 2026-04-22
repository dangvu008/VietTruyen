import { planChapterBranches, writeChapterFromBranch } from '../ai/chapter_writer_ai';
import type { BranchPlanningResult, ChapterWriteResult, SurpriseBranch, TensionLevel } from '../../types/surprise';
import type { Project, WorkflowEngineType } from '../../types/story';

interface PlanBranchesParams {
  project: Project;
  targetChapterIndex: number;
  mode: 'create' | 'continue';
  tensionLevel: TensionLevel;
  prompt?: string;
  notes?: string;
  sourceOverride?: string;
}

interface WriteChapterParams {
  project: Project;
  targetChapterIndex: number;
  mode: 'create' | 'continue';
  tensionLevel: TensionLevel;
  branch: SurpriseBranch;
  prompt?: string;
  notes?: string;
  sourceOverride?: string;
  styleInstruction?: string;
}

interface BridgeSuccess<T> {
  ok: true;
  data: T;
}

interface BridgeFailure {
  ok: false;
  error: string;
}

type BridgeResponse<T> = BridgeSuccess<T> | BridgeFailure;

async function callClaudeBridge<T>(action: string, payload: unknown): Promise<T> {
  const baseUrl = import.meta.env.VITE_CLAUDE_PLUGIN_BRIDGE_URL || '/api/workflow/claude-plugin';
  let response: Response;
  try {
    response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    });
  } catch {
    throw new Error(
      'Không kết nối được Claude plugin bridge. Hãy bật backend bridge hoặc chuyển về API engine.'
    );
  }

  let body: BridgeResponse<T> | null = null;
  try {
    body = (await response.json()) as BridgeResponse<T>;
  } catch {
    // Ignore parse error and throw fallback below.
  }

  if (!response.ok) {
    const errorMessage = body && !body.ok ? body.error : `Bridge lỗi HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  if (!body || !body.ok) {
    throw new Error('Bridge trả dữ liệu không hợp lệ.');
  }

  return body.data;
}

export async function planChapterBranchesWithEngine(
  engine: WorkflowEngineType,
  params: PlanBranchesParams
): Promise<BranchPlanningResult> {
  if (engine === 'claude_plugin') {
    return callClaudeBridge<BranchPlanningResult>('plan_branches', params);
  }
  return planChapterBranches(params);
}

export async function writeChapterFromBranchWithEngine(
  engine: WorkflowEngineType,
  params: WriteChapterParams
): Promise<ChapterWriteResult> {
  if (engine === 'claude_plugin') {
    return callClaudeBridge<ChapterWriteResult>('write_chapter', params);
  }
  return writeChapterFromBranch(params);
}
