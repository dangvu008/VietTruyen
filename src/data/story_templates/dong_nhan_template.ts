/**
 * File: dong_nhan_template.ts
 * Purpose: Story template cho thể loại Đồng Nhân (Fanfiction)
 * Layer: Data (Constants)
 * Domain: StoryTemplate → [creation_orchestrator, context_builder]
 * Deps: types/story_template
 * Source: Ported from tinix-ai/tinix-story (MIT)
 */

import type { StoryTemplate } from '../../types/story_template';

export const DONG_NHAN_TEMPLATE: StoryTemplate = {
  id: 'dong-nhan',
  name: 'Đồng Nhân',
  originalName: '同人',
  coreSellingPoint:
    'Viết dựa trên thế giới của tác phẩm gốc (anime, manga, game, phim). Tương tác với nhân vật yêu thích, bổ sung cái kết tiếc nuối, hoặc tạo cuộc phiêu lưu hoàn toàn mới.',
  tags: ['dong-nhan', 'fanfiction', 'anime', 'manga', 'game', 'crossover'],

  subGenres: [
    {
      name: 'Đồng nhân anime/manga',
      description: 'Dựa trên các bộ anime/manga nổi tiếng (One Piece, Naruto, Bleach, Dragon Ball...). Xuyên vào thế giới đó hoặc viết với nhân vật gốc.',
      coreAppeal: 'Fanservice, gặp nhân vật yêu thích, cảm giác "mình ở trong thế giới đó".',
      referenceWorks: ['Đồng Nhân Naruto', 'Đồng Nhân One Piece'],
    },
    {
      name: 'Đồng nhân game',
      description: 'Dựa trên game nổi tiếng (Genshin Impact, League of Legends, Honkai...). Xuyên vào thế giới game hoặc viết góc nhìn NPC.',
      coreAppeal: 'Game lore sâu, world-building có sẵn, thoả mãn nhu cầu "nếu mình ở đó thì sao".',
    },
    {
      name: 'Xuyên vào tác phẩm',
      description: 'Nhân vật chính từ thế giới thực xuyên vào trong một tác phẩm mà họ đã đọc/xem. Biết trước cốt truyện.',
      coreAppeal: 'Meta-awareness thú vị, nhân vật chính có thể thay đổi kết cục.',
      referenceWorks: ['Xuyên Vào Truyện Phản Diện'],
    },
    {
      name: 'Đồng nhân crossover',
      description: 'Kết hợp hai hoặc nhiều thế giới từ các tác phẩm khác nhau.',
      coreAppeal: 'Bất ngờ, sáng tạo, đọc giả thích tìm easter egg.',
    },
    {
      name: 'Đồng nhân phim/truyền hình',
      description: 'Dựa trên phim điện ảnh, drama Hàn/Hoa/Việt. Viết tiếp kết cục hoặc cảnh bị cắt.',
      coreAppeal: 'Chữa lành nỗi đau khi kết cục không như ý.',
    },
  ],

  worldRules: [
    {
      name: 'Tôn trọng thế giới gốc',
      description: 'Luật lệ, cảnh giới, tính cách nhân vật gốc phải được tôn trọng. OOC (Out Of Character) là lỗi nghiêm trọng.',
    },
    {
      name: 'Canon vs Non-canon',
      description: 'Phải xác định rõ từ đầu: AU (Alternate Universe), Canon-compliant, hay Divergence từ điểm nào.',
    },
    {
      name: 'Nhân vật gốc (OC) cân bằng',
      description: 'Nhân vật chính OC không nên quá mạnh so với nhân vật gốc mà không có lý do hợp lý.',
    },
    {
      name: 'Lore trung thành',
      description: 'Chi tiết về thế giới gốc phải chính xác. Sai lore = mất uy tín với fan cứng.',
    },
  ],

  powerSystem: undefined,

  opportunityArc: [
    { name: 'Xuyên nhập/Thiết lập', description: 'Nhân vật chính đến thế giới gốc, nhận ra bản thân đang ở đâu.' },
    { name: 'Thích nghi', description: 'Học hệ thống sức mạnh, xây dựng quan hệ với nhân vật gốc.' },
    { name: 'Tham gia cốt truyện', description: 'Bắt đầu ảnh hưởng đến timeline gốc — thay đổi hoặc theo dõi.' },
    { name: 'Điểm phân kỳ', description: 'Hành động của nhân vật chính làm thay đổi kết cục của tác phẩm gốc.' },
    { name: 'Kết thúc mới', description: 'Kết cục được rewrite theo ý tác giả.' },
  ],

  coolPatterns: [
    {
      name: 'Biết trước plot twist',
      scenario: 'Nhân vật chính biết trước cốt truyện, dùng kiến thức đó để chuẩn bị.',
      appeal: 'Thú vị khi thấy nhân vật đi trước một bước, tension cao khi họ cố thay đổi định mệnh.',
      keyNote: 'Đừng làm nhân vật quá op vì "biết trước" — phải có giới hạn.',
    },
    {
      name: 'Gặp nhân vật yêu thích',
      scenario: 'Nhân vật chính lần đầu gặp nhân vật yêu thích của mình từ tác phẩm gốc.',
      appeal: 'Fan-service mạnh, cảm xúc cao trào.',
    },
    {
      name: 'Cứu nhân vật chết trong gốc',
      scenario: 'Nhân vật chính biết ai sẽ chết và cố gắng thay đổi kết cục đó.',
      appeal: 'Emotional stakes cao, chữa lành trauma của fan.',
    },
    {
      name: 'Phá vỡ kỳ vọng của nhân vật gốc',
      scenario: 'Nhân vật gốc bị bất ngờ bởi hành động của nhân vật chính OC.',
      appeal: 'Tươi mới, thú vị, không theo pattern quen thuộc.',
    },
  ],

  conflictPatterns: [
    { type: 'Thay đổi timeline', source: 'Hành động của OC làm lệch cốt truyện gốc', resolution: 'Điều chỉnh và tìm cân bằng mới' },
    { type: 'Kẻ thù từ gốc', source: 'Villain của tác phẩm gốc', resolution: 'Dùng kiến thức về điểm yếu của villain' },
    { type: 'Nhân vật gốc không tin tưởng OC', source: 'OC là người lạ trong thế giới gốc', resolution: 'Chứng minh qua hành động' },
    { type: 'Không thể thay đổi số mệnh', source: 'Timeline tự sửa chữa về lại kết cục gốc', resolution: 'Tìm cách phá vỡ quy luật số mệnh' },
  ],

  outlineArcs: [
    {
      title: 'Nhập Thế Giới Gốc',
      chapterRange: '1-30',
      percentageOfTotal: 20,
      coreFocus: 'Định hướng, nhận ra mình ở đâu trong timeline, thiết lập mục tiêu.',
      coreConflict: 'Thích nghi, không để lộ mình là "người ngoài".',
      climax: 'Gặp nhân vật chính của tác phẩm gốc lần đầu.',
      characterGrowth: 'Từ bối rối → có kế hoạch.',
    },
    {
      title: 'Can Thiệp Timeline',
      chapterRange: '31-120',
      percentageOfTotal: 50,
      coreFocus: 'Tham gia sự kiện gốc, thay đổi một số điểm quan trọng.',
      coreConflict: 'Villain gốc, định mệnh tự sửa chữa, nhân vật gốc phản ứng với thay đổi.',
      climax: 'Thay đổi lớn nhất — khoảnh khắc timeline gốc hoàn toàn thay đổi.',
      characterGrowth: 'Từ quan sát → tham gia tích cực, chịu trách nhiệm.',
    },
    {
      title: 'Kết Cục Mới',
      chapterRange: '121-180',
      percentageOfTotal: 30,
      coreFocus: 'Giải quyết theo hướng mới, kết thúc thỏa mãn hơn bản gốc.',
      coreConflict: 'Cuộc chiến cuối cùng với kẻ thù mạnh nhất.',
      climax: 'Kết cục mới, các nhân vật gốc có tương lai tốt hơn.',
      characterGrowth: 'Nhân vật chính tìm được chỗ đứng trong thế giới này.',
    },
  ],

  targetWordCount: '200.000 - 600.000 chữ',
  targetChapterCount: 180,

  pitfalls: [
    { description: 'OOC nghiêm trọng — nhân vật gốc hành xử hoàn toàn trái với bản gốc.', severity: 'critical' },
    { description: 'Sai lore — chi tiết không khớp với tác phẩm gốc.', severity: 'critical' },
    { description: 'OC quá mạnh không có lý do — Mary Sue/Gary Stu.', severity: 'warning' },
    { description: 'Cốt truyện hoàn toàn phụ thuộc vào tác phẩm gốc — không có điểm riêng.', severity: 'warning' },
  ],

  bestPractices: [
    { description: 'Đọc lại tác phẩm gốc trước khi viết — hoặc có nguồn tra cứu lore chính xác.' },
    { description: 'Xác định rõ điểm phân kỳ từ đầu: đây là AU hay canon-divergence.' },
    { description: 'OC cần có điểm yếu và mục tiêu riêng, không chỉ là fan của nhân vật gốc.' },
    { description: 'Tôn trọng nhân vật gốc — cải biến nhưng không hạ thấp.' },
  ],

  entityTags: [
    { type: 'source', nameVi: 'Tác phẩm gốc', attributes: ['tên', 'thể loại', 'timeline điểm xuyên vào'] },
    { type: 'OC', nameVi: 'Nhân vật tự tạo', attributes: ['xuất phát điểm', 'kiến thức về gốc', 'mục tiêu'] },
    { type: 'canon', nameVi: 'Nhân vật gốc', attributes: ['tính cách canon', 'phản ứng với OC', 'arc thay đổi'] },
  ],

  constraintPacks: ['Pack M01'],
};
