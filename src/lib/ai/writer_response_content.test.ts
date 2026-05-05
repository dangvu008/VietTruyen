import { describe, expect, it } from 'vitest';

import { extractWriterVisibleContent } from './writer_response_content';

describe('extractWriterVisibleContent', () => {
  it('normalizes prose artifacts after the content marker', () => {
    const response = `@@CONTENT@@
# Chương tạm
- Lục Phong cúi xuống bên mép nước
và nghe hơi lạnh bò qua cổ tay.


— Dòng này không phải gạch đầu dòng thật.

***

\u200B> Hắn không nói nữa.`;

    expect(extractWriterVisibleContent(response)).toBe(
      'Chương tạm Lục Phong cúi xuống bên mép nước và nghe hơi lạnh bò qua cổ tay.\n\nDòng này không phải gạch đầu dòng thật.\n\nHắn không nói nữa.',
    );
  });

  it('keeps paragraph breaks but unwraps arbitrary single newlines', () => {
    const response = `Và Thẩm Vô Nhai đứng ở mũi thuyền,
nhìn vào vùng nước đang dần phẳng lặng trở lại.


Đứa trẻ đó không biết
mình đang giữ thứ gì.`;

    expect(extractWriterVisibleContent(response)).toBe(
      'Và Thẩm Vô Nhai đứng ở mũi thuyền, nhìn vào vùng nước đang dần phẳng lặng trở lại.\n\nĐứa trẻ đó không biết mình đang giữ thứ gì.',
    );
  });
});
