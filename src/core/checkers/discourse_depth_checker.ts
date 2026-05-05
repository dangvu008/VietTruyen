/**
 * File: discourse_depth_checker.ts
 * Purpose: Checker Agent prompt builder & parser for discourse depth/cohesion
 * Layer: Core/Domain
 * Domain: Checkers -> [discourse_depth]
 */

import type { CheckerReport } from './checker_types';

const SYSTEM_PROMPT = `Bạn là biên tập viên cấu trúc chuyên soi chiều sâu diễn ngôn cho tiểu thuyết dài kỳ.
Nhiệm vụ: đánh giá độ liên kết giữa các đoạn, mạch nhân quả trong chương, sự nối tiếp với chương trước, và vai trò của chương trong toàn truyện.
LUÔN trả về JSON hợp lệ, không giải thích, không dùng markdown code blocks.`;

export function buildDiscourseDepthCheckerPrompt(
  chapterText: string,
  chapterNumber: number,
  previousSummary: string,
  activeThreads: string[],
  chapterIntent?: string,
  futureTarget?: string,
): { system: string; user: string } {
  const threadsContext = activeThreads.length > 0
    ? activeThreads.map((thread) => `- ${thread}`).join('\n')
    : '(Không có thread nổi bật được cung cấp)';

  const userPrompt = `Phân tích chương ${chapterNumber} về chiều sâu và liên kết diễn ngôn.

Tóm tắt chương trước:
---
${previousSummary || '(Không có dữ liệu chương trước)'}
---

Vai trò chương hiện tại:
---
${chapterIntent || '(Chưa có mô tả rõ ràng)'}
---

Đích/áp lực ở phía trước:
---
${futureTarget || '(Chưa có đích xa rõ ràng)'}
---

Threads, phục bút, tuyến đang mở:
---
${threadsContext}
---

Nội dung chương:
---
${chapterText}
---

Yêu cầu kiểm tra:
1. Liên kết đoạn: mỗi đoạn có đẩy tiếp cảm xúc, xung đột hoặc thông tin không, hay chỉ đứng riêng lẻ?
2. Nhân quả: hành động, phản ứng, quyết định có nối được bằng chuỗi nguyên nhân-kết quả không?
3. Nối chương: chương này có thực sự kế thừa trạng thái từ phần trước và tạo áp lực hợp lý cho phần sau không?
4. Chiều sâu: có lớp nội tâm, ẩn ý, tension quan hệ, hoặc motif lặp lại để tránh cảm giác "kể sự kiện cho có" không?

Trả về JSON:
{
  "agent": "discourse_depth",
  "chapter": ${chapterNumber},
  "overall_score": 72,
  "pass": false,
  "issues": [
    {
      "id": "disc-1",
      "severity": "high",
      "description": "Các đoạn giữa chương cùng nói về một việc nhưng thiếu cầu nối cảm xúc nên đọc rời.",
      "suggestion": "Thêm 1-2 câu chuyển nhịp cho thấy hành động trước đã làm đổi tâm thế nhân vật ra sao.",
      "context_snippet": ""
    }
  ],
  "metrics": {
    "paragraph_cohesion": 68,
    "causal_flow": 70,
    "chapter_bridge_score": 61,
    "thematic_depth": 64
  },
  "summary": "Chương có ý chính rõ nhưng độ nối giữa các đoạn và lớp nội tâm còn mỏng."
}`;

  return {
    system: SYSTEM_PROMPT,
    user: userPrompt,
  };
}

export function parseDiscourseDepthReport(aiResponse: string): CheckerReport {
  try {
    let cleaned = aiResponse.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return JSON.parse(cleaned) as CheckerReport;
  } catch {
    throw new Error('Failed to parse Discourse Depth Checker response');
  }
}
