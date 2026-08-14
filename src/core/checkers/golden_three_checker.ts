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
 * Domain Map Ref: GOLDEN-THREE-v2-CONTEXTUAL
 */

import type { CheckerReport } from './checker_types';
import type { GenreProfile } from '../../types/genre_profile';

const SYSTEM_PROMPT = `Bạn là chuyên gia đánh giá "Tam Giác Vàng" (Golden Three) cho tiểu thuyết mạng.
Golden Three là BỘ CÔNG CỤ retention, không phải checklist bắt buộc trong mọi chương.

1. HOOK: yếu tố tạo lực kéo đọc tiếp. Có thể mạnh, nhẹ hoặc không cần nếu chương kết tự nhiên và vẫn có momentum.
2. COOLPOINT: khoảnh khắc thỏa mãn. Không phải chương nào cũng cần; chương lắng, chuyển tiếp, xây quan hệ hoặc setup có thể không có.
3. MICROPAYOFF: phần thưởng/tiến triển nhỏ. Có thể là thông tin, quan hệ, quyết định, cảm xúc, tiến độ mục tiêu; không cần ép thành clue hay power-up.

NGUYÊN TẮC:
- Đánh giá mức độ PHÙ HỢP với chức năng chương, không chấm theo quota máy móc.
- Không coi thiếu hook/cliffhanger, coolpoint hoặc mystery clue là lỗi chỉ vì chúng vắng mặt.
- Không đề xuất thêm twist, nguy hiểm, bí ẩn, power-up, treasure, world expansion hay foreshadowing nếu nội dung hiện tại không cần.
- Nếu retention yếu, ưu tiên sửa nhịp, làm rõ stakes/decision/progress từ vật liệu đã có trước khi nghĩ đến plot device mới.
- Quiet ending hợp lệ. Atmospheric detail không phải manh mối mặc định.

LUÔN trả về JSON hợp lệ. Không giải thích. Không markdown code blocks.`;

export function buildGoldenThreeCheckerPrompt(
  chapterText: string,
  chapterNumber: number,
  genreProfile?: GenreProfile,
): { system: string; user: string } {
  const genreContext = genreProfile
    ? `\nThể loại: ${genreProfile.name}\nHook guideline allowance: ${genreProfile.hookConfig?.transitionAllowance ?? 1}\nCoolpoint guideline interval: khoảng ${genreProfile.coolPointConfig?.comboInterval ?? 3} chương. Các số này là guideline, không phải luật bắt buộc.`
    : '';

  const userPrompt = `Phân tích chương ${chapterNumber} theo Golden Three theo hướng BỐI CẢNH, không checklist:
${genreContext}

Nội dung chương:
---
${chapterText}
---

Đánh giá từng yếu tố và trả về JSON:
{
  "agent": "golden_three",
  "chapter": ${chapterNumber},
  "overall_score": 82,
  "pass": true,
  "issues": [],
  "metrics": {
    "hooks_found": [],
    "hooks_count": 0,
    "hooks_score": 70,
    "coolpoints_found": [],
    "coolpoints_count": 0,
    "coolpoints_score": 70,
    "micropayoffs_found": [{ "type": "relationship_shift", "location": "giữa chương", "strength": 6 }],
    "micropayoffs_count": 1,
    "micropayoffs_score": 75,
    "golden_triangle_balance": "good",
    "retention_prediction": "medium"
  },
  "summary": "Chương không dùng hook/coolpoint rõ nhưng vẫn phù hợp nhờ tiến triển quan hệ và kết cảnh tự nhiên."
}

golden_triangle_balance: "excellent" | "good" | "weak" | "broken"
retention_prediction: "high" | "medium" | "low"

Chỉ tạo issue khi có vấn đề reader-pull thực sự. Không tạo issue kiểu "thiếu Hook cuối chương" nếu chương vẫn hoàn thành chức năng và có động lượng tự nhiên.`;

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