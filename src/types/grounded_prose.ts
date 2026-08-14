export const GROUNDED_PROSE_CAUSALITY_SCHEMA = 'grounded-prose/causality-skeleton/v1' as const;
export const GROUNDED_PROSE_COLD_READER_SCHEMA = 'grounded-prose/blind-cold-reader/v1' as const;
export const GROUNDED_PROSE_LINE_AUDIT_SCHEMA = 'grounded-prose/line-audit/v1' as const;
export const GROUNDED_PROSE_GATE_SCHEMA = 'grounded-prose/runtime-gate/v1' as const;

export type GroundedProseSeverity = 'low' | 'medium' | 'high';

export type GroundedProseFindingCategory =
  | 'confusion'
  | 'author_intrusion'
  | 'forced_meaning'
  | 'unnatural_phrase'
  | 'decorative_glue'
  | 'unsupported_emotion'
  | 'metadata_feel'
  | 'interrogation_feel'
  | 'behavior_template_feel'
  | 'semantic_opacity';

export interface CausalityBeatArtifact {
  id: string;
  stimulus: string;
  perception: string;
  response: string;
  consequence: string;
}

export interface CausalitySkeletonArtifact {
  schemaVersion: typeof GROUNDED_PROSE_CAUSALITY_SCHEMA;
  chapterNumber: number;
  proseHash: string;
  pass: boolean;
  beats: CausalityBeatArtifact[];
  blockers: string[];
}

export interface ColdReaderFindingArtifact {
  id: string;
  category: GroundedProseFindingCategory;
  severity: GroundedProseSeverity;
  excerpt: string;
  reason: string;
}

export interface BlindColdReaderArtifact {
  schemaVersion: typeof GROUNDED_PROSE_COLD_READER_SCHEMA;
  chapterNumber: number;
  proseHash: string;
  pass: boolean;
  findings: ColdReaderFindingArtifact[];
  blockers: string[];
}

export type LineAuditAction = 'KEEP_WITH_REASON' | 'DELETE' | 'REWRITE';

export interface LineAuditVerdictArtifact {
  findingId: string;
  action: LineAuditAction;
  reason: string;
  sceneFunction?: string;
}

export interface LineAuditArtifact {
  schemaVersion: typeof GROUNDED_PROSE_LINE_AUDIT_SCHEMA;
  chapterNumber: number;
  proseHash: string;
  pass: boolean;
  verdicts: LineAuditVerdictArtifact[];
  blockers: string[];
}

export interface GroundedProseRuntimeGateArtifact {
  schemaVersion: typeof GROUNDED_PROSE_GATE_SCHEMA;
  chapterNumber: number;
  proseHash: string;
  decision: 'PASS' | 'FAIL';
  blockers: string[];
  causalitySkeleton: CausalitySkeletonArtifact | null;
  coldReader: BlindColdReaderArtifact | null;
  lineAudit: LineAuditArtifact | null;
  createdAt: string;
}
