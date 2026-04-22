/**
 * File: document_parser.ts
 * Purpose: Unified document parser — auto-detect file type & route to correct strategy
 * Layer: Application
 * Domain: Document → [PDF, DOCX, TXT, MD, EPUB] → ParsedDocument
 * Data Contract:
 *   Input: File (from <input type="file">)
 *   Output: ParsedDocument { text, pageCount?, metadata? }
 *   Consumer: AdaptationPage, future import flows
 * Edge Cases: Unsupported format, corrupt file, empty content, very large file (>10MB)
 * Allowed Deps: parse_pdf_browser, parse_pdf_liteparse_tauri, parse_docx_browser, parse_text_browser, parse_epub_browser
 */

export interface ParsedDocument {
  text: string;
  pageCount?: number;
  title?: string;
  metadata?: Record<string, string | undefined>;
}

export interface DocumentParserOptions {
  maxPages?: number;
  onProgress?: (message: string) => void;
}

type SupportedExtension = '.pdf' | '.docx' | '.doc' | '.txt' | '.md' | '.rtf' | '.epub';

const SUPPORTED_EXTENSIONS: SupportedExtension[] = ['.pdf', '.docx', '.doc', '.txt', '.md', '.rtf', '.epub'];

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.rtf']);

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.slice(lastDot).toLowerCase();
}

function isSupportedExtension(ext: string): ext is SupportedExtension {
  return SUPPORTED_EXTENSIONS.includes(ext as SupportedExtension);
}

/**
 * Parse any supported document file → unified text output.
 * Auto-detects format from file extension and routes to the correct parser.
 *
 * Supported formats:
 * - .pdf  → LiteParse on Tauri desktop, fallback to pdfjs-dist
 * - .docx → mammoth
 * - .txt, .md, .rtf → FileReader
 * - .epub → JSZip + OPF/spine extraction
 */
export async function parseDocument(
  file: File,
  options?: DocumentParserOptions
): Promise<ParsedDocument> {
  const ext = getFileExtension(file.name);

  if (!isSupportedExtension(ext)) {
    throw new Error(
      `Định dạng "${ext}" không được hỗ trợ. ` +
      `Hỗ trợ: ${SUPPORTED_EXTENSIONS.join(', ')}`
    );
  }

  // STEP 1: Route to correct parser based on file extension
  if (ext === '.pdf') {
    options?.onProgress?.('Đang parse PDF...');

    try {
      const { parsePdfWithLiteparseTauri } = await import('./parse_pdf_liteparse_tauri');
      const liteparseResult = await parsePdfWithLiteparseTauri(file, {
        maxPages: options?.maxPages,
      });

      if (liteparseResult) {
        options?.onProgress?.(`Đã parse ${liteparseResult.pageCount ?? 0} trang PDF bằng LiteParse`);
        return liteparseResult;
      }
    } catch (error) {
      console.warn('[DocumentParser] LiteParse unavailable, falling back to pdfjs-dist:', error);
      options?.onProgress?.('LiteParse không khả dụng, chuyển sang parser mặc định...');
    }

    const buffer = await file.arrayBuffer();
    const { parsePdfFromBuffer } = await import('./parse_pdf_browser');
    const result = await parsePdfFromBuffer(buffer, { maxPages: options?.maxPages });
    options?.onProgress?.(`Đã parse ${result.pageCount ?? 0} trang PDF`);
    return result;
  }

  if (ext === '.docx' || ext === '.doc') {
    options?.onProgress?.('Đang đọc file DOCX...');
    const buffer = await file.arrayBuffer();
    const { parseDocxFromBuffer } = await import('./parse_docx_browser');
    const result = await parseDocxFromBuffer(buffer);
    options?.onProgress?.('Đã đọc xong DOCX');
    return result;
  }

  if (ext === '.epub') {
    options?.onProgress?.('Đang đọc file EPUB...');
    const buffer = await file.arrayBuffer();
    const { parseEpubFromBuffer } = await import('./parse_epub_browser');
    const result = await parseEpubFromBuffer(buffer);
    options?.onProgress?.('Đã đọc xong EPUB');
    return result;
  }

  if (TEXT_EXTENSIONS.has(ext)) {
    options?.onProgress?.('Đang đọc file văn bản...');
    const { parseTextFromFile } = await import('./parse_text_browser');
    const result = await parseTextFromFile(file);
    options?.onProgress?.('Đã đọc xong');
    return result;
  }

  // Fallback — should never reach here due to guard above
  throw new Error(`Parser chưa được implement cho định dạng "${ext}".`);
}

/**
 * Check if a file extension is supported by the document parser.
 */
export function isDocumentSupported(fileName: string): boolean {
  return isSupportedExtension(getFileExtension(fileName));
}

/**
 * Get the accept string for <input type="file"> element.
 */
export function getAcceptString(): string {
  return SUPPORTED_EXTENSIONS.join(',');
}
