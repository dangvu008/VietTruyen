/**
 * File: ooc_checker.ts
 * Purpose: Checker Agent prompt builder & parser for Out-Of-Character (OOC) detection
 * Layer: Core/Domain
 * Domain: Checkers -> [ooc]
 */

import type { CheckerReport } from './checker_types';

export interface CharacterProfile {
  name: string;
  role: string;
  personality: string;
  speechPattern: string;
  coreValues: string;
  behavioralTendencies: string;
}

const SYSTEM_PROMPT = `Bạn là chuyên gia giám sát tính nhất quán nhân vật (OOC Checker) cho tiểu thuyết.
Nhiệm vụ: Phát hiện các hành vi, lời nói, hoặc quyết định đi ngược lại thiết lập nhân vật (OOC).
LUÔN trả về định dạng JSON hợp lệ, không giải thích, không dùng markdown code blocks (\`\`\`).`;

export function buildOocCheckerPrompt(
  chapterText: string,
  chapterNumber: number,
  characters: CharacterProfile[]
): { system: string; user: string } {
  const charactersContext = characters.map(c => `
- ${c.name} (${c.role}):
  + Tính cách: ${c.personality}
  + Cách nói chuyện: ${c.speechPattern}
  + Giá trị cốt lõi: ${c.coreValues}
  + Khuynh hướng hành vi: ${c.behavioralTendencies}`).join('\n');

  const userPrompt = `Phân tích chương ${chapterNumber} để tìm các lỗi OOC (Out-Of-Character) dựa trên hồ sơ nhân vật sau:
${charactersContext || '(Chưa có hồ sơ nhân vật cụ thể, hãy tự đánh giá tính logic nhất quán trong nội bộ chương)'}

Nội dung chương:
---
${chapterText}
---

Yêu cầu:
1. Đánh giá hành vi, lời nói của các nhân vật chính/phụ.
2. Phân loại lỗi OOC làm 3 cấp:
   - low (nhẹ): Hơi khác thường nhưng có thể giải thích được.
   - medium (vừa): Hành động bất nhất, thiếu trải đệm hoặc thiếu động cơ.
   - critical/high (nặng): Hoàn toàn trái ngược thiết lập (VD: kẻ thông minh đột nhiên ngu ngốc để nộp mạng).
3. Đừng nhầm lẫn giữa sự "Phát triển nhân vật" (Character Development - có lý do) và OOC (vô lý).
4. Trả về JSON theo đúng Schema sau (thay thế giá trị mẫu):

{
  "agent": "ooc",
  "chapter": ${chapterNumber},
  "overall_score": 80,
  "pass": false,
  "issues": [
    {
      "id": "ooc-1",
      "severity": "high",
      "description": "Phản diện A tự nhiên nói toàn lời đạo lý trượng nghĩa.",
      "suggestion": "Sửa lại hội thoại cho phù hợp với tính cách xảo trá của A.",
      "context_snippet": "đoạn thoại lỗi"
    }
  ],
  "metrics": {
    "characters_checked": ["A", "B"],
    "ooc_count_by_severity": { "low": 0, "medium": 0, "high": 1 }
  },
  "summary": "Nhân vật B giữ vững thiết lập, nhưng phản diện A bị OOC nặng ở cuối chương."
}
`;

  return {
    system: SYSTEM_PROMPT,
    user: userPrompt,
  };
}

export function parseOocReport(aiResponse: string): CheckerReport {
  try {
    let cleaned = aiResponse.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return JSON.parse(cleaned) as CheckerReport;
  } catch (err) {
    throw new Error('Failed to parse OOC Checker response');
  }
}
