/**
 * File: urban_brainwave_template.ts
 * Purpose: Story template cho thể loại Đô Thị Não Động / Quy Tắc Xâm Nhập
 * Layer: Data (Constants)
 * Domain: StoryTemplate → [creation_orchestrator, context_builder]
 * Deps: types/story_template
 */

import type { StoryTemplate } from '../../types/story_template';

export const URBAN_BRAINWAVE_TEMPLATE: StoryTemplate = {
  id: 'urban-brainwave',
  name: 'Đô Thị Não Động / Dị Tượng',
  originalName: '都市脑洞',
  coreSellingPoint: 'Đô thị hiện thực + Quy tắc/dị tượng xâm nhập + Phản chuyển cao. Siêu nhiên xâm nhập đời thường.',
  tags: ['urban', 'supernatural', 'rules', 'modern', 'system'],

  subGenres: [
    { name: 'Quy tắc xâm nhập lưu', description: 'Thế giới hiện thực bị quy tắc siêu nhiên xâm nhập.', coreAppeal: 'Phát hiện quy tắc, lợi dụng quy tắc, phản sát.' },
    { name: 'Đô thị dị tượng lưu', description: 'Đô thị xuất hiện các hiện tượng bất thường.', coreAppeal: 'Thám hiểm dị tượng, hé lộ chân tướng, năng lực giác tỉnh.' },
    { name: 'Hệ thống giáng lâm lưu', description: 'Hệ thống/game hóa xâm nhập hiện thực.', coreAppeal: 'Lợi dụng hệ thống, hoàn thành nhiệm vụ, đẳng cấp nghiền áp.' },
    { name: 'Song song thế giới lưu', description: 'Phát hiện/xuyên qua thế giới song song.', coreAppeal: 'Thám hiểm thế giới, quy tắc khác biệt, thân phận chuyển đổi.' },
  ],

  worldRules: [
    { name: 'Dị thường đẳng cấp', description: 'Nhật thường cấp (cá nhân) → Sự kiện cấp (khu vực) → Tai nạn cấp (thành phố) → Mạt nhật cấp (toàn cầu).' },
    { name: 'Tin tức tầng cấp', description: 'Hoàn toàn tri tình (cao tầng) → Bộ phận tri tình (chấp hành) → Biên duyên tri tình (liên quan) → Hoàn toàn không biết (bình thường).' },
    { name: 'Đại giá hệ thống', description: 'Sinh lý (thương tổn), tinh thần (tâm trí hao tổn), tài nguyên (tiêu hao), tồn tại (tồn tại cảm giảm).' },
  ],

  coolPatterns: [
    { name: 'Quy tắc phá giải', scenario: 'Phát hiện lỗ hổng quy tắc.', appeal: 'Lợi dụng lỗ hổng đào thoát / phản sát.' },
    { name: 'Năng lực giác tỉnh', scenario: 'Giữa sinh tử giác tỉnh năng lực đặc thù.', appeal: 'Phản sát kẻ thù, xoay chuyển cục diện.' },
    { name: 'Chân tướng hé lộ', scenario: 'Vén màn chân tướng sau dị thường.', appeal: 'Hoảng nhiên đại ngộ, trước sau hô ứng.' },
    { name: 'Đẳng cấp nghiền áp', scenario: 'Dùng năng lực cao cấp nghiền áp dị thường cấp thấp.', appeal: 'Dễ dàng giải quyết, triển thị trưởng thành.' },
  ],

  conflictPatterns: [
    { type: 'Sinh tồn trong dị thường', source: 'Sự kiện siêu nhiên', resolution: 'Phát hiện + lợi dụng quy tắc' },
    { type: 'Tổ chức bí mật', source: 'Chính phủ / dân gian', resolution: 'Gia nhập hoặc đối đầu' },
    { type: 'Đồng hồ đếm ngược', source: 'Thời hạn dị thường', resolution: 'Áp lực tăng cường kịch tính' },
    { type: 'Nhật thường vs dị thường', source: 'Hai mặt cuộc sống', resolution: 'Cân bằng bí mật' },
  ],

  outlineArcs: [
    { title: 'Quyển 1: Nhập Môn', chapterRange: '1-60', percentageOfTotal: 12, coreFocus: 'Tiếp xúc thế giới dị thường.', coreConflict: 'Năng lực sơ bộ giác tỉnh.', climax: 'Lần đầu giải quyết dị thường sự kiện.' },
    { title: 'Quyển 2: Trưởng Thành', chapterRange: '61-150', percentageOfTotal: 18, coreFocus: 'Năng lực đề thăng, hiểu biết nhiều hơn.', coreConflict: 'Giải quyết trọng đại dị thường sự kiện.', climax: 'Chất biến năng lực.' },
    { title: 'Quyển 3: Thâm Nhập', chapterRange: '151-280', percentageOfTotal: 26, coreFocus: 'Thám hiểm chân tướng thế giới dị thường.', coreConflict: 'Hé lộ bộ phận chân tướng.', climax: 'Phát hiện lớn.' },
    { title: 'Quyển 4: Đối Kháng', chapterRange: '281-400', percentageOfTotal: 24, coreFocus: 'Đối đầu cao cấp dị thường / thế lực.', coreConflict: 'Đánh bại kẻ thù chính.', climax: 'Tiệm cận đỉnh phong.' },
    { title: 'Quyển 5: Chung Cục', chapterRange: '401-500', percentageOfTotal: 20, coreFocus: 'Chân tướng cuối cùng, đối quyết tối chung.', coreConflict: 'Viên mãn.', climax: 'Giải quyết nguồn gốc dị thường.' },
  ],

  targetWordCount: '1.500.000 chữ',
  targetChapterCount: 500,

  pitfalls: [
    { description: 'Quy tắc tự mâu thuẫn.', severity: 'critical' },
    { description: 'Đại giá không đổi hiện — nói có mà không bao giờ trả.', severity: 'critical' },
    { description: 'Phản chuyển quá nhiều mất chân thực.', severity: 'warning' },
    { description: 'MC khai quải không đại giá.', severity: 'warning' },
  ],

  bestPractices: [
    { description: 'Quy tắc tự nhất quán, có thể kiểm chứng.' },
    { description: 'Đại giá rõ ràng và phải được đổi hiện.' },
    { description: 'Phản chuyển có phục bút.' },
    { description: 'Nhật thường và dị thường đối lập tạo xung kích.' },
  ],

  entityTags: [
    { type: 'quy_tac', nameVi: 'Quy tắc', attributes: ['điều kiện kích hoạt', 'hình phạt vi phạm', 'lỗ hổng'] },
    { type: 'di_thuong', nameVi: 'Dị thường', attributes: ['đặc điểm', 'nguy hiểm', 'điểm yếu', 'nguồn gốc'] },
    { type: 'nang_luc', nameVi: 'Năng lực', attributes: ['hiệu quả', 'đại giá', 'giới hạn'] },
  ],

  constraintPacks: ['Pack M04', 'Pack M05', 'Pack U02'],
};
