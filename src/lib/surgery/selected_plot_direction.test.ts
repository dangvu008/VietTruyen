import { describe, expect, it } from 'vitest';

import {
  buildSelectedPlotDirectionInstruction,
  getSelectedPlotDirection,
} from './selected_plot_direction';
import type { SurgerySpec } from '../../types/surgery';

describe('selected_plot_direction', () => {
  it('returns null when a spec has no selected plot direction', () => {
    const spec: SurgerySpec = {
      id: 'spec-1',
      projectId: 'project-1',
      title: 'Spec',
      description: '',
      status: 'draft',
      directives: [],
      assumptions: [],
      blockedReasons: [],
      sourceFormat: 'project',
      createdAt: 'now',
      updatedAt: 'now',
    };

    expect(getSelectedPlotDirection(spec)).toBeNull();
  });

  it('formats the chosen direction as rewrite guidance', () => {
    const instruction = buildSelectedPlotDirectionInstruction({
      id: 'twist',
      title: 'Chết giả',
      stance: 'twist',
      summary: 'Cái chết của phản diện là lớp ngụy trang.',
      riskLevel: 'medium',
      affectedRange: '12 chương',
      rewritePolicy: 'downgrade_presence',
      downstreamImpact: ['Phục bút chiếc nhẫn đổi payoff'],
      tradeoffs: ['Cần gieo seed rõ hơn'],
      whyChoose: 'Giữ bất ngờ mà không phá endgame',
      selectedAt: '2026-05-05T08:00:00.000Z',
    });

    expect(instruction).toContain('Hướng cốt truyện đã chọn: Chết giả');
    expect(instruction).toContain('Cái chết của phản diện');
    expect(instruction).toContain('Phục bút chiếc nhẫn');
    expect(instruction).toContain('downgrade_presence');
  });
});
