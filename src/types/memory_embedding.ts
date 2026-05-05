export type MemoryEmbeddingContentType =
  | 'scene'
  | 'chapter_summary'
  | 'canon_fact'
  | 'character_note'
  | 'world_note'
  | 'source_span'
  | 'adaptation_note'
  | 'motif_note'
  | 'retcon_note';

export interface MemoryEmbeddingRecord {
  id: string;
  projectId: string;
  chapterId?: string;
  sceneId?: string;
  sourceProjectId?: string;
  sourceReferenceId?: string;
  entityIds: string[];
  arcIds: string[];
  contentType: MemoryEmbeddingContentType;
  sourceText: string;
  sourceTextHash: string;
  provenanceType?: 'original' | 'adapted' | 'commentary';
  embedding: number[];
  chapterIndex: number;
  updatedAt: string;
}

export interface MemorySearchHit {
  record: MemoryEmbeddingRecord;
  score: number;
  vectorScore?: number;
  proximityScore?: number;
  rerankScore?: number;
  lexicalScore?: number;
  phraseScore?: number;
  entityScore?: number;
  contentTypeScore?: number;
}

export interface RetrievalPackItem {
  id: string;
  title: string;
  body: string;
  score: number;
  sourceType: string;
  nodeIds?: string[];
  chapterIndex?: number;
}

export interface HybridMemoryResult {
  canonPack: RetrievalPackItem[];
  statePack: RetrievalPackItem[];
  hookPack: RetrievalPackItem[];
  graphPack: RetrievalPackItem[];
  semanticPack: RetrievalPackItem[];
  riskPack: RetrievalPackItem[];
  provenancePack: RetrievalPackItem[];
  warnings: string[];
}
