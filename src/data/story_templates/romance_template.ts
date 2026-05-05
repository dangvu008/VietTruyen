/**
 * File: romance_template.ts
 * Purpose: Story template cho thể loại Ngôn Tình / Ngọt Sủng
 * Layer: Data (Constants)
 * Domain: StoryTemplate → [creation_orchestrator, context_builder]
 * Deps: types/story_template
 */

import type { StoryTemplate } from '../../types/story_template';

export const ROMANCE_TEMPLATE: StoryTemplate = {
  id: 'romance',
  name: 'Ngôn Tình / Ngọt Sủng',
  originalName: '青春甜宠 + CEO giàu có',
  coreSellingPoint: 'Tương tác tình cảm dẫn dắt cốt truyện, rung động + ngược luyến + HE.',
  tags: ['romance', 'sweet', 'modern', 'love'],

  subGenres: [
    { name: 'Ngọt sủng lưu', description: 'Ngọt ngào từ đầu đến cuối, rắc đường liên tục.', coreAppeal: 'Rung động, tim đập, cười không ngừng.' },
    { name: 'Ngược luyến lưu', description: 'Hiểu lầm, chia ly, day dứt rồi đoàn tụ.', coreAppeal: 'Đau lòng → xót xa → kỳ vọng → HE.' },
    { name: 'Hào môn tổng tài lưu', description: 'Tổng tài bá đạo yêu một người bình thường.', coreAppeal: 'Chênh lệch giai cấp, sủng ái vô tận.' },
    { name: 'Thanh mai trúc mã lưu', description: 'Cùng lớn lên, tình cảm chuyển từ bạn sang yêu.', coreAppeal: 'Ấm áp, tự nhiên, quen thuộc.' },
    { name: 'Cưới trước yêu sau lưu', description: 'Hôn nhân sắp đặt, dần phát hiện tình cảm.', coreAppeal: 'Chuyển biến tâm lý tinh tế.' },
  ],

  worldRules: [
    { name: 'Tuyến tình cảm là huyết mạch', description: 'Gián đoạn tuyến tình cảm = gián đoạn mạch truyện. Mọi sự kiện phải phục vụ hoặc liên quan đến quan hệ CP chính.' },
    { name: 'Tiến triển phải có nhịp', description: 'Từ lạ → quen → hiểu lầm → rung động → thú nhận → xung đột → HE. Không nhảy cóc.' },
  ],

  coolPatterns: [
    { name: 'Khoảnh khắc rung động', scenario: 'Cử chỉ nhỏ nhưng đầy ý nghĩa.', appeal: 'Tim đập nhanh, hồi hộp.' },
    { name: 'Sủng ái vô điều kiện', scenario: 'Nam chính bảo vệ/chăm sóc nữ chính.', appeal: 'An toàn, được yêu thương.' },
    { name: 'Hiểu lầm được hóa giải', scenario: 'Sau bao sóng gió, hiểu lầm tan vỡ.', appeal: 'Xúc động, khoái trá, nhẹ nhõm.' },
    { name: 'Ghen tuông', scenario: 'Một bên ghen khi thấy đối phương với người khác.', appeal: 'Hài hước + ngọt ngào.' },
  ],

  conflictPatterns: [
    { type: 'Hiểu lầm', source: 'Giao tiếp sai lệch', resolution: 'Hội thoại chân thành' },
    { type: 'Gia đình phản đối', source: 'Chênh lệch giai cấp', resolution: 'Chứng minh bằng hành động' },
    { type: 'Tình địch', source: 'Người thứ ba', resolution: 'Lòng tin + lựa chọn rõ ràng' },
    { type: 'Sự nghiệp vs tình yêu', source: 'Áp lực công việc', resolution: 'Cân bằng + hy sinh' },
  ],

  outlineArcs: [
    { title: 'Quyển 1: Gặp Gỡ', chapterRange: '1-30', percentageOfTotal: 20, coreFocus: 'Hai nhân vật gặp nhau, ấn tượng đầu.', coreConflict: 'Hiểu lầm ban đầu.', climax: 'Khoảnh khắc rung động đầu tiên.' },
    { title: 'Quyển 2: Tiến Triển', chapterRange: '31-80', percentageOfTotal: 30, coreFocus: 'Quen biết → quý mến → rung động.', coreConflict: 'Tình địch / gia đình.', climax: 'Thú nhận tình cảm / nụ hôn đầu.' },
    { title: 'Quyển 3: Sóng Gió', chapterRange: '81-120', percentageOfTotal: 25, coreFocus: 'Xung đột lớn nhất trong quan hệ.', coreConflict: 'Chia ly / hiểu lầm sâu.', climax: 'Nhận ra giá trị của nhau.' },
    { title: 'Quyển 4: Hạnh Phúc', chapterRange: '121-150', percentageOfTotal: 25, coreFocus: 'Hàn gắn, cam kết, tương lai.', coreConflict: 'Giải quyết mâu thuẫn cuối.', climax: 'Happy Ending.' },
  ],

  targetWordCount: '600.000 chữ',
  targetChapterCount: 150,

  pitfalls: [
    { description: 'Gián đoạn tuyến tình cảm quá lâu bằng sự kiện phụ.', severity: 'critical' },
    { description: 'Hiểu lầm kéo dài vô lý khi chỉ cần 1 câu là giải quyết.', severity: 'warning' },
    { description: 'Nữ/nam chính quá thụ động, không có agency.', severity: 'warning' },
    { description: 'Tình địch xuất hiện quá nhiều, gây bực bội.', severity: 'warning' },
  ],

  bestPractices: [
    { description: 'Mỗi chương phải có ít nhất 1 khoảnh khắc tiến triển quan hệ.' },
    { description: 'Xung đột phải đến từ nội tại (tính cách, quá khứ) chứ không chỉ ngoại lực.' },
    { description: 'Cả hai nhân vật đều cần character arc riêng, không chỉ phục vụ romance.' },
  ],

  entityTags: [
    { type: 'nhan_vat', nameVi: 'Nhân vật', attributes: ['tính cách', 'quá khứ', 'mong muốn', 'nỗi sợ'] },
    { type: 'quan_he', nameVi: 'Quan hệ', attributes: ['giai đoạn', 'rào cản', 'kỷ niệm chung'] },
  ],

  languageRegister: {
    eraLabel: 'hiện đại / đô thị',
    narrationStyle: 'ngôi ba hoặc ngôi một hiện đại, tự nhiên, cảm xúc rõ, tránh làm màu cổ phong',
    hanVietDensity: 'light',
    hanVietGuidance: 'Ưu tiên tiếng Việt hiện đại tự nhiên; Hán Việt chỉ dùng khi có sắc thái trang trọng hoặc tên gọi đặc thù.',
    dictionGuidance: 'Xưng hô thay đổi theo mức thân mật, tuổi tác và quyền lực, nhưng không được nhảy ngôi vô cớ giữa cùng một lượt thoại.',
    preferredTerms: ['thành phố', 'văn phòng', 'trường học', 'điện thoại', 'tin nhắn'],
    avoidTerms: ['kinh thành', 'phủ đệ', 'điện hạ', 'nương nương'],
    preferredPronouns: ['tôi', 'anh', 'em', 'cô', 'cậu', 'chị'],
    forbiddenPronouns: ['trẫm', 'bổn cung', 'thiếp', 'chàng'],
    dialogueRules: [
      {
        context: 'đối thoại thân mật hiện đại',
        preferredPairs: ['anh - em', 'em - anh', 'tôi - anh'],
        forbiddenPairs: ['thiếp - chàng', 'ta - ngươi'],
        note: 'Cặp xưng hô phải bám sát quan hệ hiện tại, không cổ phong hóa vô lý.',
      },
      {
        context: 'cãi nhau hoặc xa cách',
        preferredPairs: ['tôi - anh', 'tôi - cô'],
        forbiddenPairs: ['anh - em nếu đang đối đầu gay gắt mà chưa có nền tình cảm phù hợp'],
        note: 'Khi cảm xúc rạn nứt, đại từ thường sẽ lạnh hơn và tăng khoảng cách.',
      },
    ],
  },

  constraintPacks: ['Pack R01', 'Pack U01'],

  characterArchetypes: [
    {
      role: 'Chính — Nam chính',
      narrativeFunction: 'Dẫn dắt tuyến tình cảm, tạo rung động và bảo vệ nữ chính',
      personalityHint: 'Lạnh ngoài ấm trong, hoặc ấm áp chiều chuộng, giỏi giang nhưng có điểm yếu',
      primaryArc: 'Quyển 1: Gặp Gỡ',
      suggestedCount: [1, 1],
    },
    {
      role: 'Chính — Nữ chính',
      narrativeFunction: 'Cần có agency riêng, không chỉ là đối tượng tình cảm',
      personalityHint: 'Độc lập, thông minh, có ước mơ riêng ngoài tình yêu',
      primaryArc: 'Quyển 1: Gặp Gỡ',
      suggestedCount: [1, 1],
    },
    {
      role: 'Đồng hành — Bạn thân nữ chính/nam chính',
      narrativeFunction: 'Tâm sự, thúc đẩy tiến triển tình cảm, comic relief',
      personalityHint: 'Hoạt bát, nhiều chuyện, thích se duyên, trung thành',
      suggestedCount: [1, 2],
    },
    {
      role: 'Đối thủ — Tình địch',
      narrativeFunction: 'Tạo ghen tuông, thử thách tình cảm CP, đẩy tension',
      personalityHint: 'Hấp dẫn bên ngoài, tốt bụng hoặc thâm hiểm tùy sub-genre',
      primaryArc: 'Quyển 2: Tiến Triển',
      suggestedCount: [1, 2],
    },
    {
      role: 'Gác cổng — Gia đình phản đối',
      narrativeFunction: 'Tạo rào cản ngoại lực, thử thách quyết tâm CP',
      personalityHint: 'Nghiêm khắc, có lý do riêng (bảo vệ con/gia đình)',
      primaryArc: 'Quyển 3: Sóng Gió',
      suggestedCount: [1, 2],
    },
    {
      role: 'Hài hước — Đồng nghiệp/bạn bè',
      narrativeFunction: 'Giảm căng thẳng, tạo tình huống hài hước, giúp đỡ CP',
      personalityHint: 'Lém lỉnh, nhiệt tình, đôi khi gây rắc rối vô ý',
      suggestedCount: [1, 2],
    },
    {
      role: 'Chất xúc tác — Người từ quá khứ',
      narrativeFunction: 'Kích hoạt xung đột hoặc hé lộ bí mật, thúc đẩy plot twist',
      personalityHint: 'Bí ẩn, liên quan đến quá khứ một trong hai CP',
      primaryArc: 'Quyển 3: Sóng Gió',
      suggestedCount: [1, 1],
    },
    {
      role: 'Nền sống động — Đồng nghiệp/hàng xóm',
      narrativeFunction: 'Tạo bầu không khí đời thường, phản ánh xã hội',
      personalityHint: 'Đa dạng tính cách, tạo tình huống đời thường sinh động',
      suggestedCount: [2, 4],
    },
  ],

  characterScaleHint: {
    per100Chapters: 4,
    minTotal: 8,
    maxTotal: 20,
  },
};
