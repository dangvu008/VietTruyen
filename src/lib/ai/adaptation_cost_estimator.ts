/**
 * File: adaptation_cost_estimator.ts
 * Purpose: Ước tính chi phí token cho các tác vụ phóng tác TRƯỚC khi user bấm tạo
 * Layer: Application (AI)
 * Domain: Adaptation → [cost estimation, task classification]
 *
 * Data Contract:
 * - Input:  AdaptationType, source project/text info, model settings
 * - Output: CostEstimate với breakdown từng task (AI vs non-AI)
 *
 * Quy tắc: Các tác vụ như sửa tên, lỗi chính tả, thay từ ngữ KHÔNG cần AI.
 * Chỉ rewrite nội dung (arc summary, chapter content) mới cần AI.
 */
import type { AdaptationType } from '../../types/adaptation';
import type { Project } from '../../types/story';
import { estimateTokens, estimateCost } from './token_estimator';
import { COST_PER_1M_INPUT, COST_PER_1M_OUTPUT } from '../../types/token_tracker';

/* ─── Types ─── */

export interface TaskCostItem {
  name: string;
  requiresAi: boolean;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
  note?: string;
}

export interface CostEstimate {
  tasks: TaskCostItem[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  aiTaskCount: number;
  freeTaskCount: number;
  modelId: string;
  modelName: string;
  tips: CostSavingTip[];
}

export interface CostSavingTip {
  action: string;
  description: string;
  icon: 'replace' | 'spell' | 'rename' | 'info';
}

/* ─── Constants ─── */

/** Output thường chiếm ~75% input khi rewrite (giữ nội dung tương đương) */
const OUTPUT_RATIO_REWRITE = 0.75;

/** Overhead token cho system prompt + instructions của một rewrite call */
const REWRITE_PROMPT_OVERHEAD_TOKENS = 350;

/** Token trung bình cho arc summary rewrite (summary + premise + climax + task instructions) */
const ARC_CONTEXT_OVERHEAD_TOKENS = 500;

/* ─── Main Estimator ─── */

export function estimateAdaptationCost(params: {
  adaptationType: AdaptationType;
  source?: Project | null;
  uploadText?: string;
  uploadIsSummary?: boolean;
  modelId: string;
  modelName: string;
}): CostEstimate {
  const { adaptationType, source, uploadText, modelId, modelName } = params;
  const costTable = { input: COST_PER_1M_INPUT, output: COST_PER_1M_OUTPUT };

  const tasks: TaskCostItem[] = [];
  const tips: CostSavingTip[] = buildDefaultTips();

  // ─── Step 1: Import / Copy tasks (always free) ───
  if (uploadText) {
    tasks.push({
      name: 'Import & chia chương từ văn bản',
      requiresAi: false,
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      estimatedCost: 0,
      note: 'Tự động chia chương bằng regex, không dùng AI',
    });
  } else if (source) {
    tasks.push({
      name: 'Copy dữ liệu từ dự án gốc',
      requiresAi: false,
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      estimatedCost: 0,
      note: 'Clone nhân vật, thế giới quan, dàn ý — miễn phí',
    });
  }

  // ─── Step 2: Mode-specific AI tasks ───
  if (adaptationType === 'surgery') {
    addSurgeryTasks(tasks, source, uploadText, modelId, costTable);
  } else {
    // reskin, what-if, new-pov, era-shift, custom: bước tạo dự án không cần AI
    tasks.push({
      name: 'Tạo dự án phóng tác',
      requiresAi: false,
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      estimatedCost: 0,
      note: 'AI chỉ dùng khi bạn viết/rewrite chương sau',
    });

    // Thêm ước tính cho bước sau (viết chương) để user biết trước
    const chapterCount = source?.chapters.length || estimateChapterCount(uploadText);
    if (chapterCount > 0) {
      const avgChapterTokens = getAverageChapterTokens(source, uploadText, chapterCount);
      const perChapterInput = avgChapterTokens + REWRITE_PROMPT_OVERHEAD_TOKENS;
      const perChapterOutput = Math.ceil(avgChapterTokens * OUTPUT_RATIO_REWRITE);
      const totalInput = perChapterInput * chapterCount;
      const totalOutput = perChapterOutput * chapterCount;

      tasks.push({
        name: `⏱ Nếu rewrite ${chapterCount} chương (tham khảo)`,
        requiresAi: true,
        estimatedInputTokens: totalInput,
        estimatedOutputTokens: totalOutput,
        estimatedCost: estimateCost(totalInput, totalOutput, modelId, costTable),
        note: 'Chi phí chỉ phát sinh khi bạn chọn viết lại chương bằng AI',
      });
    }
  }

  // ─── Aggregate ───
  let totalInput = 0, totalOutput = 0, totalCost = 0;
  let aiCount = 0, freeCount = 0;

  for (const task of tasks) {
    totalInput += task.estimatedInputTokens;
    totalOutput += task.estimatedOutputTokens;
    totalCost += task.estimatedCost;
    if (task.requiresAi) aiCount++;
    else freeCount++;
  }

  return {
    tasks,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    totalCost,
    aiTaskCount: aiCount,
    freeTaskCount: freeCount,
    modelId,
    modelName,
    tips,
  };
}

/* ─── Surgery-specific tasks ─── */

function addSurgeryTasks(
  tasks: TaskCostItem[],
  source: Project | null | undefined,
  uploadText: string | undefined,
  modelId: string,
  costTable: { input: Record<string, number>; output: Record<string, number> }
): void {
  // Impact scan — free
  tasks.push({
    name: 'Impact scan (quét tác động)',
    requiresAi: false,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    estimatedCost: 0,
    note: 'Phân tích text-based, không dùng AI',
  });

  // Build index — free
  tasks.push({
    name: 'Build dependency index',
    requiresAi: false,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    estimatedCost: 0,
    note: 'Indexing cục bộ, không dùng AI',
  });

  // Freeze canon — free
  tasks.push({
    name: 'Freeze canon (đóng băng dữ liệu gốc)',
    requiresAi: false,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    estimatedCost: 0,
  });

  // ─── AI tasks: Rewrite ───
  const chapterCount = source?.chapters.length || estimateChapterCount(uploadText);
  const arcCount = source?.arcCount || Math.max(1, Math.ceil(chapterCount / 15));

  if (arcCount > 0) {
    const perArcInput = ARC_CONTEXT_OVERHEAD_TOKENS + REWRITE_PROMPT_OVERHEAD_TOKENS;
    const perArcOutput = Math.ceil(ARC_CONTEXT_OVERHEAD_TOKENS * OUTPUT_RATIO_REWRITE);
    const totalInput = perArcInput * arcCount;
    const totalOutput = perArcOutput * arcCount;

    tasks.push({
      name: `Rewrite ${arcCount} arc summary`,
      requiresAi: true,
      estimatedInputTokens: totalInput,
      estimatedOutputTokens: totalOutput,
      estimatedCost: estimateCost(totalInput, totalOutput, modelId, costTable),
      note: 'AI viết lại tóm tắt arc để khớp canon mới',
    });
  }

  if (chapterCount > 0) {
    const avgChapterTokens = getAverageChapterTokens(source, uploadText, chapterCount);
    const perChapterInput = avgChapterTokens + REWRITE_PROMPT_OVERHEAD_TOKENS;
    const perChapterOutput = Math.ceil(avgChapterTokens * OUTPUT_RATIO_REWRITE);
    const totalInput = perChapterInput * chapterCount;
    const totalOutput = perChapterOutput * chapterCount;

    tasks.push({
      name: `Rewrite ${chapterCount} chương`,
      requiresAi: true,
      estimatedInputTokens: totalInput,
      estimatedOutputTokens: totalOutput,
      estimatedCost: estimateCost(totalInput, totalOutput, modelId, costTable),
      note: 'AI viết lại nội dung chương để phù hợp thay đổi',
    });
  }
}

/* ─── Helpers ─── */

function estimateChapterCount(uploadText?: string): number {
  if (!uploadText) return 0;
  // Heuristic: 1 chương ≈ 5500 ký tự
  return Math.max(1, Math.ceil(uploadText.length / 5500));
}

function getAverageChapterTokens(
  source: Project | null | undefined,
  uploadText: string | undefined,
  chapterCount: number
): number {
  if (source && source.chapters.length > 0) {
    // Sample đầu, giữa, cuối để estimate trung bình
    const chapters = source.chapters;
    const samples = [
      chapters[0],
      chapters[Math.floor(chapters.length / 2)],
      chapters[chapters.length - 1],
    ].filter(Boolean);
    const totalTokens = samples.reduce((sum, ch) => sum + estimateTokens(ch.content), 0);
    return Math.ceil(totalTokens / samples.length);
  }

  if (uploadText) {
    const totalTokens = estimateTokens(uploadText);
    return Math.ceil(totalTokens / chapterCount);
  }

  return 1500; // Fallback: ~5000 chars / 3.5 ≈ 1500 tokens
}

function buildDefaultTips(): CostSavingTip[] {
  return [
    {
      action: 'Sửa tên nhân vật hàng loạt',
      description: 'Dùng "Tìm & Thay thế" — không tốn token',
      icon: 'rename',
    },
    {
      action: 'Sửa lỗi chính tả',
      description: 'Tự động sửa bằng text processing — không tốn token',
      icon: 'spell',
    },
    {
      action: 'Thay đổi từ ngữ cụ thể',
      description: 'Dùng thay thế hàng loạt — không tốn token',
      icon: 'replace',
    },
  ];
}
