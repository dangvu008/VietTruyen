import type { Project, Character, OutlineBeat, WorldRules } from '../types/story';
import { styleById, stylePresets, type StylePreset } from '../data/style_presets';
import { buildConsistencyReport, buildFixParagraph, selfReflect } from './reflection';
import { createId } from './id';

export type WriterMode = 'create' | 'rewrite' | 'continue' | 'polish';

export interface WriterRequest {
  mode: WriterMode;
  prompt: string;
  sourceText: string;
  notes: string;
  styleId: string;
  intensity: number;
  selfReflection: boolean;
  consistency: boolean;
  project: Project;
}

export interface WriterGeneratedData {
  world?: WorldRules;
  characters?: Character[];
  outline?: OutlineBeat[];
  chapterTitle?: string;
  chapterContent?: string;
}

export interface WriterResponse {
  output: string;
  report?: ReturnType<typeof selfReflect>['report'];
  consistencyReport?: ReturnType<typeof buildConsistencyReport>;
  generated?: WriterGeneratedData;
}

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const sentenceSplit = (text: string) =>
  text
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const sanitize = (text: string) => text.replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();

const deAi = (text: string) => {
  const replaced = text
    .replace(/\b(?:có lẽ|dường như|một cách nào đó)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/([.!?]){2,}/g, '$1');
  return sanitize(replaced);
};

const applyCadence = (sentences: string[], cadence: StylePreset['cadence']) => {
  if (cadence === 'short') {
    return sentences.flatMap((sentence) => {
      if (sentence.split(' ').length <= 16) return [sentence];
      return sentence.split(/,|;|:/).map((chunk) => chunk.trim()).filter(Boolean);
    });
  }
  if (cadence === 'long') {
    const merged: string[] = [];
    for (let i = 0; i < sentences.length; i += 2) {
      const combo = [sentences[i], sentences[i + 1]].filter(Boolean).join(', ');
      merged.push(combo);
    }
    return merged;
  }
  return sentences;
};

const injectLexicon = (sentences: string[], lexicon: string[], intensity: number) => {
  if (!lexicon.length) return sentences;
  const step = Math.max(1, Math.round(3 - intensity));
  return sentences.map((sentence, index) => {
    if (index % step !== 0) return sentence;
    const token = pick(lexicon);
    return sentence.endsWith('.') || sentence.endsWith('!') || sentence.endsWith('?')
      ? sentence.slice(0, -1) + `, ${token}.`
      : `${sentence}, ${token}.`;
  });
};

export const applyStyle = (text: string, style: StylePreset, intensity = 0.6) => {
  const base = deAi(text);
  const sentences = sentenceSplit(base);
  const cadenced = applyCadence(sentences, style.cadence);
  const lexed = injectLexicon(cadenced, style.lexicon, intensity);
  const withSignature = style.signature.length
    ? [style.signature[0], ...lexed].join('\n')
    : lexed.join(' ');
  return sanitize(withSignature.replace(/\n{2,}/g, '\n'));
};

const buildWorld = (prompt: string, style: StylePreset): WorldRules => ({
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

const buildCharacters = (prompt: string, style: StylePreset): Character[] => {
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

const buildOutline = (prompt: string, characters: Character[]): OutlineBeat[] => {
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

const buildChapter = (prompt: string, world: WorldRules, characters: Character[], outline: OutlineBeat[]) => {
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

const findNextBeat = (output: string, outline: OutlineBeat[]) => {
  const lower = output.toLowerCase();
  return outline.find((beat) => {
    const keywords = beat.summary
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length >= 4)
      .slice(0, 2);
    return !keywords.some((keyword) => lower.includes(keyword));
  });
};

const continueStory = (sourceText: string, outline: OutlineBeat[], characters: Character[]) => {
  const lastSentence = sentenceSplit(sourceText).slice(-1)[0] || 'Câu chuyện còn dang dở.';
  const nextBeat = findNextBeat(sourceText, outline);
  const focus = characters[0]?.name || 'Nhân vật chính';
  const rival = characters[1]?.name || 'đối thủ';
  const paragraphOne = `Từ dư âm của "${lastSentence}", ${focus} buộc phải bước tiếp.`;
  const paragraphTwo = nextBeat
    ? `Nhịp kế tiếp mở ra: ${nextBeat.summary}`
    : `${rival} bất ngờ thay đổi cuộc chơi, đẩy mọi thứ lên cao trào.`;
  const paragraphThree = `${focus} giữ vững quyết tâm, nhưng một chi tiết mới khiến toàn đội chao đảo.`;
  return [paragraphOne, paragraphTwo, paragraphThree].join('\n\n');
};

const polishText = (text: string, style: StylePreset) => {
  const trimmed = sanitize(text);
  const tightened = trimmed
    .replace(/\b(đã|đang)\s+\1\b/gi, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
  return applyStyle(tightened, style, 0.4);
};

export const runWriter = (request: WriterRequest): WriterResponse => {
  const style = styleById[request.styleId] ?? stylePresets[0];
  let output = '';
  let generated: WriterGeneratedData | undefined;

  if (request.mode === 'create') {
    const world = request.project.world.geography ? request.project.world : buildWorld(request.prompt, style);
    const characters = request.project.characters.length ? request.project.characters : buildCharacters(request.prompt, style);
    const outline = request.project.outline.length ? request.project.outline : buildOutline(request.prompt, characters);
    const chapterContent = buildChapter(request.prompt, world, characters, outline);
    output = applyStyle(chapterContent, style, request.intensity);
    generated = {
      world,
      characters,
      outline,
      chapterTitle: outline[0]?.title || 'Chương 1',
      chapterContent: output,
    };
  }

  if (request.mode === 'rewrite') {
    const base = request.sourceText || request.prompt;
    output = applyStyle(base, style, request.intensity);
  }

  if (request.mode === 'continue') {
    const base = request.sourceText || request.project.chapters[0]?.content || '';
    const continued = continueStory(base, request.project.outline, request.project.characters);
    output = applyStyle(continued, style, request.intensity);
  }

  if (request.mode === 'polish') {
    const base = request.sourceText || request.prompt;
    output = polishText(base, style);
  }

  let report: WriterResponse['report'];
  if (request.selfReflection) {
    const reflection = selfReflect(output, request.project.outline, request.project.characters, style);
    report = reflection.report;
    if (reflection.report.issues.length) {
      const fixParagraph = buildFixParagraph(reflection.fixes);
      if (fixParagraph) {
        output = applyStyle(`${output}\n\n${fixParagraph}`, style, request.intensity);
      }
    }
  }

  const consistencyReport = request.consistency
    ? buildConsistencyReport(output, request.project.characters, request.project.outline, request.project.world)
    : undefined;

  return { output, report, consistencyReport, generated };
};
