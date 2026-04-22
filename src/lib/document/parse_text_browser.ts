/**
 * File: parse_text_browser.ts
 * Purpose: Parse plain text files (.txt, .md) in browser via FileReader
 * Layer: Infrastructure
 * Domain: Document → Text parsing
 * Data Contract: Input: File | Output: ParsedDocument
 * Edge Cases: Non-UTF8 encoding, empty file, very large file
 * Allowed Deps: none (browser API only)
 */

import type { ParsedDocument } from './document_parser';

export function parseTextFromFile(file: File): Promise<ParsedDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;

      if (!text || !text.trim()) {
        reject(new Error('File trống hoặc không đọc được nội dung.'));
        return;
      }

      resolve({
        text: text.trim(),
        metadata: {
          engine: 'FileReader',
          fileName: file.name,
          fileSize: String(file.size),
        },
      });
    };

    reader.onerror = () => {
      reject(new Error('Không thể đọc file. Kiểm tra encoding (UTF-8).'));
    };

    // STEP 1: Read as UTF-8 text
    reader.readAsText(file, 'UTF-8');
  });
}
