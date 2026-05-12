import { describe, expect, it } from 'vitest';

import { extractWriterVisibleContent } from './writer_response_content';

describe('extractWriterVisibleContent', () => {
  it('strips Markdown artifacts but preserves prose structure', () => {
    const response = `@@CONTENT@@
# Chương tạm
Lục Phong cúi xuống bên mép nước
và nghe hơi lạnh bò qua cổ tay.


— Dòng này là lời thoại.

***

\u200B> Hắn không nói nữa.`;

    expect(extractWriterVisibleContent(response)).toBe(
      'Chương tạm\nLục Phong cúi xuống bên mép nước\nvà nghe hơi lạnh bò qua cổ tay.\n\n— Dòng này là lời thoại.\n\nHắn không nói nữa.',
    );
  });

  it('preserves single newlines as sentence/dialogue breaks', () => {
    const response = `Và Thẩm Vô Nhai đứng ở mũi thuyền,
nhìn vào vùng nước đang dần phẳng lặng trở lại.


Đứa trẻ đó không biết
mình đang giữ thứ gì.`;

    expect(extractWriterVisibleContent(response)).toBe(
      'Và Thẩm Vô Nhai đứng ở mũi thuyền,\nnhìn vào vùng nước đang dần phẳng lặng trở lại.\n\nĐứa trẻ đó không biết\nmình đang giữ thứ gì.',
    );
  });

  it('preserves em-dash dialogue markers at line starts', () => {
    const response = `Hắn quay đầu nhìn.

— Ngươi tới rồi sao? — hắn hỏi.
— Phải. — Cô gái đáp.

Gió thổi lùa qua.`;

    expect(extractWriterVisibleContent(response)).toBe(
      'Hắn quay đầu nhìn.\n\n— Ngươi tới rồi sao? — hắn hỏi.\n— Phải. — Cô gái đáp.\n\nGió thổi lùa qua.',
    );
  });

  it('preserves en-dash dialogue markers at line starts', () => {
    const response = `– Đi thôi. – Hắn nói.
– Chờ ta. – Nàng đáp.`;

    expect(extractWriterVisibleContent(response)).toBe(
      '– Đi thôi. – Hắn nói.\n– Chờ ta. – Nàng đáp.',
    );
  });

  it('collapses 3+ blank lines to double-newline paragraph break', () => {
    const response = `Đoạn một.



Đoạn hai.`;

    expect(extractWriterVisibleContent(response)).toBe(
      'Đoạn một.\n\nĐoạn hai.',
    );
  });

  it('strips Markdown bullets but keeps em-dash', () => {
    const response = `- Đây là bullet sẽ bị strip.
* Đây cũng vậy.
— Đây là lời thoại, giữ lại.`;

    expect(extractWriterVisibleContent(response)).toBe(
      'Đây là bullet sẽ bị strip.\nĐây cũng vậy.\n— Đây là lời thoại, giữ lại.',
    );
  });
});
