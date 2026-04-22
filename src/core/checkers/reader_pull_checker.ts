/**
 * File: reader_pull_checker.ts
 * Purpose: Checker Agent prompt builder & parser for Reader Pull (Sức hút theo dõi)
 * Layer: Core/Domain
 * Domain: Checkers -> [reader_pull]
 */

import type { CheckerReport } from './checker_types';
import type { GenreProfile } from '../../types/genre_profile';

const SYSTEM_PROMPT = `Bạn là chuyên gia về Sức hút theo dõi (Reader Pull) của truyện chữ.
Nhiệm vụ: Phân tích các yếu tố giữ chân độc giả như Hook (câu nhử) và Micro-payoff (vi phần thưởng).
Cung cấp JSON hợp lệ, không giải thích, không dùng \`\`\` (code blocks).`;

export function buildReaderPullCheckerPrompt(
  chapterText: string,
  chapterNumber: number,
  genreProfile?: GenreProfile
): { system: string; user: string } {
  let genreContext = '';
  if (genreProfile) {
    genreContext = `
Dữ liệu Thể loại (${genreProfile.name}):
- Số Micro-payoff tối thiểu/chương: ${genreProfile.microPayoffConfig.minPerChapter}
- Mức độ chấp nhận chuyển tiếp: Chương này có thể hạ chuẩn nếu tính nhịp độ của thể loại cho phép.
`;
  }

  const userPrompt = `Phân tích chương ${chapterNumber} để đánh giá "Lực giữ chân độc giả" (Reader Pull).

Các yếu tố cần kiểm tra:
1. Hook (Câu nhử) cuối chương: Có không? Thuộc loại nào (Crisis, Mystery, Emotion, Choice, Desire)? Cường độ (weak, medium, strong)? 
2. Micro-payoff (Vi phần thưởng) trong chương: Số lượng bao nhiêu? Gồm những loại nào (Thông tin, Quan hệ, Điểm kỹ năng, Tài nguyên, Cảm xúc...)?
3. Phân biệt Hard Violations (Lỗi nghiêm trọng) và Soft Suggestions (Lỗi nhẹ/Đề xuất).
   - Hard: Đọc không hiểu gì, mất phương hướng hoàn toàn, cốt truyện ngưng trệ vô lý.
   - Soft: Hook yếu, Micro-payoff không đạt chỉ tiêu thể loại.

Nội dung chương:
---
${chapterText}
---
${genreContext}

Yêu cầu trả về JSON có định dạng sau:
{
  "agent": "reader_pull",
  "chapter": ${chapterNumber},
  "overall_score": 88,
  "pass": true,
  "issues": [
    {
      "id": "rp-1",
      "severity": "high",
      "description": "Không có câu nhử chuyển bộ ở cuối chương.",
      "suggestion": "Bổ sung một tình huống đe dọa hoặc một câu hỏi chưa lời đáp ở câu cuối."
    }
  ],
  "metrics": {
    "hook_present": true,
    "hook_type": "Crisis Hook",
    "hook_strength": "medium",
    "micropayoffs": ["Tài nguyên", "Thông tin"],
    "micropayoff_count": 2,
    "next_chapter_reason": "Độc giả muốn xem nam chính giải quyết khủng hoảng thế nào"
  },
  "summary": "Chương có sức hút khá tốt nhờ 2 khoản micropayoff rải rác nhưng hook cuối còn hơi yếu."
}
`;

  return {
    system: SYSTEM_PROMPT,
    user: userPrompt,
  };
}

export function parseReaderPullReport(aiResponse: string): CheckerReport {
  try {
    let cleaned = aiResponse.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return JSON.parse(cleaned) as CheckerReport;
  } catch (err) {
    throw new Error('Failed to parse Reader Pull Checker response');
  }
}
