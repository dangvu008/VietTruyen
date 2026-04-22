/**
 * File: high_point_checker.ts
 * Purpose: Checker Agent prompt builder & parser for high points (Sảng điểm)
 * Layer: Core/Domain
 * Domain: Checkers -> [high_point]
 */

import type { CheckerReport } from './checker_types';
import type { GenreProfile } from '../../types/genre_profile';

const SYSTEM_PROMPT = `Bạn là chuyên gia thiết kế Sảng điểm (High Point) tiểu thuyết mạng Việt Nam.
Nhiệm vụ: Phân tích đánh giá mật độ và chất lượng sảng điểm của chương truyện.
LUÔN trả về định dạng JSON hợp lệ, không giải thích, không dùng markdown code blocks (\`\`\`).`;

export function buildHighPointCheckerPrompt(
  chapterText: string,
  chapterNumber: number,
  genreProfile?: GenreProfile
): { system: string; user: string } {
  let genreContext = '';
  if (genreProfile) {
    genreContext = `
THÊ THỂ LOẠI: ${genreProfile.name}
Cấu hình sảng điểm kỳ vọng:
- Mật độ: ${genreProfile.coolPointConfig.densityPerChapter}
- Patterns ưu tiên: ${genreProfile.coolPointConfig.preferredPatterns.join(', ')}
`;
  }

  const userPrompt = `Phân tích chương ${chapterNumber} để tìm các Sảng điểm (High Point) dựa trên 8 mô típ chuẩn:
1. Trang bức vả mặt (flex_counter)
2. Cải trang giấu nghề (underdog_reveal)
3. Vượt cấp phản sát (underdog_victory)
4. Thách thức quyền uy (authority_challenge)
5. Phản diện lật xe (villain_downfall)
6. Ngọt ngào bất ngờ (sweet_surprise)
7. Hiểu lầm thăng hoa (misunderstanding_elevation)
8. Lộ thân phận (identity_reveal)

Nội dung chương:
---
${chapterText}
---
${genreContext}
Yêu cầu:
1. Xác định số lượng sảng điểm có trong chương.
2. Đánh giá chất lượng thực thi (có đủ trải đệm, có hợp lý, cảm xúc tốt không?).
3. Kiểm tra xem có quá phụ thuộc vào 1 loại sảng điểm không (>80%).
4. Trả về JSON theo đúng Schema sau (thay thế giá trị mẫu):

{
  "agent": "high_point",
  "chapter": ${chapterNumber},
  "overall_score": 85,
  "pass": true,
  "issues": [
    {
      "id": "hp-1",
      "severity": "medium",
      "description": "Sảng điểm vả mặt thiếu trải đệm.",
      "suggestion": "Thêm 1-2 đoạn mô tả sự khinh thường của nhân vật phụ trước khi nam chính ra tay.",
      "context_snippet": "đoạn text nếu có"
    }
  ],
  "metrics": {
    "cool_point_count": 2,
    "cool_point_types": ["flex_counter", "identity_reveal"],
    "density_score": 8,
    "type_diversity": 0.5
  },
  "summary": "Chương có mật độ sảng điểm tốt, chất lượng thực thi đạt yêu cầu."
}
`;

  return {
    system: SYSTEM_PROMPT,
    user: userPrompt,
  };
}

export function parseHighPointReport(aiResponse: string): CheckerReport {
  try {
    let cleaned = aiResponse.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return JSON.parse(cleaned) as CheckerReport;
  } catch (err) {
    throw new Error('Failed to parse High Point Checker response');
  }
}
