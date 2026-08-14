/**
 * File: consistency_checker.ts
 * Purpose: Checker Agent prompt builder & parser for World/Power Consistency
 * Layer: Core/Domain
 * Domain: Checkers -> [consistency]
 */

import type { CheckerReport } from './checker_types';

const SYSTEM_PROMPT = `Bạn là biên tập viên kiểm soát tính nhất quán (Consistency Checker) của thế giới truyện.
Nhiệm vụ: Đối chiếu diễn biến với thiết lập, trạng thái và bằng chứng đã biết trước chương. Đặc biệt phải phân biệt WORLD TRUTH với CHARACTER KNOWLEDGE: một sự thật tồn tại trong Canon không có nghĩa nhân vật tự động biết nó.
Cấm chế tác lỗi toán học thời gian, hổng logic quyền hạn sức mạnh, dịch chuyển vô cớ hoặc cho nhân vật biết thông tin chưa có đường truyền/bằng chứng.
Trả về JSON hợp lệ, không giải thích, không dùng \`\`\` (code blocks).`;

export function buildConsistencyCheckerPrompt(
  chapterText: string,
  chapterNumber: number,
  systemStateContext: string,
  opts?: {
    continuityWarnings?: string[];
    activeHooks?: string[];
    storyStateFacts?: string[];
  }
): { system: string; user: string } {
  const continuityBlock = opts?.continuityWarnings?.length
    ? `\nCảnh báo continuity đang mở:\n- ${opts.continuityWarnings.join('\n- ')}\n`
    : '';
  const hookBlock = opts?.activeHooks?.length
    ? `\nHook/foreshadowing còn mở:\n- ${opts.activeHooks.join('\n- ')}\n`
    : '';
  const storyStateBlock = opts?.storyStateFacts?.length
    ? `\nSnapshot trạng thái đã biết trước chương này:\n- ${opts.storyStateFacts.join('\n- ')}\n`
    : '';
  const userPrompt = `Dựa trên nội dung chương ${chapterNumber} và dữ liệu trạng thái trước chương, hãy tìm mâu thuẫn có bằng chứng.

Dữ liệu trạng thái hệ thống hiện tại:
---
${systemStateContext || '{}'}
---
${storyStateBlock}${hookBlock}${continuityBlock}

Lưu ý về fact dạng character_knowledge:<id>: value JSON chứa proposition, worldTruth và belief. Đây là tri thức/niềm tin của riêng subjectId. Không được suy từ worldTruth sang belief nếu ledger không ghi như vậy.

Nội dung chương:
---
${chapterText}
---

Kiểm tra 4 lớp:
1. Sức mạnh (Power): dùng năng lực vượt trạng thái đã có, tăng/giảm cấp không nguyên nhân.
2. Địa điểm (Location): xuất hiện/dịch chuyển không có cầu nối hợp lý.
3. Thời gian (Timeline): chronology, duration, tuổi tác hoặc countdown mâu thuẫn. Không tự bịa mốc thời gian để kết tội khi dữ liệu chỉ mơ hồ.
4. Tri thức nhân vật (Knowledge): nhân vật có nói, suy luận chắc chắn hoặc hành động dựa trên thông tin mà ledger cho thấy họ chưa biết/chỉ nghi ngờ/đã quên hay không. Phân biệt độc giả biết, thế giới đúng và nhân vật biết.

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
      "description": "Nhân vật hành động như đã biết bí mật X nhưng ledger chỉ ghi belief=unknown.",
      "suggestion": "Bổ sung đường truyền thông tin hợp lệ hoặc sửa phản ứng về mức chưa biết/nghi ngờ."
    }
  ],
  "metrics": {
    "power_conflicts": 0,
    "location_errors": 0,
    "timeline_issues": 0,
    "knowledge_leaks": 1,
    "active_hook_regressions": 0,
    "new_entities": []
  },
  "summary": "Không có lỗi power/location; phát hiện một knowledge leak."
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
