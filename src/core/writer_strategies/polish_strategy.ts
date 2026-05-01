import type { IWriterStrategy, WriterStrategyContext } from './index';
import type { WriterResponse } from '../writer_engine';
import { polishText } from '../style_engine';
import { writerStrategyRegistry } from './index';

export const polishStrategy: IWriterStrategy = {
  mode: 'polish',
  execute(context: WriterStrategyContext): WriterResponse {
    const { request, style } = context;
    const base = request.sourceText || request.prompt;
    const output = polishText(base, style);
    return { output };
  }
};

writerStrategyRegistry.register(polishStrategy);
