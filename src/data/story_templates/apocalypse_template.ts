/**
 * File: apocalypse_template.ts
 * Purpose: Story template cho thể loại Mạt Thế / Hậu Tận Thế
 * Layer: Data (Constants)
 * Domain: StoryTemplate → [creation_orchestrator, context_builder]
 * Deps: types/story_template
 */

import type { StoryTemplate } from '../../types/story_template';

export const APOCALYPSE_TEMPLATE: StoryTemplate = {
  id: 'apocalypse',
  name: 'Mạt Thế / Hậu Tận Thế',
  originalName: '末世',
  coreSellingPoint: 'Tài nguyên sụp đổ + Sinh tồn bác dịch + Nhân tính lựa chọn. Xây dựng lại trật tự trên đống tàn tro.',
  tags: ['apocalypse', 'survival', 'base-building', 'zombie'],

  subGenres: [
    { name: 'Tang thi mạt thế lưu', description: 'Virus bùng phát, xác sống tràn lan.', coreAppeal: 'Giết zombie thăng cấp, xây dựng khu an toàn.' },
    { name: 'Dị biến mạt thế lưu', description: 'Linh khí khôi phục/bức xạ đột biến, người tỉnh thức dị năng.', coreAppeal: 'Dị năng tỉnh thức, săn thú biến dị, thu thập tài liệu tiến hóa.' },
    { name: 'Thiên tai mạt thế lưu', description: 'Thiên tai (băng hà/hạn hán/động đất), tài nguyên cạn kiệt.', coreAppeal: 'Tích trữ vật tư, kinh doanh nơi trú ẩn, thám hiểm phế tích.' },
    { name: 'Trật tự tái lập lưu', description: 'Tái xây dựng sau thảm họa, thế lực tranh bá.', coreAppeal: 'Mở rộng thế lực, tuyển dụng nhân tài, thiết lập chế độ.' },
  ],

  worldRules: [
    { name: 'Tài nguyên pháp tắc', description: 'Thực phẩm: đồng tiền cứng nhất. Nước sạch quý hơn vàng. Thuốc kháng sinh đổi một mạng. Nhiên liệu = khả năng cơ động.' },
    { name: 'Nhân tính quang phổ', description: 'Thánh nhân (giữ đáy tuyến) → Người thường → Vùng xám (sinh tồn bất chấp) → Ác nhân (lợi dụng hỗn loạn).' },
    { name: 'Thế lực phân bố', description: 'Quân đội tàn bộ, cụm sống sót, nhóm cướp bóc, giáo phái mạt thế, cơ quan nghiên cứu.' },
  ],

  powerSystem: {
    name: 'Dị năng tỉnh thức',
    tiers: [
      { name: 'Nhất giai', description: 'Cơ thể cường hóa, mạnh gấp 2-3 lần người thường.' },
      { name: 'Nhị giai', description: 'Nguyên tố sơ hiện, thao khống đơn nguyên tố.' },
      { name: 'Tam giai', description: 'Nguyên tố tinh thông, AOE tấn công.' },
      { name: 'Tứ giai', description: 'Lĩnh vực hình thành, phạm vi nhỏ bóp méo quy tắc.' },
      { name: 'Ngũ giai', description: 'Truyền thuyết cấp, một người diệt cả thành zombie.' },
    ],
    balanceRules: [
      'Tinh hạch từ sinh vật đột biến là chìa khóa thăng cấp.',
      'Dị năng có giới hạn và phụ tác dụng.',
      'Cao cấp hơn không có nghĩa vô địch — chiến thuật nhóm quan trọng.',
    ],
  },

  coolPatterns: [
    { name: 'Tích trữ vật tư', scenario: 'Trước/đầu mạt thế, MC tích trữ điên cuồng.', appeal: 'Người khác đói, MC ăn uống thoải mái.', keyNote: 'Cần lý do hợp lý (trọng sinh/dự tri/không gian).' },
    { name: 'Xây dựng căn cứ', scenario: 'Từ zero xây dựng pháo đài an toàn.', appeal: 'Từ đổ nát thành pháo đài, từ cô đơn thành đội ngũ.' },
    { name: 'Cứu người thu phục', scenario: 'Cứu kẻ cùng đường, nhận trung thành.', appeal: 'Đội ngũ lớn mạnh, mỗi người có vai trò.' },
    { name: 'Thế lực nghiền áp', scenario: 'Tiểu thế lực khiêu khích, không biết thực lực MC.', appeal: 'Một người diệt một băng, chấn nhiếp bốn phương.' },
  ],

  conflictPatterns: [
    { type: 'Sinh tồn cơ bản', source: 'Thực phẩm/nước/thuốc cạn kiệt', resolution: 'Thám hiểm + tích trữ thông minh' },
    { type: 'Thế lực xâm lấn', source: 'Nhóm cướp / quân đội hòa trang', resolution: 'Phòng thủ + liên minh' },
    { type: 'Nhân tính lựa chọn', source: 'Cứu ai bỏ ai, tin ai nghi ai', resolution: 'Quyết định có cái giá' },
    { type: 'Đợt tấn công lớn', source: 'Xác sống triều / thú đột biến', resolution: 'Phòng tuyến + hy sinh + sáng tạo' },
  ],

  outlineArcs: [
    { title: 'Quyển 1: Cầu Sinh', chapterRange: '1-80', percentageOfTotal: 12, coreFocus: 'Mạt thế giáng lâm, MC tỉnh thức, gian nan sinh tồn.', coreConflict: 'Đánh bại biến dị thể cao giai đầu tiên.', climax: 'Đạt năng lực quan trọng.' },
    { title: 'Quyển 2: Lập Túc', chapterRange: '81-180', percentageOfTotal: 15, coreFocus: 'Xây dựng/gia nhập cứ điểm, đứng vững.', coreConflict: 'Đẩy lùi xác sống triều/thế lực đối địch.', climax: 'Cứ điểm ổn định.' },
    { title: 'Quyển 3: Khuếch Trương', chapterRange: '181-350', percentageOfTotal: 25, coreFocus: 'Mở rộng thế lực, thôn tính xung quanh.', coreConflict: 'Trở thành bá chủ khu vực.', climax: 'Đánh bại đối thủ ngang hàng.' },
    { title: 'Quyển 4: Tranh Bá', chapterRange: '351-550', percentageOfTotal: 28, coreFocus: 'Đấu trí đấu lực với đại thế lực.', coreConflict: 'Thống nhất khu vực lớn / phát hiện chân tướng mạt thế.', climax: 'Bước ngoặt chiến lược.' },
    { title: 'Quyển 5: Chung Cục', chapterRange: '551-700', percentageOfTotal: 20, coreFocus: 'Giải quyết nguồn gốc mạt thế / xây dựng trật tự mới.', coreConflict: 'Nhân loại tìm lại hy vọng.', climax: 'Viên mãn.' },
  ],

  targetWordCount: '2.000.000 chữ',
  targetChapterCount: 700,

  pitfalls: [
    { description: 'MC thánh mẫu, cứu người không có đáy tuyến.', severity: 'critical' },
    { description: 'Tài nguyên đạt được quá dễ, mất cảm giác mạt thế.', severity: 'critical' },
    { description: 'Chỉ viết đánh quái, không viết nhân tính.', severity: 'warning' },
    { description: 'Hậu kỳ vô địch, mất cảm giác căng thẳng.', severity: 'warning' },
  ],

  bestPractices: [
    { description: 'MC có đáy tuyến nhưng không thánh mẫu — có lựa chọn, có cái giá.' },
    { description: 'Tài nguyên luôn căng thẳng, cần lựa chọn đánh đổi.' },
    { description: 'Xung đột nhân tính là nhìn điểm cốt lõi, không chỉ đánh quái.' },
    { description: 'Luôn có mối đe dọa mạnh hơn phía trước.' },
  ],

  entityTags: [
    { type: 'bien_di', nameVi: 'Biến dị thể', attributes: ['đặc điểm', 'cấp bậc', 'điểm yếu', 'vật phẩm rơi'] },
    { type: 'cu_diem', nameVi: 'Cứ điểm', attributes: ['quy mô', 'dân số', 'phòng thủ', 'tài nguyên'] },
    { type: 'the_luc', nameVi: 'Thế lực', attributes: ['tính chất', 'thủ lĩnh', 'thực lực', 'quan hệ MC'] },
    { type: 'vat_tu', nameVi: 'Vật tư', attributes: ['công dụng', 'hiếm có', 'tồn kho'] },
    { type: 'di_nang', nameVi: 'Dị năng', attributes: ['hiệu quả', 'cấp bậc', 'tiêu hao'] },
  ],

  constraintPacks: ['Pack M20', 'Pack U03'],
};
