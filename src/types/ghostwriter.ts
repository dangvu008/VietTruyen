export type SceneEmotionStage =
  | 'guarded'
  | 'tense'
  | 'surprised'
  | 'ashamed'
  | 'relieved'
  | 'resolved';

export interface SceneMindState {
  povCharacterId: string;
  want: string;
  fear: string;
  misbelief?: string;
  bodyState: string;
  relationshipTension: string[];
  suppressedThought?: string;
  emotionCurve: SceneEmotionStage[];
}

export interface SceneCard {
  sceneId: string;
  intent: 'writing_scene' | 'continuation' | 'adaptation';
  purpose: string;
  conflictBeat: string;
  reveal: string[];
  withhold: string[];
  motifTargets: string[];
  continuityObligations: string[];
  exitState: string;
}

export interface VoiceConstraints {
  bannedPhrases: string[];
  bannedDiscourseMoves: string[];
  sentenceRhythm: 'mixed' | 'compressed' | 'breathless';
  abstractionLevel: 'low' | 'medium';
  sensoryBias: Array<'visual' | 'touch' | 'sound' | 'breath' | 'pain'>;
}
