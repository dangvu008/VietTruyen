/**
 * File: novel_polish.ts
 * Purpose: Prompt contract for the Novel Polish editor workflow
 * Layer: Application (AI)
 * Domain: AI -> [novel polishing, editing modes]
 */

export type NovelPolishModeId =
  | 'comprehensive'
  | 'find_errors'
  | 'remove_ai_tone'
  | 'enhance_details'
  | 'optimize_dialogue';

export type NovelPolishOutputKind = 'rewrite' | 'report';

export interface NovelPolishMode {
  id: NovelPolishModeId;
  label: string;
  description: string;
  instruction: string;
  outputKind: NovelPolishOutputKind;
}

export interface NovelPolishInstructionInput {
  mode: NovelPolishModeId;
  rawText: string;
}

export const NOVEL_POLISH_MODES: NovelPolishMode[] = [
  {
    id: 'comprehensive',
    label: 'Toàn diện',
    description: 'Trau chuốt toàn diện.',
    instruction:
      'Trau chuốt toàn diện: sửa nhịp câu, lựa chọn từ, cảm xúc, logic đoạn, giọng kể và độ mượt khi đọc.',
    outputKind: 'rewrite',
  },
  {
    id: 'find_errors',
    label: 'Tìm lỗi',
    description: 'Tìm lỗi chính tả, ngữ pháp, logic.',
    instruction:
      'Chỉ liệt kê lỗi chính tả, ngữ pháp, dùng từ, mạch logic và continuity. Với mỗi lỗi, nêu vị trí gần đúng, lý do và gợi ý sửa ngắn.',
    outputKind: 'report',
  },
  {
    id: 'remove_ai_tone',
    label: 'Giảm giọng AI',
    description: 'Làm cho câu chữ tự nhiên và giống người viết hơn.',
    instruction:
      'Loại bỏ văn AI: giảm sáo ngữ, giảm tổng kết lộ liễu, bỏ nhịp câu đều đều, tăng chi tiết cụ thể và lựa chọn từ tự nhiên.',
    outputKind: 'rewrite',
  },
  {
    id: 'enhance_details',
    label: 'Tăng chi tiết',
    description: 'Phóng to các chi tiết miêu tả cảm quan, bối cảnh.',
    instruction:
      'Phóng to các chi tiết miêu tả cảm quan, bối cảnh, chuyển động nhỏ và phản ứng thân thể mà không làm lệch sự kiện chính.',
    outputKind: 'rewrite',
  },
  {
    id: 'optimize_dialogue',
    label: 'Tối ưu lời thoại',
    description: 'Làm mượt mà và cá nhân hóa lời thoại.',
    instruction:
      'Tối ưu lời thoại: làm câu thoại tự nhiên, cá nhân hóa theo thái độ nhân vật, thêm nhịp ngắt và hành động xen kẽ khi cần.',
    outputKind: 'rewrite',
  },
];

const modeById = new Map(NOVEL_POLISH_MODES.map((mode) => [mode.id, mode]));

export function getNovelPolishMode(modeId: NovelPolishModeId): NovelPolishMode {
  const mode = modeById.get(modeId);
  if (!mode) {
    throw new Error(`Unknown novel polish mode: ${modeId}`);
  }
  return mode;
}

export function buildNovelPolishInstruction(input: NovelPolishInstructionInput): string {
  const mode = getNovelPolishMode(input.mode);
  const rawText = input.rawText.trim();

  const outputRule = mode.outputKind === 'report'
    ? 'Đầu ra: liệt kê lỗi theo bullet rõ ràng; không viết lại toàn bộ trừ khi cần đưa ví dụ sửa ngắn.'
    : 'Đầu ra: chỉ trả về phiên bản đã trau chuốt; giữ nguyên sự kiện, góc nhìn, nhân vật và ý chính.';

  return [
    'Bạn là biên tập viên tiểu thuyết chuyên nghiệp.',
    `Chế độ: ${mode.label}`,
    `Mục tiêu: ${mode.description}`,
    `Chỉ dẫn: ${mode.instruction}`,
    outputRule,
    'Không thêm giải thích ngoài phần đầu ra cần thiết.',
    '',
    'Văn bản thô:',
    '"""',
    rawText,
    '"""',
  ].join('\n');
}
