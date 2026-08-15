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

  it('always asks for one primary genre with optional secondary genres', () => {
    const topics = getDiscussTopicsForIdea('Một truyện đời thường về gia đình.');
    const genreTopic = topics.find((topic) => topic.id === 'genre_stack');
    expect(genreTopic?.required).toBe(true);
    expect(genreTopic?.suggestionGroups[0]).toMatchObject({ selectionMode: 'single', required: true });
    expect(genreTopic?.suggestionGroups[1]).toMatchObject({ selectionMode: 'multi', required: false });
    expect(genreTopic?.suggestionGroups[0].chips.every((chip) => chip.value?.startsWith('PRIMARY_GENRE='))).toBe(true);
  });

  it('offers broad writing-style types without darkness or rhythm locks', () => {
    const topics = getDiscussTopicsForIdea('Một truyện tiên hiệp cổ đại.');
    const styleTopic = topics.find((topic) => topic.id === 'tone_antagonist');
    const values = styleTopic?.suggestionGroups[0].chips.map((chip) => chip.value) ?? [];
    expect(values).toContain('WRITING_STYLE=plain_clear');
    expect(values).toContain('WRITING_STYLE=classic_grave');
    expect(values).toContain('WRITING_STYLE=custom');
    expect(values.join(' ')).not.toContain('Dark');
  });

  it('offers seven broad era frames and no 1-5 intensity group', () => {
    const topics = getDiscussTopicsForIdea('Một truyện tiên hiệp cổ đại.');
    const eraTopic = topics.find((topic) => topic.id === 'era_register');
    expect(eraTopic?.required).toBe(true);
    expect(eraTopic?.suggestionGroups).toHaveLength(1);
    expect(eraTopic?.suggestionGroups[0].chips.map((chip) => chip.value)).toEqual([
      'ERA_FRAME=contemporary',
      'ERA_FRAME=near_premodern',
      'ERA_FRAME=period',
      'ERA_FRAME=future',
      'ERA_FRAME=timeless_fantasy',
      'ERA_FRAME=mixed',
      'ERA_FRAME=custom',
    ]);
  });
});
