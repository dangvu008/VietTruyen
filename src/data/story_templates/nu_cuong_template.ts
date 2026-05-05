/**
 * File: nu_cuong_template.ts
 * Purpose: Story template cho thể loại Nữ Cường (Nữ Chủ Mạnh Mẽ)
 * Layer: Data (Constants)
 * Domain: StoryTemplate → [creation_orchestrator, context_builder]
 * Deps: types/story_template
 * Source: Ported from tinix-ai/tinix-story (MIT)
 */

import type { StoryTemplate } from '../../types/story_template';

export const NU_CUONG_TEMPLATE: StoryTemplate = {
  id: 'nu-cuong',
  name: 'Nữ Cường',
  originalName: '女强',
  coreSellingPoint:
    'Nữ chính kiên cường, thông minh, độc lập — tự vươn lên, phá định kiến, không dựa dẫm. Tự mình làm chủ cuộc đời.',
  tags: ['nu-cuong', 'strong-female', 'romance', 'independent', 'self-reliant'],

  subGenres: [
    {
      name: 'Trọng sinh nữ cường',
      description: 'Nữ chính trọng sinh về quá khứ, lần này dùng trí tuệ và kinh nghiệm để nghịch thiên cải mệnh.',
      coreAppeal: 'Phục hưng từ bi kịch, vả mặt tất cả kẻ từng hại mình.',
      referenceWorks: ['Thứ Nữ Đích Phong Hoa'],
    },
    {
      name: 'Xuyên không nữ cường',
      description: 'Nữ chính hiện đại xuyên vào cổ đại hoặc thế giới khác, dùng tri thức hiện đại để thăng tiến.',
      coreAppeal: 'Chênh lệch tri thức, kinh doanh phát triển, đánh bại cả nam nhân.',
    },
    {
      name: 'Tu tiên nữ cường',
      description: 'Nữ chính tu luyện, thực lực áp đảo — không cần ai bảo vệ, chỉ cần ai ngang hàng.',
      coreAppeal: 'Sảng khoái, nữ chính không bị harem, tự quyết mọi thứ.',
    },
    {
      name: 'Nữ đế - Nữ vương',
      description: 'Nữ chính trở thành lãnh đạo tối cao — nữ đế, nữ vương, trùm tập đoàn.',
      coreAppeal: 'Uy quyền, chiến lược, cảm giác nắm trong tay vận mệnh thiên hạ.',
    },
  ],

  worldRules: [
    {
      name: 'Nữ chính không cần nam chính cứu',
      description: 'Nam chính (nếu có) là đồng hành ngang hàng, không phải cứu thế. Xung đột chính phải do nữ chính tự giải quyết.',
    },
    {
      name: 'Phá vỡ định kiến giới tính',
      description: 'Thế giới có thể mang định kiến — nhưng nữ chính không chấp nhận. Mỗi chiến thắng là một cú đánh vào định kiến.',
    },
    {
      name: 'Trí tuệ > Vũ lực',
      description: 'Dù thể loại có chiến đấu hay không, nữ cường thắng bằng trí tuệ, mưu lược và kiên định.',
    },
  ],

  powerSystem: undefined,

  opportunityArc: [
    { name: 'Xuất phát điểm thấp', description: 'Bị khinh thường, phản bội, ở điểm xuất phát bất lợi nhất.' },
    { name: 'Nắm cơ duyên', description: 'Trọng sinh/xuyên không/hệ thống — nữ chính có lợi thế người ngoài không biết.' },
    { name: 'Từng bước vươn lên', description: 'Kinh doanh, tu luyện, chính trị — mỗi bước là một chiến thắng.' },
    { name: 'Đối đầu kẻ thù lớn nhất', description: 'Cao trào đối mặt với kẻ từng phá hoại nữ chính nhất.' },
    { name: 'Đạt đỉnh cao', description: 'Nữ chính đạt vị trí không ai có thể đụng chạm.' },
  ],

  coolPatterns: [
    {
      name: 'Vả mặt công khai',
      scenario: 'Kẻ từng khinh thường đứng ngây ra khi chứng kiến nữ chính uy quyền.',
      appeal: 'Cực kỳ sảng khoái, đền bù cảm xúc cho độc giả đã ức chế.',
      keyNote: 'Chỉ hiệu quả nếu kẻ bị vả đã được xây dựng đủ đáng ghét từ trước.',
    },
    {
      name: 'Không cần ai cứu',
      scenario: 'Nguy hiểm xuất hiện, nữ chính tự giải quyết trước khi ai kịp can thiệp.',
      appeal: 'Khẳng định bản lĩnh, tránh trope nữ chính yếu đuối.',
    },
    {
      name: 'Chiến lược thương nghiệp',
      scenario: 'Nữ chính dùng tri thức hiện đại hoặc trí tuệ vượt trội để thắng đối thủ kinh doanh.',
      appeal: 'Thỏa mãn trí tuệ, cảm giác "mình cũng đoán được" nhưng vẫn bất ngờ.',
    },
  ],

  conflictPatterns: [
    { type: 'Kẻ phản bội từ quá khứ', source: 'Gia đình, tình nhân, đồng đội cũ', resolution: 'Vả mặt bằng thực lực + địa vị' },
    { type: 'Định kiến xã hội', source: 'Môi trường cổ đại hoặc gia trưởng', resolution: 'Chứng minh qua hành động, không phải lời nói' },
    { type: 'Đối thủ thực lực', source: 'Kẻ mạnh hơn hoặc ngang hàng muốn cản trở', resolution: 'Trí tuệ + liên minh + thực lực' },
    { type: 'Nội tâm', source: 'Tổn thương quá khứ, thiếu tin tưởng người khác', resolution: 'Học cách mở lòng trong khi vẫn mạnh mẽ' },
  ],

  outlineArcs: [
    {
      title: 'Vực Thẳm: Khởi Điểm',
      chapterRange: '1-40',
      percentageOfTotal: 15,
      coreFocus: 'Giới thiệu nữ chính ở điểm thấp nhất, nguyên nhân phải vươn lên.',
      coreConflict: 'Phản bội, bị hại, bị khinh thường.',
      climax: 'Quyết định đứng dậy, lấy lại mọi thứ.',
      characterGrowth: 'Từ nạn nhân → quyết tâm chiến đấu.',
    },
    {
      title: 'Vươn Lên: Chiến Thắng Từng Bước',
      chapterRange: '41-150',
      percentageOfTotal: 45,
      coreFocus: 'Từng bước khẳng định địa vị, vả mặt từng kẻ từng hại mình.',
      coreConflict: 'Nhiều đối thủ ở nhiều lĩnh vực, thử thách ngày càng lớn.',
      climax: 'Đạt vị trí không ai ngờ tới.',
      characterGrowth: 'Từ chiến thuật nhỏ → tầm nhìn chiến lược lớn.',
    },
    {
      title: 'Đỉnh Cao: Đối Đầu Kẻ Thù Lớn Nhất',
      chapterRange: '151-250',
      percentageOfTotal: 40,
      coreFocus: 'Cuộc đối đầu cuối cùng với kẻ thù căn nguyên của mọi đau khổ.',
      coreConflict: 'Trận chiến quyết định — thực lực, mưu kế, và ý chí.',
      climax: 'Chiến thắng hoàn toàn, đạt đỉnh cao.',
      characterGrowth: 'Trưởng thành về nội tâm, không chỉ về địa vị.',
    },
  ],

  targetWordCount: '400.000 - 1.000.000 chữ',
  targetChapterCount: 250,

  pitfalls: [
    { description: 'Nữ chính "mạnh" về ngoại hình nhưng thụ động về tư duy — không phải nữ cường thật.', severity: 'critical' },
    { description: 'Nam chính cứu nữ chính ở khoảnh khắc quyết định — phá vỡ toàn bộ hình tượng.', severity: 'critical' },
    { description: 'Vả mặt quá nhiều mà không có character growth.', severity: 'warning' },
  ],

  bestPractices: [
    { description: 'Nữ chính phải có điểm yếu nội tâm — không phải về năng lực mà về cảm xúc.' },
    { description: 'Chiến thắng phải đến từ trí tuệ + nỗ lực, không phải cơ may.' },
    { description: 'Nam chính (nếu có) cần tôn trọng, không cần bảo hộ nữ chính.' },
    { description: 'Thế giới quan cần nhất quán — nếu phân biệt giới tính, phải được xây dựng rõ từ đầu.' },
  ],

  entityTags: [
    { type: 'nhân vật chính', nameVi: 'Nữ chính', attributes: ['điểm xuất phát', 'lĩnh vực thống trị', 'điểm yếu nội tâm'] },
    { type: 'đối lập', nameVi: 'Kẻ thù/Đối thủ', attributes: ['mức độ đe dọa', 'quan hệ với nữ chính', 'cách vả mặt'] },
    { type: 'hỗ trợ', nameVi: 'Nam chính / Đồng hành', attributes: ['vai trò', 'cách hỗ trợ', 'không bảo hộ'] },
  ],

  constraintPacks: ['Pack M01'],
};
