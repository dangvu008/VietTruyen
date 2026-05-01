/**
 * File: western_fantasy_template.ts
 * Purpose: Story template cho thể loại Tây Huyễn / Fantasy Phương Tây
 * Layer: Data (Constants)
 * Domain: StoryTemplate → [creation_orchestrator, context_builder]
 * Deps: types/story_template
 */

import type { StoryTemplate } from '../../types/story_template';

export const WESTERN_FANTASY_TEMPLATE: StoryTemplate = {
  id: 'western-fantasy',
  name: 'Tây Huyễn / Fantasy Phương Tây',
  originalName: '西幻',
  coreSellingPoint: 'Thần ma thể hệ + Hiệp sĩ mạo hiểm + Khế ước đại giá. Viết sử thi phàm nhân giữa khe hở thần và ma.',
  tags: ['western-fantasy', 'fantasy', 'magic', 'knight', 'epic'],

  subGenres: [
    { name: 'Hiệp sĩ mạo hiểm lưu', description: 'DND style, tổ đội đánh quái thăng cấp.', coreAppeal: 'Phối hợp nhóm, thu thập trang bị, BOSS chiến.' },
    { name: 'Ma pháp học viện lưu', description: 'Vào trường ma pháp, học viện + mạo hiểm.', coreAppeal: 'Thiên phú giác tỉnh, học viện cạnh tranh, sư phụ truyền thừa.' },
    { name: 'Thần quyền giáo đình lưu', description: 'Thần minh thực tồn, giáo hội khống chế thế giới.', coreAppeal: 'Tín ngưỡng bác dịch, thần quyền đối kháng, chân tướng hé lộ.' },
    { name: 'Lĩnh chúa kinh doanh lưu', description: 'Nhận lĩnh địa, phát triển thế lực tranh bá.', coreAppeal: 'Xây dựng lĩnh địa, tuyển dụng nhân tài, chỉ huy chiến tranh.' },
    { name: 'Hắc ám sử thi lưu', description: 'Thế giới tàn khốc, đạo đức xám, kháng tranh mệnh vận.', coreAppeal: 'Tuyệt cảnh cầu sinh, lựa chọn đạo đức, sử thi chiến dịch.' },
  ],

  worldRules: [
    { name: 'Chủng tộc thể hệ', description: 'Nhân loại (thích ứng mạnh), Tinh linh (trường thọ, ma pháp), Ai nhân (công tượng), Thú nhân (lực lượng mạnh), Long tộc (đỉnh chiến lực).' },
    { name: 'Giai cấp cấu trúc', description: 'Thần minh → Giáo hoàng → Quốc vương → Quý tộc/Hiệp sĩ → Thương nhân → Nông dân/Nô lệ.' },
    { name: 'Ma pháp đại giá', description: 'Tinh thần lực tiêu hao, sinh mệnh lực khó hồi phục, lý trí trị (tiếp xúc cấm kỵ tri thức), khế ước ràng buộc.' },
  ],

  powerSystem: {
    name: 'Ma pháp hoàn cấp',
    tiers: [
      { name: '1 hoàn - Học đồ', description: 'Pháp thuật cơ bản.', stats: 'Người thường' },
      { name: '3 hoàn - Chính thức pháp sư', description: 'Chiến đấu pháp thuật.', stats: 'Được tôn trọng' },
      { name: '5 hoàn - Cao giai pháp sư', description: 'Lĩnh vực pháp thuật.', stats: 'Đãi ngộ quý tộc' },
      { name: '7 hoàn - Đại pháp sư', description: 'Cấm chú.', stats: 'Cấp quốc sư' },
      { name: '9 hoàn - Truyền kỳ pháp sư', description: 'Thay đổi quy tắc.', stats: 'Sức mạnh ngang quốc gia' },
    ],
  },

  coolPatterns: [
    { name: 'Huyết mạch giác tỉnh', scenario: 'MC phát hiện huyết mạch đặc thù (Long/Ma/Thần).', appeal: 'Thiên phú nghiền áp, năng lực độc nhất.' },
    { name: 'Truyền thừa cổ đại', scenario: 'Phát hiện di tích đại pháp sư/hiệp sĩ cổ đại.', appeal: 'Thực lực phi dược, mở rộng thế giới quan.' },
    { name: 'Khế ước triệu hoán', scenario: 'Ký khế ước với tồn tại cường đại.', appeal: 'Trợ lực mạnh mẽ, nhưng phải trả giá.' },
    { name: 'Thân phận phản chuyển', scenario: 'Tiểu nhân vật bị khinh thường, thân phận thật kinh người.', appeal: 'Thân phận hé lộ, vả mặt mọi người.' },
  ],

  conflictPatterns: [
    { type: 'Thần quyền vs Vương quyền', source: 'Giáo đình / Vương quốc', resolution: 'Chính trị + vũ lực' },
    { type: 'Hắc ám thế lực', source: 'Tà giáo / Ma tộc', resolution: 'Liên minh anh hùng' },
    { type: 'Huyết mạch xung đột', source: 'Chủng tộc kỳ thị', resolution: 'Chứng minh bằng hành động' },
    { type: 'Ma pháp cấm kỵ', source: 'Nghiên cứu vượt giới hạn', resolution: 'Lựa chọn đạo đức' },
  ],

  outlineArcs: [
    { title: 'Quyển 1: Khởi Nguyên', chapterRange: '1-80', percentageOfTotal: 12, coreFocus: 'MC giác tỉnh / nhập học, xây nền năng lực.', coreConflict: 'Chiến thắng đồng cấp cường địch.', climax: 'Thể hiện thiên phú.' },
    { title: 'Quyển 2: Lịch Luyện', chapterRange: '81-180', percentageOfTotal: 15, coreFocus: 'Mạo hiểm bên ngoài, tổ đội.', coreConflict: 'Hoàn thành nhiệm vụ trọng đại.', climax: 'Được công nhận.' },
    { title: 'Quyển 3: Quật Khởi', chapterRange: '181-350', percentageOfTotal: 25, coreFocus: 'Cuốn vào bác dịch đại thế lực.', coreConflict: 'Trở thành hạt nhân thế lực.', climax: 'Đánh bại đại địch.' },
    { title: 'Quyển 4: Tranh Bá', chapterRange: '351-550', percentageOfTotal: 28, coreFocus: 'Tham gia xung đột cấp đại lục.', coreConflict: 'Đánh bại chủ yếu kẻ thù, hé lộ chân tướng.', climax: 'Chiến thắng sử thi.' },
    { title: 'Quyển 5: Thần Chiến', chapterRange: '551-700', percentageOfTotal: 20, coreFocus: 'Đối kháng thần minh / chí cao tồn tại.', coreConflict: 'Thành thần / thay đổi quy tắc thế giới.', climax: 'Viên mãn.' },
  ],

  targetWordCount: '2.000.000 chữ',
  targetChapterCount: 700,

  pitfalls: [
    { description: 'Thế giới quan danh từ chất chồng, độc giả không hiểu.', severity: 'warning' },
    { description: 'Chủng tộc thiết lập sao chép y nguyên, không có sáng tạo.', severity: 'warning' },
    { description: 'Ma pháp không có đại giá, MC vô địch.', severity: 'critical' },
    { description: 'Phối giác công cụ nhân, không có nhân cách độc lập.', severity: 'warning' },
  ],

  bestPractices: [
    { description: 'Thế giới quan từng bước triển khai, vừa đi vừa giới thiệu.' },
    { description: 'Ma pháp có đại giá rõ ràng và giới hạn.' },
    { description: 'Phối giác có tuyến truyện riêng, không chỉ phục vụ MC.' },
    { description: 'Khế ước phải có cái giá, không thể "bạch phiêu".' },
  ],

  entityTags: [
    { type: 'phap_thuat', nameVi: 'Pháp thuật', attributes: ['hiệu quả', 'hoàn số', 'lưu phái', 'đại giá'] },
    { type: 'than_minh', nameVi: 'Thần minh', attributes: ['lĩnh vực', 'trận doanh', 'giáo hội'] },
    { type: 'chung_toc', nameVi: 'Chủng tộc', attributes: ['đặc điểm', 'thọ mệnh', 'thiên phú'] },
    { type: 'trang_bi', nameVi: 'Trang bị', attributes: ['hiệu quả', 'phẩm cấp', 'chất liệu'] },
  ],

  constraintPacks: ['Pack M22', 'Pack U01'],
};
