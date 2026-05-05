import { describe, expect, it } from 'vitest';

import { applyEditorDraftInsertion } from './editor_draft_insertion';

describe('applyEditorDraftInsertion', () => {
  it('appends chapter-scope AI prose to the open draft', () => {
    expect(
      applyEditorDraftInsertion('Đoạn hiện tại.', {
        content: 'Đoạn viết tiếp.',
        scope: 'chapter',
      }),
    ).toBe('Đoạn hiện tại.\n\nĐoạn viết tiếp.');
  });

  it('continues directly when the open draft stops in the middle of a word', () => {
    expect(
      applyEditorDraftInsertion('Lục Phong không nhấc tay khỏi vảy rồng: "Nói rõ h', {
        content: 'ơn. Đừng để ta phải hỏi lần thứ hai."',
        scope: 'chapter',
      }),
    ).toBe('Lục Phong không nhấc tay khỏi vảy rồng: "Nói rõ hơn. Đừng để ta phải hỏi lần thứ hai."');
  });

  it('continues with a space when the open draft stops after a comma', () => {
    expect(
      applyEditorDraftInsertion('Lâm Tề nâng tay,', {
        content: 'để chạm vào khe nứt lạnh buốt.',
        scope: 'chapter',
      }),
    ).toBe('Lâm Tề nâng tay, để chạm vào khe nứt lạnh buốt.');
  });

  it('starts an empty draft with the AI prose', () => {
    expect(
      applyEditorDraftInsertion('', {
        content: 'Mở đầu chương mới.',
        scope: 'chapter',
      }),
    ).toBe('Mở đầu chương mới.');
  });

  it('replaces only the selected fragment when fragment scope is used', () => {
    const current = 'Trước. Đoạn cũ. Sau.';
    const selected = 'Đoạn cũ.';
    const start = current.indexOf(selected);

    expect(
      applyEditorDraftInsertion(current, {
        content: 'Đoạn mới.',
        scope: 'fragment',
        selection: {
          start,
          end: start + selected.length,
          text: selected,
        },
      }),
    ).toBe('Trước. Đoạn mới. Sau.');
  });
});
