/**
 * File: writer_response_content.ts
 * Purpose: Extract visible chapter prose from writer responses with sentinel metadata
 * Layer: Infrastructure (AI parsing)
 * Domain: AI
 */

function findJsonObjectEnd(text: string): number {
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) return -1;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = firstBrace; index < text.length; index++) {
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
    } else if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) return index + 1;
    }
  }

  return -1;
}

function normalizeWriterProse(text: string): string {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .split('\n')
    .map((line) => {
      let cleaned = line;
      // [Domain:AI] Strip Markdown code fence markers (``` or ```lang)
      cleaned = cleaned.replace(/^\s*```(?:\w+)?\s*$/u, '');
      // [Domain:AI] Strip Markdown heading markers (# ## ### etc.)
      cleaned = cleaned.replace(/^\s*#{1,6}\s+/u, '');
      // [Domain:AI] Strip Markdown blockquote markers (> >>)
      cleaned = cleaned.replace(/^\s*>+\s?/u, '');
      // [Domain:AI] Strip Markdown numbered list markers (1. 2) etc.)
      cleaned = cleaned.replace(/^\s*\d+[.)]\s+/u, '');
      // [Domain:AI] Strip Markdown bullet markers (- * +) BUT preserve
      // Vietnamese dialogue markers (– —) which use en-dash/em-dash
      cleaned = cleaned.replace(/^\s*[-*+]\s+/u, '');
      // [Domain:AI] Collapse intra-line whitespace (tabs, multiple spaces)
      cleaned = cleaned.replace(/\s+/g, ' ');
      return cleaned.trim();
    })
    // [Domain:AI] Remove Markdown horizontal rules (--- *** ___)
    .filter((line) => !/^(?:[-*_]\s*){3,}$/u.test(line));

  // [Domain:AI] Reassemble: preserve single newlines (sentence/dialogue breaks),
  // collapse 3+ blank lines to max double-newline (paragraph break),
  // and drop fully empty trailing/leading lines.
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')
    .trim();
}

export function extractWriterVisibleContent(responseText: string): string {
  const text = responseText.trim();
  if (!text) return '';

  const ecotMarker = '@@ECOT_ANALYSIS@@';
  const ledgerMarker = '@@LEDGER@@';
  const contentMarker = '@@CONTENT@@';

  const markerIndexesAfter = (start: number) =>
    [ecotMarker, ledgerMarker, contentMarker]
      .map((marker) => text.indexOf(marker, start))
      .filter((index) => index !== -1);

  const contentIndex = text.indexOf(contentMarker);
  if (contentIndex !== -1) {
    const start = contentIndex + contentMarker.length;
    const nextIndexes = markerIndexesAfter(start);
    const end = nextIndexes.length > 0 ? Math.min(...nextIndexes) : text.length;
    return normalizeWriterProse(text.slice(start, end));
  }

  const ledgerIndex = text.indexOf(ledgerMarker);
  if (ledgerIndex !== -1) {
    const beforeLedger = text.slice(0, ledgerIndex);
    const proseBeforeLedger = beforeLedger.includes(ecotMarker) ? '' : beforeLedger.trim();
    if (proseBeforeLedger) return normalizeWriterProse(proseBeforeLedger);

    const afterLedger = text.slice(ledgerIndex + ledgerMarker.length).trim();
    const jsonEnd = findJsonObjectEnd(afterLedger);
    if (jsonEnd !== -1) {
      return normalizeWriterProse(afterLedger.slice(jsonEnd));
    }

    return '';
  }

  const ecotIndex = text.indexOf(ecotMarker);
  if (ecotIndex !== -1) {
    const nextIndexes = [ledgerMarker, contentMarker]
      .map((marker) => text.indexOf(marker, ecotIndex + ecotMarker.length))
      .filter((index) => index !== -1);
    if (nextIndexes.length > 0) {
      return normalizeWriterProse(text.slice(Math.min(...nextIndexes)));
    }
    return normalizeWriterProse(text.slice(0, ecotIndex));
  }

  return normalizeWriterProse(text);
}
