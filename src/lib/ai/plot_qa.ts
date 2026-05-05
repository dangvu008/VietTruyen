import type { AiModel, Chapter, Character, OutlineBeat, Project } from '../../types/story';
import { callAiModelTracked } from './tracked_ai_client';
import { estimateTokens, quickTruncate, truncateToTokenLimit } from './token_estimator';
import { retrieveForPlotQa } from '../memory/hybrid_memory_query';
import { extractPackBodies } from '../memory/retrieval_pack_builder';
import { buildVietnameseTextSystem } from './prompt_standard';

const PLOT_KEYWORDS = [
  'cot truyen',
  'plot',
  'logline',
  'dien bien',
  'tom tat',
  'tong quan',
  'review',
  'chuong',
  'chapter',
  'arc',
  'beat',
  'dan y',
  'moi nhat',
  'gan nhat',
  'hien tai',
  'vua roi',
  'tiep theo',
  'phuc but',
  'mam moi',
  'foreshadow',
  'nhan vat',
  'phan dien',
  'ket thuc',
  'ket cuc',
  'xuat hien',
  'xay ra',
  'o dau',
  'khi nao',
  'vi sao',
  'ra sao',
  'the nao',
  'bao nhieu',
  'lan dau',
  'tu khi',
];

const QUESTION_WORDS = ['ai', 'gi', 'nao', 'dau', 'sao', 'tai sao', 'bao gio', 'khi nao', 'ra sao', 'the nao', '?'];
const STOP_WORDS = new Set([
  'la', 'gi', 'va', 'cua', 'cho', 'voi', 'mot', 'nhung', 'cac', 'nay', 'kia',
  'toi', 'ban', 'nguoi', 'duoc', 'khong', 'co', 'da', 'dang', 'se', 'o', 'tu',
  'den', 'di', 've', 'trong', 'tren', 'duoi', 'tai', 'sau', 'truoc', 'neu',
  'thi', 'hay', 'giup', 'choi', 'viet', 'truyen', 'cot', 'plot', 'chuong', 'chapter',
  'nhan', 'vat', 'dien', 'bien', 'tom', 'tat', 'tong', 'quan', 'hien', 'tai',
  'gan', 'nhat', 'moi', 'nhat', 'vua', 'roi', 'xay', 'ra', 'phuc', 'but', 'mam', 'moi',
]);

interface PlotQuestionParams {
  project: Project;
  question: string;
  model?: AiModel;
  apiKey?: string;
}

interface PlotAnswerResult {
  answer: string;
  source: 'local' | 'ai' | 'insufficient';
}

interface ChapterRecord {
  chapter: Chapter;
  chapterNumber: number;
  snippet: string;
  hasSummary: boolean;
  normalizedSearch: string;
}

interface CharacterMatch {
  character: Character;
  normalizedName: string;
}

const PLOT_QA_SYSTEM = buildVietnameseTextSystem(
  'Plot QA assistant',
  'Answer the writer’s plot question using only the supplied context',
  [
    'Use only facts present in the context.',
    'Keep the answer direct and concise.',
    'Reference chapter numbers like "Ch.X" when available.',
    'If evidence is insufficient, state what is missing.',
    'Do not invent events or canon.',
  ],
);

/**
 * Writing action verbs that indicate a creative/editing instruction, NOT a question.
 * When these appear, the text should not be routed to Plot Q&A.
 */
const WRITING_ACTION_EXCLUDES = [
  'viet tiep',
  'mo rong canh',
  'mo rong',
  'viet lai',
  'sang tac',
  'tiep tuc viet',
  'them chi tiet',
  'them cam xuc',
  'them hanh dong',
  'viet chuong',
  'viet noi dung',
  'giu dung giong van',
  'nhip ke tu nhien',
  'trau chuot',
  'chinh sua van phong',
];

export function isPlotQuestion(question: string, project?: Project): boolean {
  const normalized = normalizeText(question);
  if (!normalized) return false;

  // [Domain:PlotQA] STEP — Exclude creative writing instructions from question detection
  if (WRITING_ACTION_EXCLUDES.some((action) => normalized.includes(action))) {
    return false;
  }

  if (PLOT_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return true;
  }

  if (QUESTION_WORDS.some((keyword) => normalized.includes(keyword))) {
    const matchedCharacter = project?.characters.some((character) =>
      normalized.includes(normalizeText(character.name))
    );
    if (matchedCharacter) return true;
  }

  return false;
}

export async function answerPlotQuestion({
  project,
  question,
  model,
  apiKey,
}: PlotQuestionParams): Promise<PlotAnswerResult> {
  const normalizedQuestion = normalizeText(question);
  const prefersWholeStorySummary = isWholeStoryReviewQuestion(normalizedQuestion);
  const prefersChapterContinuityReview = isChapterContinuityReviewQuestion(normalizedQuestion);

  if (prefersWholeStorySummary || prefersChapterContinuityReview) {
    const localSummaryAnswer = prefersChapterContinuityReview
      ? buildChapterContinuityReview(project)
      : buildLocalPlotAnswer(project, question);
    if (localSummaryAnswer) {
      return { answer: localSummaryAnswer, source: 'local' };
    }
  }

  const localMemoryAnswer = await buildLocalMemoryPlotAnswer(project, question);
  if (localMemoryAnswer) {
    return { answer: localMemoryAnswer, source: 'local' };
  }

  const localAnswer = buildLocalPlotAnswer(project, question);
  if (localAnswer) {
    return { answer: localAnswer, source: 'local' };
  }

  if (!model || !apiKey) {
    return {
      answer: 'Tôi chưa đủ dữ liệu tóm tắt để trả lời chắc câu này ngay trong app. Hãy tóm tắt các chương liên quan hoặc cấu hình AI để tôi suy luận từ context nén.',
      source: 'insufficient',
    };
  }

  const context = buildPlotQaContext(project, question);
  const userPrompt = `CÂU HỎI:
${question}

NGỮ CẢNH NÉN:
${context.contextText}

YÊU CẦU:
- Trả lời trong 3-6 câu.
- Ưu tiên nêu đúng chương nếu context có.
- Nếu chưa đủ dữ liệu, nói rõ.`;

  const answer = await callAiModelTracked({
    provider: model.provider,
    modelId: model.modelId,
    modelName: model.name,
    baseUrl: model.baseUrl,
    systemPrompt: PLOT_QA_SYSTEM,
    userPrompt,
    taskType: 'answer_plot',
  });

  return {
    answer: context.usedFallbackExcerpt
      ? `${answer.trim()}\n\nLưu ý: một phần context được rút gọn từ nội dung chương vì chưa có tóm tắt riêng.`
      : answer.trim(),
    source: 'ai',
  };
}

async function buildLocalMemoryPlotAnswer(project: Project, question: string): Promise<string | null> {
  const result = await retrieveForPlotQa(project, question).catch(() => null);
  if (!result) return null;

  const hardCanon = extractPackBodies(result.canonPack, 2)
    .map((line) => line.replace(/^- /, '').trim())
    .filter(Boolean);
  const semanticContext = extractPackBodies(result.semanticPack, 2)
    .map((line) => line.replace(/^- /, '').trim())
    .filter(Boolean);
  const graphContext = result.graphPack
    .slice(0, 1)
    .flatMap((item) => [item.title, item.body])
    .map((line) => line.replace(/^\d+\.\s*/, '').replace(/^- /, '').trim())
    .filter(Boolean)
    .slice(0, 1);
  const warnings = extractPackBodies(result.riskPack, 1)
    .flatMap((line) => line.split('\n'))
    .map((line) => line.replace(/^Continuity:\s*/i, '').replace(/^Ngữ cảnh:\s*/i, '').trim())
    .filter(Boolean)
    .slice(0, 1);

  const hasStrongLocalSignal = hardCanon.length > 0 || semanticContext.length > 0;
  if (!hasStrongLocalSignal) {
    return null;
  }

  const parts: string[] = [];

  if (hardCanon.length > 0) {
    parts.push(`Theo dữ liệu local: ${hardCanon.join(' | ')}.`);
  }

  if (semanticContext.length > 0) {
    parts.push(`Dấu vết liên quan nhất: ${semanticContext.join(' | ')}.`);
  }

  if (graphContext.length > 0) {
    parts.push(`Cụm truyện liên quan: ${graphContext.join(' | ')}.`);
  }

  if (warnings.length > 0) {
    parts.push(`Lưu ý continuity: ${warnings.join(' | ')}.`);
  }

  return parts.join(' ');
}

function buildLocalPlotAnswer(project: Project, question: string): string | null {
  const chapters = buildChapterRecords(project);
  const normalizedQuestion = normalizeText(question);
  const mentionedCharacters = findMentionedCharacters(project.characters, normalizedQuestion);
  const chapterNumber = parseChapterNumber(normalizedQuestion, chapters.length);

  if (matchesAny(normalizedQuestion, ['co bao nhieu chuong', 'so chuong', 'tong so chuong'])) {
    const latest = chapters[chapters.length - 1];
    if (!latest) {
      return 'Dự án hiện chưa có chương nào.';
    }
    return `Dự án hiện có ${chapters.length} chương. Chương mới nhất là ${formatChapterLabel(latest)}.`;
  }

  if (chapterNumber != null) {
    const chapter = chapters[chapterNumber - 1];
    if (!chapter) {
      return `Tôi không tìm thấy Chương ${chapterNumber} trong dự án hiện tại.`;
    }

    if (matchesAny(normalizedQuestion, ['ten chuong', 'tieu de'])) {
      return `${formatChapterLabel(chapter)} có tiêu đề "${chapter.chapter.title || 'Không đặt tên'}".`;
    }

    if (matchesAny(normalizedQuestion, ['ai xuat hien', 'nhan vat nao', 'co ai'])) {
      const names = findCharacterNamesInChapter(chapter, project.characters);
      if (names.length > 0) {
        return `${formatChapterLabel(chapter)} có dấu vết rõ nhất của: ${names.join(', ')}.`;
      }
    }

    const note = chapter.hasSummary
      ? ''
      : ' Chương này chưa có tóm tắt riêng, nên thông tin đang được rút gọn từ nội dung gốc.';
    return `${formatChapterLabel(chapter)}: ${chapter.snippet}.${note}`;
  }

  if (matchesAny(normalizedQuestion, ['cot truyen chinh', 'truyen noi ve gi', 'logline', 'main plot'])) {
    if (project.mainPlot.trim()) {
      return `Cốt truyện chính: ${quickTruncate(project.mainPlot.trim(), 320)}`;
    }
    if (project.logline.trim()) {
      return `Tổng quan truyện: ${quickTruncate(project.logline.trim(), 260)}`;
    }
  }

  const roleAnswer = buildRoleAnswer(project.characters, normalizedQuestion);
  if (roleAnswer) {
    return roleAnswer;
  }

  if (mentionedCharacters.length > 0) {
    const character = mentionedCharacters[0].character;

    // [Domain:PlotQA] STEP — Detect compound question (e.g., "xuất hiện ở chương nào + kết cục ra sao")
    const asksAppearance = matchesAny(normalizedQuestion, ['chuong nao', 'xuat hien', 'o dau', 'bao nhieu']);
    const asksOutcome = matchesAny(normalizedQuestion, ['ket cuc', 'ket thuc', 'ra sao', 'the nao', 'hien tai']);
    const asksIdentity = matchesAny(normalizedQuestion, ['la ai', 'vai tro', 'tinh cach', 'giai doan', 'arc', 'nhan vat']);

    // Compound question: both appearance + outcome/identity
    if (asksAppearance && (asksOutcome || asksIdentity)) {
      const parts: string[] = [];
      const hits = findRelevantChapters(question, project).filter((item) =>
        item.normalizedSearch.includes(mentionedCharacters[0].normalizedName)
      );
      if (hits.length > 0) {
        parts.push(`${character.name} xuất hiện rõ nhất ở: ${hits
          .slice(0, 5)
          .map((item) => formatChapterLabel(item))
          .join(', ')}.`);
      }
      parts.push(`Vai trò: ${character.role || 'chưa rõ'}.`);
      if (character.traits) parts.push(`Đặc điểm: ${quickTruncate(character.traits, 140)}.`);
      if (character.currentStage) parts.push(`Trạng thái/kết cục hiện tại: ${quickTruncate(character.currentStage, 160)}.`);
      if (parts.length > 1) return parts.join(' ');
    }

    if (asksIdentity) {
      const traits = character.traits ? `Tính chất: ${quickTruncate(character.traits, 140)}.` : '';
      const stage = character.currentStage ? `Trạng thái hiện tại: ${quickTruncate(character.currentStage, 120)}.` : '';
      return `${character.name} giữ vai trò ${character.role || 'chưa rõ'}. ${traits} ${stage}`.trim();
    }

    if (asksAppearance) {
      const hits = findRelevantChapters(question, project).filter((item) =>
        item.normalizedSearch.includes(mentionedCharacters[0].normalizedName)
      );
      if (hits.length > 0) {
        return `${character.name} xuất hiện rõ nhất ở: ${hits
          .slice(0, 5)
          .map((item) => formatChapterLabel(item))
          .join(', ')}.`;
      }
    }

    if (asksOutcome) {
      const parts: string[] = [`${character.name}:`];
      if (character.currentStage) parts.push(`Trạng thái/kết cục: ${quickTruncate(character.currentStage, 180)}.`);
      if (character.traits) parts.push(`Đặc điểm: ${quickTruncate(character.traits, 120)}.`);
      const hits = findRelevantChapters(question, project).filter((item) =>
        item.normalizedSearch.includes(mentionedCharacters[0].normalizedName)
      );
      if (hits.length > 0) {
        const latestHit = hits[0];
        parts.push(`Diễn biến gần nhất ở ${formatChapterLabel(latestHit)}: ${latestHit.snippet}`);
      }
      if (parts.length > 1) return parts.join(' ');
    }

    if (matchesAny(normalizedQuestion, ['hien tai', 'gan nhat', 'moi nhat'])) {
      const hits = findRelevantChapters(question, project).filter((item) =>
        item.normalizedSearch.includes(mentionedCharacters[0].normalizedName)
      );
      if (hits.length > 0) {
        const latestHit = hits[0];
        return `Diễn biến gần nhất của ${character.name} nằm ở ${formatChapterLabel(latestHit)}: ${latestHit.snippet}`;
      }
    }
  }

  if (
    isWholeStoryReviewQuestion(normalizedQuestion)
    || matchesAny(normalizedQuestion, ['tom tat tu dau', 'tong quan tu dau', 'den hien tai', 'review cot truyen'])
  ) {
    const summary = buildStoryProgressSummary(project, chapters);
    if (summary) return summary;
  }

  if (matchesAny(normalizedQuestion, ['gan nhat', 'moi nhat', 'hien tai', 'vua roi'])) {
    const recent = chapters.slice(-3);
    if (recent.length > 0) {
      const recentText = recent
        .map((chapter) => `${formatChapterLabel(chapter)}: ${chapter.snippet}`)
        .join(' ');
      return `Mạch hiện tại đang đi qua các diễn biến gần đây sau: ${recentText}`;
    }
  }

  if (matchesAny(normalizedQuestion, ['phuc but', 'mam moi', 'foreshadow'])) {
    const active = (project.foreshadowings || []).filter((item) => !item.isResolved);
    if (active.length === 0) {
      return 'Hiện tại không có phục bút nào đang được đánh dấu là chưa giải quyết.';
    }
    return `Các mầm mối chưa giải quyết: ${active
      .slice(0, 5)
      .map((item) => quickTruncate(item.description, 100))
      .join(' | ')}`;
  }

  if (matchesAny(normalizedQuestion, ['dan y', 'beat', 'arc hien tai', 'nhip hien tai', 'tiep theo'])) {
    const outlineAnswer = buildOutlineAnswer(project.outline, chapters.length, normalizedQuestion);
    if (outlineAnswer) return outlineAnswer;
  }

  if (matchesAny(normalizedQuestion, ['chuong nao', 'o dau'])) {
    const hits = findRelevantChapters(question, project);
    if (hits.length > 0) {
      return `Những chương liên quan nhất tới câu hỏi này là: ${hits
        .slice(0, 4)
        .map((item) => `${formatChapterLabel(item)} (${item.snippet})`)
        .join(' | ')}`;
    }
  }

  return null;
}

function buildPlotQaContext(project: Project, question: string): {
  contextText: string;
  tokenEstimate: number;
  usedFallbackExcerpt: boolean;
} {
  const chapters = buildChapterRecords(project);
  const normalizedQuestion = normalizeText(question);
  const mentionedCharacters = findMentionedCharacters(project.characters, normalizedQuestion);
  const relevantChapters = findRelevantChapters(question, project).slice(0, 6);
  const sections: string[] = [];

  const storyBrief = [
    `Tiêu đề: ${project.title || 'Chưa đặt tên'}`,
    project.logline ? `Logline: ${quickTruncate(project.logline, 180)}` : '',
    project.mainPlot ? `Cốt truyện chính: ${quickTruncate(project.mainPlot, 260)}` : '',
    project.endgame ? `Đích đến dự kiến: ${quickTruncate(project.endgame, 160)}` : '',
  ].filter(Boolean);
  sections.push(`## HỒ SƠ TRUYỆN\n${storyBrief.join('\n')}`);

  const characterPool = mentionedCharacters.length > 0
    ? mentionedCharacters.map((item) => item.character)
    : project.characters.slice(0, 6);
  if (characterPool.length > 0) {
    sections.push(
      `## NHÂN VẬT LIÊN QUAN\n${characterPool
        .map((character) => {
          const parts = [`- ${character.name}: ${character.role || 'chưa rõ vai trò'}`];
          if (character.currentStage) parts.push(`; hiện tại ${quickTruncate(character.currentStage, 80)}`);
          if (character.traits) parts.push(`; đặc điểm ${quickTruncate(character.traits, 80)}`);
          return parts.join('');
        })
        .join('\n')}`
    );
  }

  const outlineAnswer = buildOutlineContext(project.outline, chapters.length);
  if (outlineAnswer) {
    sections.push(`## NHỊP TRUYỆN\n${outlineAnswer}`);
  }

  const activeForeshadowings = (project.foreshadowings || [])
    .filter((item) => !item.isResolved)
    .slice(0, 5);
  if (activeForeshadowings.length > 0) {
    sections.push(
      `## MẦM MỐI CHƯA GIẢI\n${activeForeshadowings
        .map((item) => `- ${quickTruncate(item.description, 100)}`)
        .join('\n')}`
    );
  }

  const chaptersForContext = relevantChapters.length > 0 ? relevantChapters : chapters.slice(-5);
  const chapterLines = chaptersForContext
    .map((chapter) => `${formatChapterLabel(chapter)}: ${chapter.snippet}`);
  if (chapterLines.length > 0) {
    sections.push(`## CÁC CHƯƠNG LIÊN QUAN\n${chapterLines.join('\n')}`);
  }

  const contextText = truncateToTokenLimit(sections.join('\n\n'), 1200);
  return {
    contextText,
    tokenEstimate: estimateTokens(contextText),
    usedFallbackExcerpt: chaptersForContext.some((chapter) => !chapter.hasSummary),
  };
}

function buildStoryProgressSummary(project: Project, chapters: ChapterRecord[]): string {
  const segments: string[] = [];

  if (project.mainPlot.trim()) {
    segments.push(`Tiền đề chính: ${quickTruncate(project.mainPlot.trim(), 220)}`);
  } else if (project.logline.trim()) {
    segments.push(`Tiền đề chính: ${quickTruncate(project.logline.trim(), 180)}`);
  }

  if (chapters.length === 0) {
    return segments.join(' ') || '';
  }

  if (chapters.length <= 6) {
    segments.push(
      chapters
        .map((chapter) => `${formatChapterLabel(chapter)}: ${chapter.snippet}`)
        .join(' ')
    );
    return segments.join(' ');
  }

  const milestones = [
    chapters[0],
    chapters[Math.floor(chapters.length / 2)],
    ...chapters.slice(-3),
  ].filter(Boolean);

  segments.push(
    milestones
      .map((chapter) => `${formatChapterLabel(chapter)}: ${chapter.snippet}`)
      .join(' ')
  );

  return segments.join(' ');
}

function buildChapterContinuityReview(project: Project): string | null {
  const chapters = buildChapterRecords(project);
  if (chapters.length === 0) {
    return 'Đánh giá liên kết chương: dự án hiện chưa có chương nào để đối chiếu.';
  }

  if (chapters.length === 1) {
    return `Đánh giá liên kết chương: mới có ${formatChapterLabel(chapters[0])}, chưa đủ dữ liệu để kiểm tra nối tiếp giữa các chương.`;
  }

  const chapterFlow = chapters
    .map((chapter) => `${formatChapterLabel(chapter)}: ${chapter.snippet}`)
    .join(' ');
  const transitions = chapters
    .slice(1)
    .map((chapter, index) => `${formatChapterLabel(chapters[index])} -> ${formatChapterLabel(chapter)}`)
    .join(' | ');
  const fallbackNote = chapters.some((chapter) => !chapter.hasSummary)
    ? ' Một số chương chưa có tóm tắt riêng, nên đánh giá này đang dựa thêm trên trích đoạn nội dung.'
    : '';

  return `Đánh giá liên kết chương: ${chapterFlow} Các cặp chuyển tiếp cần đối chiếu: ${transitions}.${fallbackNote}`;
}

function isWholeStoryReviewQuestion(normalizedQuestion: string): boolean {
  return matchesAny(normalizedQuestion, [
    'tom tat truyen',
    'tom tat cot truyen',
    'tom tat mach truyen',
    'review toan bo truyen',
    'review toan truyen',
    'review tong the truyen',
    'review truyen',
    'review cot truyen',
    'tong quan truyen',
    'tong quan cot truyen',
    'tong quan toan bo truyen',
    'tom tat toan bo truyen',
    'truyen den hien tai',
    'toan bo truyen den hien tai',
    'toan truyen den hien tai',
  ]);
}

function isChapterContinuityReviewQuestion(normalizedQuestion: string): boolean {
  const asksChapterScope = matchesAny(normalizedQuestion, ['giua cac chuong', 'cac chuong', 'lien chuong']);
  const asksContinuity = matchesAny(normalizedQuestion, [
    'lien ket',
    'tinh lien ket',
    'mach lien ket',
    'mach truyen',
    'mach logic',
    'noi tiep',
    'tiep noi',
    'continuity',
    'nhat quan',
  ]);
  const asksReview = matchesAny(normalizedQuestion, ['kiem tra', 'review', 'ra soat', 'danh gia', 'doi chieu']);

  return asksChapterScope && asksContinuity && asksReview;
}

function buildOutlineAnswer(outline: OutlineBeat[], writtenChapterCount: number, normalizedQuestion: string): string | null {
  if (outline.length === 0) return null;

  const currentIndex = Math.max(0, Math.min(writtenChapterCount - 1, outline.length - 1));
  const nextIndex = Math.min(writtenChapterCount, outline.length - 1);

  if (matchesAny(normalizedQuestion, ['tiep theo'])) {
    const nextBeat = outline[nextIndex];
    if (!nextBeat) return null;
    return `Nhịp tiếp theo dự kiến là "${nextBeat.title || `Beat ${nextIndex + 1}`}". Tóm tắt: ${quickTruncate(nextBeat.summary, 180)}`;
  }

  const currentBeat = outline[currentIndex];
  if (!currentBeat) return null;
  return `Nhịp hiện tại là "${currentBeat.title || `Beat ${currentIndex + 1}`}". Tóm tắt: ${quickTruncate(currentBeat.summary, 180)}`;
}

function buildOutlineContext(outline: OutlineBeat[], writtenChapterCount: number): string {
  if (outline.length === 0) return '';

  const currentIndex = Math.max(0, Math.min(writtenChapterCount - 1, outline.length - 1));
  const nextIndex = Math.min(writtenChapterCount, outline.length - 1);
  const lines: string[] = [];

  const currentBeat = outline[currentIndex];
  if (currentBeat) {
    lines.push(`Beat hiện tại: ${currentBeat.title || `Beat ${currentIndex + 1}`} - ${quickTruncate(currentBeat.summary, 140)}`);
  }

  const nextBeat = outline[nextIndex];
  if (nextBeat && nextIndex !== currentIndex) {
    lines.push(`Beat tiếp theo: ${nextBeat.title || `Beat ${nextIndex + 1}`} - ${quickTruncate(nextBeat.summary, 140)}`);
  }

  return lines.join('\n');
}

function findRelevantChapters(question: string, project: Project): ChapterRecord[] {
  const chapters = buildChapterRecords(project);
  const questionTokens = tokenize(question);
  const mentionedCharacters = findMentionedCharacters(project.characters, normalizeText(question));

  return chapters
    .map((chapter) => ({
      chapter,
      score: scoreChapter(chapter, questionTokens, mentionedCharacters),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.chapter.chapterNumber - a.chapter.chapterNumber)
    .map((item) => item.chapter);
}

function scoreChapter(
  chapter: ChapterRecord,
  questionTokens: string[],
  mentionedCharacters: CharacterMatch[],
): number {
  let score = 0;

  for (const token of questionTokens) {
    if (token.length < 2) continue;
    if (chapter.normalizedSearch.includes(token)) {
      score += chapter.normalizedSearch.includes(` ${token} `) ? 2 : 1;
    }
  }

  for (const match of mentionedCharacters) {
    if (chapter.normalizedSearch.includes(match.normalizedName)) {
      score += 4;
    }
  }

  return score;
}

function buildChapterRecords(project: Project): ChapterRecord[] {
  return sortChaptersChronologically(project.chapters).map((chapter, index) => {
    const hasSummary = Boolean(chapter.summary?.trim());
    const snippetSource = hasSummary ? chapter.summary!.trim() : buildContentExcerpt(chapter.content);
    return {
      chapter,
      chapterNumber: index + 1,
      snippet: quickTruncate(snippetSource || 'Chương này hiện chưa có nội dung.', 220),
      hasSummary,
      normalizedSearch: ` ${normalizeText([
        chapter.title,
        chapter.summary || '',
        buildContentExcerpt(chapter.content),
      ].join(' '))} `,
    };
  });
}

function sortChaptersChronologically(chapters: Chapter[]): Chapter[] {
  return chapters
    .map((chapter, index) => ({ chapter, index }))
    .sort((a, b) => {
      const aNumber = extractTitleChapterNumber(a.chapter.title);
      const bNumber = extractTitleChapterNumber(b.chapter.title);
      if (aNumber != null && bNumber != null && aNumber !== bNumber) {
        return aNumber - bNumber;
      }

      const aCreated = safeDate(a.chapter.createdAt);
      const bCreated = safeDate(b.chapter.createdAt);
      if (aCreated !== bCreated) {
        return aCreated - bCreated;
      }

      return b.index - a.index;
    })
    .map((item) => item.chapter);
}

function findMentionedCharacters(characters: Character[], normalizedQuestion: string): CharacterMatch[] {
  return characters
    .map((character) => ({
      character,
      normalizedName: normalizeText(character.name),
    }))
    .filter((item) => item.normalizedName && normalizedQuestion.includes(item.normalizedName));
}

function findCharacterNamesInChapter(chapter: ChapterRecord, characters: Character[]): string[] {
  return characters
    .filter((character) => chapter.normalizedSearch.includes(normalizeText(character.name)))
    .map((character) => character.name)
    .slice(0, 8);
}

function buildRoleAnswer(characters: Character[], normalizedQuestion: string): string | null {
  const roleMatchers: Array<{ keywords: string[]; label: string }> = [
    { keywords: ['phan dien'], label: 'phản diện' },
    { keywords: ['nhan vat chinh', 'main character'], label: 'nhân vật chính' },
    { keywords: ['nu chinh'], label: 'nữ chính' },
    { keywords: ['nam chinh'], label: 'nam chính' },
  ];

  for (const matcher of roleMatchers) {
    if (!matchesAny(normalizedQuestion, matcher.keywords)) continue;
    const hits = characters.filter((character) =>
      normalizeText(character.role).includes(normalizeText(matcher.label))
    );
    if (hits.length === 0) continue;
    return `${matcher.label[0].toUpperCase()}${matcher.label.slice(1)} hiện được gán cho: ${hits
      .slice(0, 4)
      .map((character) => character.name)
      .join(', ')}.`;
  }

  return null;
}

function parseChapterNumber(normalizedQuestion: string, maxChapter: number): number | null {
  const match = normalizedQuestion.match(/(?:chuong|chap|chapter|ch)\s*(\d{1,4})/);
  if (!match) return null;
  const chapterNumber = Number(match[1]);
  if (!Number.isFinite(chapterNumber) || chapterNumber < 1 || chapterNumber > maxChapter) {
    return null;
  }
  return chapterNumber;
}

function formatChapterLabel(record: ChapterRecord): string {
  return `Ch.${record.chapterNumber}${record.chapter.title ? ` "${record.chapter.title}"` : ''}`;
}

function buildContentExcerpt(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 240) return trimmed;
  return `${trimmed.slice(0, 120)} ... ${trimmed.slice(-100)}`;
}

function extractTitleChapterNumber(title: string): number | null {
  const normalizedTitle = normalizeText(title);
  const match = normalizedTitle.match(/(?:chuong|chap|chapter|ch)\s*(\d{1,4})/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function safeDate(value?: string): number {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}
