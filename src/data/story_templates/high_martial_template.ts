/**
 * File: high_martial_template.ts
 * Purpose: Story template cho thể loại Cao Vũ / Toàn Dân Vũ Đạo
 * Layer: Data (Constants)
 * Domain: StoryTemplate
 * Deps: types/story_template
 */
import type { StoryTemplate } from '../../types/story_template';

export const HIGH_MARTIAL_TEMPLATE: StoryTemplate = {
  id: 'high-martial',
  name: 'Cao Vũ / Toàn Dân Vũ Đạo',
  originalName: '高武',
  coreSellingPoint: 'Vũ đạo đỉnh phong + Nhiệt huyết chiến đấu + Thực lực vi tôn. Quyền đấm chính là đạo lý.',
  tags: ['high-martial', 'martial-arts', 'fighting', 'cultivation'],
  subGenres: [
    { name: 'Toàn dân cao vũ lưu', description: 'Linh khí khôi phục, toàn dân tập võ.', coreAppeal: 'Vũ đạo đột phá, xếp hạng leo thăng, quốc chiến vinh quang.' },
    { name: 'Vũ đạo tông sư lưu', description: 'Truyền thống võ thuật, cảnh giới tông sư.', coreAppeal: 'Võ học đột phá, môn phái tranh bá.' },
    { name: 'Cách đấu cạnh kỹ lưu', description: 'Lôi đài tỷ thí, cách đấu chuyên nghiệp.', coreAppeal: 'Lôi đài thắng lợi, kỹ thuật tiến bộ, vô địch vinh quang.' },
    { name: 'Vũ đạo tu chân lưu', description: 'Vũ đạo kết hợp tu chân, dĩ vũ nhập đạo.', coreAppeal: 'Cảnh giới vũ đạo, nhục thân thành thánh, vũ toái hư không.' },
  ],
  worldRules: [
    { name: 'Vũ đạo giai cấp', description: 'Vũ Thánh (sức ngang quốc gia) → Tông Sư (trấn quốc) → Đại Sư (trấn thành) → Cao Thủ (tinh anh) → Vũ Giả (cơ bản) → Người thường.' },
    { name: 'Cảnh giới hệ thống', description: 'Minh kình → Ám kình → Hóa kình → Tông sư → Đại tông sư → Vũ thánh. Mỗi cảnh giới chênh lệch 10 lần.' },
  ],
  powerSystem: {
    name: 'Vũ đạo cảnh giới',
    tiers: [
      { name: 'Minh kình', description: 'Lực lượng ngoại phóng.', stats: 'Một đánh mười' },
      { name: 'Ám kình', description: 'Lực lượng nội liễm.', stats: 'Một đánh trăm' },
      { name: 'Hóa kình', description: 'Lực lượng hóa hư.', stats: 'Một đánh ngàn' },
      { name: 'Tông sư', description: 'Lĩnh vực sơ thành.', stats: 'Một đánh vạn' },
      { name: 'Đại tông sư', description: 'Lĩnh vực đại thành.', stats: 'Trấn thành' },
      { name: 'Vũ thánh', description: 'Vũ đạo cực trí.', stats: 'Trấn quốc' },
    ],
  },
  coolPatterns: [
    { name: 'Lôi đài nghiền áp', scenario: 'Tỷ thí chính thức, chúng nhân chú mục.', appeal: 'Nhất chiêu chế địch, chấn kinh toàn trường.' },
    { name: 'Vũ học đột phá', scenario: 'Sinh tử quan đầu hoặc bế quan tu luyện.', appeal: 'Cảnh giới đột phá, thực lực bạo tăng.' },
    { name: 'Dĩ vũ phục nhân', scenario: 'Bị coi thường, dùng thực lực nói chuyện.', appeal: 'Quyền đấm chính là đạo lý.' },
    { name: 'Quốc chiến vinh quang', scenario: 'Đại diện quốc gia xuất chiến.', appeal: 'Vì nước tranh quang, dân tộc tự hào.' },
  ],
  conflictPatterns: [
    { type: 'Môn phái tranh bá', source: 'Vũ quán/đạo trường cạnh tranh', resolution: 'Lôi đài tỷ thí' },
    { type: 'Xếp hạng cạnh tranh', source: 'Bảng xếp hạng vũ giả', resolution: 'Chiến thắng liên tục' },
    { type: 'Dị tộc xâm lấn', source: 'Yêu thú / dị tộc', resolution: 'Quốc chiến' },
    { type: 'Tài nguyên tranh đoạt', source: 'Thiên tài địa bảo / bí tịch', resolution: 'Thực lực quyết định' },
  ],
  outlineArcs: [
    { title: 'Quyển 1: Nhập Môn', chapterRange: '1-80', percentageOfTotal: 12, coreFocus: 'MC giác ngộ vũ đạo thiên phú.', coreConflict: 'Đánh bại đồng cấp cường địch.', climax: 'Vô địch đồng lứa.' },
    { title: 'Quyển 2: Quật Khởi', chapterRange: '81-180', percentageOfTotal: 15, coreFocus: 'Gia nhập tổ chức vũ đạo, tham gia tỷ thi.', coreConflict: 'Giành chức vô địch quan trọng.', climax: 'Thành danh.' },
    { title: 'Quyển 3: Thành Danh', chapterRange: '181-350', percentageOfTotal: 25, coreFocus: 'Trở thành vũ giả nổi tiếng.', coreConflict: 'Đột phá Tông Sư, chấn kinh vũ lâm.', climax: 'Tông sư cảnh giới.' },
    { title: 'Quyển 4: Tranh Bá', chapterRange: '351-550', percentageOfTotal: 28, coreFocus: 'Quốc tế cạnh tranh.', coreConflict: 'Quốc chiến thắng lợi, dương ngã quốc uy.', climax: 'Đại tông sư.' },
    { title: 'Quyển 5: Đỉnh Phong', chapterRange: '551-700', percentageOfTotal: 20, coreFocus: 'Truy cầu vũ đạo cực trí.', coreConflict: 'Thành vũ đạo đỉnh phong.', climax: 'Vũ thánh.' },
  ],
  targetWordCount: '2.000.000 chữ', targetChapterCount: 700,
  pitfalls: [
    { description: 'Chiến lực bùng nổ, số trị lạm phát.', severity: 'critical' },
    { description: 'Vả mặt quá thường xuyên, thẩm mỹ mệt mỏi.', severity: 'warning' },
    { description: 'Vũ học thiết lập trước sau mâu thuẫn.', severity: 'critical' },
  ],
  bestPractices: [
    { description: 'Chiến lực thể hệ tự nhất quán, không phá quy tắc.' },
    { description: 'Chiến đấu có nhịp điệu: thăm dò → giao phong → cao trào → kết thúc.' },
    { description: 'Đối thủ phải có IQ và nhân cách riêng.' },
  ],
  entityTags: [
    { type: 'vu_hoc', nameVi: 'Vũ học', attributes: ['hiệu quả', 'phẩm cấp', 'loại', 'nguồn'] },
    { type: 'vu_gia', nameVi: 'Vũ giả', attributes: ['cảnh giới', 'tuyệt kỹ', 'thế lực'] },
    { type: 'binh_khi', nameVi: 'Binh khí', attributes: ['phẩm cấp', 'chất liệu', 'đặc điểm'] },
  ],
  constraintPacks: ['Pack M21', 'Pack U03'],
};
