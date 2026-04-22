/**
 * File: pacing_checker.ts
 * Purpose: Checker Agent prompt builder & parser for Pacing (Strand Weave)
 * Layer: Core/Domain
 * Domain: Checkers -> [pacing]
 */

import type { CheckerReport } from './checker_types';
import type { StrandTracker } from '../../types/strand_weave';

const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích nhịp độ truyện (Pacing Checker).
Nhiệm vụ: Đánh giá sự cân bằng của các tuyến truyện (Strand Weave) để tránh làm độc giả mệt mỏi.
LUÔN trả về định dạng JSON hợp lệ, không giải thích, không dùng markdown code blocks (\`\`\`).`;

export function buildPacingCheckerPrompt(
  chapterText: string,
  chapterNumber: number,
  strandTracker: StrandTracker
): { system: string; user: string } {
  // Calculate gaps
  const questGap = chapterNumber - strandTracker.lastQuestChapter;
  const fireGap = chapterNumber - strandTracker.lastFireChapter;
  const constellationGap = chapterNumber - strandTracker.lastConstellationChapter;

  const historyStr = strandTracker.history.slice(-10).map(h => `Chương ${h.chapterId}: ${h.dominant}`).join(', ');

  const userPrompt = `Phân tích chương ${chapterNumber} để xác định tuyến truyện chủ đạo (Dominant Strand) và đánh giá nhịp độ tổng thể.

3 Tuyến truyện (Strand) chính:
- Quest (Tuyến chính): Chiến đấu, làm nhiệm vụ, thăng cấp, giải quyết âm mưu.
- Fire (Tuyến tình cảm/nhân vật): Quan hệ lãng mạn, tình thầy trò, huynh đệ, phát triển nội tâm.
- Constellation (Tuyến thế giới): Giới thiệu thế lực mới, bối cảnh, đấu đá chính trị.

Tuyến chủ đạo là tuyến chiếm >= 60% thời lượng chương.

Lịch sử nhịp độ gần đây (10 chương):
${historyStr || '(Chưa có dữ liệu)'}

Khoảng cách từ lần cuối xuất hiện:
- Quest: cách đây ${questGap} chương (Cảnh báo nếu > 5)
- Fire: cách đây ${fireGap} chương (Cảnh báo nếu > 10)
- Constellation: cách đây ${constellationGap} chương (Cảnh báo nếu > 15)

Nội dung chương:
---
${chapterText}
---

Yêu cầu:
1. Xác định tuyến chủ đạo của chương này.
2. Kiểm tra xem có vi phạm cân bằng nhịp độ không (ví dụ: Quest quá tải, Fire khô hạn).
3. Trả về JSON theo đúng Schema sau (thay thế giá trị mẫu):

{
  "agent": "pacing",
  "chapter": ${chapterNumber},
  "overall_score": 75,
  "pass": true,
  "issues": [
    {
      "id": "pacing-1",
      "severity": "medium",
      "description": "Tuyến Fire (tình cảm) đã bị lãng quên quá 10 chương.",
      "suggestion": "Chương tới nên đan xen một cảnh tương tác với nhân vật phụ để làm dịu nhịp độ chiến đấu.",
      "context_snippet": ""
    }
  ],
  "metrics": {
    "dominant_strand": "quest",
    "quest_streak": ${questGap === 1 ? 'tăng 1' : 1},
    "fire_gap": ${fireGap},
    "constellation_gap": ${constellationGap}
  },
  "summary": "Chương này tiếp tục là Quest. Nhịp độ chiến đấu đang gay cấn nhưng cần lưu ý tuyến Fire đang khô hạn."
}
`;

  return {
    system: SYSTEM_PROMPT,
    user: userPrompt,
  };
}

export function parsePacingReport(aiResponse: string): CheckerReport {
  try {
    let cleaned = aiResponse.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return JSON.parse(cleaned) as CheckerReport;
  } catch (err) {
    throw new Error('Failed to parse Pacing Checker response');
  }
}
