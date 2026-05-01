/**
 * File: template_extractor.ts
 * Purpose: Chiết xuất StoryTemplate từ bản thảo tải lên — "Reverse Engineer Template"
 * Layer: Application (AI)
 * Domain: StoryTemplate ← Adaptation
 * Deps: types/story_template, lib/ai/tracked_ai_client, lib/ai/model_router, store/use_ai_store
 *
 * Pipeline (3 lượt AI tuần tự):
 *   Phase 1 (World & System):  Bóc tách thế giới quan, hệ thống sức mạnh, entity types
 *   Phase 2 (Pattern Mining):  Bóc tách sảng điểm, xung đột, pitfalls, bestPractices
 *   Phase 3 (Structure):       Bóc tách cấu trúc arc/outline
 *
 * Giới hạn: Lấy mẫu tối đa 30k chars (đầu + giữa + cuối) để tránh overflow token.
 * Chi phí ước tính: 3 lần gọi × ~10k tokens = ~30k input tokens (~$0.05–0.10 với model nhỏ).
 */

import type { StoryTemplate } from '../../types/story_template';
import { callAiModelTracked } from './tracked_ai_client';
import { useAiStore } from '../../store/use_ai_store';
import { getModelForTask } from './model_router';

// ─── Public Types ─────────────────────────────────────────────

export interface ExtractionProgress {
  /** Phase hiện tại (1-4). Phase 4 = compile/done */
  phase: 1 | 2 | 3 | 4;
  label: string;
  done: boolean;
}

export type ExtractionProgressCallback = (progress: ExtractionProgress) => void;

// ─── Text Sampling ────────────────────────────────────────────

/**
 * Lấy mẫu đại diện từ văn bản dài (tối đa maxChars chars).
 * Lấy 1/3 đầu (world setup) + 1/3 giữa (arc cao trào) + 1/3 cuối (kết cục).
 */
function sampleText(text: string, maxChars = 30000): string {
  if (text.length <= maxChars) return text;

  const third = Math.floor(maxChars / 3);
  const head = text.slice(0, third);
  const midStart = Math.floor(text.length / 2) - Math.floor(third / 2);
  const mid = text.slice(midStart, midStart + third);
  const tail = text.slice(-third);

  return [
    '=== PHẦN ĐẦU (setup/world-building) ===\n',
    head,
    '\n\n=== PHẦN GIỮA (arc cao trào) ===\n',
    mid,
    '\n\n=== PHẦN CUỐI (kết cục arc) ===\n',
    tail,
  ].join('');
}

// ─── System Prompt ────────────────────────────────────────────

const EXTRACTION_SYSTEM = `Bạn là chuyên gia phân tích cấu trúc tiểu thuyết mạng.
Nhiệm vụ: Bóc tách CÔNG THỨC (pattern) và CẤU TRÚC CHUNG có thể tái sử dụng để viết truyện MỚI cùng thể loại.
KHÔNG phân tích nội dung hay nhân vật cụ thể của tác phẩm đã cho.
LUÔN trả về JSON thuần túy hợp lệ. Không markdown. Không giải thích ngoài JSON.`;

// ─── Prompt Builders ─────────────────────────────────────────

function buildPhase1Prompt(sample: string): string {
  return `Đọc đoạn trích sau và bóc tách KHUNG THẾ GIỚI QUAN & HỆ THỐNG chung của thể loại (không phải nội dung cụ thể).

VĂN BẢN:
${sample}

Trả về JSON:
{
  "genre": "tên thể loại tiếng Việt",
  "coreSellingPoint": "1-2 câu: tại sao đọc thể loại này hứng thú / điểm bán hàng cốt lõi?",
  "tags": ["tag1", "tag2", "tag3"],
  "worldRules": [
    {"name": "tên quy tắc vũ trụ", "description": "mô tả cách quy tắc vận hành trong thể loại này"}
  ],
  "powerSystem": {
    "name": "tên hệ thống sức mạnh / tu luyện",
    "tiers": [
      {"name": "cấp bậc thấp nhất", "description": "đặc điểm năng lực"},
      {"name": "cấp bậc trung gian", "description": "đặc điểm năng lực"},
      {"name": "cấp bậc cao nhất", "description": "đặc điểm năng lực"}
    ]
  },
  "entityTags": [
    {"type": "loai_entity_slug", "nameVi": "Tên tiếng Việt", "attributes": ["thuộc tính đặc trưng 1", "thuộc tính 2"]}
  ]
}`;
}

function buildPhase2Prompt(sample: string): string {
  return `Đọc đoạn trích và tìm ra CÔNG THỨC SẢNG ĐIỂM và PITFALLS của thể loại.

VĂN BẢN:
${sample}

Trả về JSON:
{
  "coolPatterns": [
    {
      "name": "Tên mẫu ngắn (VD: Bị khinh bỉ → Vả mặt công khai)",
      "scenario": "Tình huống xảy ra khi nào trong cốt truyện",
      "appeal": "Tại sao người đọc cảm thấy sảng / hứng khởi khi đọc cảnh này"
    }
  ],
  "conflictPatterns": [
    {
      "type": "Loại xung đột đặc trưng",
      "source": "Nguồn gốc / nguyên nhân xung đột",
      "resolution": "Cách giải quyết đặc trưng của thể loại"
    }
  ],
  "pitfalls": [
    {
      "description": "Lỗi phổ biến cần tránh khi viết thể loại này",
      "severity": "critical"
    },
    {
      "description": "Lỗi ảnh hưởng đến chất lượng",
      "severity": "warning"
    }
  ],
  "bestPractices": [
    {"description": "Thực hành tốt / bí quyết viết thể loại này hiệu quả"}
  ]
}`;
}

function buildPhase3Prompt(sample: string): string {
  return `Đọc đoạn trích và phân tích CẤU TRÚC NHỊP TRUYỆN — xác định các arc/quyển lớn.

VĂN BẢN:
${sample}

Trả về JSON:
{
  "outlineArcs": [
    {
      "title": "Quyển 1: [Tên mô tả nội dung arc]",
      "chapterRange": "1-80",
      "coreFocus": "Chủ đề trọng tâm / mục tiêu của arc này",
      "coreConflict": "Xung đột chính cần giải quyết trong arc",
      "climax": "Đỉnh cao / bước ngoặt quyết định của arc"
    }
  ]
}`;
}

// ─── JSON Parser ──────────────────────────────────────────────

function parseJsonSafe<T>(text: string, fallback: T): T {
  try {
    const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    return JSON.parse(match[0]) as T;
  } catch {
    return fallback;
  }
}

// ─── Model Resolution ─────────────────────────────────────────

function resolveExtractionModel(): { provider: string; modelId: string; modelName: string } {
  const aiState = useAiStore.getState();
  const model = getModelForTask('extract_metadata', aiState.models, {}, aiState.activeModelId, aiState.taskModelOverrides);

  return {
    provider: model?.provider ?? 'gemini',
    modelId: model?.modelId ?? 'gemini-2.0-flash',
    modelName: model?.name ?? 'Gemini Flash',
  };
}

// ─── Main Extractor ───────────────────────────────────────────

/**
 * Chiết xuất StoryTemplate từ văn bản tải lên.
 * Chạy 3 lượt AI để bóc tách: World, Patterns, Structure.
 *
 * @param text       Văn bản bản thảo đầy đủ
 * @param title      Tên tác phẩm gốc (để đặt tên template)
 * @param onProgress Callback cập nhật tiến trình cho UI
 */
export async function extractTemplateFromText(
  text: string,
  title: string,
  onProgress?: ExtractionProgressCallback,
): Promise<StoryTemplate> {
  const sample = sampleText(text, 30000);
  const templateId = `custom_${Date.now()}`;
  const { provider, modelId, modelName } = resolveExtractionModel();

  // ─── Phase 1: World & System ─────────────────────────────
  onProgress?.({ phase: 1, label: 'Phân tích thế giới quan và hệ thống sức mạnh...', done: false });

  const phase1Text = await callAiModelTracked({
    provider,
    modelId,
    modelName,
    systemPrompt: EXTRACTION_SYSTEM,
    userPrompt: buildPhase1Prompt(sample),
    taskType: 'extract_metadata',
    skipCache: true,
  });

  const phase1 = parseJsonSafe<{
    genre?: string;
    coreSellingPoint?: string;
    tags?: string[];
    worldRules?: Array<{ name: string; description: string }>;
    powerSystem?: { name: string; tiers: Array<{ name: string; description: string }> };
    entityTags?: Array<{ type: string; nameVi: string; attributes: string[] }>;
  }>(phase1Text, {});

  onProgress?.({ phase: 1, label: 'Hoàn thành phân tích thế giới quan.', done: true });

  // ─── Phase 2: Patterns & Pitfalls ────────────────────────
  onProgress?.({ phase: 2, label: 'Bóc tách sảng điểm, xung đột và pitfalls...', done: false });

  const phase2Text = await callAiModelTracked({
    provider,
    modelId,
    modelName,
    systemPrompt: EXTRACTION_SYSTEM,
    userPrompt: buildPhase2Prompt(sample),
    taskType: 'extract_metadata',
    skipCache: true,
  });

  const phase2 = parseJsonSafe<{
    coolPatterns?: Array<{ name: string; scenario: string; appeal: string }>;
    conflictPatterns?: Array<{ type: string; source: string; resolution: string }>;
    pitfalls?: Array<{ description: string; severity: 'critical' | 'warning' | 'info' }>;
    bestPractices?: Array<{ description: string }>;
  }>(phase2Text, {});

  onProgress?.({ phase: 2, label: 'Hoàn thành bóc tách công thức sảng.', done: true });

  // ─── Phase 3: Outline Structure ──────────────────────────
  onProgress?.({ phase: 3, label: 'Phân tích cấu trúc arc và dàn ý...', done: false });

  const phase3Text = await callAiModelTracked({
    provider,
    modelId,
    modelName,
    systemPrompt: EXTRACTION_SYSTEM,
    userPrompt: buildPhase3Prompt(sample),
    taskType: 'extract_metadata',
    skipCache: true,
  });

  const phase3 = parseJsonSafe<{
    outlineArcs?: Array<{
      title: string;
      chapterRange: string;
      coreFocus: string;
      coreConflict: string;
      climax: string;
    }>;
  }>(phase3Text, {});

  onProgress?.({ phase: 3, label: 'Hoàn thành phân tích cấu trúc.', done: true });

  // ─── Phase 4: Compile StoryTemplate ──────────────────────
  onProgress?.({ phase: 4, label: 'Đang tổng hợp template...', done: false });

  const arcCount = phase3.outlineArcs?.length ?? 0;

  const template: StoryTemplate = {
    id: templateId,
    name: `[Trích xuất] ${title}`,
    originalName: title,
    coreSellingPoint: phase1.coreSellingPoint ?? `Công thức chiết xuất từ "${title}"`,
    tags: [...(phase1.tags ?? []), 'custom', 'extracted'],

    subGenres: [
      {
        name: phase1.genre ?? 'Tùy chỉnh',
        description: phase1.coreSellingPoint ?? '',
        coreAppeal: phase1.coreSellingPoint ?? '',
        referenceWorks: [title],
      },
    ],

    worldRules: phase1.worldRules ?? [],

    powerSystem: phase1.powerSystem,

    coolPatterns: (phase2.coolPatterns ?? []).map((p) => ({
      name: p.name,
      scenario: p.scenario,
      appeal: p.appeal,
    })),

    conflictPatterns: phase2.conflictPatterns ?? [],

    outlineArcs: arcCount > 0
      ? (phase3.outlineArcs ?? []).map((arc) => ({
          title: arc.title,
          chapterRange: arc.chapterRange,
          coreFocus: arc.coreFocus,
          coreConflict: arc.coreConflict,
          climax: arc.climax,
          percentageOfTotal: Math.round(100 / arcCount),
        }))
      : [
          { title: 'Quyển 1: Khởi đầu', chapterRange: '1-80', coreFocus: 'Giới thiệu thế giới và nhân vật chính.', coreConflict: 'Xung đột đầu tiên — thử thách tồn tại.', climax: 'Bước ngoặt đầu tiên.', percentageOfTotal: 33 },
          { title: 'Quyển 2: Phát triển', chapterRange: '81-200', coreFocus: 'Mở rộng phạm vi, tích lũy sức mạnh.', coreConflict: 'Xung đột leo thang.', climax: 'Đỉnh cao arc giữa.', percentageOfTotal: 34 },
          { title: 'Quyển 3: Kết', chapterRange: '201-350', coreFocus: 'Đối đầu cuối cùng, giải quyết mọi mầm mối.', coreConflict: 'Boss cuối.', climax: 'Viên mãn.', percentageOfTotal: 33 },
        ],

    pitfalls: (phase2.pitfalls ?? []).length > 0
      ? (phase2.pitfalls ?? [])
      : [{ description: 'Tránh sao chép y nguyên nội dung gốc, chỉ áp dụng cấu trúc.', severity: 'critical' }],

    bestPractices: phase2.bestPractices ?? [],

    entityTags: phase1.entityTags ?? [],
  };

  onProgress?.({ phase: 4, label: 'Template đã sẵn sàng!', done: true });

  return template;
}
