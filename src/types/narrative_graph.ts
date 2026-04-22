export type NarrativeNodeType =
  | 'character'
  | 'foreshadowing'
  | 'arc'
  | 'chapter'
  | 'world'
  | 'faction';

export type NarrativeEdgeType =
  | 'co_presence'
  | 'foreshadow_link'
  | 'arc_membership'
  | 'dependency'
  | 'canonical_impact'
  | 'temporal_adjacent';

export interface NarrativeNode {
  id: string;
  projectId: string;
  nodeType: NarrativeNodeType;
  refId: string;
  label: string;
  salience: number;
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
