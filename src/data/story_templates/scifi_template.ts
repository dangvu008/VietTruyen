/**
 * File: scifi_template.ts
 * Purpose: Story template cho thể loại Khoa Học Viễn Tưởng
 * Layer: Data (Constants)
 * Domain: StoryTemplate → [creation_orchestrator, context_builder]
 * Deps: types/story_template
 */

import type { StoryTemplate } from '../../types/story_template';

export const SCIFI_TEMPLATE: StoryTemplate = {
  id: 'scifi',
  name: 'Khoa Học Viễn Tưởng',
  originalName: '科幻',
  coreSellingPoint: 'Thiết lập khoa kỹ + Xung đột luân lý + Trí tưởng tượng hùng vĩ. Khám phá tương lai và biên giới nhân loại.',
  tags: ['scifi', 'science-fiction', 'space', 'cyberpunk', 'mech'],

  subGenres: [
    { name: 'Cyberpunk lưu', description: 'Công nghệ cao đời sống thấp, cải tạo cơ thể.', coreAppeal: 'Hacker xâm nhập, nâng cấp nghĩa thể, chống lại thể chế.' },
    { name: 'Thái không ca kịch lưu', description: 'Hành trình liên sao, văn minh ngoài hành tinh.', coreAppeal: 'Chiến hạm đối đầu, thám hiểm ngoài hành tinh, va chạm văn minh.' },
    { name: 'Ngạnh khoa huyễn lưu', description: 'Nguyên lý khoa học nghiêm cẩn, chi tiết kỹ thuật chân thực.', coreAppeal: 'Giải mã khoa học, đột phá kỹ thuật, suy diễn logic.' },
    { name: 'Cơ giáp / Chiến tranh lưu', description: 'Cơ giáp khổng lồ, chiến tranh liên sao.', coreAppeal: 'Lái cơ giáp, chỉ huy chiến thuật, vương bài phi hành gia.' },
  ],

  worldRules: [
    { name: 'Thang khoa kỹ (Kardashev cải)', description: '0.7: hành tinh bán phần (hiện tại). 1: toàn hành tinh. 2: hệ thống hằng tinh (Dyson sphere). 3: cấp ngân hà.' },
    { name: 'Đại giá khoa kỹ', description: 'Năng lượng tiêu hao, phụ tác dụng nghĩa thể, vấn đề luân lý (nhân bản, ý thức upload), công nghệ mất kiểm soát (AI phản biến).' },
  ],

  powerSystem: {
    name: 'Khoa kỹ thụ',
    tiers: [
      { name: 'Năng lượng', description: 'Hạch tụ biến → Phản vật chất → Chân không năng.' },
      { name: 'Đẩy tiến', description: 'Ion engine → Khúc suất quy động → Trùng động nhảy.' },
      { name: 'Vũ khí', description: 'Laser/điện từ → Hạt tử thúc → Hằng tinh pháo.' },
      { name: 'Sinh vật', description: 'Gene cải tạo → Nghĩa thể cải tạo → Ý thức upload.' },
    ],
  },

  coolPatterns: [
    { name: 'Kỹ thuật nghiền áp', scenario: 'MC nắm giữ kỹ thuật vượt thời đại.', appeal: 'Dùng high-tech đánh bại low-tech.' },
    { name: 'Cơ giáp giác tỉnh', scenario: 'MC và cơ giáp sản sinh liên kết đặc thù.', appeal: 'Nhân cơ hợp nhất, chiến lực bạo tăng.' },
    { name: 'Chiến hạm chỉ huy', scenario: 'MC trở thành hạm trưởng, chỉ huy chiến đấu.', appeal: 'Chiến thuật nghiền áp, lấy ít thắng nhiều.' },
    { name: 'Tiếp xúc văn minh', scenario: 'Lần đầu tiếp xúc văn minh ngoài hành tinh.', appeal: 'Xung kích văn hóa, giao lưu kỹ thuật, hóa giải nguy cơ.' },
  ],

  conflictPatterns: [
    { type: 'Tranh đoạt kỹ thuật', source: 'Tập đoàn/quốc gia', resolution: 'Liên minh hoặc đột phá độc lập' },
    { type: 'Chiến tranh liên sao', source: 'Đế quốc/liên bang', resolution: 'Chiến thuật + ngoại giao' },
    { type: 'AI phản biến', source: 'Trí tuệ nhân tạo giác ngộ', resolution: 'Đàm phán hoặc shutdown' },
    { type: 'Luân lý khoa kỹ', source: 'Nhân bản/ý thức upload', resolution: 'Lựa chọn đạo đức' },
  ],

  outlineArcs: [
    { title: 'Quyển 1: Giác Tỉnh', chapterRange: '1-80', percentageOfTotal: 12, coreFocus: 'MC đạt năng lực/kỹ thuật đặc thù.', coreConflict: 'Lần đầu thể hiện thực lực.', climax: 'Thu hút sự chú ý.' },
    { title: 'Quyển 2: Quật Khởi', chapterRange: '81-180', percentageOfTotal: 15, coreFocus: 'Gia nhập tổ chức, xây dựng vị thế.', coreConflict: 'Hoàn thành nhiệm vụ trọng đại.', climax: 'Được công nhận.' },
    { title: 'Quyển 3: Tranh Bá', chapterRange: '181-350', percentageOfTotal: 25, coreFocus: 'Cuốn vào đấu tranh thế lực.', coreConflict: 'Trở thành hạt nhân một phương thế lực.', climax: 'Đánh bại đối thủ chính.' },
    { title: 'Quyển 4: Chiến Tranh', chapterRange: '351-550', percentageOfTotal: 28, coreFocus: 'Tham gia chiến tranh liên sao.', coreConflict: 'Xoay chuyển cục diện, vạch trần âm mưu.', climax: 'Chiến thắng quyết định.' },
    { title: 'Quyển 5: Chung Cục', chapterRange: '551-700', percentageOfTotal: 20, coreFocus: 'Đối mặt mối đe dọa cuối cùng.', coreConflict: 'Cứu văn minh / thay đổi cục diện vũ trụ.', climax: 'Nhân loại tiến vào kỷ nguyên mới.' },
  ],

  targetWordCount: '2.000.000 chữ',
  targetChapterCount: 700,

  pitfalls: [
    { description: 'Thiết lập khoa kỹ trước sau mâu thuẫn.', severity: 'critical' },
    { description: 'Thuật ngữ chất chồng, độc giả không hiểu nổi.', severity: 'warning' },
    { description: 'Khoa kỹ vạn năng, không có đại giá.', severity: 'critical' },
    { description: 'Người ngoài hành tinh quá giống người Trái Đất.', severity: 'warning' },
  ],

  bestPractices: [
    { description: 'Thiết lập khoa kỹ tự nhất quán, có giới hạn rõ ràng.' },
    { description: 'Thuật ngữ từng bước giải thích, không dump info.' },
    { description: 'Văn minh ngoài hành tinh phải có đặc sắc riêng.' },
  ],

  entityTags: [
    { type: 'phi_thuyen', nameVi: 'Phi thuyền', attributes: ['cấp bậc', 'vũ khí', 'thuyền viên'] },
    { type: 'co_giap', nameVi: 'Cơ giáp', attributes: ['loại', 'phi công', 'vũ khí'] },
    { type: 'khoa_ky', nameVi: 'Khoa kỹ', attributes: ['hiệu quả', 'đại giá', 'nguồn'] },
    { type: 'van_minh', nameVi: 'Văn minh', attributes: ['cấp bậc', 'đặc điểm', 'quan hệ nhân loại'] },
  ],

  constraintPacks: ['Pack M18', 'Pack U02'],
};
