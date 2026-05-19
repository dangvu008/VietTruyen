import { describe, expect, it } from 'vitest';

import { extractWriterVisibleContent } from './writer_response_content';

describe('extractWriterVisibleContent', () => {
  it('strips Markdown artifacts and merges prose lines into paragraphs', () => {
    const response = `@@CONTENT@@
# Chương tạm
Lục Phong cúi xuống bên mép nước
và nghe hơi lạnh bò qua cổ tay.


— Dòng này là lời thoại.

***

​> Hắn không nói nữa.`;

    expect(extractWriterVisibleContent(response)).toBe(
      'Chương tạm Lục Phong cúi xuống bên mép nước và nghe hơi lạnh bò qua cổ tay.\n\n— Dòng này là lời thoại.\n\nHắn không nói nữa.',
    );
  });

  it('merges fragmented prose lines within the same paragraph', () => {
    const response = `Và Thẩm Vô Nhai đứng ở mũi thuyền,
nhìn vào vùng nước đang dần phẳng lặng trở lại.


Đứa trẻ đó không biết
mình đang giữ thứ gì.`;

    expect(extractWriterVisibleContent(response)).toBe(
      'Và Thẩm Vô Nhai đứng ở mũi thuyền, nhìn vào vùng nước đang dần phẳng lặng trở lại.\n\nĐứa trẻ đó không biết mình đang giữ thứ gì.',
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

  it('strips Markdown bullets and merges prose, keeps em-dash dialogue', () => {
    const response = `- Đây là bullet sẽ bị strip.
* Đây cũng vậy.
— Đây là lời thoại, giữ lại.`;

    expect(extractWriterVisibleContent(response)).toBe(
      'Đây là bullet sẽ bị strip. Đây cũng vậy.\n— Đây là lời thoại, giữ lại.',
    );
  });

  it('strips inline markdown formatting (bold, italic, code)', () => {
    const response = `Hắn **nhìn** nàng, _mắt_ đầy \`nghi hoặc\`.`;

    expect(extractWriterVisibleContent(response)).toBe(
      'Hắn nhìn nàng, mắt đầy nghi hoặc.',
    );
  });

  it('removes space before punctuation', () => {
    const response = `Nàng cười , rồi quay đi .`;

    expect(extractWriterVisibleContent(response)).toBe(
      'Nàng cười, rồi quay đi.',
    );
  });

  it('merges one-sentence-per-line AI output into flowing paragraphs', () => {
    const response = `Hắn bước vào căn phòng tối.
Không gì cả.
Chỉ mùi ẩm mốc và tiếng nước nhỏ giọt đâu đó phía xa.

Lão nhân ngồi ở góc, bất động như tượng đá.
Hắn không thèm ngẩng đầu lên.`;

    expect(extractWriterVisibleContent(response)).toBe(
      'Hắn bước vào căn phòng tối. Không gì cả. Chỉ mùi ẩm mốc và tiếng nước nhỏ giọt đâu đó phía xa.\n\nLão nhân ngồi ở góc, bất động như tượng đá. Hắn không thèm ngẩng đầu lên.',
    );
  });

  it('keeps dialogue on separate lines while merging surrounding prose', () => {
    const response = `Hắn cười nhẹ, mắt nheo lại.
Ánh trăng dội lên khuôn mặt hắn.
— Ngươi thật ngốc. — Hắn khẽ thở dài.
— Ta biết. — Nàng đáp.
Rồi cả hai im lặng.`;

    expect(extractWriterVisibleContent(response)).toBe(
      'Hắn cười nhẹ, mắt nheo lại. Ánh trăng dội lên khuôn mặt hắn.\n— Ngươi thật ngốc. — Hắn khẽ thở dài.\n— Ta biết. — Nàng đáp.\nRồi cả hai im lặng.',
    );
  });
});
