import { describe, expect, it } from 'vitest';
import type { Project } from '../../types/story';
import type { SurpriseBranch } from '../../types/surprise';
import {
  buildCreativeComplexityDirective,
  resolveCreativeComplexityPolicy,
  resolveWriterPolicyFromBranch,
} from './creative_complexity_governor';

function projectWithBeat(beat: Partial<Project['outline'][number]>): Project {
  return {
    id: 'p1',
    title: 'Test',
    outline: [{
      id: 'beat-1',
      title: 'Quiet chapter',
      summary: 'Nhân vật hoàn tất một việc nhỏ và trở về.',
      focus: 'Main',
      ...beat,
    }],
  } as Project;
}

function branch(overrides: Partial<SurpriseBranch> = {}): SurpriseBranch {
  return {
    id: 'branch-1',
    suggestedTitle: 'Test',
    tensionLevel: 'follow',
    summary: 'Đi theo beat hiện tại.',
    surpriseVector: 'none',
    beatStrategy: 'follow',
    preservedAnchorIds: [],
    challengedExpectation: 'none',
    foreshadowNow: [],
    impactTrace: [],
    riskScore: 1,
    ...overrides,
  };
}

describe('creative complexity governor', () => {
  it('keeps an ordinary follow chapter LOW and invention-free by default', () => {
    const policy = resolveCreativeComplexityPolicy({
      project: projectWithBeat({ chapterRole: 'falling', suspenseLevel: 1, plotTwistLevel: 1 }),
      targetChapterIndex: 0,
      tensionLevel: 'follow',
    });

    expect(policy.level).toBe('LOW');
    expect(policy.maxNewNamedEntities).toBe(0);
    expect(policy.maxNewForeshadowSeeds).toBe(0);
    expect(policy.allowCliffhanger).toBe(false);
    expect(policy.allowUnplannedLore).toBe(false);
    expect(policy.allowUnplannedTwist).toBe(false);
  });

  it('allows a high-complexity ceiling only when the planned beat actually warrants it', () => {
    const policy = resolveCreativeComplexityPolicy({
      project: projectWithBeat({
        chapterRole: 'climax',
        suspenseLevel: 5,
        plotTwistLevel: 5,
        foreshadowingHint: 'Một clue đã được lên kế hoạch',
      }),
      targetChapterIndex: 0,
      tensionLevel: 'subvert',
    });

    expect(policy.level).toBe('HIGH');
    expect(policy.maxNewForeshadowSeeds).toBe(1);
    expect(policy.allowCliffhanger).toBe(true);
    expect(policy.allowUnplannedLore).toBe(false);
    expect(policy.allowUnplannedTwist).toBe(false);
  });

  it('does not treat complexity budget as permission for unplanned invention', () => {
    const policy = resolveWriterPolicyFromBranch(
      branch({ tensionLevel: 'twist', foreshadowNow: ['planned clue'] }),
      'twist',
    );

    expect(policy.level).toBe('MEDIUM');
    expect(policy.maxNewForeshadowSeeds).toBe(1);
    expect(policy.allowUnplannedLore).toBe(false);
    expect(policy.allowUnplannedTwist).toBe(false);
  });

  it('tells a low-complexity writer not to manufacture a cliffhanger or narrative signal', () => {
    const directive = buildCreativeComplexityDirective(
      resolveWriterPolicyFromBranch(branch(), 'follow'),
    );

    expect(directive).toContain('KHÔNG mặc định tạo cliffhanger/hook');
    expect(directive).toContain('Atmospheric detail ≠ Narrative signal');
    expect(directive).toContain('Minimum Necessary Invention');
    expect(directive).toContain('Author knowledge ≠ Character knowledge ≠ Reader knowledge');
  });
});
