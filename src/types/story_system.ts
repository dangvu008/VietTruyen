/**
 * File: story_system.ts
 * Purpose: Story System types based on webnovel-writer architecture
 * Layer: Domain / Types
 * 
 * Contract-driven story management system with:
 * - MASTER_SETTING.json (contract seeds)
 * - Volume contracts
 * - Chapter contracts  
 * - Review contracts
 * - Event audit chain
 */

export interface RedLineReport {
  passed: boolean;
  violations: string[];
}

export interface MasterSetting {
  route: {
    primary_genre: string;
    secondary_genres?: string[];
  };
  tone: {
    mood: string;
    voice: string;
    pacing: string;
  };
  constraints: {
    anti_patterns: string[];
    hard_constraints: string[];
    style_guidelines: string[];
  };
  quality_gates: {
    min_reading_power: number;
    min_high_point_density: number;
    max_ooc_violations: number;
  };
  metadata: {
    version: string;
    created_at: string;
    updated_at: string;
  };
}

export interface VolumeContract {
  volume_number: number;
  title: string;
  arc_summary: string;
  target_chapters: number;
  target_words: number;
  strand_weave: {
    quest_ratio: number; // Default 0.6
    fire_ratio: number; // Default 0.2
    constellation_ratio: number; // Default 0.2
  };
  constraints: {
    required_beats: string[];
    forbidden_tropes: string[];
    character_arcs: CharacterArc[];
  };
  metadata: {
    status: 'planned' | 'in_progress' | 'completed';
    created_at: string;
    updated_at: string;
  };
}

export interface CharacterArc {
  character_id: string;
  arc_type: 'growth' | 'fall' | 'redemption' | 'discovery';
  start_state: string;
  end_state: string;
  key_moments: string[];
}

export interface ChapterContract {
  chapter_number: number;
  volume_number: number;
  title: string;
  beat_structure: {
    opening_hook: string;
    main_conflict: string;
    climax: string;
    resolution: string;
  };
  strand_classification: 'quest' | 'fire' | 'constellation';
  context_requirements: {
    required_entities: string[];
    required_locations: string[];
    required_timeline: string;
  };
  quality_targets: {
    min_word_count: number;
    max_word_count: number;
    reading_power_target: number;
    high_point_count: number;
  };
  constraints: {
    immutable_facts: string[];
    prohibited_actions: string[];
    character_consistency_rules: string[];
  };
  metadata: {
    status: 'planned' | 'written' | 'reviewed' | 'published';
    created_at: string;
    updated_at: string;
  };
}

export interface ReviewContract {
  chapter_number: number;
  review_dimensions: ReviewDimension[];
  pass_criteria: {
    min_score: number;
    required_dimensions: string[];
  };
  auto_fix_rules: {
    enabled: boolean;
    rules: AutoFixRule[];
  };
}

export interface ReviewDimension {
  name: 'high_point' | 'consistency' | 'pacing' | 'ooc' | 'continuity' | 'reader_pull';
  weight: number;
  threshold: number;
  enabled: boolean;
}

export interface AutoFixRule {
  pattern: string;
  replacement: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ChapterCommit {
  chapter_number: number;
  commit_id: string;
  timestamp: string;
  author: string;
  changes: {
    content_diff: string;
    metadata_changes: Record<string, unknown>;
  };
  artifacts: {
    accepted_events: StoryEvent[];
    state_deltas: StateDelta[];
    entity_deltas: EntityDelta[];
    summary_text: string;
  };
  validation: {
    contract_compliant: boolean;
    quality_score: number;
    violations: string[];
  };
}

export interface StoryEvent {
  event_id: string;
  event_type: 'entity_change' | 'state_change' | 'relationship_change' | 'plot_milestone';
  chapter_number: number;
  timestamp: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
}

export interface StateDelta {
  attribute: string;
  old_value: unknown;
  new_value: unknown;
  confidence: number;
}

export interface EntityDelta {
  entity_id: string;
  change_type: 'create' | 'update' | 'delete';
  attributes: Record<string, unknown>;
}

export interface StoryRuntimeHealth {
  overall_health: 'healthy' | 'degraded' | 'critical';
  contract_compliance: number;
  quality_trend: 'improving' | 'stable' | 'declining';
  active_issues: RuntimeIssue[];
  last_commit: string;
  last_validation: string;
}

export interface RuntimeIssue {
  issue_id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'contract' | 'quality' | 'consistency' | 'performance';
  description: string;
  affected_chapters: number[];
  suggested_actions: string[];
}

export interface StrandWeaveMetrics {
  quest_percentage: number;
  fire_percentage: number;
  constellation_percentage: number;
  redline_violations: StrandViolation[];
}

export interface StrandViolation {
  strand_type: 'quest' | 'fire' | 'constellation';
  violation_type: 'consecutive_exceeded' | 'gap_exceeded';
  current_streak: number;
  threshold: number;
  affected_chapters: number[];
}