import type { GenreProfile } from '../types/genre_profile';

export const GENRE_PROFILES: Record<string, GenreProfile> = {
  shuangwen: {
    id: 'shuangwen',
    name: 'Truyện Sảng / Hệ Thống',
    description: 'Bàn tay vàng, nhịp độ nhanh, nâng cấp liên tục, vả mặt trang bức.',
    tags: ['shuangwen', 'system'],
    notes: [
      'Mật độ sảng điểm cao, độc giả kỳ vọng nhịp độ nhanh.',
      'Nên ưu tiên giữ lại các hook tạo kỳ vọng rõ ràng ở cuối chương (sắp đột phá/sắp vả mặt).',
      'Độ dung nhẫn với chương chuyển tiếp thấp, không nên dài quá 2 chương.',
    ],
    hookConfig: {
      preferredTypes: ['desire', 'crisis', 'emotion'],
      strengthBaseline: 'medium',
      chapterEndRequired: true,
      transitionAllowance: 2,
    },
    coolPointConfig: {
      preferredPatterns: ['flex_counter', 'underdog_reveal', 'underdog_victory', 'misunderstanding'],
      densityPerChapter: 'high',
      comboInterval: 5,
      milestoneInterval: 10,
    },
    microPayoffConfig: {
      preferredTypes: ['ability', 'resource', 'recognition'],
      minPerChapter: 2,
      transitionMin: 1,
    },
    pacingConfig: {
      stagnationThreshold: 3,
      strandQuestMax: 5,
      strandFireGapMax: 15,
      transitionMaxConsecutive: 2,
    },
    overrideConfig: {
      allowedRationaleTypes: ['TRANSITIONAL_SETUP', 'ARC_TIMING'],
      debtMultiplier: 1.0,
      paybackWindowDefault: 3,
    },
  },

  xianxia: {
    id: 'xianxia',
    name: 'Tu Tiên / Huyền Huyễn',
    description: 'Nghịch thiên cải mệnh, quy tắc tàn khốc, cơ duyên và chiến đấu song hành.',
    tags: ['xianxia', 'fantasy'],
    notes: [
      'Cần xây dựng thế giới quan sâu, cho phép nhiều chương trải đệm hơn.',
      'Đột phá cảnh giới là kỳ vọng cốt lõi, nên trực quan hóa.',
      'Hệ thống tài nguyên (linh thạch/đan dược/công pháp) là phương tiện vi hồi đáp chính.',
    ],
    hookConfig: {
      preferredTypes: ['crisis', 'desire', 'choice'],
      strengthBaseline: 'medium',
      chapterEndRequired: true,
      transitionAllowance: 3,
    },
    coolPointConfig: {
      preferredPatterns: ['underdog_victory', 'underdog_reveal', 'identity_reveal', 'villain_downfall'],
      densityPerChapter: 'high',
      comboInterval: 5,
      milestoneInterval: 15,
    },
    microPayoffConfig: {
      preferredTypes: ['ability', 'resource', 'information'],
      minPerChapter: 1,
      transitionMin: 1,
    },
    pacingConfig: {
      stagnationThreshold: 4,
      strandQuestMax: 6,
      strandFireGapMax: 12,
      transitionMaxConsecutive: 3,
    },
    overrideConfig: {
      allowedRationaleTypes: ['TRANSITIONAL_SETUP', 'WORLD_RULE_CONSTRAINT', 'ARC_TIMING'],
      debtMultiplier: 0.9,
      paybackWindowDefault: 5,
    },
  },

  romance: {
    id: 'romance',
    name: 'Ngôn Tình / Ngọt Sủng',
    description: 'Tương tác tình cảm, thúc đẩy quan hệ, đan xen rung động và ngược luyến.',
    tags: ['romance', 'sweet'],
    notes: [
      'Tuyến tình cảm là huyết mạch cốt lõi, độ dung nhẫn với việc gián đoạn cực thấp.',
      'Hook cảm xúc là vương bài (đau lòng/rung động/ghen tuông).',
      'Tiến triển mối quan hệ là vi hồi đáp quan trọng nhất.',
    ],
    hookConfig: {
      preferredTypes: ['emotion', 'desire', 'choice'],
      strengthBaseline: 'medium',
      chapterEndRequired: true,
      transitionAllowance: 2,
    },
    coolPointConfig: {
      preferredPatterns: ['sweet_surprise', 'identity_reveal', 'misunderstanding'],
      densityPerChapter: 'medium',
      comboInterval: 6,
      milestoneInterval: 12,
    },
    microPayoffConfig: {
      preferredTypes: ['relationship', 'emotion', 'recognition'],
      minPerChapter: 1,
      transitionMin: 1,
    },
    pacingConfig: {
      stagnationThreshold: 4,
      strandQuestMax: 4,
      strandFireGapMax: 5,
      transitionMaxConsecutive: 2,
    },
    overrideConfig: {
      allowedRationaleTypes: ['TRANSITIONAL_SETUP', 'CHARACTER_CREDIBILITY', 'ARC_TIMING'],
      debtMultiplier: 1.0,
      paybackWindowDefault: 4,
    },
  },

  mystery: {
    id: 'mystery',
    name: 'Huyền Nghi / Trinh Thám',
    description: 'Giải đố dẫn dắt, suy luận logic, chân tướng từng bước lộ diện.',
    tags: ['mystery', 'detective'],
    notes: [
      'Tính trọn vẹn của logic ưu tiên hơn mật độ sảng điểm.',
      'Phát hiện thông tin mới là vi hồi đáp cốt lõi.',
    ],
    hookConfig: {
      preferredTypes: ['mystery', 'crisis', 'choice'],
      strengthBaseline: 'medium',
      chapterEndRequired: true,
      transitionAllowance: 2,
    },
    coolPointConfig: {
      preferredPatterns: ['villain_downfall', 'identity_reveal'],
      densityPerChapter: 'low',
      comboInterval: 10,
      milestoneInterval: 20,
    },
    microPayoffConfig: {
      preferredTypes: ['information', 'clue'],
      minPerChapter: 1,
      transitionMin: 1,
    },
    pacingConfig: {
      stagnationThreshold: 3,
      strandQuestMax: 8,
      strandFireGapMax: 20,
      transitionMaxConsecutive: 2,
    },
    overrideConfig: {
      allowedRationaleTypes: ['LOGIC_INTEGRITY', 'TRANSITIONAL_SETUP', 'ARC_TIMING'],
      debtMultiplier: 0.8,
      paybackWindowDefault: 5,
    },
  },

  'rules-mystery': {
    id: 'rules-mystery',
    name: 'Quái Đàm Quy Tắc',
    description: 'Quy tắc quỷ dị, suy luận sinh tồn, lật ngược thế cờ.',
    tags: ['rules-mystery', 'horror'],
    notes: [
      'Bầu không khí căng thẳng yêu cầu cường độ hook cao.',
      'Độ dung nhẫn với chương chuyển tiếp rỗng cực kỳ thấp.',
    ],
    hookConfig: {
      preferredTypes: ['crisis', 'mystery', 'choice'],
      strengthBaseline: 'strong',
      chapterEndRequired: true,
      transitionAllowance: 1,
    },
    coolPointConfig: {
      preferredPatterns: ['underdog_victory', 'villain_downfall'],
      densityPerChapter: 'medium',
      comboInterval: 5,
      milestoneInterval: 8,
    },
    microPayoffConfig: {
      preferredTypes: ['information', 'clue', 'ability'],
      minPerChapter: 1,
      transitionMin: 1,
    },
    pacingConfig: {
      stagnationThreshold: 2,
      strandQuestMax: 4,
      strandFireGapMax: 15,
      transitionMaxConsecutive: 1,
    },
    overrideConfig: {
      allowedRationaleTypes: ['LOGIC_INTEGRITY', 'WORLD_RULE_CONSTRAINT'],
      debtMultiplier: 1.2,
      paybackWindowDefault: 2,
    },
  },

  'urban-power': {
    id: 'urban-power',
    name: 'Đô Thị Dị Năng',
    description: 'Bối cảnh hiện đại, siêu năng lực ẩn giấu, giả heo ăn hổ.',
    tags: ['urban', 'power'],
    notes: [
      'Các tình huống giả heo ăn hổ là trọng tâm sảng điểm.',
      'Sự thăng tiến địa vị xã hội là vi hồi đáp quan trọng.',
    ],
    hookConfig: {
      preferredTypes: ['crisis', 'desire', 'emotion'],
      strengthBaseline: 'medium',
      chapterEndRequired: true,
      transitionAllowance: 2,
    },
    coolPointConfig: {
      preferredPatterns: ['underdog_reveal', 'flex_counter', 'identity_reveal', 'misunderstanding'],
      densityPerChapter: 'high',
      comboInterval: 3,
      milestoneInterval: 10,
    },
    microPayoffConfig: {
      preferredTypes: ['recognition', 'ability', 'relationship'],
      minPerChapter: 2,
      transitionMin: 1,
    },
    pacingConfig: {
      stagnationThreshold: 3,
      strandQuestMax: 5,
      strandFireGapMax: 8,
      transitionMaxConsecutive: 2,
    },
    overrideConfig: {
      allowedRationaleTypes: ['TRANSITIONAL_SETUP', 'ARC_TIMING'],
      debtMultiplier: 1.0,
      paybackWindowDefault: 3,
    },
  },

  'zhihu-short': {
    id: 'zhihu-short',
    name: 'Truyện Ngắn / Đảo Ngược',
    description: 'Ngắn gọn súc tích, phản chuyển gắt, xung kích cảm xúc mạnh.',
    tags: ['short', 'plot-twist'],
    notes: [
      'Cửa sổ chuyển tiếp cực hẹp, yêu cầu mỗi chương đều có tiến triển hoặc cao trào.',
      'Cường độ hook phải cực mạnh.',
    ],
    hookConfig: {
      preferredTypes: ['emotion', 'mystery', 'choice'],
      strengthBaseline: 'strong',
      chapterEndRequired: true,
      transitionAllowance: 0,
    },
    coolPointConfig: {
      preferredPatterns: ['villain_downfall', 'identity_reveal', 'sweet_surprise'],
      densityPerChapter: 'high',
      comboInterval: 2,
      milestoneInterval: 3,
    },
    microPayoffConfig: {
      preferredTypes: ['emotion', 'information', 'relationship'],
      minPerChapter: 2,
      transitionMin: 2,
    },
    pacingConfig: {
      stagnationThreshold: 1,
      strandQuestMax: 2,
      strandFireGapMax: 3,
      transitionMaxConsecutive: 0,
    },
    overrideConfig: {
      allowedRationaleTypes: [],
      debtMultiplier: 2.0,
      paybackWindowDefault: 1,
    },
  },

  substitute: {
    id: 'substitute',
    name: 'Thế Thân / Ngược Văn',
    description: 'Vướng mắc tình cảm, hiểu lầm và lật ngược, truy thê hỏa táng tràng.',
    tags: ['substitute', 'angst'],
    notes: [
      'Hook cảm xúc (ngược tâm -> xót xa -> kỳ vọng) là lõi.',
      'Lộ thân phận/sự thật là vương bài.',
    ],
    hookConfig: {
      preferredTypes: ['emotion', 'choice', 'mystery'],
      strengthBaseline: 'strong',
      chapterEndRequired: true,
      transitionAllowance: 2,
    },
    coolPointConfig: {
      preferredPatterns: ['identity_reveal', 'villain_downfall', 'sweet_surprise'],
      densityPerChapter: 'medium',
      comboInterval: 5,
      milestoneInterval: 10,
    },
    microPayoffConfig: {
      preferredTypes: ['emotion', 'relationship', 'recognition'],
      minPerChapter: 1,
      transitionMin: 1,
    },
    pacingConfig: {
      stagnationThreshold: 3,
      strandQuestMax: 3,
      strandFireGapMax: 4,
      transitionMaxConsecutive: 2,
    },
    overrideConfig: {
      allowedRationaleTypes: ['CHARACTER_CREDIBILITY', 'ARC_TIMING', 'TRANSITIONAL_SETUP'],
      debtMultiplier: 1.0,
      paybackWindowDefault: 4,
    },
  },

  esports: {
    id: 'esports',
    name: 'Thể Thao Điện Tử / Võng Du',
    description: 'Cạnh tranh võ đài, ma sát đồng đội, lật kèo nghịch phong.',
    tags: ['esports', 'competition'],
    notes: [
      'Chương thi đấu cần có mục tiêu thắng bại/quyết định cụ thể.',
      'Phần nghịch phong lật kèo mang lại sảng điểm cốt lõi.',
    ],
    hookConfig: {
      preferredTypes: ['crisis', 'choice', 'desire'],
      strengthBaseline: 'strong',
      chapterEndRequired: true,
      transitionAllowance: 1,
    },
    coolPointConfig: {
      preferredPatterns: ['underdog_victory', 'villain_downfall', 'misunderstanding'],
      densityPerChapter: 'high',
      comboInterval: 4,
      milestoneInterval: 8,
    },
    microPayoffConfig: {
      preferredTypes: ['information', 'recognition', 'relationship'],
      minPerChapter: 2,
      transitionMin: 1,
    },
    pacingConfig: {
      stagnationThreshold: 2,
      strandQuestMax: 4,
      strandFireGapMax: 8,
      transitionMaxConsecutive: 1,
    },
    overrideConfig: {
      allowedRationaleTypes: ['TRANSITIONAL_SETUP', 'ARC_TIMING', 'LOGIC_INTEGRITY'],
      debtMultiplier: 1.1,
      paybackWindowDefault: 2,
    },
  },

  livestream: {
    id: 'livestream',
    name: 'Livestream / Trực Tiếp',
    description: 'Tranh đoạt lưu lượng, phản hồi thời gian thực, dư luận & thương mại.',
    tags: ['livestream', 'urban'],
    notes: [
      'Tạo vòng lặp: Phản hồi bên ngoài -> Biểu hiện nhân vật -> Kết quả thay đổi.',
      'Sự thay đổi số liệu/trend là vi hồi đáp cường độ cao.',
    ],
    hookConfig: {
      preferredTypes: ['crisis', 'emotion', 'choice'],
      strengthBaseline: 'strong',
      chapterEndRequired: true,
      transitionAllowance: 1,
    },
    coolPointConfig: {
      preferredPatterns: ['flex_counter', 'villain_downfall', 'identity_reveal'],
      densityPerChapter: 'high',
      comboInterval: 3,
      milestoneInterval: 6,
    },
    microPayoffConfig: {
      preferredTypes: ['recognition', 'resource', 'information'],
      minPerChapter: 2,
      transitionMin: 1,
    },
    pacingConfig: {
      stagnationThreshold: 2,
      strandQuestMax: 4,
      strandFireGapMax: 6,
      transitionMaxConsecutive: 1,
    },
    overrideConfig: {
      allowedRationaleTypes: ['TRANSITIONAL_SETUP', 'ARC_TIMING', 'CHARACTER_CREDIBILITY'],
      debtMultiplier: 1.1,
      paybackWindowDefault: 2,
    },
  },

  'cosmic-horror': {
    id: 'cosmic-horror',
    name: 'Cthulhu / Vũ Trụ Lưu',
    description: 'Sự tha hóa quy tắc và lý trí sụp đổ, biết càng nhiều trả giá càng cao.',
    tags: ['horror', 'mystery', 'cosmic'],
    notes: [
      'Nỗi sợ hãi tới từ quy tắc và cái giá phải trả, chứ không đơn thuần là mô tả đáng sợ.',
      'Mỗi khám phá chân tướng nên đánh đổi bằng tổn thất (lý trí/phiền toái).',
    ],
    hookConfig: {
      preferredTypes: ['mystery', 'crisis', 'choice'],
      strengthBaseline: 'strong',
      chapterEndRequired: true,
      transitionAllowance: 1,
    },
    coolPointConfig: {
      preferredPatterns: ['villain_downfall', 'misunderstanding', 'underdog_victory'],
      densityPerChapter: 'medium',
      comboInterval: 6,
      milestoneInterval: 10,
    },
    microPayoffConfig: {
      preferredTypes: ['clue', 'information', 'emotion'],
      minPerChapter: 1,
      transitionMin: 1,
    },
    pacingConfig: {
      stagnationThreshold: 2,
      strandQuestMax: 4,
      strandFireGapMax: 12,
      transitionMaxConsecutive: 1,
    },
    overrideConfig: {
      allowedRationaleTypes: ['LOGIC_INTEGRITY', 'WORLD_RULE_CONSTRAINT', 'ARC_TIMING'],
      debtMultiplier: 1.3,
      paybackWindowDefault: 2,
    },
  },

  'history-travel': {
    id: 'history-travel',
    name: 'Xuyên Không Lịch Sử',
    description: 'Giang sơn tranh bá, khoa kỹ nghiền ép, xoay chuyển càn khôn bằng tri thức.',
    tags: ['history', 'travel', 'knowledge'],
    notes: [
      'Ưu thế tri thức > Vũ lực, thiết lập thế trận thay vì dùng sức.',
      'Phần lớn sảng điểm đến từ sự chênh lệch thời đại (giáng chiều đả kích).',
    ],
    hookConfig: {
      preferredTypes: ['choice', 'crisis', 'desire'],
      strengthBaseline: 'medium',
      chapterEndRequired: true,
      transitionAllowance: 2,
    },
    coolPointConfig: {
      preferredPatterns: ['authority_challenge', 'underdog_reveal', 'villain_downfall', 'identity_reveal'],
      densityPerChapter: 'medium',
      comboInterval: 3,
      milestoneInterval: 10,
    },
    microPayoffConfig: {
      preferredTypes: ['information', 'resource', 'recognition'],
      minPerChapter: 1,
      transitionMin: 1,
    },
    pacingConfig: {
      stagnationThreshold: 3,
      strandQuestMax: 5,
      strandFireGapMax: 10,
      transitionMaxConsecutive: 2,
    },
    overrideConfig: {
      allowedRationaleTypes: ['WORLD_RULE_CONSTRAINT', 'CHARACTER_CREDIBILITY', 'ARC_TIMING'],
      debtMultiplier: 0.9,
      paybackWindowDefault: 4,
    },
  },

  'game-lit': {
    id: 'game-lit',
    name: 'Trò Chơi / Hệ Thống Mạt Thế',
    description: 'Thế giới số hóa bản, đánh quái thăng cấp, cướp đoạt tài nguyên cực độ.',
    tags: ['game', 'system', 'apocalypse'],
    notes: [
      'Cường điệu hóa sự thay đổi số hạng và sức mạnh số',
      'Động lực cày cuốc nâng cấp luôn luôn hiện hữu, ranh giới tử sinh cao.',
    ],
    hookConfig: {
      preferredTypes: ['crisis', 'desire', 'choice'],
      strengthBaseline: 'strong',
      chapterEndRequired: true,
      transitionAllowance: 0,
    },
    coolPointConfig: {
      preferredPatterns: ['underdog_victory', 'flex_counter', 'underdog_reveal', 'villain_downfall'],
      densityPerChapter: 'high',
      comboInterval: 3,
      milestoneInterval: 10,
    },
    microPayoffConfig: {
      preferredTypes: ['ability', 'resource', 'recognition'],
      minPerChapter: 2,
      transitionMin: 1,
    },
    pacingConfig: {
      stagnationThreshold: 2,
      strandQuestMax: 5,
      strandFireGapMax: 15,
      transitionMaxConsecutive: 0,
    },
    overrideConfig: {
      allowedRationaleTypes: ['WORLD_RULE_CONSTRAINT', 'ARC_TIMING'],
      debtMultiplier: 1.1,
      paybackWindowDefault: 2,
    },
  },
  'vietnamese-horror': {
    id: 'vietnamese-horror',
    name: 'Truyện Ma Việt Nam',
    description: 'Linh dị dân gian, bùa ngải, tâm linh, luật nhân quả báo ứng mang đậm chất văn hóa Việt.',
    tags: ['horror', 'folk', 'vietnam'],
    notes: [
      'Bầu không khí u ám, ngột ngạt và mang tính chất tâm linh nông thôn hoặc đô thị Việt.',
      'Chú trọng vào luật nhân quả, "oan có đầu nợ có chủ" hơn là các yếu tố hù dọa đơn giản.',
      'Quá trình điều tra và hóa giải ân oán là trung tâm của sự phát triển cốt truyện.'
    ],
    hookConfig: {
      preferredTypes: ['mystery', 'crisis', 'emotion'],
      strengthBaseline: 'strong',
      chapterEndRequired: true,
      transitionAllowance: 1,
    },
    coolPointConfig: {
      preferredPatterns: ['villain_downfall', 'identity_reveal', 'underdog_victory'],
      densityPerChapter: 'low',
      comboInterval: 5,
      milestoneInterval: 12,
    },
    microPayoffConfig: {
      preferredTypes: ['clue', 'information', 'emotion'],
      minPerChapter: 1,
      transitionMin: 1,
    },
    pacingConfig: {
      stagnationThreshold: 3,
      strandQuestMax: 4,
      strandFireGapMax: 10,
      transitionMaxConsecutive: 1,
    },
    overrideConfig: {
      allowedRationaleTypes: ['LOGIC_INTEGRITY', 'WORLD_RULE_CONSTRAINT', 'CHARACTER_CREDIBILITY'],
      debtMultiplier: 1.2,
      paybackWindowDefault: 3,
    },
  },

  'viet-historical-fantasy': {
    id: 'viet-historical-fantasy',
    name: 'Huyền Sử Việt Nam',
    description: 'Lịch sử và dã sử Việt Nam kết hợp yếu tố thần thoại, cổ tích, tiên hiệp hoặc dị năng.',
    tags: ['history', 'fantasy', 'vietnam'],
    notes: [
      'Hòa trộn giữa sự kiện lịch sử (hoặc dã sử) có thật và các yếu tố giả tưởng, tâm linh, kỳ ảo bản địa.',
      'Câu chuyện thường gắn liền với vận nước, bảo vệ non sông, hào khí Đông A hoặc các cuộc khởi nghĩa.',
      'Sự thăng tiến sức mạnh đi kèm với trách nhiệm cứu nước, cứu dân hoặc giải mã truyền thuyết.'
    ],
    hookConfig: {
      preferredTypes: ['crisis', 'choice', 'desire'],
      strengthBaseline: 'medium',
      chapterEndRequired: true,
      transitionAllowance: 2,
    },
    coolPointConfig: {
      preferredPatterns: ['underdog_victory', 'authority_challenge', 'identity_reveal'],
      densityPerChapter: 'medium',
      comboInterval: 4,
      milestoneInterval: 10,
    },
    microPayoffConfig: {
      preferredTypes: ['recognition', 'ability', 'resource'],
      minPerChapter: 1,
      transitionMin: 1,
    },
    pacingConfig: {
      stagnationThreshold: 3,
      strandQuestMax: 5,
      strandFireGapMax: 10,
      transitionMaxConsecutive: 2,
    },
    overrideConfig: {
      allowedRationaleTypes: ['WORLD_RULE_CONSTRAINT', 'ARC_TIMING', 'LOGIC_INTEGRITY'],
      debtMultiplier: 1.0,
      paybackWindowDefault: 4,
    },
  },
};
