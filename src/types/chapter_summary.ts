/**
 * File: chapter_summary.ts
 * Purpose: TypeScript declarations for generated chapter summaries
 */

import type { StrandType } from './strand_weave';
import type { HookType, HookStrength } from './reading_power';

export interface ChapterSummary {
  chapter_id: string;
  time: string;
  location: string;
  characters: string[];
  state_changes: string[];
  hook: { 
    type: HookType; 
    strength: HookStrength; 
    content: string 
  };
  plot_summary: string;
  foreshadowing: Array<{
    type: 'planted' | 'progressed' | 'resolved';
    content: string;
  }>;
  bridge_point: string;
  strand_dominant: StrandType;
}

export interface Scene {
  id: string;
  chapter_id: string;
  sequence: number;
  time: string;
  location: string;
  pov_character: string;
  summary: string;
  content: string; // The text chunk
}
