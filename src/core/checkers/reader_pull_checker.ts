/**
 * File: reader_pull_checker.ts
 * Purpose: Checker Agent prompt builder & parser for Reader Pull (Sức hút theo dõi)
 * Layer: Core/Domain
 * Domain: Checkers -> [reader_pull]
 */

import type { CheckerReport } from './checker_types';
import type { GenreProfile } from '../../types/genre_profile';

const SYSTEM_PROMPT = `Bạn là chuyên gia về Sức hút theo dõi (Reader Pull) của truyện chữ.
Nhiệm vụ: đánh giá lý do tự nhiên khiến độc giả muốn đọc tiếp.
Hook/cliffhanger chỉ là MỘT công cụ, không phải yêu cầu bắt buộc cho mọi chương.
Một chương kết yên, khép cảnh, hoàn tất nhịp cảm xúc hoặc để lại chuyển động tự nhiên vẫn có thể có reader pull tốt.
Không được đề xuất thêm bí ẩn, nguy hiểm, twist, foreshadowing hoặc sự kiện mới chỉ để tạo hook.
Cung cấp JSON hợp lệ, không giải thích, không dùng code blocks.`;

export function buildReaderPullCheckerPrompt(
  chapterText: string,
  chapterNumber: number,
  genreProfile?: GenreProfile
): { system: string; user: string } {
  let genreContext = '';
  if (genreProfile) {
    genreContext = `
Dữ liệu Thể loại (${genreProfile.name}):
- Micro-payoff guideline/chương: ${genreProfile.microPayoffConfig.minPerChapter}
- Đây là guideline retention, KHÔNG phải quota cứng. Quiet/transition chapters có thể thấp hơn nếu chức năng cảnh vẫn hoàn chỉnh.
`;
  }

  const userPrompt = `Phân tích chương ${chapterNumber} để đánh giá "Lực giữ chân độc giả" (Reader Pull).

Các yếu tố cần kiểm tra:
1. Ending pull: cuối chương có tạo lý do tự nhiên để đọc tiếp không? Có thể là Crisis, Mystery, Emotion, Choice, Desire, Progress, Relationship, hoặc đơn giản là momentum của hành trình. KHÔNG bắt buộc phải có hook rõ ràng.
2. Micro-payoff trong chương: có thay đổi/thông tin/cảm xúc/quyết định/quan hệ nào tạo cảm giác tiến triển không? Không yêu cầu đủ quota nếu chapter role là cầu nối hoặc lắng nhịp.
3. Phân biệt Hard Violations và Soft Suggestions.
   - Hard: đọc không hiểu, mất phương hướng hoàn toàn, cốt truyện ngưng trệ vô lý, kết chương đột ngột vì thiếu scene logic.
   - Soft: ending pull yếu hoặc tiến triển mỏng. Soft suggestion chỉ được đề xuất làm rõ/tăng lực từ vật liệu ĐÃ CÓ; không phát minh mystery/twist/nguy hiểm mới.
4. Nếu chương kết yên nhưng hoàn thành chức năng và vẫn có động lượng tự nhiên, KHÔNG coi thiếu cliffhanger là lỗi.
5. Không thưởng cho "hook mạnh" nếu hook đó trông cưỡng ép, bịa thêm biến cố hoặc nâng chi tiết bình thường thành manh mối.

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
  "issues": [],
  "metrics": {
    "hook_present": false,
    "hook_type": "quiet_momentum",
    "hook_strength": "medium",
    "micropayoffs": ["Quan hệ", "Thông tin"],
    "micropayoff_count": 2,
    "next_chapter_reason": "Độc giả muốn theo dõi hệ quả tự nhiên của quyết định vừa xảy ra"
  },
  "summary": "Chương không cần cliffhanger nhưng vẫn giữ lực đọc nhờ tiến triển rõ và kết cảnh tự nhiên."
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