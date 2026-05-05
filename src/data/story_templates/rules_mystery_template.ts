/**
 * File: rules_mystery_template.ts
 * Purpose: Story template cho thể loại Quái Đàm Quy Tắc / Trinh Thám
 * Layer: Data (Constants)
 * Domain: StoryTemplate → [creation_orchestrator, context_builder]
 * Deps: types/story_template
 */

import type { StoryTemplate } from '../../types/story_template';

export const RULES_MYSTERY_TEMPLATE: StoryTemplate = {
  id: 'rules-mystery',
  name: 'Quái Đàm Quy Tắc / Trinh Thám',
  originalName: 'luật lệ怪谈',
  coreSellingPoint: 'Logic suy luận + Manh mối công bằng + Trí lực đối kháng.',
  tags: ['mystery', 'detective', 'rules', 'horror'],

  subGenres: [
    { name: 'Bản Cách suy luận lưu', description: 'Logic thuần túy: mật thất, quỷ kế.', coreAppeal: 'Khoái cảm giải mã.' },
    { name: 'Quái đàm quy tắc lưu', description: 'Truyền thuyết đô thị, quy tắc quỷ dị.', coreAppeal: 'Phát hiện + lợi dụng quy tắc.' },
    { name: 'Huyền nghi kinh sợ lưu', description: 'Bầu không khí, tâm lý kinh hãi.', coreAppeal: 'Căng thẳng, phản chuyển liên tục.' },
    { name: 'Xã hội phái suy luận', description: 'Khám phá động cơ, phê phán xã hội.', coreAppeal: 'Chiều sâu nhân tính.' },
  ],

  worldRules: [
    { name: '10 giới luật suy luận', description: 'Hung thủ phải xuất hiện sớm. Siêu nhiên cấm cho chân tướng. Mật thất tối đa 1 lối bí mật. Thám tử không dựa vào may mắn. Phải công khai manh mối.' },
    { name: 'Công bằng tính', description: 'Manh mối thám tử phát hiện, người đọc cũng phải thấy.' },
    { name: 'Khả giải tính', description: 'Manh mối quan trọng xuất hiện ít nhất 3 lần dạng khác nhau.' },
  ],

  coolPatterns: [
    { name: 'Phát hiện quy tắc', scenario: 'Quan sát kẻ vi phạm bị trừng phạt.', appeal: 'Eureka moment.' },
    { name: 'Lợi dụng quy tắc', scenario: 'Tìm lỗ hổng quy tắc thoát hiểm.', appeal: 'Trí tuệ vượt trội.' },
    { name: 'Phản chuyển nhiều tầng', scenario: 'Lật hung thủ → động cơ → bản chất → người kể.', appeal: 'Chấn động liên tiếp.' },
  ],

  conflictPatterns: [
    { type: 'Sinh tồn trong quy tắc', source: 'Môi trường dị thường', resolution: 'Hiểu + lợi dụng quy tắc' },
    { type: 'Nghi phạm nhiều người', source: 'Ai cũng có động cơ', resolution: 'Logic loại trừ + bằng chứng' },
    { type: 'Đồng hồ đếm ngược', source: 'Giới hạn thời gian', resolution: 'Áp lực tăng kịch tính' },
  ],

  outlineArcs: [
    { title: 'Quyển 1: Án Phát', chapterRange: '1-30', percentageOfTotal: 15, coreFocus: 'Mở màn bí ẩn.', coreConflict: 'Thiết lập môi trường + giới hạn.', climax: 'Manh mối đầu tiên.' },
    { title: 'Quyển 2: Điều Tra', chapterRange: '31-100', percentageOfTotal: 35, coreFocus: 'Nghi phạm, bằng chứng tích lũy.', coreConflict: 'Red herring + vụ án thứ hai.', climax: 'Phá vỡ giả thiết ban đầu.' },
    { title: 'Quyển 3: Suy Luận', chapterRange: '101-150', percentageOfTotal: 25, coreFocus: 'Tổng hợp manh mối.', coreConflict: 'Chân tướng tiệm cận.', climax: 'Thách thức người đọc.' },
    { title: 'Quyển 4: Hé Lộ + Thu Vĩ', chapterRange: '151-200', percentageOfTotal: 25, coreFocus: 'Logic hoàn chỉnh, hung thủ phục pháp.', coreConflict: 'Giải mã quỷ kế.', climax: 'Dư vị / mở.' },
  ],

  targetWordCount: '400.000 chữ',
  targetChapterCount: 200,

  pitfalls: [
    { description: 'Dùng siêu nhiên giải thích chân tướng.', severity: 'critical' },
    { description: 'Giấu manh mối rồi đột ngột hé lộ.', severity: 'critical' },
    { description: 'Red herring nhiều hơn manh mối thật.', severity: 'warning' },
    { description: 'Logic suy luận có lỗ hổng.', severity: 'critical' },
  ],

  bestPractices: [
    { description: '3 tầng manh mối: Bề mặt → Ẩn giấu → Chiều sâu.' },
    { description: 'Quy tắc quái đàm cần nội tại logic, ngoại lệ cần phục bút.' },
    { description: 'Thiết kế nghi phạm: Quan hệ, Động cơ, Cơ hội, Phương tiện, Ngoại phạm, Bí mật.' },
  ],

  entityTags: [
    { type: 'nghi_pham', nameVi: 'Nghi phạm', attributes: ['động cơ', 'cơ hội', 'ngoại phạm'] },
    { type: 'manh_moi', nameVi: 'Manh mối', attributes: ['ý nghĩa thật', 'vị trí', 'tính chất'] },
    { type: 'quy_tac', nameVi: 'Quy tắc', attributes: ['nội dung', 'hình phạt', 'lỗ hổng'] },
  ],

  strandWeaveHint: { quest: 60, fire: 15, constellation: 25 },
  constraintPacks: ['Pack M14', 'Pack M06', 'Pack U02'],
};
