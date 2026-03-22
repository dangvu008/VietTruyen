/**
 * File: token_estimator.ts
 * Purpose: Ước lượng token count và cắt text theo token limit
 * Layer: Utility (AI)
 * Domain: AI → [token estimation, text truncation]
 *
 * Data Contract:
 * - Input:  text (string)
 * - Output: estimated token count (number) hoặc truncated text (string)
 *
 * Quy tắc: Tiếng Việt ~1 token = 3-4 ký tự (có dấu). Tiếng Anh ~1 token = 4 ký tự.
 * Đây là ước lượng, không cần chính xác 100%.
 */

const CHARS_PER_TOKEN_VI = 3.5;

/** Ước lượng số tokens cho đoạn text (Vietnamese-optimized) */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN_VI);
}

/** Cắt text cho vừa token limit, giữ nguyên word boundary */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  if (!text) return '';
  const maxChars = Math.floor(maxTokens * CHARS_PER_TOKEN_VI);

  if (text.length <= maxChars) return text;

  // Cắt tại word boundary gần nhất
  const truncated = text.substring(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  const lastNewline = truncated.lastIndexOf('\n');
  const cutPoint = Math.max(lastSpace, lastNewline);

  return (cutPoint > 0 ? truncated.substring(0, cutPoint) : truncated) + '…';
}

/** Tóm tắt nhanh bằng cách lấy N ký tự đầu, giữ word boundary */
export function quickTruncate(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text || '';
  const cut = text.substring(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxChars * 0.5 ? cut.substring(0, lastSpace) : cut) + '…';
}
