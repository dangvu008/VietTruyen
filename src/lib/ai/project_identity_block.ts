/**
 * File: project_identity_block.ts
 * Purpose: Generate compact project identity block (~200 tokens) for AI wake-up.
 *          Inspired by MemPalace L0 layer — always-loaded identity context
 *          that gives the AI instant awareness of project + author before heavy context.
 * Layer: AI → Director
 * Domain: Context Selection
 * Deps: story types (Project), token_estimator
 */

import type { Project } from '../../types/story';
import type { SceneTypeResult } from './scene_type_classifier';
import { quickTruncate, estimateTokens } from './token_estimator';

// ─── Constants ───────────────────────────────────────────

/** Max token budget for L0 identity block */
const IDENTITY_TOKEN_BUDGET = 200;

/** Max chars ≈ 200 tokens × 3.5 chars/token for Vietnamese */
const IDENTITY_MAX_CHARS = 700;

// ─── Types ───────────────────────────────────────────────

export interface ProjectIdentityBlock {
  /** Compact identity text ready to prepend to any AI call */
  text: string;
  /** Estimated token count */
  tokenEstimate: number;
  /** Scene type tag if classified */
  sceneTag: string | null;
}

// ─── Builders ────────────────────────────────────────────

/**
 * [Domain:ContextSelection] STEP 0 — Build L0 project identity block.
 * This is the cheapest context layer (~200 tokens), always loaded first.
 *
 * Packs these essentials:
 * 1. Project name + genre + tone
 * 2. Main character names + current power levels
 * 3. Current chapter number + scene type
 * 4. Active strand (quest/fire/constellation)
 *
 * @example Output:
 * ```
 * [L0:IDENTITY] Vạn Cổ Đệ Nhất | Tiên hiệp | Giọng: lạnh lùng, tối tăm
 * MC: Lý Thiên (Nguyên Anh giai đoạn hậu kỳ) | Đối thủ: Trần Huyền (Hóa Thần)
 * Hỗ trợ: Tiểu Hàn (Trúc Cơ), Lão Ma (Đại Thừa)
 * Ch.47 | Scene: combat | Strand: fire
 * ```
 */
export function buildProjectIdentityBlock(
  project: Project,
  targetChapterIndex: number,
  sceneType?: SceneTypeResult,
): ProjectIdentityBlock {
  const lines: string[] = [];

  // Line 1: Project core identity
  const identityParts = [project.title || 'Untitled'];
  if (project.genre) identityParts.push(project.genre);
  if (project.tone) identityParts.push(`Giọng: ${quickTruncate(project.tone, 30)}`);
  lines.push(`[L0:IDENTITY] ${identityParts.join(' | ')}`);

  // Line 2-3: Characters (MC first, then key support, max 5)
  const characters = project.characters || [];
  if (characters.length > 0) {
    const mc = characters.find((c) => c.role === 'protagonist' || c.role === 'mc');
    const antagonists = characters.filter((c) => c.role === 'antagonist' || c.role === 'villain');
    const supports = characters.filter(
      (c) => c !== mc && !antagonists.includes(c)
    );

    if (mc) {
      const mcStage = mc.currentStage ? ` (${quickTruncate(mc.currentStage, 30)})` : '';
      const antaInfo = antagonists.length > 0
        ? ` | Đối thủ: ${antagonists.slice(0, 2).map((a) => {
            const stage = a.currentStage ? ` (${quickTruncate(a.currentStage, 20)})` : '';
            return `${a.name}${stage}`;
          }).join(', ')}`
        : '';
      lines.push(`MC: ${mc.name}${mcStage}${antaInfo}`);
    }

    if (supports.length > 0) {
      const supportLine = supports.slice(0, 3).map((c) => {
        const stage = c.currentStage ? ` (${quickTruncate(c.currentStage, 20)})` : '';
        return `${c.name}${stage}`;
      }).join(', ');
      lines.push(`Hỗ trợ: ${supportLine}`);
    }
  }

  // Line 4: Chapter + scene type + strand
  const statusParts = [`Ch.${targetChapterIndex + 1}`];
  if (sceneType) {
    statusParts.push(`Scene: ${sceneType.primary}`);
    if (sceneType.secondary) statusParts.push(`+${sceneType.secondary}`);
  }
  const tracker = project.strandTracker;
  if (tracker?.history?.length) {
    const lastStrand = tracker.history[tracker.history.length - 1];
    if (lastStrand) statusParts.push(`Strand: ${lastStrand}`);
  }
  lines.push(statusParts.join(' | '));

  // Line 5: Logline (ultra-condensed, only if space)
  if (project.logline) {
    lines.push(`Logline: ${quickTruncate(project.logline, 100)}`);
  }

  // Assemble and enforce budget
  let text = lines.join('\n');
  if (text.length > IDENTITY_MAX_CHARS) {
    text = text.substring(0, IDENTITY_MAX_CHARS) + '…';
  }

  const tokenEstimate = estimateTokens(text);

  return {
    text,
    tokenEstimate,
    sceneTag: sceneType?.primary ?? null,
  };
}

/**
 * [Domain:ContextSelection] Build the minimal wake-up block for non-writing AI calls
 * (e.g., Plot QA, summarization). Even cheaper at ~50-80 tokens.
 */
export function buildMinimalIdentityBlock(project: Project): string {
  const parts = [project.title || 'Untitled'];
  if (project.genre) parts.push(project.genre);

  const mc = (project.characters || []).find(
    (c) => c.role === 'protagonist' || c.role === 'mc'
  );
  if (mc) parts.push(`MC: ${mc.name}`);

  const totalChapters = project.chapters?.length ?? 0;
  if (totalChapters > 0) parts.push(`${totalChapters} chương`);

  return `[L0] ${parts.join(' | ')}`;
}
