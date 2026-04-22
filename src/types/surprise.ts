export type TensionLevel = 'follow' | 'nudge' | 'twist' | 'subvert';

export type DivergenceLevel = 'safe' | 'warning' | 'critical';

export type AnchorKind =
  | 'endgame'
  | 'character_truth'
  | 'established_fact'
  | 'foreshadowing_planted';

export type BeatStrategy = 'follow' | 'delay' | 'replace';

export interface Anchor {
  id: string;
  kind: AnchorKind;
  label: string;
  detail: string;
  source: string;
  weight: 1 | 2 | 3;
}

export interface AnchorSet {
  endgame: Anchor[];
  characterTruth: Anchor[];
  establishedFact: Anchor[];
  foreshadowingPlanted: Anchor[];
  all: Anchor[];
}

export interface ExpectationProfile {
  dominantExpectation: string;
  alternativeExpectations: string[];
  setupSignals: string[];
  confidence: number;
}

export interface SurpriseBranch {
  id: string;
  suggestedTitle: string;
  tensionLevel: TensionLevel;
  summary: string;
  surpriseVector: string;
  beatStrategy: BeatStrategy;
  preservedAnchorIds: string[];
  challengedExpectation: string;
  foreshadowNow: string[];
  impactTrace: string[];
  riskScore: number;
  recommendationScore?: number;
}

export interface ChapterLedger {
  summary: string;
  beatStatus: 'hit' | 'delay' | 'replace';
  usedCharacterNames: string[];
  introducedEntities: string[];
  foreshadowPlanted: string[];
  preservedAnchorIds: string[];
}

export interface DivergenceIssue {
  severity: 'warning' | 'critical';
  code:
    | 'beat_skipped'
    | 'beat_delayed'
    | 'anchor_broken'
    | 'new_entity_untracked'
    | 'fact_conflict'
    | 'missing_foreshadow'
    | 'endgame_drift';
  message: string;
}

export interface DivergenceReport {
  level: DivergenceLevel;
  score: number;
  issues: DivergenceIssue[];
  followUpActions: string[];
}

export interface BranchPlanningResult {
  anchors: AnchorSet;
  expectation: ExpectationProfile;
  branches: SurpriseBranch[];
  recommendedBranchId: string;
}

export interface ContextUsageStats {
  rawTokens: number;
  cleanTokens: number;
  reducedTokens: number;
  reductionPercent: number;
}

export interface ChapterWriteResult {
  title: string;
  content: string;
  ledger: ChapterLedger;
  divergence: DivergenceReport;
  selectedBranch: SurpriseBranch;
  contextUsage?: ContextUsageStats;
}
