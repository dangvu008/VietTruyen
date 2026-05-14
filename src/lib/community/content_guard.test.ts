import { describe, expect, it } from 'vitest';
import { checkContent } from './content_guard';

describe('content_guard', () => {
  it('passes clean text', () => {
    expect(checkContent('Truyện rất hay, cảm ơn tác giả!')).toEqual({ clean: true });
  });

  it('passes empty text', () => {
    expect(checkContent('')).toEqual({ clean: true });
    expect(checkContent('   ')).toEqual({ clean: true });
  });

  it('flags inappropriate content', () => {
    const result = checkContent('đồ ngu');
    expect(result.clean).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('detects abbreviations', () => {
    const result = checkContent('dcm sao kì vậy');
    expect(result.clean).toBe(false);
  });

  it('handles diacritics normalization', () => {
    const result = checkContent('con đĩ');
    expect(result.clean).toBe(false);
  });
});
