/**
 * File: vong_du_ngon_tinh_template.ts
 * Purpose: Story template cho thể loại Võng Du Ngôn Tình (Game Online + Tình Cảm)
 * Layer: Data (Constants)
 * Domain: StoryTemplate → [creation_orchestrator, context_builder]
 * Deps: types/story_template
 * Source: Ported from tinix-ai/tinix-story (MIT)
 */

import type { StoryTemplate } from '../../types/story_template';

export const VONG_DU_NGON_TINH_TEMPLATE: StoryTemplate = {
  id: 'vong-du-ngon-tinh',
  name: 'Võng Du Ngôn Tình',
  originalName: '网游言情',
  coreSellingPoint:
    'Kết hợp game online và tình cảm đời thực. Tình cảm phát triển song song trong thế giới ảo và đời thực. Sự kiện offline, PK, đấu giải giữa các bang phái.',
  tags: ['vong-du', 'game', 'romance', 'online-game', 'mmorpg'],

  subGenres: [
    {
      name: 'Game + Ngôn tình thuần',
      description: 'Nhân vật chính gặp gỡ, yêu đương trong game và ngoài đời. Trọng tâm là tình cảm, game chỉ là bối cảnh.',
      coreAppeal: 'Lãng mạn, nhẹ nhàng, ngọt sủng. Lý tưởng hóa romance trong game.',
    },
    {
      name: 'Cạnh kỹ võng du',
      description: 'Nhân vật chính là game thủ giỏi, tham gia giải đấu chuyên nghiệp. Có cả tuyến tình cảm đan xen.',
      coreAppeal: 'Chiến đấu kịch tính trong game, vinh quang thi đấu, romance là bonus.',
      referenceWorks: ['Toàn Chức Cao Thủ'],
    },
    {
      name: 'Sảng văn võng du',
      description: 'Nhân vật chính bá chủ server, vả mặt tất cả đối thủ, đồng thời có tuyến tình cảm.',
      coreAppeal: 'Sảng khoái double-track: sảng trong game + ngọt trong tình cảm.',
    },
    {
      name: 'VR/Full Dive game',
      description: 'Nhân vật chính đắm chìm hoàn toàn vào game VR, ranh giới thực-ảo mờ nhạt.',
      coreAppeal: 'World-building phong phú, bí ẩn game chứa sự thật thực tế.',
    },
  ],

  worldRules: [
    {
      name: 'Song song thực - ảo',
      description: 'Câu chuyện phải duy trì cả hai tuyến: trong game và ngoài đời thực. Không nên bỏ bê một trong hai quá lâu.',
    },
    {
      name: 'Danh tính ẩn',
      description: 'Trope phổ biến: nhân vật chính có danh tính ẩn trong game. Sự tiết lộ là một khoảnh khắc cao trào.',
    },
    {
      name: 'Bang phái là thế lực',
      description: 'Bang phái (guild) tương đương gia tộc — có lãnh địa, tài nguyên, tranh đấu chính trị trong game.',
    },
    {
      name: 'Offline là đỉnh điểm',
      description: 'Sự kiện gặp mặt offline luôn là cao trào quan trọng. Sự khác biệt giữa người trong game và ngoài đời tạo kịch tính.',
    },
  ],

  powerSystem: {
    name: 'Cấp độ nhân vật game',
    tiers: [
      { name: 'Newbie / Novice', description: 'Mới bắt đầu, chưa có kỹ năng và trang bị.', stats: 'Level 1-20' },
      { name: 'Thường', description: 'Hiểu cơ bản, bắt đầu ổn định.', stats: 'Level 21-50' },
      { name: 'Tinh anh', description: 'Kỹ năng tốt, có trang bị khá, được công nhận trong server.', stats: 'Level 51-80' },
      { name: 'Cao thủ', description: 'Top rank, được biết đến trong cộng đồng.', stats: 'Level 81-100' },
      { name: 'Thiên tài / Huyền thoại', description: 'Bất bại trong class, đã để lại dấu ấn lịch sử server.', stats: 'Max level + Achievement' },
    ],
    balanceRules: [
      'Level cao hơn không đảm bảo thắng nếu thua về kỹ năng (APM, micro).',
      'Trang bị có thể bù đắp level, nhưng không bù được lỗi kỹ năng nghiêm trọng.',
      'Bang phái chiến: quy mô + chiến thuật > cá nhân mạnh.',
    ],
  },

  opportunityArc: [
    { name: 'Bắt đầu game', description: 'Nhân vật chính lần đầu đăng nhập, chọn class, khám phá thế giới.' },
    { name: 'Gặp gỡ', description: 'Gặp nhân vật quan trọng trong game — không biết đó là ai ngoài đời.' },
    { name: 'Phát triển thực lực', description: 'Nâng cấp, có trang bị tốt, khẳng định vị trí trong server.' },
    { name: 'Bang phái sự kiện', description: 'Chiến bang, đấu giải, sự kiện lớn — cao trào trong game.' },
    { name: 'Offline reveal', description: 'Gặp mặt thực, tiết lộ danh tính, tình cảm chính thức.' },
  ],

  coolPatterns: [
    {
      name: 'Danh tính bất ngờ',
      scenario: 'Người yêu/đối thủ trong game hóa ra là người quen ngoài đời.',
      appeal: 'Plot twist thú vị, kịch tính dồn nén bùng phát.',
      keyNote: 'Chuẩn bị foreshadowing đủ để người đọc có thể đoán được nhưng vẫn bất ngờ.',
    },
    {
      name: 'PK drama',
      scenario: 'Nhân vật chính PK với kẻ bắt nạt trong game, thể hiện skill vượt trội.',
      appeal: 'Sảng khoái, cộng đồng game ầm ĩ, danh tiếng tăng vọt.',
    },
    {
      name: 'Sự kiện offline',
      scenario: 'Toàn bộ bang phái gặp mặt, bầu không khí khác hoàn toàn so với online.',
      appeal: 'Awkward + romantic, ranh giới thực-ảo tan biến.',
    },
    {
      name: 'Server-wide event',
      scenario: 'Sự kiện lớn toàn server — nhiều bang phái tham chiến, quyết định thứ hạng.',
      appeal: 'Quy mô lớn, chiến thuật phức tạp, vinh quang khi chiến thắng.',
    },
  ],

  conflictPatterns: [
    { type: 'Bang phái tranh đấu', source: 'Lãnh địa, tài nguyên, thứ hạng server', resolution: 'Chiến lược + team play + kỹ năng cá nhân' },
    { type: 'Hiểu lầm danh tính', source: 'Không biết nhau là ai ngoài đời', resolution: 'Tiết lộ dần, offline gặp mặt' },
    { type: 'Hacker/Bug abuser', source: 'Đối thủ dùng bất chính để giành lợi thế', resolution: 'Tố cáo hoặc đánh bại dù thiệt thòi' },
    { type: 'Tình cảm tam giác', source: 'Yêu nhân vật game, nhưng nhân vật thực lại khác', resolution: 'Nhận ra và chọn lựa thật lòng' },
  ],

  outlineArcs: [
    {
      title: 'Nhập Game: Khởi Đầu',
      chapterRange: '1-30',
      percentageOfTotal: 15,
      coreFocus: 'Giới thiệu thế giới game, nhân vật chính, gặp nhân vật quan trọng.',
      coreConflict: 'Làm quen môi trường, xung đột nhỏ ban đầu.',
      climax: 'Gặp gỡ ấn tượng với nhân vật quan trọng.',
      characterGrowth: 'Từ newbie bắt đầu thích nghi.',
    },
    {
      title: 'Khẳng Định: Trở Thành Cao Thủ',
      chapterRange: '31-120',
      percentageOfTotal: 45,
      coreFocus: 'Nâng cấp, tham gia bang phái, khẳng định vị trí. Tình cảm nảy sinh.',
      coreConflict: 'Đối thủ trong game, drama bang phái, hiểu lầm với người yêu.',
      climax: 'Chiến thắng sự kiện server lớn.',
      characterGrowth: 'Từ ẩn danh đến huyền thoại server.',
    },
    {
      title: 'Offline: Thực Tế Gặp Gỡ',
      chapterRange: '121-200',
      percentageOfTotal: 40,
      coreFocus: 'Tiết lộ danh tính, gặp mặt thực, tình cảm chính thức.',
      coreConflict: 'Sự khác biệt giữa online persona và người thật ngoài đời.',
      climax: 'Chính thức trong mối quan hệ, giải quyết mọi hiểu lầm.',
      characterGrowth: 'Học cách thật sự kết nối với con người thật, không qua màn hình.',
    },
  ],

  targetWordCount: '300.000 - 700.000 chữ',
  targetChapterCount: 200,

  pitfalls: [
    { description: 'Mô tả game quá chi tiết kỹ thuật — người không chơi game sẽ bỏ đọc.', severity: 'critical' },
    { description: 'Tuyến tình cảm bị lấn át hoàn toàn bởi chiến đấu game — mất cân bằng.', severity: 'warning' },
    { description: 'Danh tính bí ẩn kéo quá dài — độc giả mất kiên nhẫn.', severity: 'warning' },
  ],

  bestPractices: [
    { description: 'Mô tả game phải đủ hấp dẫn cho cả người chơi lẫn không chơi game.' },
    { description: 'Duy trì balance 50:50 giữa trong game và ngoài đời.' },
    { description: 'Foreshadowing danh tính ẩn — cho phép độc giả đoán trước một chút.' },
    { description: 'Bang phái cần có cá tính riêng, không chỉ là backdrop.' },
  ],

  entityTags: [
    { type: 'nhân vật', nameVi: 'Avatar game / Người thật', attributes: ['class', 'level', 'danh tiếng server', 'danh tính thật'] },
    { type: 'bang phái', nameVi: 'Guild / Bang phái', attributes: ['kích thước', 'chuyên môn', 'lãnh đạo', 'đối thủ'] },
    { type: 'sự kiện', nameVi: 'Server event', attributes: ['quy mô', 'phần thưởng', 'các phe tham gia'] },
  ],

  constraintPacks: ['Pack M01'],
};
