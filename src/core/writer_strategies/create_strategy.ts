import type { IWriterStrategy, WriterStrategyContext } from './index';
import type { WriterResponse, WriterGeneratedData } from '../writer_engine';
import { applyStyle } from '../style_engine';
import { buildWorld, buildCharacters, buildOutline, buildChapter } from '../mock_generators';
import { writerStrategyRegistry } from './index';

export const createStrategy: IWriterStrategy = {
  mode: 'create',
  execute(context: WriterStrategyContext): WriterResponse {
    const { request, style } = context;
    let output = '';
    let generated: WriterGeneratedData | undefined;

    const world = request.project.world?.geography ? request.project.world : buildWorld(request.prompt, style);
    const characters = request.project.characters?.length ? request.project.characters : buildCharacters(request.prompt, style);
    const outline = request.project.outline?.length ? request.project.outline : buildOutline(request.prompt, characters);
    const chapterContent = buildChapter(request.prompt, world, characters, outline);
    
    output = applyStyle(chapterContent, style, request.intensity);
    
    generated = {
      world,
      characters,
      outline,
      chapterTitle: outline[0]?.title || 'Chương 1',
      chapterContent: output,
    };

    return { output, generated };
  }
};

writerStrategyRegistry.register(createStrategy);
