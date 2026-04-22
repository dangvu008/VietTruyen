/**
 * File: golden_three_checker.ts
 * Purpose: Integrated "Tam Giác Vàng" checker — evaluates Hook + Coolpoint + Micropayoff together
 * Layer: Core/Domain
 * Domain: Checkers → [golden_three / reading_power integration]
 *
 * Data Contract:
 * - Input:  Chapter text + genre profile + chapter number
 * - Output: CheckerReport with golden_three metrics
 * - Consumer: run_all_checkers.ts → chapter review flows
 *
 * Flow: Build prompt with reading_power taxonomy → AI evaluates → Parse JSON → Return
 * Refusal rule: Chapter < 200 chars → skip
 * Domain Map Ref: GOLDEN-THREE-v1
 */

import type { CheckerReport } from './checker_types';
import type { GenreProfile } from '../../types/genre_profile';

const SYSTEM_PROMPT = `Bạn là chuyên gia đánh giá "Tam Giác Vàng" (Golden Three) cho tiểu thuyết mạng.
Tam Giác Vàng gồm 3 yếu tố bắt buộc trong MỖI chương:

1. HOOK (钩子): Yếu tố kéo đọc giả đọc tiếp. Các loại:
   - question_hook: Câu hỏi chưa được trả lời
   - danger_hook: Nhân vật đang trong nguy hiểm
   - revelation_hook: Sắp lộ bí mật lớn
   - emotional_hook: Đỉnh điểm cảm xúc
   - reversal_hook: Tình thế đảo ngược

2. COOLPOINT (爽点): Khoảnh khắc thỏa mãn đọc giả. Các mô thức:
   - face_slap: Tát mặt kẻ coi thường
   - level_up: Nâng cấp, đột phá
   - treasure: Phát hiện kho báu, bí kíp
   - revenge: Báo thù thành công
   - recognition: Được thừa nhận thực lực

3. MICROPAYOFF (微兑现): Phần thưởng nhỏ xuyên suốt để duy trì retention:
   - skill_reveal: Lộ kỹ năng/bài mới
   - mystery_clue: Manh mối bí ẩn
   - relationship_shift: Thay đổi quan hệ
   - world_expansion: Mở rộng thế giới quan
   - foreshadow_payoff: Thu hoạch mầm mối đã gieo

LUÔN trả về JSON hợp lệ. Không giải thích. Không markdown code blocks.`;

export function buildGoldenThreeCheckerPrompt(
  chapterText: string,
  chapterNumber: number,
  genreProfile?: GenreProfile,
): { system: string; user: string } {
  const genreContext = genreProfile
    ? `\nThể loại: ${genreProfile.name}\nYêu cầu Hook: mỗi chương (allowance: ${genreProfile.hookConfig?.transitionAllowance ?? 1})\nYêu cầu Coolpoint: mỗi ${genreProfile.coolPointConfig?.comboInterval ?? 3} chương`
    : '';

  const userPrompt = `Phân tích chương ${chapterNumber} theo Tam Giác Vàng:
${genreContext}

Nội dung chương:
---
${chapterText}
---

Đánh giá từng yếu tố và trả về JSON:
{
  "agent": "golden_three",
  "chapter": ${chapterNumber},
  "overall_score": 75,
  "pass": true,
  "issues": [
    {
      "id": "gt-1",
      "severity": "high",
      "description": "Thiếu Hook cuối chương — không có lý do để đọc tiếp",
      "suggestion": "Thêm question_hook hoặc danger_hook ở 2 đoạn cuối"
    }
  ],
  "metrics": {
    "hooks_found": [{ "type": "question_hook", "location": "cuối chương", "strength": 8 }],
    "hooks_count": 1,
    "hooks_score": 80,
    "coolpoints_found": [{ "type": "level_up", "location": "giữa chương", "strength": 7 }],
    "coolpoints_count": 1,
    "coolpoints_score": 70,
    "micropayoffs_found": [{ "type": "skill_reveal", "location": "đầu chương", "strength": 6 }],
    "micropayoffs_count": 1,
    "micropayoffs_score": 65,
    "golden_triangle_balance": "good",
    "retention_prediction": "medium"
  },
  "summary": "Chương có coolpoint tốt nhưng hook cuối yếu, cần cải thiện."
}

golden_triangle_balance: "excellent" | "good" | "weak" | "broken"
retention_prediction: "high" | "medium" | "low"`;

  return { system: SYSTEM_PROMPT, user: userPrompt };
}

export function parseGoldenThreeReport(aiResponse: string): CheckerReport {
  try {
    let cleaned = aiResponse.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return JSON.parse(cleaned) as CheckerReport;
  } catch {
    throw new Error('Failed to parse Golden Three Checker response');
  }
}
