/**
 * File: farming_template.ts
 * Purpose: Story template cho thể loại Điền Văn / Kinh Doanh / Xây Dựng Thế Lực
 * Layer: Data (Constants)
 * Domain: StoryTemplate → [creation_orchestrator, context_builder]
 * Deps: types/story_template
 */

import type { StoryTemplate } from '../../types/story_template';

export const FARMING_TEMPLATE: StoryTemplate = {
  id: 'farming',
  name: 'Điền Văn / Kinh Doanh / Xây Dựng Thế Lực',
  originalName: '种田',
  coreSellingPoint: 'Tích lũy tài nguyên + Xây dựng thế lực + Phát triển ổn định. "Cao xây tường, rộng tích lương, chậm xưng vương".',
  tags: ['farming', 'kingdom-building', 'slice-of-life', 'management'],

  subGenres: [
    { name: 'Thế lực kinh doanh lưu', description: 'Xây dựng căn cứ, phát triển nông nghiệp/kinh tế/quân sự.', coreAppeal: 'Thế lực mở rộng, khoa kỹ nghiền ép.' },
    { name: 'Lĩnh địa xây dựng lưu', description: 'Nhận lĩnh địa, từ zero xây dựng.', coreAppeal: 'Lĩnh địa thăng cấp, dân số tăng trưởng.' },
    { name: 'Gia trưởng lý đoản lưu', description: 'Cuộc sống bình dị, tiểu nhân vật phấn đấu.', coreAppeal: 'Phát gia trí phú, cải thiện cuộc sống.' },
  ],

  worldRules: [
    { name: 'Phát triển giai đoạn', description: 'Lập Túc → Phát Triển → Khuếch Trương → Tranh Bá → Thống Nhất. Mỗi giai đoạn có thử thách riêng.' },
    { name: 'Nội chính hệ thống', description: 'Nông nghiệp → Công nghiệp → Thương nghiệp → Quân sự → Khoa kỹ → Chính trị. 6 trụ cột phát triển.' },
    { name: 'Kinh tế tuần hoàn', description: 'Sản xuất → Gia công → Bán hàng → Tích lũy vốn → Mở rộng sản xuất. + Nâng cấp công nghệ → Hiệu suất.' },
  ],

  coolPatterns: [
    { name: 'Khoa kỹ nghiền ép', scenario: 'Dùng công nghệ vượt thời đại đánh bại đối thủ lạc hậu.', appeal: 'Giáng chiều đả kích, lấy ít thắng nhiều.' },
    { name: 'Nhân tài quy tâm', scenario: 'Các lộ nhân tài đầu quân.', appeal: 'Nhân tài tề tụ, chúng tinh phụng nguyệt.' },
    { name: 'Phát gia trí phú', scenario: 'Từ nghèo khó đến giàu có.', appeal: 'Tiền bạc tăng dần, cuộc sống tốt lên.' },
    { name: 'Vả mặt cực phẩm', scenario: 'Họ hàng/láng giềng khinh thường, sau đó hối hận.', appeal: 'Sướng nhẹ, hả dạ.' },
  ],

  conflictPatterns: [
    { type: 'Ngoại địch xâm lấn', source: 'Thế lực địch đối', resolution: 'Phòng thủ quân sự' },
    { type: 'Nội bộ phản loạn', source: 'Thế lực bất mãn', resolution: 'Thủ đoạn chính trị' },
    { type: 'Tranh chấp đất đai', source: 'Địa chủ/láng giềng', resolution: 'Cứ lý lực tranh' },
    { type: 'Thiên tai', source: 'Tự nhiên/nhân tạo', resolution: 'Nội chính ứng phó' },
  ],

  outlineArcs: [
    { title: 'Quyển 1: Lập Túc', chapterRange: '1-80', percentageOfTotal: 15, coreFocus: 'Đạt được căn cứ, đứng vững.', coreConflict: 'Đánh lui mối đe dọa đầu tiên.', climax: 'Mùa thu hoạch đầu tiên.' },
    { title: 'Quyển 2: Phát Triển', chapterRange: '81-200', percentageOfTotal: 25, coreFocus: 'Nội chính xây dựng, tích lũy thực lực.', coreConflict: 'Khoa kỹ/chế độ bước đầu hiệu quả.', climax: 'Trở thành thế lực khu vực.' },
    { title: 'Quyển 3: Khuếch Trương', chapterRange: '201-400', percentageOfTotal: 30, coreFocus: 'Thôn tính xung quanh, mở rộng.', coreConflict: 'Đối đầu thế lực ngang hàng.', climax: 'Thành bá chủ một phương.' },
    { title: 'Quyển 4: Tranh Bá & Thống Nhất', chapterRange: '401-600+', percentageOfTotal: 30, coreFocus: 'Trục lộc thiên hạ, thống nhất.', coreConflict: 'Trận chiến quyết định.', climax: 'Đăng cơ / viên mãn.' },
  ],

  targetWordCount: '2.000.000 chữ',
  targetChapterCount: 600,

  pitfalls: [
    { description: 'Viết như sổ kế toán, không có xung đột.', severity: 'critical' },
    { description: 'Phát triển quá thuận lợi, không có trắc trở.', severity: 'warning' },
    { description: 'Khoa kỹ/chế độ không phù hợp thời đại.', severity: 'warning' },
    { description: 'Số liệu không hợp lý (dân số, sản lượng).', severity: 'warning' },
  ],

  bestPractices: [
    { description: 'Có xung đột, có trắc trở — phát triển phải có cái giá.' },
    { description: 'Khoa kỹ tuần tự tiệm tiến, không nhảy cóc.' },
    { description: 'Nhân vật phụ (nhân tài) cần có cá tính riêng.' },
  ],

  entityTags: [
    { type: 'the_luc', nameVi: 'Thế lực', attributes: ['lĩnh thổ', 'dân số', 'quân lực'] },
    { type: 'khoa_ky', nameVi: 'Khoa kỹ', attributes: ['hiệu quả', 'tiền đề', 'chi phí'] },
    { type: 'nhan_tai', nameVi: 'Nhân tài', attributes: ['năng lực', 'trung thành', 'loại'] },
    { type: 'tai_san', nameVi: 'Tài sản', attributes: ['giá trị', 'nguồn', 'quy mô'] },
  ],

  constraintPacks: ['Pack F12', 'Pack U03'],
};
