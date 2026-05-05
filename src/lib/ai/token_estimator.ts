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
const DEFAULT_INPUT_RATE = 0.10;
const DEFAULT_OUTPUT_RATE = 0.40;

interface CostRateTable {
  input: Record<string, number>;
  output: Record<string, number>;
}

const FALLBACK_COST_ALIASES: Array<{
  match: (modelId: string) => boolean;
  inputRate: number;
  outputRate: number;
}> = [
  {
    match: (modelId) => modelId.startsWith('gemini-2.0-flash'),
    inputRate: 0.10,
    outputRate: 0.40,
  },
  {
    match: (modelId) => modelId.startsWith('gemini-2.5-flash-lite') || modelId.includes('gemini-2.5-flash-lite'),
    inputRate: 0.10,
    outputRate: 0.40,
  },
  {
    match: (modelId) => modelId.startsWith('gemini-2.5-flash'),
    inputRate: 0.15,
    outputRate: 0.60,
  },
  {
    match: (modelId) => modelId.startsWith('gemini-2.5-pro-preview') || modelId === 'gemini-2.5-pro',
    inputRate: 1.25,
    outputRate: 5.00,
  },
  {
    match: (modelId) => modelId === 'openai/gpt-4.1-nano' || modelId === 'gpt-4.1-nano',
    inputRate: 0.10,
    outputRate: 0.40,
  },
  {
    match: (modelId) => modelId === 'openai/gpt-4.1-mini' || modelId === 'gpt-4.1-mini',
    inputRate: 0.40,
    outputRate: 1.60,
  },
  {
    match: (modelId) => modelId === 'openai/gpt-4o-mini' || modelId === 'gpt-4o-mini',
    inputRate: 0.15,
    outputRate: 0.60,
  },
  {
    match: (modelId) => modelId === 'mistralai/mistral-small-creative' || modelId === 'mistralai/mistral-small-2603',
    inputRate: 0.15,
    outputRate: 0.60,
  },
  {
    match: (modelId) => modelId === 'gryphe/mythomax-l2-13b',
    inputRate: 0.06,
    outputRate: 0.06,
  },
  {
    match: (modelId) => modelId.includes('qwen3.5-flash'),
    inputRate: 0.065,
    outputRate: 0.26,
  },
  {
    match: (modelId) =>
      modelId === 'anthropic/claude-3.5-sonnet'
      || modelId === 'anthropic/claude-sonnet-4'
      || modelId.startsWith('claude-3-5-sonnet')
      || modelId.startsWith('claude-3-7-sonnet'),
    inputRate: 3.00,
    outputRate: 15.00,
  },
  {
    match: (modelId) =>
      modelId === 'anthropic/claude-3.5-haiku'
      || modelId.startsWith('claude-3-5-haiku'),
    inputRate: 0.80,
    outputRate: 4.00,
  },
  {
    match: (modelId) => modelId === 'deepseek/deepseek-v4-flash',
    inputRate: 0.14,
    outputRate: 0.28,
  },
  {
    match: (modelId) => modelId === 'deepseek/deepseek-chat' || modelId.startsWith('deepseek'),
    inputRate: 0.14,
    outputRate: 0.28,
  },
];

/** Ước lượng số tokens cho đoạn text (Vietnamese-optimized) */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN_VI);
}

export function resolveModelCostRates(
  modelId: string,
  costTable?: CostRateTable,
): { inputRate: number; outputRate: number } {
  const inputRate = costTable?.input[modelId];
  const outputRate = costTable?.output[modelId];

  if (typeof inputRate === 'number' && typeof outputRate === 'number') {
    return { inputRate, outputRate };
  }

  for (const alias of FALLBACK_COST_ALIASES) {
    if (alias.match(modelId)) {
      return {
        inputRate: alias.inputRate,
        outputRate: alias.outputRate,
      };
    }
  }

  return {
    inputRate: inputRate ?? DEFAULT_INPUT_RATE,
    outputRate: outputRate ?? DEFAULT_OUTPUT_RATE,
  };
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

/** Cắt phần giữa để giữ cả brief đầu và chỉ dẫn/cuối context mới nhất. */
export function truncateMiddleToTokenLimit(text: string, maxTokens: number): string {
  if (!text) return '';
  const maxChars = Math.floor(maxTokens * CHARS_PER_TOKEN_VI);

  if (text.length <= maxChars) return text;

  const marker = '\n\n[...đã rút gọn phần giữa để tiết kiệm token...]\n\n';
  if (maxChars <= marker.length + 80) {
    return truncateToTokenLimit(text, maxTokens);
  }

  const availableChars = maxChars - marker.length;
  const headChars = Math.floor(availableChars * 0.45);
  const tailChars = availableChars - headChars;
  const head = text.slice(0, headChars).replace(/\s+\S*$/, '').trimEnd();
  const tail = text.slice(-tailChars).replace(/^\S*\s+/, '').trimStart();

  return `${head}${marker}${tail}`;
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
  costTable?: CostRateTable,
): number {
  const { inputRate, outputRate } = resolveModelCostRates(modelId, costTable);
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
