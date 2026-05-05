/**
 * File: hong_hoang_template.ts
 * Purpose: Story template cho thể loại Hồng Hoang (Thần Thoại Cổ Đại Trung Hoa)
 * Layer: Data (Constants)
 * Domain: StoryTemplate → [creation_orchestrator, context_builder]
 * Deps: types/story_template
 * Source: Ported from tinix-ai/tinix-story (MIT)
 */

import type { StoryTemplate } from '../../types/story_template';

export const HONG_HOANG_TEMPLATE: StoryTemplate = {
  id: 'hong-hoang',
  name: 'Hồng Hoang',
  originalName: '洪荒',
  coreSellingPoint:
    'Hệ thống thần thoại Trung Hoa cổ đại — từ Bàn Cổ khai thiên đến Phong Thần. Quy mô vũ trụ, cấp bậc thần thánh vô tận, tranh đấu Thánh Nhân quy mô thiên địa.',
  tags: ['hong-hoang', 'mythology', 'fantasy', 'primordial', 'chinese-mythology'],

  subGenres: [
    {
      name: 'Hồng Hoang cổ điển',
      description: 'Bám sát Phong Thần Diễn Nghĩa — Tam Thanh, Ngọc Đế, 12 Tổ Vu. Nhân vật chính tham gia phong thần đại kiếp.',
      coreAppeal: 'Quy mô sử thi, gặp thần tiên truyền thuyết, tham gia vào định mệnh thiên địa.',
      referenceWorks: ['Phong Thần Diễn Nghĩa'],
    },
    {
      name: 'Hồng Hoang lai hiện đại',
      description: 'Kết hợp thần thoại Hồng Hoang với cơ chế tu tiên hiện đại (levels, hệ thống, xuyên không).',
      coreAppeal: 'Tân kỳ, buff nhân vật chính theo cơ chế hiện đại trong bối cảnh hồng hoang.',
    },
    {
      name: 'Tiên tổ lưu',
      description: 'Nhân vật chính trở thành thủy tổ của một loài hoặc một nhánh tu luyện thần thánh.',
      coreAppeal: 'Tạo di sản, uy quyền tổ tông, con cháu đầy thiên hạ.',
    },
  ],

  worldRules: [
    {
      name: 'Thánh Nhân bất khả xâm phạm',
      description: 'Cảnh giới Thánh Nhân (Chứng Đạo) là đỉnh cao thực sự. Dưới Thánh Nhân đều có thể bị giết.',
    },
    {
      name: 'Nhân quả thiên đạo',
      description: 'Mọi hành động có nhân quả. Nghiệp lực tích lũy sẽ tăng khó khăn trong đại kiếp tiếp theo.',
    },
    {
      name: 'Đại kiếp định kỳ',
      description: 'Phong Thần Đại Kiếp, Tứ Hung Đại Kiếp... Thiên đạo định kỳ tẩy rửa. Ai không vào phong thần bảng sẽ bị truy sát.',
    },
  ],

  powerSystem: {
    name: 'Hồng Hoang Cảnh Giới',
    tiers: [
      { name: 'Thiên Tiên', description: 'Bước đầu vào hàng ngũ thần thánh.', stats: 'Thọ vạn năm' },
      { name: 'Kim Tiên', description: 'Bắt đầu hiểu pháp tắc cơ bản.', stats: 'Thọ trăm vạn năm' },
      { name: 'Đại La Kim Tiên', description: 'Pháp lực vô biên, thân bất diệt trong kiếp số.', stats: 'Bán bất tử' },
      { name: 'Chuẩn Thánh', description: 'Một bước nữa là Chứng Đạo. Đại thần thông.', stats: 'Gần bất tử' },
      { name: 'Thánh Nhân', description: 'Chứng đắc đại đạo, thật sự bất tử ngang hàng thiên địa.', stats: 'Bất tử' },
    ],
    balanceRules: [
      'Thánh Nhân không thể giết Thánh Nhân trực tiếp trừ khi thiên đạo cho phép.',
      'Chuẩn Thánh bị Thánh Nhân áp chế hoàn toàn trong lĩnh vực đại đạo.',
    ],
  },

  opportunityArc: [
    { name: 'Khai thiên', description: 'Hấp thụ công đức Bàn Cổ khai thiên, thu Hồng Mông Tử Khí.' },
    { name: 'Tích lũy thực lực', description: 'Tu luyện, nhận truyền thừa cổ tiên, lĩnh ngộ pháp tắc.' },
    { name: 'Tham gia đại kiếp', description: 'Chiến tranh thần linh — chọn phe, chiến đấu, bảo toàn thế lực.' },
    { name: 'Chứng đạo', description: 'Đạt Thánh Nhân, định hình thiên địa.' },
  ],

  coolPatterns: [
    {
      name: 'Gặp nhân vật truyền thuyết',
      scenario: 'Nhân vật chính gặp Lão Tử, Nữ Oa, Nguyên Thủy...',
      appeal: 'Fanservice thần thoại, đứng bên cạnh huyền thoại.',
      keyNote: 'Tránh hạ thấp thần thoại để buff nhân vật chính vô lý.',
    },
    {
      name: 'Tranh đoạt Hồng Mông Tử Khí',
      scenario: 'Tài nguyên tối thượng xuất hiện, chư thánh đều muốn tranh đoạt.',
      appeal: 'Căng thẳng cực cao, bộc lộ bản chất thật của chư thánh.',
    },
    {
      name: 'Thoát kiếp siêu thần',
      scenario: 'Thoát khỏi thiên đạo kiểm soát, tự lập pháp tắc riêng.',
      appeal: 'Đỉnh cao sức mạnh và tự do.',
    },
  ],

  conflictPatterns: [
    { type: 'Tranh Hồng Mông Tử Khí', source: 'Chuẩn thánh/chư thánh tranh nhau', resolution: 'Mưu kế hoặc liên minh' },
    { type: 'Đại kiếp thiên đạo', source: 'Thiên đạo cưỡng chế tham gia', resolution: 'Thoát kiếp hoặc lợi dụng kiếp' },
    { type: 'Nhân quả nghiệp lực', source: 'Hành động quá khứ trở thành kiếp nạn', resolution: 'Hóa giải hoặc chịu đựng vượt qua' },
  ],

  outlineArcs: [
    {
      title: 'Thời Khai Thiên',
      chapterRange: '1-200',
      percentageOfTotal: 20,
      coreFocus: 'Hình thành nhân vật, tích lũy thực lực trong thời Hồng Hoang.',
      coreConflict: 'Sinh tồn thời nguyên sơ, gặp gỡ chư thánh.',
      climax: 'Đạt Chuẩn Thánh.',
      characterGrowth: 'Từ vô danh đến thế lực đáng kể.',
    },
    {
      title: 'Phong Thần Đại Kiếp',
      chapterRange: '201-600',
      percentageOfTotal: 40,
      coreFocus: 'Tham gia chiến tranh thần thánh quy mô lớn.',
      coreConflict: 'Chọn phe, chiến đấu, bảo toàn đồ đệ.',
      climax: 'Phong thần bảng hoàn tất, thiên đình kiến lập.',
      characterGrowth: 'Hiểu rõ bản chất thiên đạo.',
    },
    {
      title: 'Chứng Đạo',
      chapterRange: '601-1000',
      percentageOfTotal: 40,
      coreFocus: 'Bước tiếp theo sau phong thần, hướng tới Thánh Nhân.',
      coreConflict: 'Thiên đạo tiếp theo, địch thủ mới cấp cao hơn.',
      climax: 'Chứng đắc đại đạo.',
      characterGrowth: 'Giác ngộ ý nghĩa trường sinh và trách nhiệm.',
    },
  ],

  targetWordCount: '3.000.000+ chữ',
  targetChapterCount: 1000,

  pitfalls: [
    { description: 'Hạ thấp thần thoại vô lý — nhân vật chính vả mặt Thánh Nhân không có lý do.', severity: 'critical' },
    { description: 'Thiếu nhất quán cảnh giới — Thánh Nhân lúc mạnh lúc yếu tùy tiện.', severity: 'critical' },
    { description: 'Đại kiếp kéo quá dài không có cao trào.', severity: 'warning' },
  ],

  bestPractices: [
    { description: 'Nghiên cứu Phong Thần Diễn Nghĩa, Tây Du Ký, Sơn Hải Kinh trước khi viết.' },
    { description: 'Thiết lập rõ cảnh giới và giới hạn từ đầu, không phá vỡ nhất quán.' },
    { description: 'Công đức/nghiệp lực phải có cơ chế rõ ràng.' },
  ],

  entityTags: [
    { type: '圣人', nameVi: 'Thánh Nhân', attributes: ['danh hiệu', 'đại đạo', 'phe'] },
    { type: '法宝', nameVi: 'Hồng Hoang Tiên Bảo', attributes: ['cấp', 'công năng', 'chủ nhân'] },
    { type: '大劫', nameVi: 'Đại Kiếp', attributes: ['tên', 'nguyên nhân', 'quy mô'] },
  ],

  constraintPacks: ['Pack M01', 'Pack M02'],

  characterArchetypes: [
    {
      role: 'Chính — Hồng Hoang cổ tộc/Xuyên không giả',
      narrativeFunction: 'Từ vô danh đến sánh ngang Thánh Nhân, dẫn dắt quy mô vũ trụ',
      personalityHint: 'Tham vọng lớn, tính toán xa, biết nhẫn nhịn chờ thời',
      primaryArc: 'Thời Khai Thiên',
      suggestedCount: [1, 1],
    },
    {
      role: 'Đồng hành — Đạo hữu/Huynh đệ nguyên sơ',
      narrativeFunction: 'Chia sẻ gian khổ thời Hồng Hoang, tạo tình nghĩa vạn năm',
      personalityHint: 'Thật thà hoặc xảo quyệt, gắn bó qua nhiều đại kiếp',
      suggestedCount: [1, 3],
    },
    {
      role: 'Phản diện — Thánh Nhân/Chuẩn Thánh đối lập',
      narrativeFunction: 'Đối thủ cấp thần thánh, mỗi đại kiếp có 1 đối thủ mới',
      personalityHint: 'Cao ngạo, coi MC như kiến, nhưng dần phải coi trọng',
      suggestedCount: [2, 4],
    },
    {
      role: 'Mentor — Cổ tiên/Bàn Cổ tàn niệm',
      narrativeFunction: 'Truyền thừa pháp quyết, giải đáp bí mật Hồng Hoang',
      personalityHint: 'Cổ kính, uy nghiêm, mang gánh nặng ngàn vạn năm',
      primaryArc: 'Thời Khai Thiên',
      suggestedCount: [1, 2],
    },
    {
      role: 'Tình yêu — Nữ tiên/Yêu tộc',
      narrativeFunction: 'Tạo động lực cá nhân giữa cục diện vũ trụ, thêm chiều sâu tình cảm',
      personalityHint: 'Tài mạo song toàn, có thế lực riêng, không phụ thuộc MC',
      suggestedCount: [1, 2],
    },
    {
      role: 'Hài hước — Linh thú/Tiểu yêu theo hầu',
      narrativeFunction: 'Comic relief trong bối cảnh sử thi trang trọng, tạo đối lập thú vị',
      personalityHint: 'Tham ăn, sợ chết, nhưng trung thành tuyệt đối với MC',
      suggestedCount: [1, 1],
    },
    {
      role: 'Ẩn boss — Thiên Đạo ý chí/Tà ma cổ đại',
      narrativeFunction: 'Đại phản diện thật sự, reveal ở giai đoạn cuối, đảo lộn toàn bộ nhận thức',
      personalityHint: 'Vô hình hoặc ẩn dưới danh nghĩa chính nghĩa, mưu sâu kế hiểm',
      primaryArc: 'Chứng Đạo',
      suggestedCount: [1, 1],
    },
    {
      role: 'Nền sống động — Các thần thoại quen thuộc',
      narrativeFunction: 'Lão Tử, Nữ Oa, Ngọc Đế xuất hiện tạo fanservice và chiều sâu thế giới',
      personalityHint: 'Mỗi vị có tính cách riêng biệt theo truyền thuyết gốc',
      suggestedCount: [3, 8],
    },
  ],

  characterScaleHint: {
    per100Chapters: 4,
    minTotal: 15,
    maxTotal: 35,
  },
};
