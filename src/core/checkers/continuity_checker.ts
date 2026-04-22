/**
 * File: continuity_checker.ts
 * Purpose: Checker Agent prompt builder & parser for Flow/Continuity
 * Layer: Core/Domain
 * Domain: Checkers -> [continuity]
 */

import type { CheckerReport } from './checker_types';

const SYSTEM_PROMPT = `Bạn là biên tập viên rà soát mạch truyện (Continuity Checker).
Nhiệm vụ: Đảm bảo luồng sự kiện trôi chảy, chuyển cảnh mượt mà, không rớt phục bút (foreshadowing) và các nhánh truyện phụ không bị bỏ quên.
Trả về JSON hợp lệ, không giải thích, không dùng \`\`\` (code blocks).`;

export function buildContinuityCheckerPrompt(
  chapterText: string,
  chapterNumber: number,
  previousSummary: string,
  activeThreads: string[] // List of ongoing plot threads or unresolved setups
): { system: string; user: string } {
  const threadsContext = activeThreads.length 
    ? activeThreads.map(t => `- ${t}`).join('\n')
    : '(Không có tuyến truyện phụ hoặc phục bút nào đang mở)';

  const userPrompt = `Phân tích chương ${chapterNumber} đối chiếu với tóm tắt trước đó và tình trạng các phục bút.

Tóm tắt phần trước:
---
${previousSummary || '(Không có dữ liệu phần trước)'}
---

Các phục bút / Tuyến sự kiện đang cần giải quyết:
---
${threadsContext}
---

Nội dung chương:
---
${chapterText}
---

Yêu cầu kiểm tra:
1. Chuyển cảnh (Scene Transition): Việc di chuyển giữa các không gian/thời gian có đủ câu nối không? Hay bị giật cục?
2. Mạch truyện phụ (Sub-threads) & Phục bút (Foreshadowing): Có yếu tố nào bị lãng quên quá lâu dẫn đến hổng mạch không? (Nếu chương này có nhắc tới để thu hồi phục bút, hãy ghi nhận).
3. Độ trôi chảy (Logic flow): Sự kiện có theo nguyên nhân - kết quả không? Hay quá lan man câu chữ (Dragging)?

Trả về JSON:
{
  "agent": "continuity",
  "chapter": ${chapterNumber},
  "overall_score": 70,
  "pass": false,
  "issues": [
    {
      "id": "cont-1",
      "severity": "medium",
      "description": "Chuyển cảnh từ thành phố ra rừng núi quá đột ngột, thiếu mô tả quá trình.",
      "suggestion": "Thêm 1 đoạn văn mô tả thời gian di chuyển làm lớp đệm."
    }
  ],
  "metrics": {
    "abrupt_transitions": 1,
    "addressed_threads": 0,
    "drag_detected": false
  },
  "summary": "Mạch truyện đang tiến triển đúng hướng, nhưng bước chuyển cảnh cần mượt mà hơn để tránh gây đứt gãy cảm xúc."
}
`;

  return {
    system: SYSTEM_PROMPT,
    user: userPrompt,
  };
}

export function parseContinuityReport(aiResponse: string): CheckerReport {
  try {
    let cleaned = aiResponse.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return JSON.parse(cleaned) as CheckerReport;
  } catch (err) {
    throw new Error('Failed to parse Continuity Checker response');
  }
}
