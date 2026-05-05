/**
 * File: xianxia_template.ts
 * Purpose: Story template cho thể loại Tu Tiên / Tiên Hiệp / Huyền Huyễn
 * Layer: Data (Constants)
 * Domain: StoryTemplate → [creation_orchestrator, context_builder]
 * Deps: types/story_template
 */

import type { StoryTemplate } from '../../types/story_template';

export const XIANXIA_TEMPLATE: StoryTemplate = {
  id: 'xianxia',
  name: 'Tu Tiên / Tiên Hiệp',
  originalName: '修仙',
  coreSellingPoint: 'Nghịch thiên cải mệnh + Trường sinh cửu thị + Pháp tắc tàn khốc. Tu tiên là tranh mệnh với trời, cũng là tranh lợi với người.',
  tags: ['xianxia', 'fantasy', 'tu-luyen', 'cultivation'],

  subGenres: [
    {
      name: 'Phàm nhân lưu',
      description: 'Nhân vật chính tư chất bình thường, dựa vào mưu trí, thận trọng và kim thủ chỉ để nghịch chuyển.',
      coreAppeal: 'IQ nghiền ép, tích tiểu thành đa, giả heo ăn hổ.',
      referenceWorks: ['Phàm Nhân Tu Tiên Truyện'],
    },
    {
      name: 'Vô địch lưu',
      description: 'Mở đầu đã là đỉnh phong (hoặc sở hữu bối cảnh/sư phụ vô địch).',
      coreAppeal: 'Hoành sảo tất cả, chuyên trị các loại bất phục, phá vỡ quy tắc.',
      referenceWorks: ['Đế Bá'],
    },
    {
      name: 'Gia tộc lưu',
      description: 'Nhân vật chính dẫn dắt gia tộc quật khởi, kinh doanh phát triển.',
      coreAppeal: 'Tập thể phi thăng, tài nguyên cuộn tuyết, thế lực tranh bá.',
    },
    {
      name: 'Cẩu đạo lưu',
      description: 'Tuyệt không dính nhân quả, tuyệt không đứng dưới tường nguy. Phòng ngự cực đại.',
      coreAppeal: 'Kẻ địch chết hết rồi ta vẫn còn, ma thực đối thủ cũng là thắng lợi.',
    },
  ],

  worldRules: [
    {
      name: 'Pháp tắc rừng tối',
      description: 'Tài nguyên hữu hạn: linh khí, linh dược, khoáng mạch đều hiếm. Gặp tu sĩ lạ ngoài hoang dã, phản ứng đầu tiên: "hắn có giết ta không?", phản ứng thứ hai: "ta có giết được hắn không?".',
    },
    {
      name: 'Hoài bích kỳ tội',
      description: 'Không có thực lực mà sở hữu trọng bảo, chính là tội nguyên.',
    },
    {
      name: 'Giai cấp tu tiên',
      description: 'Tán tu: tầng đáy tu tiên giới, vì mấy viên linh thạch liều mạng. Tông môn đệ tử: có tổ chức, có chỗ dựa. Thế gia tử đệ: lũng đoạn tài nguyên, huyết mạch truyền thừa.',
    },
  ],

  powerSystem: {
    name: 'Tu chân cảnh giới',
    tiers: [
      { name: 'Luyện Khí', description: 'Dẫn khí nhập thể, pháp thuật sơ hiện.', stats: 'Thọ mệnh 100' },
      { name: 'Trúc Cơ', description: 'Đúc nền đạo cơ, ngự kiếm phi hành.', stats: 'Thọ mệnh 200' },
      { name: 'Kim Đan', description: 'Một viên kim đan nuốt vào bụng, mệnh ta do ta không do trời.', stats: 'Thọ mệnh 500' },
      { name: 'Nguyên Anh', description: 'Toái đan thành anh, nhục thân hủy hoại có thể đoạt xá.', stats: 'Thọ mệnh 1000' },
      { name: 'Hóa Thần', description: 'Lĩnh ngộ pháp tắc, thần thức hóa hình.', stats: 'Thọ mệnh 2000' },
      { name: 'Luyện Hư → Hợp Thể → Đại Thừa → Độ Kiếp', description: 'Đỉnh phong tu luyện, vượt qua thiên kiếp.', stats: 'Vô tận' },
    ],
    balanceRules: [
      'Đại cảnh giới áp chế: Trúc Cơ giết Luyện Khí như giết gà, không thể vượt cấp (trừ khi có kim thủ chỉ nghịch thiên).',
      'Tiểu cảnh giới chênh lệch: Sơ kỳ đánh hậu kỳ rất khó, nhưng có thể dùng trang bị/phù nhiên/trận pháp bù đắp.',
      'Nhân hải chiến thuật: Tu sĩ bậc thấp số lượng nhiều cũng không chất chồng chết tu sĩ bậc cao (AOE tồn tại).',
    ],
  },

  opportunityArc: [
    { name: 'Tin đồn', description: 'Tửu quán nghe nói, manh mối đấu giá, cổ tịch ghi chép.' },
    { name: 'Thám hiểm', description: 'Tiến vào bí cảnh/di tích, gặp cơ quan, trận pháp, yêu thú.' },
    { name: 'Tranh đoạt', description: 'Bảo vật xuất thế, đa phương thế lực hỗn chiến. Chủ nhân vật lợi dụng nước đục thả câu hoặc cưỡng thế trấn áp.' },
    { name: 'Thu hoạch', description: 'Đạt được bảo vật và lập tức chuyển hóa thành thực lực (đột phá tại chỗ).' },
  ],

  coolPatterns: [
    {
      name: 'Đột phá cảnh giới',
      scenario: 'Nhân vật chính trong tình thế nguy hiểm bất ngờ đột phá.',
      appeal: 'Cảm giác phấn khích, lật ngược thế cờ.',
      keyNote: 'Cần tiền đề (tích lũy trước đó), không nên đột phá vô cớ.',
    },
    {
      name: 'Giả heo ăn hổ',
      scenario: 'Kẻ địch coi thường, nhân vật chính bộc lộ thực lực áp đảo.',
      appeal: 'Vả mặt đã đời, phản chuyển mạnh.',
    },
    {
      name: 'Cơ duyên lớn',
      scenario: 'Phát hiện bí cảnh cổ đại, nhận được truyền thừa.',
      appeal: 'Thăng cấp vượt bậc, mở rộng thế giới quan.',
    },
    {
      name: 'Tông môn đại tỷ',
      scenario: 'Tông môn nội bộ tranh đấu, nâng cấp thứ bậc.',
      appeal: 'So sánh trực quan, khẳng định vị thế.',
    },
  ],

  conflictPatterns: [
    { type: 'Tài nguyên tranh đoạt', source: 'Linh mạch/linh điền/bảo vật', resolution: 'Dùng mưu hoặc vũ lực áp chế' },
    { type: 'Tông môn ân oán', source: 'Nội đấu hoặc tông môn khác', resolution: 'Thăng cấp + liên minh' },
    { type: 'Thiên kiếp thử thách', source: 'Đột phá cảnh giới', resolution: 'Chuẩn bị đầy đủ + kim thủ chỉ' },
    { type: 'Ma đạo xâm lấn', source: 'Phe tà ma', resolution: 'Chiến tranh chính-tà' },
  ],

  outlineArcs: [
    {
      title: 'Quyển 1: Tông Môn Phong Vân',
      chapterRange: '1-100',
      percentageOfTotal: 14,
      coreFocus: 'Ngoại môn đệ tử cạnh tranh, Trúc Cơ trước.',
      coreConflict: 'Tài nguyên tranh đoạt, tiểu nhân hãm hại.',
      climax: 'Tông môn đại tỷ xếp thứ nhất, Trúc Cơ thành công.',
      characterGrowth: 'Từ tiểu tu sĩ lên nội môn tinh anh.',
    },
    {
      title: 'Quyển 2: Huyết Sắc Thí Luyện',
      chapterRange: '101-250',
      percentageOfTotal: 21,
      coreFocus: 'Bí cảnh/di tích thám hiểm.',
      coreConflict: 'Đa tông môn hỗn chiến, ma đạo xâm nhập.',
      climax: 'Kết Đan, đạt được bản mệnh pháp bảo.',
    },
    {
      title: 'Quyển 3: Hải Ngoại/Trung Châu',
      chapterRange: '251-500',
      percentageOfTotal: 36,
      coreFocus: 'Đổi bản đồ: bị truy sát chạy trốn hoặc chủ động du lịch.',
      coreConflict: 'Tán tu gian nan sinh tồn, kết thức bạn mới.',
      climax: 'Kết Anh, xây dựng thế lực riêng.',
    },
    {
      title: 'Quyển 4: Giới Vực Chiến Tranh',
      chapterRange: '501-700+',
      percentageOfTotal: 29,
      coreFocus: 'Cục diện lớn: Nhân yêu lưỡng tộc đại chiến.',
      coreConflict: 'Thành một phương đại lão, tả hữu chiến cục.',
      climax: 'Đạt cảnh giới tối cao, kết thúc đại chiến.',
    },
  ],

  targetWordCount: '2.000.000 chữ',
  targetChapterCount: 700,

  pitfalls: [
    { description: 'Đột phá vô cớ không có tích lũy trước.', severity: 'critical' },
    { description: 'Chiến lực bùng nổ (power creep) — mất cân bằng hệ thống.', severity: 'critical' },
    { description: 'Quá nhiều nhân vật phụ không có vai trò.', severity: 'warning' },
    { description: 'Cốt truyện lặp đi lặp lại: vả mặt → thăng cấp → vả mặt.', severity: 'warning' },
  ],

  bestPractices: [
    { description: 'Cơ duyên cần qua 4 bước: Tin đồn → Thám hiểm → Tranh đoạt → Thu hoạch.' },
    { description: 'Mỗi đại cảnh giới cần có arc phát triển riêng, không nhảy cấp.' },
    { description: 'Giữ hệ thống chiến lực nhất quán: không phá quy tắc đã đặt.' },
    { description: 'Xây dựng thế giới quan có chiều sâu trước khi mở rộng bản đồ.' },
  ],

  entityTags: [
    { type: '功法', nameVi: 'Công pháp', attributes: ['hiệu quả', 'tầng cấp', 'phẩm cấp', 'thuộc tính'] },
    { type: '法宝', nameVi: 'Pháp bảo', attributes: ['chức năng', 'tầng cấp', 'phẩm cấp', 'ngoại hình'] },
    { type: 'quyền lực', nameVi: 'Thế lực', attributes: ['quan hệ với MC', 'tầng cấp', 'chính/ma', 'công pháp cốt lõi'] },
    { type: '妖兽', nameVi: 'Yêu thú', attributes: ['đặc điểm', 'cảnh giới', 'vật phẩm rơi'] },
  ],

  constraintPacks: ['Pack M01', 'Pack M02', 'Pack U03'],

  characterArchetypes: [
    {
      role: 'Chính — Tán tu quật cường',
      narrativeFunction: 'Nghịch thiên cải mệnh, dẫn dắt toàn bộ cốt truyện',
      personalityHint: 'Thận trọng, mưu trí, không tin ai dễ dàng',
      primaryArc: 'Quyển 1: Tông Môn Phong Vân',
      suggestedCount: [1, 1],
    },
    {
      role: 'Đồng hành — Huynh đệ kết nghĩa',
      narrativeFunction: 'Tạo tình cảm, hy sinh để thúc đẩy MC trưởng thành',
      personalityHint: 'Trung thành, nóng nảy, giỏi 1 lĩnh vực (luyện đan/trận pháp)',
      primaryArc: 'Quyển 1: Tông Môn Phong Vân',
      suggestedCount: [1, 3],
    },
    {
      role: 'Phản diện leo thang',
      narrativeFunction: 'Mỗi arc có 1 phản diện mạnh hơn, tạo áp lực leo thang liên tục',
      personalityHint: 'Kiêu ngạo, tham lam quyền lực, coi thường MC ban đầu',
      suggestedCount: [3, 6],
    },
    {
      role: 'Mentor — Lão quái giang hồ',
      narrativeFunction: 'Truyền thừa, gợi mở bí mật thế giới, hy sinh tạo bước ngoặt',
      personalityHint: 'Bí ẩn, nói ít hiểu nhiều, quá khứ u ám',
      primaryArc: 'Quyển 1: Tông Môn Phong Vân',
      suggestedCount: [1, 2],
    },
    {
      role: 'Tình yêu — Nữ tu tiên',
      narrativeFunction: 'Điểm mềm mại trong thế giới tàn khốc, tạo động lực cho MC',
      personalityHint: 'Độc lập, tài năng ngang MC, không yếu đuối',
      suggestedCount: [1, 2],
    },
    {
      role: 'Hài hước — Tán tu bạn đường',
      narrativeFunction: 'Giảm tension sau arc nặng, comic relief nhưng có chiều sâu',
      personalityHint: 'Ba hoa, tham sống sợ chết nhưng lúc cần thì đứng ra',
      suggestedCount: [1, 1],
    },
    {
      role: 'Kẻ phản bội — Sư huynh/đồng môn',
      narrativeFunction: 'Twist plot, phá vỡ trust, thúc đẩy MC cảnh giác hơn',
      personalityHint: 'Ban đầu tốt, dần lộ bản chất vì lợi ích',
      primaryArc: 'Quyển 2: Huyết Sắc Thí Luyện',
      suggestedCount: [1, 2],
    },
    {
      role: 'Nền sống động — Tán tu/Tiểu nhị quán trà',
      narrativeFunction: 'Cung cấp tin đồn, tạo bầu không khí thế giới sống động',
      personalityHint: 'Giang hồ, sặc mùi thế tục, biết nhiều chuyện',
      suggestedCount: [2, 5],
    },
    {
      role: 'Ẩn boss — Tông chủ bí ẩn',
      narrativeFunction: 'Reveal muộn, đảo lộn nhận thức, là phản diện thật sự hoặc đồng minh bất ngờ',
      personalityHint: 'Ôn hòa bề ngoài, cực kỳ thâm hiểm hoặc có nỗi khổ riêng',
      primaryArc: 'Quyển 4: Giới Vực Chiến Tranh',
      suggestedCount: [1, 1],
    },
  ],

  characterScaleHint: {
    per100Chapters: 6,
    minTotal: 12,
    maxTotal: 40,
  },
};
