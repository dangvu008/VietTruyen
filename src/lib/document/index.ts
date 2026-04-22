/**
 * File: index.ts
 * Purpose: Barrel export for document parsing module
 * Layer: Application
 * Domain: Document
 */

export { parseDocument, isDocumentSupported, getAcceptString } from './document_parser';
export type { ParsedDocument, DocumentParserOptions } from './document_parser';
export { preprocessTextForLlmInput } from './llm_input_preprocessor';
export type {
  LlmInputPreprocessOptions,
  LlmInputPreprocessResult,
  LlmInputPreprocessStats,
} from './llm_input_preprocessor';
