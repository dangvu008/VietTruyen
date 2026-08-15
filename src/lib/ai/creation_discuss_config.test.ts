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

  it('always asks the writer to choose modern, period, or mixed era style', () => {
    const topics = getDiscussTopicsForIdea('Một truyện đời thường về gia đình.');
    const eraTopic = topics.find((topic) => topic.id === 'era_register');

    expect(eraTopic).toBeDefined();
    expect(eraTopic?.required).toBe(true);
    expect(eraTopic?.suggestionGroups[0]).toMatchObject({
      selectionMode: 'single',
      required: true,
    });
    expect(eraTopic?.suggestionGroups[0].chips.map((chip) => chip.value)).toEqual([
      'ERA_FRAME=contemporary',
      'ERA_FRAME=period',
      'ERA_FRAME=mixed',
    ]);
  });

  it('reveals the 1-5 period intensity only for period or mixed choices', () => {
    const topics = getDiscussTopicsForIdea('Một truyện tiên hiệp cổ đại.');
    const eraTopic = topics.find((topic) => topic.id === 'era_register');
    const levelGroup = eraTopic?.suggestionGroups[1];

    expect(levelGroup).toMatchObject({
      selectionMode: 'single',
      required: true,
      visibleWhenSelectedValues: ['ERA_FRAME=period', 'ERA_FRAME=mixed'],
    });
    expect(levelGroup?.chips.map((chip) => chip.value)).toEqual([
      'ERA_LEVEL=1',
      'ERA_LEVEL=2',
      'ERA_LEVEL=3',
      'ERA_LEVEL=4',
      'ERA_LEVEL=5',
    ]);
  });
});