import { describe, expect, it } from 'vitest';
import {
  DEEP_WRITING_MODE_PROFILE,
  buildDeepWritingNotes,
  isDeepWritingMode,
} from './deep_writing_mode';

describe('Deep Writing mode', () => {
  it('maps the existing quality selection to Deep Writing', () => {
    expect(isDeepWritingMode({ qualityMode: 'quality' })).toBe(true);
    expect(isDeepWritingMode({ qualityMode: undefined })).toBe(true);
    expect(isDeepWritingMode({ qualityMode: 'balanced' })).toBe(false);
    expect(isDeepWritingMode({ qualityMode: 'fast' })).toBe(false);
  });

  it('deepens craft without increasing plot complexity', () => {
    const directive = DEEP_WRITING_MODE_PROFILE.directive;
    expect(directive).toContain('DEEP CRAFT, NOT DEEPER PLOT');
    expect(directive).toContain('Creative Complexity Governor');
    expect(directive).toContain('Atmospheric detail ≠ Narrative signal');
    expect(directive).toContain('Author knowledge ≠ Character knowledge ≠ Reader knowledge');
    expect(directive).toContain('KHÔNG phát minh');
  });

  it('preserves author notes and appends the deep craft contract', () => {
    const notes = buildDeepWritingNotes('Giữ cảnh này yên, không thêm nhân vật mới.');
    expect(notes).toContain('Giữ cảnh này yên');
    expect(notes).toContain('DEEP WRITING MODE');
    expect(notes).toContain('Correct the broken, preserve the alive');
  });
});
