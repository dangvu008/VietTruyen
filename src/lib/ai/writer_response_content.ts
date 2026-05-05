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
  const normalizedLines = text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .split('\n')
    .map((line) => line
      .replace(/^\s*```(?:\w+)?\s*$/u, '')
      .replace(/^\s*#{1,6}\s+/u, '')
      .replace(/^\s*>+\s?/u, '')
      .replace(/^\s*(?:[-*+]|[–—])\s+/u, '')
      .replace(/^\s*\d+[.)]\s+/u, '')
      .replace(/\s+/g, ' ')
      .trim())
    .filter((line) => !/^(?:[-*_]\s*){3,}$/u.test(line));

  return normalizedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
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
