/**
 * File: consistency_checker.ts
 * Purpose: Checker Agent prompt builder & parser for World/Power Consistency
 * Layer: Core/Domain
 * Domain: Checkers -> [consistency]
 */

import type { CheckerReport } from './checker_types';

const SYSTEM_PROMPT = `Bạn là biên tập viên kiểm soát tính nhất quán (Consistency Checker) của thế giới truyện.
Nhiệm vụ: Đối chiếu diễn biến với thiết lập (Hệ thống sức mạnh, Địa điểm, Thời gian). Cấm chế tác lỗi toán học thời gian hay hổng logic quyền hạn sức mạnh.
Trả về JSON hợp lệ, không giải thích, không dùng \`\`\` (code blocks).`;

export function buildConsistencyCheckerPrompt(
  chapterText: string,
  chapterNumber: number,
  systemStateContext: string // JSON string of state (power level, location, time, entities)
): { system: string; user: string } {
  const userPrompt = `Dựa trên nội dung chương ${chapterNumber} và Dữ liệu trạng thái hệ thống, bạn hãy tìm ra các mâu thuẫn (nếu có).

Dữ liệu trạng thái hệ thống hiện tại (bối cảnh trước khi vào chương):
---
${systemStateContext || '{}'}
---

Nội dung chương:
---
${chapterText}
---

Kiểm tra 3 lớp:
1. Sức mạnh (Power): Có xài chiêu thức vượt cấp không? Có giảm cấp không lý do không?
2. Địa điểm (Location): Có dịch chuyển tức thời không giải thích không?
3. Thời gian (Timeline): Dòng thời gian có bị lỗi logic không (đang đếm ngược 5 ngày mà nhảy vọt lên 2 ngày bỏ qua 3 ngày, tuổi tác sai lệch...)?

Trả về JSON có định dạng sau:
{
  "agent": "consistency",
  "chapter": ${chapterNumber},
  "overall_score": 90,
  "pass": true,
  "issues": [
    {
      "id": "consist-1",
      "severity": "critical",
      "description": "Lỗi đếm ngược: Hôm qua bảo còn 3 ngày, hôm nay lại nói 1 tuần sau.",
      "suggestion": "Thống nhất dùng mốc '3 ngày'."
    }
  ],
  "metrics": {
    "power_conflicts": 0,
    "location_errors": 0,
    "timeline_issues": 1,
    "new_entities": ["Tông Môn Mới"]
  },
  "summary": "Nhất quán về phép thuật và không gian, nhưng dòng thời gian bị lệch nhẹ."
}
`;

  return {
    system: SYSTEM_PROMPT,
    user: userPrompt,
  };
}

export function parseConsistencyReport(aiResponse: string): CheckerReport {
  try {
    let cleaned = aiResponse.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n? সংকট$/, '').replace(/\n?```$/, '');
    }
    return JSON.parse(cleaned) as CheckerReport;
  } catch (err) {
    throw new Error('Failed to parse Consistency Checker response');
  }
}
