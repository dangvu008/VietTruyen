import { describe, expect, it } from 'vitest';
import { getAcceptString, isDocumentSupported } from './document_parser';

describe('document_parser', () => {
  it('accepts epub files in the picker and support guard', () => {
    expect(isDocumentSupported('novel.epub')).toBe(true);
    expect(getAcceptString()).toContain('.epub');
  });
});
