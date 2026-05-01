import type { IWriterStrategy, WriterStrategyContext } from './index';
import type { WriterResponse } from '../writer_engine';
import { applyStyle } from '../style_engine';
import { writerStrategyRegistry } from './index';

export const rewriteStrategy: IWriterStrategy = {
  mode: 'rewrite',
  execute(context: WriterStrategyContext): WriterResponse {
    const { request, style } = context;
    const base = request.sourceText || request.prompt;
    const output = applyStyle(base, style, request.intensity);
    return { output };
  }
};

writerStrategyRegistry.register(rewriteStrategy);
