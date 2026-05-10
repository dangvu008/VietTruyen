import { extractWriterVisibleContent } from '../ai/writer_response_content';

const WRITER_MARKER_RE = /@@(?:ECOT_ANALYSIS|LEDGER|CONTENT)@@/;
const WRITER_LEDGER_KEY_RE =
  /"(summary|beatStatus|usedCharacterNames|introducedEntities|foreshadowPlanted|preservedAnchorIds)"\s*:/g;

/**
 * Technical/programming terms that MUST NEVER appear in Vietnamese prose.
 * These leak from AI context headers or model confusion.
 * Matched case-insensitively when flanked by Vietnamese characters.
 */
const BANNED_TECHNICAL_TERMS = new Set([
  'runtime', 'promise', 'function', 'module', 'error', 'typeerror',
  'referenceerror', 'syntaxerror', 'async', 'await', 'const',
  'import', 'export', 'default', 'require', 'console', 'json',
  'array', 'object', 'string', 'number', 'boolean', 'regexp',
  'symbol', 'proxy', 'reflect', 'interface',
  'class', 'extends', 'implements', 'return', 'yield', 'throw',
  'catch', 'finally', 'typeof', 'instanceof', 'delete',
  'super', 'static', 'public', 'private',
  'protected', 'abstract', 'override', 'readonly', 'enum', 'namespace',
  'declare', 'keyof', 'infer', 'unknown', 'tuple',
  'record', 'partial', 'required', 'omit', 'pick', 'exclude', 'extract',
  'fetch', 'settimeout', 'setinterval', 'addeventlistener',
  'queryselector', 'innerhtml', 'textcontent', 'appendchild',
  'createelement', 'undefined', 'config',
  'callback', 'middleware', 'endpoint', 'payload', 'webhook',
  'database', 'schema', 'migration', 'debugger', 'breakpoint',
  'stacktrace', 'stderr', 'stdout', 'stdin', 'localhost',
  'dockerfile', 'container', 'pipeline', 'deploy',
]);

/**
 * Regex: a Vietnamese/CJK character followed by a technical English word
 * (or vice versa), with no space between them. This catches leaks like
 * "Phế vậtRuntime!" where "Runtime" is fused into Vietnamese prose.
 */
const VIETNAMESE_CHAR_RE = /[\u00C0-\u024F\u1E00-\u1EFF\u0300-\u036F\u3000-\u9FFF]/;
const INLINE_JSON_FRAGMENT_RE = /\{\s*"(?:chapter|title|content|body|text|chapterContent)"\s*:/;

/**
 * Strip JSON-like fragments that appear inline within prose text.
 * Catches cases where AI outputs partial JSON within the chapter content.
 */
function stripInlineJsonFragments(text: string): { content: string; stripped: boolean } {
  if (!INLINE_JSON_FRAGMENT_RE.test(text)) {
    return { content: text, stripped: false };
  }

  // Try to find and remove the JSON fragment
  let result = text;
  let stripped = false;

  // Find each JSON-like opening and try to extract/remove it
  let match: RegExpExecArray | null;
  const regex = new RegExp(INLINE_JSON_FRAGMENT_RE.source, 'g');
  while ((match = regex.exec(result)) !== null) {
    const startIdx = match.index;
    // Find matching closing brace
    let depth = 0;
    let inStr = false;
    let esc = false;
    let endIdx = -1;

    for (let i = startIdx; i < result.length; i++) {
      const ch = result[i];
      if (inStr) {
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') { inStr = false; }
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{') { depth++; continue; }
      if (ch === '}') {
        depth--;
        if (depth === 0) { endIdx = i + 1; break; }
      }
    }

    if (endIdx > startIdx) {
      try {
        const jsonStr = result.slice(startIdx, endIdx);
        const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
        // If it has a 'content' field, extract it as the useful text
        const innerContent = String(
          parsed.content ?? parsed.chapterContent ?? parsed.body ?? parsed.text ?? ''
        ).trim();

        const beforeJson = result.slice(0, startIdx).trim();
        const afterJson = result.slice(endIdx).trim();
        const replacement = [beforeJson, innerContent, afterJson]
          .filter(Boolean)
          .join('\n\n');
        result = replacement;
        stripped = true;
        break; // Re-run from start if needed
      } catch {
        // Not valid JSON, skip
        break;
      }
    } else {
      break;
    }
  }

  return { content: result, stripped };
}

/**
 * Check if a text window contains Vietnamese diacritic characters,
 * indicating the surrounding context is Vietnamese prose.
 */
function isVietnameseContext(text: string, matchStart: number, matchEnd: number): boolean {
  const windowStart = Math.max(0, matchStart - 10);
  const windowEnd = Math.min(text.length, matchEnd + 10);
  const window = text.slice(windowStart, matchStart) + text.slice(matchEnd, windowEnd);
  return VIETNAMESE_CHAR_RE.test(window);
}

/**
 * Detect and remove programming/technical English terms that appear
 * concatenated with Vietnamese text. Example: "vậtRuntime" → "vật".
 * Also strips standalone technical terms surrounded by Vietnamese prose.
 * Uses a 10-char window context check to determine if surrounding text
 * is Vietnamese, since Vietnamese words often end with ASCII chars
 * (e.g. "vật" ends with 't').
 */
function sanitizeTechnicalTermLeaks(text: string): { content: string; sanitized: boolean } {
  let result = text;
  let sanitized = false;

  // Pattern 1: Technical term touching non-space characters in Vietnamese context
  // e.g. "vậtRuntime" → strip "Runtime" (the 'ậ' is in the 10-char window)
  for (const term of BANNED_TECHNICAL_TERMS) {
    if (term.length < 4) continue; // Skip very short terms to avoid false positives
    const termRegex = new RegExp(
      `(${term})`,
      'gi'
    );
    let termMatch: RegExpExecArray | null;
    while ((termMatch = termRegex.exec(result)) !== null) {
      const matchStart = termMatch.index;
      const matchEnd = matchStart + termMatch[0].length;

      // Don't strip if the term is part of a longer PURELY English word.
      // Vietnamese words end with 1-2 ASCII consonants (e.g. "vật" ends with 't'),
      // so a single ASCII char before doesn't mean it's English.
      // Only skip if there's a run of 3+ consecutive ASCII letters, which indicates
      // a true English word (e.g. "promiseCallback" has 7 ASCII chars "promise").
      const charAfter = matchEnd < result.length ? result[matchEnd] : '';
      const engAfter = /[a-zA-Z]/.test(charAfter);

      // Check consecutive ASCII letters before the match
      let asciiRunBefore = 0;
      for (let i = matchStart - 1; i >= 0 && /[a-zA-Z]/.test(result[i]); i--) {
        asciiRunBefore++;
      }
      const isPartOfEnglishWord = asciiRunBefore >= 3 || engAfter;

      if (isPartOfEnglishWord) {
        // Part of a longer English word, skip
        continue;
      }

      // Check if within Vietnamese prose context (10-char window)
      if (isVietnameseContext(result, matchStart, matchEnd)) {
        result = result.slice(0, matchStart) + result.slice(matchEnd);
        sanitized = true;
        // Reset regex after mutation
        termRegex.lastIndex = matchStart;
      }
    }
  }

  // Pattern 2: Standalone technical terms surrounded by Vietnamese punctuation/spaces
  // e.g. "– Phế vật Runtime! Đem" → "– Phế vật! Đem"
  for (const term of BANNED_TECHNICAL_TERMS) {
    if (term.length < 4) continue; // Skip very short terms
    const standaloneRegex = new RegExp(
      `(\\s+)(${term})(\\s*[!?.,;:…–—]|\\s+)`,
      'gi'
    );
    const before = result;
    result = result.replace(standaloneRegex, (_match, _leadSpace, _termText, trail) => {
      return `${trail.trim() ? ` ${trail.trimStart()}` : ' '}`;
    });
    if (result !== before) sanitized = true;
  }

  // Clean up double spaces left by removals
  if (sanitized) {
    result = result.replace(/  +/g, ' ').trim();
  }

  return { content: result, sanitized };
}

export interface ChapterContentGuardResult {
  content: string;
  sanitized: boolean;
  rejected: boolean;
  reasons: string[];
}

interface GuardOptions {
  allowEmptyAfterSanitize?: boolean;
}

function stripTrailingArtifacts(text: string): string {
  let next = text.trim();

  while (true) {
    const canStripQuoteBraceArtifact = !next.trimStart().startsWith('{');
    const stripped = next
      .replace(/\s*"""\s*$/u, '')
      .replace(/\s*```+\s*$/u, '')
      .replace(canStripQuoteBraceArtifact ? /\s*["'“”‘’]\s*\}\s*$/u : /$(?=a)/u, '')
      .trim();

    if (stripped === next) {
      return next;
    }

    next = stripped;
  }
}

function countWriterLedgerKeys(text: string): number {
  return Array.from(text.matchAll(WRITER_LEDGER_KEY_RE)).length;
}

function findLeadingJsonObjectEnd(text: string): number {
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) return -1;

  const prefix = text.slice(0, firstBrace);
  if (prefix.trim().length > 0) return -1;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = firstBrace; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }

  return -1;
}

function stripLeadingWriterLedger(text: string): { content: string; stripped: boolean } {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith('{')) {
    return { content: text, stripped: false };
  }

  if (countWriterLedgerKeys(trimmed.slice(0, 500)) < 2) {
    return { content: text, stripped: false };
  }

  const jsonEnd = findLeadingJsonObjectEnd(text);
  if (jsonEnd === -1) {
    return { content: text, stripped: false };
  }

  return {
    content: stripTrailingArtifacts(text.slice(jsonEnd)),
    stripped: true,
  };
}

function extractJsonStringContent(value: unknown): string {
  if (typeof value !== 'string') return '';
  return stripTrailingArtifacts(extractWriterVisibleContent(value));
}

function stripLeadingChapterJsonPayload(text: string): { content: string; stripped: boolean } {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith('{')) {
    return { content: text, stripped: false };
  }

  const jsonEnd = findLeadingJsonObjectEnd(text);
  if (jsonEnd === -1) {
    return { content: text, stripped: false };
  }

  try {
    const parsed = JSON.parse(text.slice(0, jsonEnd)) as Record<string, unknown>;
    const extractedContent = extractJsonStringContent(
      parsed.content ?? parsed.chapterContent ?? parsed.body ?? parsed.text,
    );

    if (!extractedContent) {
      return { content: text, stripped: false };
    }

    const trailingText = stripTrailingArtifacts(text.slice(jsonEnd));
    return {
      content: [extractedContent, trailingText].filter(Boolean).join('\n\n').trim(),
      stripped: true,
    };
  } catch {
    return { content: text, stripped: false };
  }
}

function containsWriterMetadataLeak(text: string): boolean {
  if (WRITER_MARKER_RE.test(text)) return true;

  const headerSample = text.slice(0, 800);
  if (countWriterLedgerKeys(headerSample) < 2) return false;

  return headerSample.trimStart().startsWith('{') || headerSample.includes('beatStatus');
}

export function guardChapterContent(
  rawContent: string,
  options: GuardOptions = {},
): ChapterContentGuardResult {
  const allowEmptyAfterSanitize = options.allowEmptyAfterSanitize ?? false;
  let content = String(rawContent || '').trim();

  // [Perf] Early exit for empty content — avoids running 70+ regex operations
  // during partialize which strips all content to '' before calling this.
  if (!content) {
    return { content: '', sanitized: false, rejected: false, reasons: [] };
  }

  let sanitized = false;
  const reasons: string[] = [];

  const initiallyStripped = stripTrailingArtifacts(content);
  if (initiallyStripped !== content) {
    content = initiallyStripped;
    sanitized = true;
    reasons.push('trailing_artifacts');
  }

  if (!content) {
    return { content: '', sanitized: false, rejected: false, reasons };
  }

  if (WRITER_MARKER_RE.test(content)) {
    content = stripTrailingArtifacts(extractWriterVisibleContent(content));
    sanitized = true;
    reasons.push('writer_markers');
  }

  while (true) {
    const stripped = stripLeadingWriterLedger(content);
    if (!stripped.stripped) break;
    content = stripped.content;
    sanitized = true;
    reasons.push('writer_ledger_prefix');
  }

  while (true) {
    const stripped = stripLeadingChapterJsonPayload(content);
    if (!stripped.stripped) break;
    content = stripped.content;
    sanitized = true;
    reasons.push('chapter_json_payload');
  }

  content = stripTrailingArtifacts(content);

  // Strip inline JSON fragments (e.g. {"chapter": 1, "content": "..."} )
  const jsonFragmentResult = stripInlineJsonFragments(content);
  if (jsonFragmentResult.stripped) {
    content = jsonFragmentResult.content;
    sanitized = true;
    reasons.push('inline_json_fragment');
  }

  // Sanitize programming/technical term leaks from AI context
  const techTermResult = sanitizeTechnicalTermLeaks(content);
  if (techTermResult.sanitized) {
    content = techTermResult.content;
    sanitized = true;
    reasons.push('technical_term_leak');
  }

  content = stripTrailingArtifacts(content);

  if (containsWriterMetadataLeak(content)) {
    return {
      content: '',
      sanitized: true,
      rejected: true,
      reasons: [...reasons, 'writer_metadata_leak'],
    };
  }

  if (!content && sanitized && !allowEmptyAfterSanitize) {
    return {
      content: '',
      sanitized: true,
      rejected: true,
      reasons: [...reasons, 'empty_after_sanitize'],
    };
  }

  return {
    content,
    sanitized,
    rejected: false,
    reasons,
  };
}
