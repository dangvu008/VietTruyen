/**
 * File: parse_epub_browser.ts
 * Purpose: Parse EPUB archives in browser/node environments via JSZip
 * Layer: Infrastructure
 * Domain: Document → EPUB parsing
 * Data Contract: Input: ArrayBuffer | Output: ParsedDocument
 * Edge Cases: Missing container.xml, malformed OPF, empty spine, HTML-heavy chapters
 * Allowed Deps: jszip
 */

import JSZip from 'jszip';
import type { ParsedDocument } from './document_parser';

interface ManifestItem {
  href: string;
  mediaType?: string;
}

const XHTML_MEDIA_TYPES = new Set([
  'application/xhtml+xml',
  'text/html',
  'application/html+xml',
]);

const BLOCK_TAG_PATTERN = /<\/?(?:address|article|aside|blockquote|br|div|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|section|table|tr|ul)\b[^>]*>/gi;
const TAG_PATTERN = /<[^>]+>/g;
const WHITESPACE_PATTERN = /[^\S\r\n]+/g;
const LINE_BREAK_PATTERN = /\n{3,}/g;
const ATTRIBUTE_PATTERN = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export async function parseEpubFromBuffer(buffer: ArrayBuffer): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(buffer);
  const packagePath = await resolvePackagePath(zip);
  const packageFile = zip.file(packagePath);

  if (!packageFile) {
    throw new Error('EPUB không hợp lệ: không tìm thấy file package (.opf).');
  }

  const packageXml = await packageFile.async('string');
  const title = extractPackageTitle(packageXml);
  const basePath = getParentPath(packagePath);
  const manifest = extractManifest(packageXml, basePath);
  const spine = extractSpine(packageXml);
  const chapterPaths = resolveChapterPaths(manifest, spine);

  if (chapterPaths.length === 0) {
    throw new Error('EPUB không có nội dung chương hợp lệ.');
  }

  const chapterTexts = await Promise.all(
    chapterPaths.map(async (chapterPath) => {
      const chapterFile = zip.file(chapterPath);
      if (!chapterFile) return '';

      const markup = await chapterFile.async('string');
      return convertMarkupToPlainText(markup);
    })
  );

  const text = chapterTexts
    .map((chapterText) => chapterText.trim())
    .filter(Boolean)
    .join('\n\n');

  if (!text) {
    throw new Error('EPUB không chứa văn bản có thể trích xuất.');
  }

  return {
    text,
    title,
    metadata: {
      engine: 'JSZip',
      packagePath,
      chapterCount: String(chapterPaths.length),
    },
  };
}

async function resolvePackagePath(zip: JSZip): Promise<string> {
  const containerFile = zip.file('META-INF/container.xml');

  if (containerFile) {
    const containerXml = await containerFile.async('string');
    const rootfileTag = containerXml.match(/<rootfile\b[^>]*>/i)?.[0];
    const rootfilePath = rootfileTag ? getAttributeValue(rootfileTag, 'full-path') : undefined;

    if (rootfilePath) {
      return normalizeZipPath(rootfilePath);
    }
  }

  const fallbackPackagePath = Object.keys(zip.files).find((filePath) => filePath.toLowerCase().endsWith('.opf'));
  if (fallbackPackagePath) {
    return fallbackPackagePath;
  }

  throw new Error('EPUB không hợp lệ: thiếu META-INF/container.xml và package (.opf).');
}

function extractPackageTitle(packageXml: string): string | undefined {
  const dcTitle = packageXml.match(/<dc:title\b[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1];
  const title = dcTitle ?? packageXml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeHtmlEntities(stripTags(title)).trim() : undefined;
}

function extractManifest(packageXml: string, basePath: string): Map<string, ManifestItem> {
  const manifest = new Map<string, ManifestItem>();
  const itemTags = packageXml.match(/<item\b[^>]*>/gi) ?? [];

  itemTags.forEach((itemTag) => {
    const id = getAttributeValue(itemTag, 'id');
    const href = getAttributeValue(itemTag, 'href');

    if (!id || !href) return;

    manifest.set(id, {
      href: joinZipPath(basePath, href),
      mediaType: getAttributeValue(itemTag, 'media-type')?.toLowerCase(),
    });
  });

  return manifest;
}

function extractSpine(packageXml: string): string[] {
  const itemRefs = packageXml.match(/<itemref\b[^>]*>/gi) ?? [];

  return itemRefs
    .map((itemRefTag) => getAttributeValue(itemRefTag, 'idref'))
    .filter((idRef): idRef is string => Boolean(idRef));
}

function resolveChapterPaths(manifest: Map<string, ManifestItem>, spine: string[]): string[] {
  const orderedPaths = spine
    .map((idRef) => manifest.get(idRef))
    .filter((item): item is ManifestItem => Boolean(item))
    .map((item) => item.href);

  if (orderedPaths.length > 0) {
    return orderedPaths;
  }

  return [...manifest.values()]
    .filter((item) => {
      if (item.mediaType && XHTML_MEDIA_TYPES.has(item.mediaType)) return true;
      return /\.(xhtml|html|htm)$/i.test(item.href);
    })
    .map((item) => item.href);
}

function convertMarkupToPlainText(markup: string): string {
  const sanitized = markup
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(BLOCK_TAG_PATTERN, '\n');

  const withoutTags = stripTags(sanitized);
  const decoded = decodeHtmlEntities(withoutTags).replace(/\r/g, '');

  return decoded
    .split('\n')
    .map((line) => line.replace(WHITESPACE_PATTERN, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .replace(LINE_BREAK_PATTERN, '\n\n')
    .trim();
}

function stripTags(value: string): string {
  return value.replace(TAG_PATTERN, ' ');
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, body: string) => {
    const normalizedBody = body.toLowerCase();

    if (normalizedBody.startsWith('#x')) {
      const codePoint = Number.parseInt(normalizedBody.slice(2), 16);
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
    }

    if (normalizedBody.startsWith('#')) {
      const codePoint = Number.parseInt(normalizedBody.slice(1), 10);
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
    }

    return namedEntities[normalizedBody] ?? entity;
  });
}

function getAttributeValue(tag: string, attributeName: string): string | undefined {
  let match: RegExpExecArray | null = ATTRIBUTE_PATTERN.exec(tag);

  while (match) {
    if (match[1] === attributeName) {
      ATTRIBUTE_PATTERN.lastIndex = 0;
      return match[2] ?? match[3];
    }

    match = ATTRIBUTE_PATTERN.exec(tag);
  }

  ATTRIBUTE_PATTERN.lastIndex = 0;
  return undefined;
}

function getParentPath(filePath: string): string {
  const normalizedPath = normalizeZipPath(filePath);
  const lastSlashIndex = normalizedPath.lastIndexOf('/');
  return lastSlashIndex === -1 ? '' : normalizedPath.slice(0, lastSlashIndex);
}

function joinZipPath(basePath: string, relativePath: string): string {
  const parts = [...basePath.split('/').filter(Boolean), ...relativePath.split('/')];
  const resolvedParts: string[] = [];

  parts.forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') {
      resolvedParts.pop();
      return;
    }

    resolvedParts.push(part);
  });

  return resolvedParts.join('/');
}

function normalizeZipPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}
