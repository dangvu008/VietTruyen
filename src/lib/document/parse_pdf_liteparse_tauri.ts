/**
 * File: parse_pdf_liteparse_tauri.ts
 * Purpose: Parse PDF files on Tauri desktop via the local LiteParse CLI bridged through Rust IPC
 * Layer: Infrastructure
 * Domain: Document → PDF parsing
 * Data Contract: Input: File (PDF) | Output: ParsedDocument
 * Edge Cases: Non-Tauri runtime, LiteParse missing on PATH, empty CLI output
 * Allowed Deps: @tauri-apps/api/core
 */

import type { ParsedDocument } from './document_parser';

interface LiteparsePdfResponse {
  text: string;
  pageCount?: number;
  metadata?: Record<string, string | undefined>;
}

export function normalizeLiteparsePdfResponse(result: LiteparsePdfResponse): ParsedDocument {
  const text = result.text?.trim();

  if (!text) {
    throw new Error('LiteParse trả về tài liệu rỗng.');
  }

  return {
    text,
    pageCount: result.pageCount,
    metadata: {
      ...result.metadata,
      engine: 'liteparse',
      runtime: 'tauri',
    },
  };
}

export async function parsePdfWithLiteparseTauri(
  file: File,
  options?: { maxPages?: number }
): Promise<ParsedDocument | null> {
  const { invoke, isTauri } = await import('@tauri-apps/api/core');

  if (!isTauri()) {
    return null;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await invoke<LiteparsePdfResponse>('parse_pdf_with_liteparse', {
    bytes,
    maxPages: options?.maxPages,
  });

  return normalizeLiteparsePdfResponse(result);
}
