export type NarrativeNodeType =
  | 'character'
  | 'foreshadowing'
  | 'arc'
  | 'chapter'
  | 'world'
  | 'faction'
  | 'scene'
  | 'beat'
  | 'motif'
  | 'source_span'
  | 'retcon_event'
  | 'state_fact'
  | 'state_mutation';

export type NarrativeEdgeType =
  | 'co_presence'
  | 'foreshadow_link'
  | 'arc_membership'
  | 'dependency'
  | 'canonical_impact'
  | 'temporal_adjacent'
  | 'scene_membership'
  | 'beat_alignment'
  | 'motif_echo'
  | 'source_derives_to'
  | 'retcon_targets'
  | 'continuity_risk'
  | 'semantic_neighbor'
  | 'state_evidence'
  | 'state_updates'
  | 'state_conflicts';

export interface NarrativeNode {
  id: string;
  projectId: string;
  nodeType: NarrativeNodeType;
  refId: string;
  label: string;
  salience: number;
  attributes?: Record<string, string>;
  confidence?: number;
  origin?: 'project' | 'source_material' | 'derived' | 'ai_enriched';
  updatedAt: string;
}

export interface NarrativeEdge {
  id: string;
  projectId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: NarrativeEdgeType;
  weight: number;
  evidenceChapterIds: string[];
  attributes?: Record<string, string>;
  confidence?: number;
  origin?: 'project' | 'source_material' | 'derived' | 'ai_enriched';
  updatedAt: string;
}

export interface NarrativeCommunity {
  id: string;
  projectId: string;
  label: string;
  memberNodeIds: string[];
  centroidNodeIds: string[];
  score: number;
  algorithmVersion: string;
  updatedAt: string;
}

export interface NarrativeGraphBuildResult {
  nodes: NarrativeNode[];
  edges: NarrativeEdge[];
  communities: NarrativeCommunity[];
}
