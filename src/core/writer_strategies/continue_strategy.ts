import type { IWriterStrategy, WriterStrategyContext } from './index';
import type { WriterResponse } from '../writer_engine';
import { applyStyle, sentenceSplit } from '../style_engine';
import type { OutlineBeat, Character } from '../../types/story';
import { writerStrategyRegistry } from './index';

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

export const continueStrategy: IWriterStrategy = {
  mode: 'continue',
  execute(context: WriterStrategyContext): WriterResponse {
    const { request, style } = context;
    const base = request.sourceText || request.project.chapters[0]?.content || '';
    const continued = continueStory(base, request.project.outline, request.project.characters);
    const output = applyStyle(continued, style, request.intensity);
    return { output };
  }
};

writerStrategyRegistry.register(continueStrategy);
