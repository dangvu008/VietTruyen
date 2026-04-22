/**
 * File: parse_docx_browser.ts
 * Purpose: Parse DOCX files in browser using mammoth
 * Layer: Infrastructure
 * Domain: Document → DOCX parsing
 * Data Contract: Input: ArrayBuffer | Output: ParsedDocument
 * Edge Cases: Corrupted DOCX, password-protected, non-standard format
 * Allowed Deps: mammoth (dynamic import)
 */

import type { ParsedDocument } from './document_parser';

export async function parseDocxFromBuffer(buffer: ArrayBuffer): Promise<ParsedDocument> {
  // STEP 1: Dynamic import mammoth to reduce initial bundle size
  const mammothModule = await import('mammoth');

  // STEP 2: Extract raw text (no HTML formatting needed for story content)
  const result = await mammothModule.extractRawText({ arrayBuffer: buffer });

  if (!result.value || !result.value.trim()) {
    throw new Error('File DOCX trống hoặc không thể đọc nội dung văn bản.');
  }

  return {
    text: result.value.trim(),
    metadata: {
      engine: 'mammoth',
      warnings: result.messages.map((m) => m.message).join('; ') || undefined,
    },
  };
}
