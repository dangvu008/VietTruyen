/**
 * File: infinite_flow_template.ts
 * Purpose: Story template cho thể loại Vô Hạn Lưu / Death Game
 * Layer: Data (Constants)
 * Domain: StoryTemplate
 * Deps: types/story_template
 */
import type { StoryTemplate } from '../../types/story_template';

export const INFINITE_FLOW_TEMPLATE: StoryTemplate = {
  id: 'infinite-flow',
  name: 'Vô Hạn Lưu / Death Game',
  originalName: '无限流',
  coreSellingPoint: 'Quan ải xông pha + Quy tắc giải mê + Cực hạn sinh tồn. Lớn lên trong trò chơi tử vong.',
  tags: ['infinite-flow', 'death-game', 'dungeon', 'survival'],
  subGenres: [
    { name: 'Khủng bố phó bản lưu', description: 'Vào thế giới phim kinh dị / đô thị truyền thuyết.', coreAppeal: 'Quy tắc phá giải, tuyệt cảnh đào thoát.' },
    { name: 'Đoàn đội cạnh kỹ lưu', description: 'Đa nhân tổ đội xông quan, đồng đội có thể là kẻ địch.', coreAppeal: 'Phối hợp đoàn đội, phản bội phản chuyển, nhân tính bác dịch.' },
    { name: 'Chủ thần không gian lưu', description: 'Có chủ thần/hệ thống quản lý, tích phân đổi năng lực.', coreAppeal: 'Năng lực phối hợp, tài nguyên quản lý, xuyên thế giới mạo hiểm.' },
  ],
  worldRules: [
    { name: 'Phó bản nan độ', description: 'D cấp (tân thủ, 70% sinh tồn) → C (thông thường, 50%) → B (khốn nan, 30%) → A (ác mộng, 10%) → S (địa ngục, 1%).' },
    { name: 'Phó bản tam yếu tố', description: '1. Bối cảnh thiết lập quy tắc. 2. Thông quan điều kiện. 3. Tử vong điều kiện (vi phạm tức chết).' },
    { name: 'Tài nguyên thể hệ', description: 'Tích phân (thông quan thưởng) → Đạo cụ (nhất thứ tính) → Kỹ năng (vĩnh cửu) → Tình báo (khẩn thông hóa).' },
  ],
  coolPatterns: [
    { name: 'Quy tắc phản sát', scenario: 'Kẻ địch tưởng nắm quy tắc, MC phát hiện tầng sâu hơn.', appeal: 'Phản sát đại khoái.' },
    { name: 'Tuyệt cảnh phiên bàn', scenario: 'Đồng đội toàn diệt, MC đơn độc đối BOSS.', appeal: 'Dùng đáy bài tích lũy lật ngược.' },
    { name: 'Tình báo nghiền áp', scenario: 'MC biết trước phó bản công lược.', appeal: 'Người khác còn dò dẫm, MC đã trực bôn mục tiêu.' },
  ],
  conflictPatterns: [
    { type: 'Phó bản sinh tồn', source: 'Quy tắc chết người', resolution: 'Phát hiện lỗ hổng quy tắc' },
    { type: 'Đồng đội phản bội', source: 'Lợi ích xung đột', resolution: 'Đề phòng + phản kích' },
    { type: 'Tích phân cạnh tranh', source: 'Tài nguyên hữu hạn', resolution: 'Chiến lược phân phối' },
    { type: 'Chân tướng không gian', source: 'Nguồn gốc vô hạn không gian', resolution: 'Dần dần hé lộ' },
  ],
  outlineArcs: [
    { title: 'Quyển 1: Tân Thủ Thôn', chapterRange: '1-50', percentageOfTotal: 10, coreFocus: 'Phó bản đầu tiên, xây dựng nhận tri quy tắc.', coreConflict: 'Hiểm thắng phó bản đầu.', climax: 'Đạt năng lực cốt lõi.' },
    { title: 'Quyển 2: Tổ Đội Kỳ', chapterRange: '51-150', percentageOfTotal: 15, coreFocus: 'Gia nhập/tổ kiến đội cố định.', coreConflict: 'Đoàn đội đầu tiên thách chiến B cấp.', climax: 'Phối hợp hoàn hảo.' },
    { title: 'Quyển 3: Trung Tầng', chapterRange: '151-300', percentageOfTotal: 25, coreFocus: 'Tại người chơi quần thể nổi bật.', coreConflict: 'Đơn độc thông quan A cấp.', climax: 'Nắm được đa năng lực.' },
    { title: 'Quyển 4: Chân Tướng', chapterRange: '301-500', percentageOfTotal: 30, coreFocus: 'Thám hiểm vô hạn không gian chân tướng.', coreConflict: 'Phát hiện bản chất.', climax: 'Tiếp xúc quản lý giả tầng.' },
    { title: 'Quyển 5: Chung Cục', chapterRange: '501-700', percentageOfTotal: 20, coreFocus: 'Thách chiến/thay đổi vô hạn không gian quy tắc.', coreConflict: 'Trở thành quy tắc chế định giả.', climax: 'Phá vỡ vô hạn, giành tự do.' },
  ],
  targetWordCount: '2.000.000 chữ', targetChapterCount: 700,
  pitfalls: [
    { description: 'Phó bản quy tắc trước sau mâu thuẫn.', severity: 'critical' },
    { description: 'MC năng lực vô hạn chất chồng thành thần.', severity: 'critical' },
    { description: 'Đồng đội công cụ nhân, chết không cảm xúc.', severity: 'warning' },
    { description: 'Phó bản đồng chất hóa, hoán bì lặp lại.', severity: 'warning' },
  ],
  bestPractices: [
    { description: 'Mỗi phó bản quy tắc tự nhất quán.' },
    { description: 'Năng lực có trần rõ ràng và đại giá.' },
    { description: 'Đồng đội có nhân cách và cốt truyện riêng.' },
    { description: 'Phó bản loại đa dạng, nan độ đệ tiến.' },
  ],
  entityTags: [
    { type: 'pho_ban', nameVi: 'Phó bản', attributes: ['bối cảnh', 'nan độ', 'thông quan điều kiện', 'tử vong quy tắc'] },
    { type: 'nang_luc', nameVi: 'Năng lực', attributes: ['hiệu quả', 'tiêu hao', 'lãnh khước', 'nguồn'] },
    { type: 'dao_cu', nameVi: 'Đạo cụ', attributes: ['chức năng', 'số lần dùng', 'giá tích phân'] },
  ],
  constraintPacks: ['Pack M19', 'Pack U02'],
};
