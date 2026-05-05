/**
 * File: dam_my_template.ts
 * Purpose: Story template cho thể loại Đam Mỹ (Nam-Nam Ngôn Tình)
 * Layer: Data (Constants)
 * Domain: StoryTemplate → [creation_orchestrator, context_builder]
 * Deps: types/story_template
 * Source: Ported from tinix-ai/tinix-story data/genres.json (MIT)
 */

import type { StoryTemplate } from '../../types/story_template';

export const DAM_MY_TEMPLATE: StoryTemplate = {
  id: 'dam-my',
  name: 'Đam Mỹ',
  originalName: '耽美',
  coreSellingPoint:
    'Tình cảm sâu sắc, tinh tế hoặc ngang trái giữa hai nhân vật nam. Văn phong trau chuốt, chú trọng tâm lý, lồng ghép mọi bối cảnh.',
  tags: ['dam-my', 'bl', 'romance', 'male-male', 'ngon-tinh'],

  subGenres: [
    {
      name: 'Cổ đại đam mỹ',
      description: 'Bối cảnh phong kiến, cổ trang, cung đình. Tình cảm ngang trái hoặc ngọt sủng giữa các nam nhân thời cổ.',
      coreAppeal: 'Trang phục cổ phong, thơ ca Hán Việt, tình tứ ẩn dụ.',
      referenceWorks: ['Thiên Quan Tứ Phúc', 'Nhị Hà'],
    },
    {
      name: 'Hiện đại đam mỹ',
      description: 'Bối cảnh đời thường hiện đại — công sở, trường học, giới showbiz. Tình cảm chân thực, gần gũi.',
      coreAppeal: 'Mối quan hệ đời thường, tâm lý tinh tế, HE ấm áp.',
      referenceWorks: ['Phiếu Lượng', 'Tứ Hải Vi Gia'],
    },
    {
      name: 'Tiên hiệp đam mỹ',
      description: 'Kết hợp tu tiên với tuyến tình cảm nam-nam. Các cặp đôi tiên tôn - thần, sư huynh - sư đệ.',
      coreAppeal: 'Nghìn năm tương tư, âm dương cách trở, đoàn tụ cảm động.',
      referenceWorks: ['Mặc Hương Đồng Khứu - Vong Ưu San'],
    },
    {
      name: 'Ngược — HE',
      description: 'Cốt truyện có nhiều bi kịch, hiểu lầm, đau khổ nhưng kết thúc viên mãn (HE).',
      coreAppeal: 'Phục hưng sau tổn thương, tình yêu bất diệt vượt qua thử thách.',
    },
  ],

  worldRules: [
    {
      name: 'Cảm xúc là trung tâm',
      description: 'Mọi xung đột — dù cung đình, tu tiên hay hiện đại — đều phải phục vụ cho chiều sâu tình cảm của cặp đôi chính.',
    },
    {
      name: 'Tâm lý nhân vật nhất quán',
      description: 'Mỗi hành động phải có động cơ tâm lý rõ ràng. Tránh OOC (Out Of Character) — đặc biệt trong các cảnh hiểu lầm.',
    },
    {
      name: 'Cân bằng Sweet & Angst',
      description: 'Không toàn ngọt (nhàm chán) cũng không toàn ngược (mệt mỏi). Tỷ lệ 6:4 sweet:angst thường hiệu quả nhất.',
    },
  ],

  powerSystem: undefined,

  opportunityArc: [
    { name: 'Lần đầu gặp gỡ', description: 'Tạo ấn tượng ban đầu đặc biệt — không nhất thiết phải tích cực.' },
    { name: 'Duyên kỳ ngộ', description: 'Hoàn cảnh buộc hai người gắn kết: cùng phòng, cùng nhiệm vụ, hôn ước ép buộc.' },
    { name: 'Hiểu lầm và giải toả', description: 'Xung đột nội tâm, mờ nhạt ranh giới, rồi thú nhận thật.' },
    { name: 'Kết viên mãn', description: 'HE (Happy Ending) thường là đích đến — BE cần được báo trước sớm.' },
  ],

  coolPatterns: [
    {
      name: 'Tương tư thầm lặng',
      scenario: 'Nhân vật A yêu từ xa, che giấu, bị phát hiện dần.',
      appeal: 'Hồi hộp, cảm xúc tinh vi, khoảnh khắc nhỏ đầy ý nghĩa.',
      keyNote: 'Dùng chi tiết — ánh mắt, động chạm vô tình — thay vì khai báo trực tiếp.',
    },
    {
      name: 'Phục thù / Trọng sinh',
      scenario: 'Nhân vật chính trọng sinh, lần này quyết định thay đổi kết cục bi thảm.',
      appeal: 'Tension cao, thú vị khi thấy MC "đi trước một bước".',
    },
    {
      name: 'Từ thù thành yêu',
      scenario: 'Hai nhân vật ban đầu đối lập, xung đột dần chuyển hóa thành tình cảm.',
      appeal: 'Dramatic tension, khoảnh khắc "nhận ra" cực mãn nhãn.',
    },
    {
      name: 'Ngăn cách thân phận',
      scenario: 'Vua — thần dân, sư phụ — đồ đệ, thần — phàm nhân. Rào cản làm tình yêu đau khổ và quý giá.',
      appeal: 'Angst sâu, hy sinh lớn, giá trị HE được đề cao.',
    },
  ],

  conflictPatterns: [
    { type: 'Thân phận cách trở', source: 'Giai cấp, tông môn, thù hận gia tộc', resolution: 'Hy sinh quyền lực hoặc xây dựng lại từ đầu cùng nhau' },
    { type: 'Hiểu lầm tích lũy', source: 'Che giấu danh tính, tin đồn thất thiệt', resolution: 'Thú nhận sự thật, kiên nhẫn chứng minh' },
    { type: 'Kẻ thứ ba', source: 'Hôn ước cũ, tình nhân quá khứ', resolution: 'Chọn lựa rõ ràng, buông bỏ dứt khoát' },
    { type: 'Số phận nghiệt ngã', source: 'Tiên tri, kiếp nạn, tiên duyên', resolution: 'Cùng nhau vượt qua hoặc hy sinh vì nhau' },
  ],

  outlineArcs: [
    {
      title: 'Chương 1: Gặp Gỡ & Duyên Khởi',
      chapterRange: '1-30',
      percentageOfTotal: 15,
      coreFocus: 'Thiết lập hai nhân vật chính, tạo duyên kỳ ngộ đặc biệt.',
      coreConflict: 'Va chạm ban đầu — hiểu lầm hoặc thù địch.',
      climax: 'Khoảnh khắc đầu tiên tạo dấu ấn sâu đậm.',
      characterGrowth: 'Nhân vật bắt đầu chú ý đến nhau.',
    },
    {
      title: 'Chương 2: Cận Kề & Rung Động',
      chapterRange: '31-80',
      percentageOfTotal: 25,
      coreFocus: 'Hoàn cảnh gắn kết, tình cảm nảy sinh dần.',
      coreConflict: 'Phủ nhận cảm xúc, xung đột nội tâm.',
      climax: 'Khoảnh khắc nhận ra mình đã yêu.',
      characterGrowth: 'Phòng thủ bắt đầu sụp đổ.',
    },
    {
      title: 'Chương 3: Angst & Thử Thách',
      chapterRange: '81-150',
      percentageOfTotal: 35,
      coreFocus: 'Xung đột lên đỉnh điểm — chia ly, hiểu lầm lớn, nguy hiểm.',
      coreConflict: 'Rào cản thân phận hoặc kẻ thứ ba.',
      climax: 'Điểm tối nhất — có thể có tạm biệt.',
      characterGrowth: 'Hiểu rõ trái tim mình muốn gì.',
    },
    {
      title: 'Chương 4: Hội Tụ & HE',
      chapterRange: '151-200',
      percentageOfTotal: 25,
      coreFocus: 'Giải quyết mọi mâu thuẫn, đoàn tụ, kết thúc viên mãn.',
      coreConflict: 'Vượt qua thử thách cuối cùng cùng nhau.',
      climax: 'Thú nhận thật, chính thức ở bên nhau.',
      characterGrowth: 'Cả hai trưởng thành, chấp nhận yêu và được yêu.',
    },
  ],

  targetWordCount: '300.000 - 800.000 chữ',
  targetChapterCount: 150,

  pitfalls: [
    { description: 'OOC (Out Of Character) — nhân vật hành xử trái tính cách đã xây dựng.', severity: 'critical' },
    { description: 'Hiểu lầm kéo dài vô lý — độc giả mất kiên nhẫn.', severity: 'critical' },
    { description: 'Kẻ thứ ba quá mờ nhạt hoặc quá dai dẳng.', severity: 'warning' },
    { description: 'Dùng trope mà không có twist mới.', severity: 'warning' },
  ],

  bestPractices: [
    { description: 'Xây dựng nhân vật chính với nội tâm phong phú trước khi đưa vào tình huống lãng mạn.' },
    { description: 'Mỗi cảnh sweet cần có ý nghĩa — đừng đặt vào chỉ vì cần "fill".' },
    { description: 'Angst phải có mục đích: thúc đẩy character growth hoặc làm sâu sắc tình cảm.' },
    { description: 'Giọng văn từng nhân vật cần khác nhau rõ ràng (POV shifts).' },
  ],

  entityTags: [
    { type: 'nhân vật chính', nameVi: 'CP (Couple)', attributes: ['vai trò', 'tính cách', 'thân phận', 'arc'] },
    { type: 'xung đột', nameVi: 'Mâu thuẫn tình cảm', attributes: ['kiểu', 'nguyên nhân', 'thời điểm giải quyết'] },
    { type: 'setting', nameVi: 'Bối cảnh', attributes: ['thời đại', 'địa điểm', 'quy tắc xã hội'] },
  ],

  constraintPacks: ['Pack M01'],

  characterArchetypes: [
    {
      role: 'Chính — Công (Seme)',
      narrativeFunction: 'Một trong hai CP, chủ động hơn trong mối quan hệ',
      personalityHint: 'Mạnh mẽ, bảo vệ, hoặc lạnh lùng bề ngoài nhưng dịu dàng với người yêu',
      primaryArc: 'Chương 1: Gặp Gỡ & Duyên Khởi',
      suggestedCount: [1, 1],
    },
    {
      role: 'Chính — Thụ (Uke)',
      narrativeFunction: 'Một trong hai CP, tâm lý tinh tế hơn, arc nội tâm sâu',
      personalityHint: 'Kiên cường nhưng mềm lòng, có quá khứ hoặc nỗi đau riêng',
      primaryArc: 'Chương 1: Gặp Gỡ & Duyên Khởi',
      suggestedCount: [1, 1],
    },
    {
      role: 'Đồng hành — Tri kỷ/Bạn thân',
      narrativeFunction: 'Người tâm sự, đẩy tiến triển tình cảm, phát hiện tình cảm trước CP',
      personalityHint: 'Tinh tế, trung thành, đôi khi là người đầu tiên nhận ra tình cảm của CP',
      suggestedCount: [1, 2],
    },
    {
      role: 'Đối thủ — Kẻ ganh đua/tình địch',
      narrativeFunction: 'Tạo ghen tuông, thử thách mối quan hệ, có thể là mối tình cũ',
      personalityHint: 'Hấp dẫn, có lý do chính đáng để can thiệp',
      primaryArc: 'Chương 2: Cận Kề & Rung Động',
      suggestedCount: [1, 2],
    },
    {
      role: 'Gác cổng — Gia đình/xã hội',
      narrativeFunction: 'Tạo rào cản thân phận, áp lực xã hội đối với mối quan hệ',
      personalityHint: 'Nghiêm khắc, có thể thay đổi hoặc cố chấp đến cùng',
      primaryArc: 'Chương 3: Angst & Thử Thách',
      suggestedCount: [1, 2],
    },
    {
      role: 'Hài hước — Đồng nghiệp/đồng môn',
      narrativeFunction: 'Giảm angst, tạo tình huống hiểu lầm vui, điều hòa nhịp truyện',
      personalityHint: 'Lém lỉnh, yêu đời, không phán xét',
      suggestedCount: [1, 2],
    },
    {
      role: 'Chất xúc tác — Người từ quá khứ',
      narrativeFunction: 'Kích hoạt twist, hé lộ bí mật, buộc CP đối mặt cảm xúc thật',
      personalityHint: 'Mang theo bí mật hoặc tổn thương cũ',
      primaryArc: 'Chương 3: Angst & Thử Thách',
      suggestedCount: [1, 1],
    },
    {
      role: 'Nền sống động — Hàng xóm/đồng nghiệp/huynh đệ',
      narrativeFunction: 'Tạo bầu không khí, phản ánh thái độ xã hội, thêm chiều sâu thế giới',
      personalityHint: 'Đa dạng — từ ủng hộ đến dè dặt, phản ánh xã hội thực tế',
      suggestedCount: [2, 4],
    },
  ],

  characterScaleHint: {
    per100Chapters: 3,
    minTotal: 8,
    maxTotal: 18,
  },
};
