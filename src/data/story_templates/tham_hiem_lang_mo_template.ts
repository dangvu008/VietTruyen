/**
 * File: tham_hiem_lang_mo_template.ts
 * Purpose: Story template cho thể loại Thám Hiểm Lăng Mộ (Đạo Mộ)
 * Layer: Data (Constants)
 * Domain: StoryTemplate → [creation_orchestrator, context_builder]
 * Deps: types/story_template
 * Source: Ported from tinix-ai/tinix-story (MIT)
 */

import type { StoryTemplate } from '../../types/story_template';

export const THAM_HIEM_LANG_MO_TEMPLATE: StoryTemplate = {
  id: 'tham-hiem-lang-mo',
  name: 'Thám Hiểm Lăng Mộ',
  originalName: '探墓',
  coreSellingPoint:
    'Hành trình trộm mộ, săn bảo vật ở các di tích cổ xưa chứa đầy cạm bẫy, cương thi và quái vật. Chi tiết đạo cụ, phong thủy, địa lý sống động.',
  tags: ['tham-hiem-lang-mo', 'tomb-raiding', 'adventure', 'mystery', 'dao-mo'],

  subGenres: [
    {
      name: 'Đạo mộ thuần túy',
      description: 'Nhân vật chính là đạo mộ thủ chuyên nghiệp. Tập trung kỹ thuật, dụng cụ, phong thủy bát quái.',
      coreAppeal: 'Hồi hộp khám phá bẫy, tri thức phong thủy thực tế, không khí ngột ngạt hầm mộ.',
      referenceWorks: ['Đạo Mộ Bút Ký', 'Ma Thổi Đèn'],
    },
    {
      name: 'Kết hợp siêu nhiên',
      description: 'Bên trong lăng mộ có cương thi, linh hồn, thần khí tồn tại. Nhân vật cần vừa đối phó bẫy vừa đối phó sinh vật.',
      coreAppeal: 'Kinh dị + phiêu lưu, không khí rùng rợn nhưng kịch tính.',
    },
    {
      name: 'Tìm kiếm kho báu lịch sử',
      description: 'Kho báu gắn với triều đại cụ thể, có giá trị lịch sử. Nhân vật chính vừa là thám hiểm vừa là khảo cổ.',
      coreAppeal: 'Bí ẩn lịch sử, câu đố thú vị, thoả mãn trí tò mò.',
    },
    {
      name: 'Hiện đại + cổ đại xen lẫn',
      description: 'Nhân vật chính người hiện đại, nhưng bên trong lăng mộ có thế giới cổ đại còn tồn tại.',
      coreAppeal: 'Khám phá thế giới mới trong lòng lăng mộ — quy mô bất ngờ.',
    },
  ],

  worldRules: [
    {
      name: 'Phong thủy lăng mộ',
      description: 'Mỗi lăng mộ được xây dựng theo phong thủy cụ thể: long mạch, huyệt vị, bát quái trận. Hiểu phong thủy = hiểu cạm bẫy.',
    },
    {
      name: 'Cương thi ngũ loại',
      description: 'Cương thi có 5 cấp độ: Bạch thi, Lục thi, Phi thi, Hạc Độ Bạch Vân, Hóa Long. Mỗi loại có đặc điểm và cách xử lý khác nhau.',
    },
    {
      name: 'Không lấy quá nhiều',
      description: 'Quy tắc bất thành văn: đạo mộ thủ không lấy toàn bộ lăng mộ — chỉ lấy đủ dùng. Tham quá sẽ gặp họa.',
    },
    {
      name: 'Nghề đặc thù',
      description: 'Đạo mộ thủ có kỹ năng chuyên môn: đọc đồ, nhận biết bẫy, phân biệt đồ cổ giả/thật, nhảy mộ kỹ thuật.',
    },
  ],

  powerSystem: undefined,

  opportunityArc: [
    { name: 'Nhận thông tin', description: 'Bản đồ, cổ tịch, tin đồn về lăng mộ chưa được khai quật.' },
    { name: 'Chuẩn bị', description: 'Thu thập đồ nghề, lập đội, nghiên cứu địa hình và phong thủy.' },
    { name: 'Xâm nhập', description: 'Tìm lối vào, phá bẫy lớp ngoài, đi sâu vào.' },
    { name: 'Khám phá', description: 'Đối mặt cạm bẫy, cương thi, cạnh tranh với đội khác.' },
    { name: 'Thu hoạch & thoát', description: 'Lấy bảo vật mục tiêu, thoát an toàn — hoặc không.' },
  ],

  coolPatterns: [
    {
      name: 'Bẫy cơ quan tinh vi',
      scenario: 'Nhân vật gặp bẫy phức tạp — cần trí tuệ + kiến thức phong thủy để phá.',
      appeal: 'Hồi hộp cao độ, thỏa mãn trí tuệ khi giải được.',
      keyNote: 'Mô tả chi tiết cơ chế bẫy tạo sự tin cậy.',
    },
    {
      name: 'Cương thi xuất hiện',
      scenario: 'Cương thi đột ngột tấn công, nhóm phải ứng phó nhanh.',
      appeal: 'Kinh dị xen lẫn kịch tính, thử thách nhóm.',
    },
    {
      name: 'Phát hiện bí mật lịch sử',
      scenario: 'Lăng mộ tiết lộ sự thật về một nhân vật lịch sử hoặc triều đại.',
      appeal: 'Thoả mãn trí tò mò, làm phong phú thế giới quan.',
    },
    {
      name: 'Đội khác tranh đoạt',
      scenario: 'Đội thám hiểm khác (cạnh tranh hoặc thù địch) cùng trong lăng mộ.',
      appeal: 'Áp lực kép — vừa đối phó bẫy vừa đối phó con người.',
    },
  ],

  conflictPatterns: [
    { type: 'Cạm bẫy lăng mộ', source: 'Kiến trúc cổ đại phòng thủ', resolution: 'Trí tuệ + kiến thức phong thủy' },
    { type: 'Cương thi/sinh vật', source: 'Thi thể được bảo quản siêu nhiên', resolution: 'Vũ trang + kiến thức về loại cương thi' },
    { type: 'Đội tranh đoạt', source: 'Các nhóm đạo mộ khác hoặc khảo cổ chính thống', resolution: 'Trốn thoát, đối đầu hoặc hợp tác' },
    { type: 'Nguyền rủa lăng mộ', source: 'Người xây mộ để lại lời nguyền', resolution: 'Tìm hiểu và hóa giải' },
  ],

  outlineArcs: [
    {
      title: 'Nhập Môn: Lăng Mộ Đầu Tiên',
      chapterRange: '1-50',
      percentageOfTotal: 20,
      coreFocus: 'Giới thiệu nhân vật chính và thế giới đạo mộ. Lăng mộ nhỏ, học kỹ năng cơ bản.',
      coreConflict: 'Bẫy cơ bản, cương thi thấp cấp.',
      climax: 'Thành công khai thác lăng mộ đầu tiên.',
      characterGrowth: 'Học được quy tắc và kỹ năng cơ bản.',
    },
    {
      title: 'Danh Tiếng: Lăng Mộ Trung Cấp',
      chapterRange: '51-150',
      percentageOfTotal: 40,
      coreFocus: 'Lăng mộ lớn hơn, phức tạp hơn. Gặp đội khác tranh đoạt.',
      coreConflict: 'Bẫy phức tạp, cương thi mạnh, kẻ thù con người.',
      climax: 'Khám phá bí mật lịch sử lớn.',
      characterGrowth: 'Trở thành đạo mộ thủ có tiếng.',
    },
    {
      title: 'Tuyệt Cảnh: Lăng Mộ Truyền Thuyết',
      chapterRange: '151-250',
      percentageOfTotal: 40,
      coreFocus: 'Lăng mộ được truyền thuyết hóa, mục tiêu cuối cùng.',
      coreConflict: 'Bẫy vô số cấp độ, cương thi cao cấp, kẻ thù cỡ lớn.',
      climax: 'Khám phá sự thật tối thượng, thoát khỏi nguyền rủa.',
      characterGrowth: 'Giải quyết xong mục tiêu cốt lõi, trưởng thành hoàn toàn.',
    },
  ],

  targetWordCount: '500.000 - 1.500.000 chữ',
  targetChapterCount: 250,

  pitfalls: [
    { description: 'Bẫy không có logic — chỉ là trở ngại ngẫu nhiên.', severity: 'critical' },
    { description: 'Cương thi xuất hiện tùy tiện không có giải thích phong thủy.', severity: 'warning' },
    { description: 'Nhóm đồng hành quá nhiều, không ai có cá tính riêng.', severity: 'warning' },
  ],

  bestPractices: [
    { description: 'Nghiên cứu phong thủy cơ bản, kiến trúc lăng mộ cổ Trung Quốc.' },
    { description: 'Mỗi lăng mộ cần một "chủ đề" riêng và loại bẫy đặc trưng.' },
    { description: 'Chi tiết về đồ nghề (xẻng Lạc Dương, đèn dầu...) tăng tính chân thực.' },
    { description: 'Nhịp độ: mô tả khám phá chậm, nhưng khi gặp nguy hiểm phải cực nhanh.' },
  ],

  entityTags: [
    { type: '墓', nameVi: 'Lăng mộ', attributes: ['triều đại', 'loại bẫy', 'cương thi loại', 'bảo vật chính'] },
    { type: '僵尸', nameVi: 'Cương thi', attributes: ['cấp độ', 'đặc điểm', 'điểm yếu'] },
    { type: '机关', nameVi: 'Cơ quan/Bẫy', attributes: ['loại', 'cách kích hoạt', 'cách phá'] },
    { type: '宝物', nameVi: 'Cổ vật/Bảo vật', attributes: ['giá trị', 'xuất xứ', 'công năng'] },
  ],

  constraintPacks: ['Pack M01'],
};
