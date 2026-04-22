/**
 * File: parse_pdf_browser.ts
 * Purpose: Parse PDF files in browser using pdfjs-dist (same engine as liteparse)
 * Layer: Infrastructure
 * Domain: Document → PDF parsing
 * Data Contract: Input: ArrayBuffer | Output: { text, pageCount }
 * Edge Cases: Encrypted PDF, scanned PDF (no text layer), empty pages
 * Allowed Deps: pdfjs-dist
 */

import type { ParsedDocument } from './document_parser';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

let pdfjsInitialized = false;

async function initPdfjs(): Promise<typeof import('pdfjs-dist')> {
  const pdfjs = await import('pdfjs-dist');

  if (!pdfjsInitialized) {
    // STEP 1: Configure worker for Vite bundling
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString();
    pdfjsInitialized = true;
  }

  return pdfjs;
}

function isTextItem(item: unknown): item is TextItem {
  return typeof item === 'object' && item !== null && 'str' in item;
}

export async function parsePdfFromBuffer(
  buffer: ArrayBuffer,
  options?: { maxPages?: number }
): Promise<ParsedDocument> {
  const pdfjs = await initPdfjs();

  // STEP 2: Load PDF document from buffer
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;

  const totalPages = pdf.numPages;
  const maxPages = options?.maxPages ?? totalPages;
  const pagesToParse = Math.min(totalPages, maxPages);

  // STEP 3: Extract text from each page sequentially
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pagesToParse; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // STEP 4: Join text items with spatial awareness
    const pageText = textContent.items
      .filter(isTextItem)
      .map((item) => {
        const suffix = item.hasEOL ? '\n' : ' ';
        return item.str + suffix;
      })
      .join('')
      .trim();

    if (pageText) {
      pageTexts.push(pageText);
    }
  }

  // STEP 5: Concatenate all pages with double newline separator
  const fullText = pageTexts.join('\n\n');

  return {
    text: fullText,
    pageCount: totalPages,
    metadata: {
      parsedPages: String(pagesToParse),
      totalPages: String(totalPages),
      engine: 'pdfjs-dist',
    },
  };
}
