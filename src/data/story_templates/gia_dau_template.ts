/**
 * File: gia_dau_template.ts
 * Purpose: Story template cho thể loại Gia Đấu (Mưu Mô Gia Tộc)
 * Layer: Data (Constants)
 * Domain: StoryTemplate → [creation_orchestrator, context_builder]
 * Deps: types/story_template
 * Source: Ported from tinix-ai/tinix-story (MIT)
 */

import type { StoryTemplate } from '../../types/story_template';

export const GIA_DAU_TEMPLATE: StoryTemplate = {
  id: 'gia-dau',
  name: 'Gia Đấu',
  originalName: '家斗',
  coreSellingPoint:
    'Đấu tranh kèn cựa trong gia tộc lớn — mẹ chồng nàng dâu, các phòng, chị em gái — bảo vệ lợi ích và vị thế. Logic gia trị cao, đòn tâm lý tinh tế.',
  tags: ['gia-dau', 'family-intrigue', 'historical', 'scheming', 'inner-court'],

  subGenres: [
    {
      name: 'Mẹ chồng nàng dâu',
      description: 'Xung đột cổ điển giữa nàng dâu mới và mẹ chồng. Cần vừa khéo léo vừa cứng rắn để giữ vị trí.',
      coreAppeal: 'Đấu trí khéo léo, logic cao về lễ nghi và quyền lợi trong gia tộc.',
    },
    {
      name: 'Các phòng tranh đấu',
      description: 'Nhiều bà vợ/thê thiếp trong gia tộc cùng tranh đấu cho con cái và quyền lợi.',
      coreAppeal: 'Phức tạp, nhiều tuyến nhân vật, mưu kế đan xen.',
      referenceWorks: ['Tri Phủ Phu Nhân'],
    },
    {
      name: 'Thừa kế gia sản',
      description: 'Tranh đấu cho người thừa kế — con trưởng, con thứ. Liên minh và phản bội trong gia tộc.',
      coreAppeal: 'Quyền lực, tiền bạc, danh dự gia tộc — tất cả đều là vũ khí.',
    },
    {
      name: 'Gia đấu hiện đại',
      description: 'Đấu tranh trong gia đình hiện đại — thừa kế công ty, mẹ chồng kiểm soát, gia đình giàu có phức tạp.',
      coreAppeal: 'Quen thuộc hơn, drama mạnh, công thức giống cổ đại nhưng bối cảnh hiện đại.',
    },
  ],

  worldRules: [
    {
      name: 'Lễ nghĩa là vũ khí',
      description: 'Trong gia đấu cổ đại, ai vi phạm lễ nghĩa là thua. Nhân vật chính phải cực kỳ hiểu lễ nghi để dùng nó làm vũ khí.',
    },
    {
      name: 'Chứng cứ và nhân chứng',
      description: 'Không có bằng chứng = không có tội. Cài bẫy phải tạo ra chứng cứ. Phá bẫy phải xóa chứng cứ.',
    },
    {
      name: 'Liên minh và phản bội',
      description: 'Không có đồng minh vĩnh cửu trong gia đấu. Liên minh khi lợi ích trùng khớp, phản bội khi lợi ích mâu thuẫn.',
    },
    {
      name: 'Phúc thị con cái',
      description: 'Địa vị của mẹ = tương lai của con. Mọi đấu tranh đều vì con cái có nền tảng vững chắc.',
    },
  ],

  powerSystem: undefined,

  opportunityArc: [
    { name: 'Nhập gia', description: 'Nhân vật chính mới gia nhập gia tộc — lấy chồng, nhận nuôi, hoặc được phân công.' },
    { name: 'Quan sát', description: 'Hiểu rõ cục diện, ai là đồng minh, ai là kẻ thù, ai là trung lập.' },
    { name: 'Bị tấn công', description: 'Kẻ thù ra tay trước — nhân vật chính phải đối phó.' },
    { name: 'Phản công', description: 'Xây liên minh, cài bẫy, dùng lễ nghĩa — từng bước trả đũa.' },
    { name: 'Kiểm soát gia tộc', description: 'Đạt vị trí ổn định, bảo vệ được con cái và lợi ích.' },
  ],

  coolPatterns: [
    {
      name: 'Dùng lễ nghĩa làm dao',
      scenario: 'Nhân vật chính khiến kẻ thù vi phạm lễ nghĩa trước mặt mọi người, không cần nói một lời.',
      appeal: 'Thỏa mãn trí tuệ, elegant nhất trong mọi đòn tấn công.',
      keyNote: 'Cần hiểu rõ lễ nghĩa thời đại để viết cho đúng.',
    },
    {
      name: 'Cài bẫy hoàn hảo',
      scenario: 'Nhân vật chính tạo tình huống mà kẻ thù không còn lựa chọn nào tốt.',
      appeal: 'Căng thẳng cao, vừa đọc vừa nghĩ "thoát bằng cách nào?"',
    },
    {
      name: 'Liên minh bất ngờ',
      scenario: 'Nhân vật mà tưởng là đối thủ hóa ra cũng bị đe dọa — hợp tác tạm thời.',
      appeal: 'Bất ngờ thú vị, làm phong phú quan hệ nhân vật.',
    },
    {
      name: 'Lợi dụng địch phe đánh nhau',
      scenario: 'Nhân vật chính không cần ra tay, chỉ cần tạo điều kiện để đối thủ tự hủy nhau.',
      appeal: 'Cao tay nhất, cảm giác "hắn đã biết trước tất cả".',
    },
  ],

  conflictPatterns: [
    { type: 'Cạnh tranh vị thế', source: 'Sủng ái, tài nguyên, địa vị trong phòng', resolution: 'Đấu trí, lễ nghĩa, liên minh' },
    { type: 'Bị hãm hại', source: 'Kẻ thù cài bẫy, dùng bằng chứng giả', resolution: 'Phá bẫy, tìm chứng cứ thật, phản công' },
    { type: 'Tranh thừa kế', source: 'Các phòng đều muốn con mình được thừa kế', resolution: 'Chứng minh con mình xứng đáng hơn' },
    { type: 'Mẹ chồng kiểm soát', source: 'Người lớn tuổi dùng uy quyền áp bức', resolution: 'Khéo léo, kiên nhẫn, dùng người đỡ đầu' },
  ],

  outlineArcs: [
    {
      title: 'Nhập Gia: Học Quy Tắc',
      chapterRange: '1-40',
      percentageOfTotal: 20,
      coreFocus: 'Nhân vật chính làm quen gia tộc, hiểu cục diện, quan sát.',
      coreConflict: 'Bị thử thách nhẹ, học cách ứng xử.',
      climax: 'Đối mặt đòn tấn công đầu tiên, không bị ngã.',
      characterGrowth: 'Từ ngây thơ → bắt đầu hiểu trò chơi.',
    },
    {
      title: 'Giao Tranh: Đòn Đánh Lẫn Nhau',
      chapterRange: '41-130',
      percentageOfTotal: 45,
      coreFocus: 'Xây liên minh, đánh trả kẻ thù, từng bước khẳng định vị trí.',
      coreConflict: 'Nhiều phe tranh đấu, nhân vật chính phải cân bằng.',
      climax: 'Phá được mưu kế lớn nhất của kẻ thù chính.',
      characterGrowth: 'Từ bị động → chủ động, hiểu rõ trò chơi quyền lực.',
    },
    {
      title: 'Ổn Định: Kiểm Soát Cục Diện',
      chapterRange: '131-200',
      percentageOfTotal: 35,
      coreFocus: 'Loại bỏ kẻ thù cuối cùng, đảm bảo tương lai cho con cái.',
      coreConflict: 'Kẻ thù quyết tử — đòn thâm hiểm nhất.',
      climax: 'Giải quyết dứt điểm, đạt vị trí ổn định.',
      characterGrowth: 'Từ đấu tranh → kiểm soát, không còn bị đe dọa.',
    },
  ],

  targetWordCount: '300.000 - 600.000 chữ',
  targetChapterCount: 200,

  pitfalls: [
    { description: 'Lễ nghĩa không nhất quán hoặc sai thời đại — mất tính chân thực.', severity: 'critical' },
    { description: 'Nhân vật chính quá OP về trí tuệ — không ai thách thức được, nhàm chán.', severity: 'warning' },
    { description: 'Quá nhiều tuyến phụ — đọc giả không theo kịp ai đang đánh ai.', severity: 'warning' },
  ],

  bestPractices: [
    { description: 'Nghiên cứu lễ nghi gia đình phong kiến Trung Hoa/Việt Nam.' },
    { description: 'Mỗi nhân vật phe địch cần có động cơ rõ ràng — không phải xấu vì bản chất.' },
    { description: 'Kết hợp drama cảm xúc với đấu trí — chỉ có mưu kế thì khô khan.' },
    { description: 'Tình huống ngõ cụt cần có ít nhất 2-3 lối thoát tiềm năng — chọn một bất ngờ nhất.' },
  ],

  entityTags: [
    { type: 'thế lực', nameVi: 'Phòng/Phe trong gia tộc', attributes: ['lãnh đạo', 'nguồn lực', 'đồng minh', 'mục tiêu'] },
    { type: 'vũ khí', nameVi: 'Lễ nghĩa/Quy tắc', attributes: ['loại', 'uy lực', 'cách dùng'] },
    { type: 'tài nguyên', nameVi: 'Sủng ái/Tài sản/Thừa kế', attributes: ['giá trị', 'ai kiểm soát', 'ai muốn'] },
  ],

  constraintPacks: ['Pack M01'],
};
