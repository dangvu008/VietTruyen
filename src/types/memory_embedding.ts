export type MemoryEmbeddingContentType =
  | 'scene'
  | 'chapter_summary'
  | 'canon_fact'
  | 'character_note'
  | 'world_note';

export interface MemoryEmbeddingRecord {
  id: string;
  projectId: string;
  chapterId?: string;
  sceneId?: string;
  entityIds: string[];
  arcIds: string[];
  contentType: MemoryEmbeddingContentType;
  sourceText: string;
  sourceTextHash: string;
  embedding: number[];
  chapterIndex: number;
  updatedAt: string;
}

export interface MemorySearchHit {
  record: MemoryEmbeddingRecord;
  score: number;
}

export interface HybridMemoryResult {
  hardCanon: string[];
  graphContext: string[];
  semanticContext: string[];
  warnings: string[];
}
