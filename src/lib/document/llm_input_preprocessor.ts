/**
 * File: llm_input_preprocessor.ts
 * Purpose: Clean noisy raw text (especially pasted HTML) before sending to LLM.
 * Layer: Application
 * Domain: Document/AI input hygiene
 */

const TOKEN_CHAR_RATIO = 3.5;

const BOILERPLATE_PATTERNS: RegExp[] = [
  /^cookie/i,
  /^accept all/i,
  /^reject all/i,
  /^privacy policy$/i,
  /^terms of service$/i,
  /^all rights reserved$/i,
  /^subscribe$/i,
  /^sign in$/i,
  /^log in$/i,
  /^login$/i,
  /^dang nhap$/i,
  /^dang ky$/i,
  /^chinh sach cookie$/i,
  /^chinh sach bao mat$/i,
  /^dieu khoan su dung$/i,
];

export interface LlmInputPreprocessOptions {
  maxChars?: number;
}

export interface LlmInputPreprocessStats {
  rawChars: number;
  cleanChars: number;
  rawTokens: number;
  cleanTokens: number;
  reducedChars: number;
  reducedTokens: number;
  reductionPercent: number;
}

export interface LlmInputPreprocessResult {
  rawText: string;
  cleanText: string;
  stats: LlmInputPreprocessStats;
}

function estimateTokensFromText(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  return Math.ceil(normalized.length / TOKEN_CHAR_RATIO);
}

function decodeBasicHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtmlNoise(text: string): string {
  let normalized = text;

  normalized = normalized.replace(/<!--[\s\S]*?-->/g, ' ');
  normalized = normalized.replace(
    /<(script|style|noscript|svg|iframe|canvas)[^>]*>[\s\S]*?<\/\1>/gi,
    ' '
  );
  normalized = normalized.replace(/<br\s*\/?>/gi, '\n');
  normalized = normalized.replace(/<\/(p|div|section|article|li|h[1-6]|tr|td|th|ul|ol)>/gi, '\n');
  normalized = normalized.replace(/<[^>]+>/g, ' ');

  return decodeBasicHtmlEntities(normalized);
}

function shouldDropLine(line: string): boolean {
  const normalized = line.trim();
  if (!normalized) return true;

  const compact = normalized.replace(/\s+/g, ' ');
  if (compact.length <= 1) return true;

  const lower = compact.toLowerCase();
  if (BOILERPLATE_PATTERNS.some((pattern) => pattern.test(lower))) {
    return true;
  }

  // Drop standalone UI separators and link-only crumbs.
  if (/^[>|•·\-_=]{2,}$/.test(compact)) return true;
  if (/^(home|menu|pricing|about|contact)$/i.test(compact)) return true;

  return false;
}

function normalizeLines(text: string): string {
  const lines = text
    .replace(/\u0000/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => !shouldDropLine(line));

  const deduped: string[] = [];
  for (const line of lines) {
    const previous = deduped[deduped.length - 1];
    if (line === previous) continue;
    deduped.push(line);
  }

  return deduped.join('\n').trim();
}

function clampByMaxChars(text: string, maxChars?: number): string {
  if (!maxChars || maxChars <= 0) return text;
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trim()}\n...`;
}

export function preprocessTextForLlmInput(
  rawText: string,
  options?: LlmInputPreprocessOptions
): LlmInputPreprocessResult {
  const normalizedRaw = (rawText || '').trim();
  const looksLikeHtml = /<([a-z][a-z0-9-]*)(\s[^>]*)?>/i.test(normalizedRaw);

  const stripped = looksLikeHtml ? stripHtmlNoise(normalizedRaw) : normalizedRaw;
  const compacted = normalizeLines(stripped);
  const cleanText = clampByMaxChars(compacted || normalizedRaw, options?.maxChars);

  const rawChars = normalizedRaw.length;
  const cleanChars = cleanText.length;
  const rawTokens = estimateTokensFromText(normalizedRaw);
  const cleanTokens = estimateTokensFromText(cleanText);
  const reducedChars = Math.max(0, rawChars - cleanChars);
  const reducedTokens = Math.max(0, rawTokens - cleanTokens);
  const reductionPercent =
    rawTokens > 0 ? Math.round((reducedTokens / rawTokens) * 1000) / 10 : 0;

  return {
    rawText: normalizedRaw,
    cleanText,
    stats: {
      rawChars,
      cleanChars,
      rawTokens,
      cleanTokens,
      reducedChars,
      reducedTokens,
      reductionPercent,
    },
  };
}

