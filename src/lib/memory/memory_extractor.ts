// Stable public entrypoint. The original implementation is retained as
// memory_extractor_legacy.ts for rollback/provenance; accepted writes use the
// fail-closed prepare -> validate -> atomic commit implementation.

export { extractChapterMemory } from './memory_extractor_legacy';
export type {
  ChapterExtractionResult,
  PostWritePipelineInput,
  PostWritePipelineResult,
} from './memory_extractor_legacy';
export {
  executePostWritePipeline,
  PostWritePrecommitHoldError,
} from './memory_extractor_safe';
