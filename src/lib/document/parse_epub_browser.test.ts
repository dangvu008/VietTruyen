import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { parseEpubFromBuffer } from './parse_epub_browser';

describe('parse_epub_browser', () => {
  it('extracts ordered chapter text and metadata from epub archives', async () => {
    const zip = new JSZip();

    zip.file(
      'META-INF/container.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles>
          <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>`
    );

    zip.file(
      'OEBPS/content.opf',
      `<?xml version="1.0" encoding="UTF-8"?>
      <package version="3.0" xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Phàm Nhân Tu Tiên</dc:title>
        </metadata>
        <manifest>
          <item id="chapter-1" href="chapter-1.xhtml" media-type="application/xhtml+xml"/>
          <item id="chapter-2" href="chapter-2.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine>
          <itemref idref="chapter-1"/>
          <itemref idref="chapter-2"/>
        </spine>
      </package>`
    );

    zip.file(
      'OEBPS/chapter-1.xhtml',
      `<html><body><h1>Chuong 1</h1><p>Mo dau cau chuyen.</p></body></html>`
    );

    zip.file(
      'OEBPS/chapter-2.xhtml',
      `<html><body><h1>Chuong 2</h1><p>Bi mat duoc tiet lo.</p></body></html>`
    );

    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const result = await parseEpubFromBuffer(buffer);

    expect(result.title).toBe('Phàm Nhân Tu Tiên');
    expect(result.text).toContain('Chuong 1');
    expect(result.text).toContain('Mo dau cau chuyen.');
    expect(result.text).toContain('Chuong 2');
    expect(result.text).toContain('Bi mat duoc tiet lo.');
    expect(result.metadata?.engine).toBe('JSZip');
  });
});
