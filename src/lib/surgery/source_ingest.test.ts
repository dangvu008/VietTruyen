import { describe, expect, it } from 'vitest';

import { parseRawTextToChapters } from './source_ingest';

describe('parseRawTextToChapters', () => {
  it('ignores heading-only blocks caused by repeated document page headers', () => {
    const chapters = parseRawTextToChapters(`
Chương 1: Hồ Nữ
Chương 1: Hồ Nữ
Nàng xuất hiện dưới trăng, tóc trắng như sương.
Tiếng chuông cổ tự vọng qua rừng.

Chương 2: Dạ Hành
Chương 2: Dạ Hành
Gã thư sinh men theo con đường đất đỏ.
    `);

    expect(chapters).toHaveLength(2);
    expect(chapters[0]).toMatchObject({
      title: 'Chương 1: Hồ Nữ',
      content: 'Nàng xuất hiện dưới trăng, tóc trắng như sương.\nTiếng chuông cổ tự vọng qua rừng.',
      sequenceNumber: 1,
    });
    expect(chapters[1]).toMatchObject({
      title: 'Chương 2: Dạ Hành',
      content: 'Gã thư sinh men theo con đường đất đỏ.',
      sequenceNumber: 2,
    });
  });
});
