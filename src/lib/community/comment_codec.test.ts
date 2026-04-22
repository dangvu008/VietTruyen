import { describe, expect, it } from 'vitest';
import { parseStoryCommentPayload, serializeStoryCommentPayload } from './comment_codec';

describe('story comment codec', () => {
  it('round-trips workshop contributions', () => {
    const encoded = serializeStoryCommentPayload({
      content: 'Nghi phạm xuất hiện lại ở cuối chương.',
      kind: 'plot-twist',
      headline: 'Cú bẻ lái cuối chương 8',
    });

    expect(parseStoryCommentPayload(encoded)).toEqual({
      content: 'Nghi phạm xuất hiện lại ở cuối chương.',
      kind: 'plot-twist',
      headline: 'Cú bẻ lái cuối chương 8',
    });
  });

  it('keeps legacy plain-text comments readable', () => {
    expect(parseStoryCommentPayload('Đoạn này rất cuốn.')).toEqual({
      content: 'Đoạn này rất cuốn.',
      kind: 'discussion',
    });
  });
});
