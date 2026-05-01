import { describe, expect, it } from 'vitest';

import { getDiscussTopicsForIdea } from './creation_discuss_config';

describe('getDiscussTopicsForIdea', () => {
  it('keeps the cultivation power question for speculative power premises', () => {
    const topics = getDiscussTopicsForIdea('Một kỹ sư dữ liệu xuyên vào thế giới tu tiên.');

    expect(topics[0].id).toBe('magic_system');
    expect(topics[0].suggestionGroups[0].chips.some((chip) => chip.label.includes('linh khí'))).toBe(true);
  });

  it('uses a genre-neutral opening question for non-power premises', () => {
    const topics = getDiscussTopicsForIdea('Một vụ án mạng trong hậu cung thời Lê sơ.');

    expect(topics[0].id).toBe('story_engine');
    expect(topics[0].questionTemplate).toContain('Điểm hấp dẫn cốt lõi');
    expect(topics[0].suggestionGroups[0].chips.some((chip) => chip.label.includes('linh khí'))).toBe(false);
  });
});
