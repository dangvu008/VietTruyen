import type { Character, OutlineBeat, WorldRules } from '../types/story';
import type { StylePreset } from '../data/style_presets';
import { createId } from './id';

export const buildWorld = (prompt: string, style: StylePreset): WorldRules => ({
  geography: prompt ? `Vùng đất xoay quanh "${prompt}"` : 'Lãnh địa trung tâm và ngoại vi biến động',
  magicSystem:
    style.id === 'sci-fi'
      ? 'Công nghệ lượng tử và giao thức trí tuệ nhân tạo'
      : style.id === 'tien-hiep' || style.id === 'tu-chan'
      ? 'Tu luyện linh khí theo tầng cảnh giới'
      : 'Năng lượng cổ xưa và bí thuật truyền đời',
  techLevel:
    style.id === 'sci-fi' || style.id === 'cyberpunk'
      ? 'Công nghệ cao, mạng lưới dữ liệu dày đặc'
      : style.id === 'steampunk'
      ? 'Cơ khí hơi nước và đồng thau'
      : 'Trung đại, pha lẫn thần bí',
  currency: 'Linh thạch / tín dụng / tiền đồng tùy vùng',
  factions: ['Liên minh trung tâm', 'Thế lực phản diện', 'Thế lực trung lập'],
  rules: 'Luật bất thành văn: ai nắm bí kíp sẽ nắm quyền định đoạt.',
});

export const buildCharacters = (prompt: string, style: StylePreset): Character[] => {
  const namePool = ['Lâm Tề', 'Hạ Vũ', 'An Nhiên', 'Tạ Phong', 'Bạch Vân', 'Kỳ Dạ', 'Minh Hà'];
  const roles = ['Nhân vật chính', 'Đối thủ', 'Đồng minh', 'Sư phụ', 'Bí ẩn'];
  return [0, 1, 2].map((index) => ({
    id: createId(),
    name: namePool[index] || `Nhân vật ${index + 1}`,
    role: roles[index] || 'Đồng hành',
    arc: prompt ? `Gắn với bí mật: ${prompt}` : 'Động cơ ẩn giấu dần lộ',
    currentStage: 'Khởi đầu',
    traits: style.tags.join(', '),
  }));
};

export const buildOutline = (prompt: string, characters: Character[]): OutlineBeat[] => {
  const main = characters[0]?.name || 'Nhân vật chính';
  const rival = characters[1]?.name || 'Đối thủ';
  const beats = [
    {
      title: 'Khởi đầu',
      summary: `${main} đối diện biến cố mở màn liên quan đến ${prompt || 'một bí mật'}.`,
    },
    {
      title: 'Xung đột',
      summary: `${rival} xuất hiện, tạo áp lực và lộ ra mục tiêu đối nghịch.`,
    },
    {
      title: 'Bước ngoặt',
      summary: `${main} nhận được manh mối hoặc trợ lực bất ngờ.`,
    },
    {
      title: 'Giằng co',
      summary: 'Quyết định khó khăn khiến đội ngũ chia rẽ hoặc tổn thất.',
    },
    {
      title: 'Cửa mới',
      summary: 'Một con đường khác mở ra, dẫn đến tuyến tiếp theo.',
    },
  ];
  return beats.map((beat) => ({
    id: createId(),
    title: beat.title,
    summary: beat.summary,
    focus: [main, rival].filter(Boolean).join(', '),
  }));
};

export const buildChapter = (prompt: string, world: WorldRules, characters: Character[], outline: OutlineBeat[]) => {
  const main = characters[0]?.name || 'Nhân vật chính';
  const rival = characters[1]?.name || 'Đối thủ';
  const beat = outline[0];
  const paragraphOne = `${world.geography} mở ra dưới bầu trời nặng màu. ${world.rules}`;
  const paragraphTwo = `${main} bước vào biến cố đầu tiên. ${beat ? beat.summary : 'Một dấu hiệu lạ xuất hiện.'}`;
  const paragraphThree = `${rival} để lộ ý đồ, buộc ${main} phải lựa chọn.`;
  const paragraphFour = `Trước khi cánh cửa khép lại, ${main} kịp nhặt lấy manh mối liên quan đến "${
    prompt || 'bí mật'
  }".`;
  return [paragraphOne, paragraphTwo, paragraphThree, paragraphFour].join('\n\n');
};
