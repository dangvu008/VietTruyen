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

/** Ước lượng chi phí USD cho một lượng tokens nhất định */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  modelId: string,
  costTable?: { input: Record<string, number>; output: Record<string, number> }
): number {
  // Lazy import to avoid circular dependency — fallback defaults
  const inputRate = costTable?.input[modelId] ?? 0.10;
  const outputRate = costTable?.output[modelId] ?? 0.40;
  return (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate;
}

/** Format số tiền USD → chuỗi thân thiện (VND hoặc USD tùy mức) */
export function formatCostDisplay(usd: number): string {
  if (usd <= 0) return 'Miễn phí';
  if (usd < 0.001) return '< $0.001';
  if (usd < 0.01) return `~$${usd.toFixed(4)}`;
  if (usd < 1) return `~$${usd.toFixed(3)}`;
  return `~$${usd.toFixed(2)}`;
}

/** Format token count thân thiện: 1234 → "1.2K", 12345 → "12.3K" */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 10_000) return `${(tokens / 1000).toFixed(1)}K`;
  if (tokens < 1_000_000) return `${Math.round(tokens / 1000)}K`;
  return `${(tokens / 1_000_000).toFixed(1)}M`;
}
