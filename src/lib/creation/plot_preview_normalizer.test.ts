import { describe, expect, it } from 'vitest';

import {
  buildPlotPreviewRepairFeedback,
  getWeakPlotPreviewReasons,
  isWeakPlotPreview,
  normalizeCreationPlotPreview,
} from './plot_preview_normalizer';

describe('plot_preview_normalizer', () => {
  it('cleans inline structural artifacts and trailing runtime tokens', () => {
    const preview = normalizeCreationPlotPreview({
      title: 'Thiên Đạo',
      logline: 'Một thiếu niên ăn cắp thiên cơ để sống sót giữa loạn cục.',
      protagonist: 'Thiên Dương - đứa trẻ bị bỏ rơi, sống bằng nghề móc túi, vô danh tặc bắt đầu tAndroid 0.',
      openingSetup: 'Arc 1: Cậu bị lôi vào buổi tế đẫm máu ngay giữa phiên chợ đêm.',
      centralConflict: 'Phần 2: Cậu phải chọn giữa chạy trốn và chạm vào bí kíp cấm.',
      escalation: 'chuyện toàn lục địa.,Arc 4: Trộm thiên đạo khiến mọi thế lực truy sát cậu.',
      endingPromise: 'Cậu bước tới cửa trời cuối cùng Android 0.',
      hooks: ['1. Bí kíp phát sáng giữa máu tAndroid 0.', '2. Một lão ăn mày biết tên thật của cậu.'],
    });

    expect(preview.protagonist).not.toContain('Android');
    expect(preview.openingSetup).not.toContain('Arc 1');
    expect(preview.centralConflict).not.toContain('Phần 2');
    expect(preview.escalation).not.toContain('Arc 4');
    expect(preview.hooks[0]).toBe('Bí kíp phát sáng giữa máu');
  });

  it('flags weak previews and produces repair guidance', () => {
    const weakPreview = {
      title: 'Thiên Đạo',
      logline: 'Một đứa trẻ trộm đạo.',
      protagonist: 'Thiên Dương là trẻ mồ côi.',
      openingSetup: 'Cậu gặp rắc rối.',
      centralConflict: 'Bị truy sát Android 0.',
      escalation: 'Arc 4: Càng lúc càng nguy hiểm.',
      endingPromise: 'Cậu thay đổi số mệnh.',
      hooks: ['Bí mật lớn', 'Phản diện lộ diện'],
    };

    expect(isWeakPlotPreview(weakPreview)).toBe(true);
    expect(getWeakPlotPreviewReasons(weakPreview)).toEqual(
      expect.arrayContaining([
        'Logline còn quá ngắn',
        'Nhân vật chính còn quá ngắn',
        'Xung đột trung tâm còn quá ngắn',
        'Leo thang còn quá ngắn',
        'Móc câu đọc tiếp chưa đủ 3 ý riêng',
      ]),
    );
    expect(buildPlotPreviewRepairFeedback(weakPreview)).toContain('Không dùng nhãn kiểu Arc 1/Arc 2');
  });
});
