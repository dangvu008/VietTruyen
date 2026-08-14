import { describe, expect, it } from 'vitest';
import { evaluateNarrativeValueGate } from './narrative_value_gate';

describe('narrative value gate', () => {
  it('holds a technically clean but narratively removable scene', () => {
    const result = evaluateNarrativeValueGate({
      scenes: [
        {
          sceneId: 's1',
          summary: 'Nhân vật đi qua hành lang và nghĩ lại điều đã biết.',
          changes: [],
          removalImpact: 'none',
        },
      ],
    });

    expect(result.verdict).toBe('HOLD');
    expect(result.blockers.some((item) => item.includes('no evidenced narrative function'))).toBe(true);
  });

  it('passes a quiet scene when it materially changes a relationship', () => {
    const result = evaluateNarrativeValueGate({
      scenes: [
        {
          sceneId: 's1',
          summary: 'Hai nhân vật nói chuyện ngắn sau thất bại.',
          changes: [
            { kind: 'relationship', description: 'A quyết định tin B thêm một mức.' },
          ],
          removalImpact: 'medium',
        },
      ],
    });

    expect(result.verdict).toBe('PASS');
  });

  it('does not require immediate state change for a necessary setup scene', () => {
    const result = evaluateNarrativeValueGate({
      scenes: [
        {
          sceneId: 's1',
          summary: 'Một chi tiết vật lý được đặt vào cảnh để payoff sau.',
          changes: [],
          removalImpact: 'medium',
          setupOrPayoffNecessary: true,
        },
      ],
    });

    expect(result.verdict).toBe('PASS');
  });

  it('holds low-impact redundant scenes', () => {
    const result = evaluateNarrativeValueGate({
      scenes: [
        {
          sceneId: 's2',
          summary: 'Lặp lại cùng chức năng cảm xúc của cảnh trước.',
          changes: [{ kind: 'character_state', description: 'Nhấn lại sự do dự đã xác lập.' }],
          removalImpact: 'low',
          redundantWithSceneIds: ['s1'],
        },
      ],
    });

    expect(result.verdict).toBe('HOLD');
    expect(result.blockers.some((item) => item.includes('duplicates s1'))).toBe(true);
  });
});
