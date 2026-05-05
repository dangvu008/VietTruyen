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

  it('deduplicates TOC entries vs actual chapters — keeps full-content version', () => {
    const chapters = parseRawTextToChapters(`
Chương 1: Sơn Biên Tiểu Thôn
Chương 2: Thanh Ngưu Trấn
Chương 3: Hải Đảo Huyền Bí

Chương 1: Sơn Biên Tiểu Thôn
Dưới chân núi có một ngôi làng nhỏ, bốn bề là rừng trúc xanh ngắt. Sương mù buổi sáng phủ kín cả thung lũng.
Người dân nơi đây sống bằng nghề trồng trọt và chăn nuôi, cuộc sống yên bình trôi qua từ thế hệ này sang thế hệ khác.

Chương 2: Thanh Ngưu Trấn
Trấn nhỏ nằm cạnh dòng sông lớn, thuyền bè qua lại tấp nập. Tiếng rao hàng vang khắp phố chợ từ sáng sớm.
Gã thư sinh bước vào quán trà bên đường, gọi một ấm trà nóng và ngồi quan sát dòng người.

Chương 3: Hải Đảo Huyền Bí
Ngoài khơi xa, có một hòn đảo mà ngư dân không ai dám đến gần. Truyền thuyết kể rằng nơi đó có yêu quái trấn giữ.
    `);

    expect(chapters).toHaveLength(3);
    expect(chapters[0].title).toBe('Chương 1: Sơn Biên Tiểu Thôn');
    expect(chapters[0].content).toContain('ngôi làng nhỏ');
    expect(chapters[0].sequenceNumber).toBe(1);

    expect(chapters[1].title).toBe('Chương 2: Thanh Ngưu Trấn');
    expect(chapters[1].content).toContain('quán trà bên đường');
    expect(chapters[1].sequenceNumber).toBe(2);

    expect(chapters[2].title).toBe('Chương 3: Hải Đảo Huyền Bí');
    expect(chapters[2].content).toContain('yêu quái trấn giữ');
    expect(chapters[2].sequenceNumber).toBe(3);
  });

  it('filters out TOC-only blocks where content is just other chapter headers', () => {
    const chapters = parseRawTextToChapters(`
Chương 1: Khởi Đầu
Chương 2: Cuộc Gặp Gỡ
Chương 3: Biến Cố

Chương 1: Khởi Đầu
Buổi sáng hôm ấy, trời trong xanh không một gợn mây. Gió thổi nhẹ qua cánh đồng lúa vàng rực, mang theo hương thơm ngào ngạt.

Chương 2: Cuộc Gặp Gỡ
Hai người gặp nhau tại ngã tư đường. Một ánh mắt, một nụ cười, và số phận đã thay đổi mãi mãi.

Chương 3: Biến Cố
Đêm hôm đó, trời đổ mưa lớn. Sấm chớp liên hồi chiếu sáng cả bầu trời đen kịt.
    `);

    // The TOC block at the top should be filtered — only real chapters remain
    expect(chapters).toHaveLength(3);
    // Each chapter should have real narrative content, not TOC artifacts
    for (const chapter of chapters) {
      expect(chapter.content.length).toBeGreaterThan(30);
    }
  });

  it('handles normal chapters without TOC — no false filtering', () => {
    const chapters = parseRawTextToChapters(`
Chương 1: Mở Đầu
Ngày xửa ngày xưa, có một chàng trai trẻ sống bên bờ suối. Mỗi sáng chàng ra suối gánh nước về nhà.

Chương 2: Phiêu Lưu
Một ngày nọ, chàng quyết định rời làng đi tìm kho báu huyền thoại mà ông nội từng kể.
    `);

    expect(chapters).toHaveLength(2);
    expect(chapters[0].content).toContain('chàng trai trẻ');
    expect(chapters[1].content).toContain('kho báu huyền thoại');
  });
});

