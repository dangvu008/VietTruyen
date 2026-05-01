import type { WriterRequest, WriterResponse, WriterMode } from '../writer_engine';
import type { StylePreset } from '../../data/style_presets';

export interface WriterStrategyContext {
  request: WriterRequest;
  style: StylePreset;
}

export interface IWriterStrategy {
  mode: WriterMode;
  execute(context: WriterStrategyContext): WriterResponse;
}

class StrategyRegistry {
  private strategies = new Map<WriterMode, IWriterStrategy>();

  register(strategy: IWriterStrategy) {
    this.strategies.set(strategy.mode, strategy);
  }

  getStrategy(mode: WriterMode): IWriterStrategy | undefined {
    return this.strategies.get(mode);
  }
}

export const writerStrategyRegistry = new StrategyRegistry();
