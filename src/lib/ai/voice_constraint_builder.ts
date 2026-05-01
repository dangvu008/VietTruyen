import type { VoiceConstraints, SceneMindState } from '../../types/ghostwriter';
import type { Project } from '../../types/story';
import type { SceneTypeResult } from './scene_type_classifier';

const DEFAULT_BANNED_PHRASES = [
  'tuy nhiên',
  'điều quan trọng là',
  'trong bối cảnh đó',
  'một cách rõ ràng',
];

const DEFAULT_BANNED_MOVES = [
  'mở đoạn bằng câu tổng kết cảm xúc',
  'giải thích tâm lý như đang bình giảng',
  'kết đoạn bằng câu chốt đạo lý',
];

export function buildVoiceConstraints(
  project: Project,
  sceneType: SceneTypeResult,
  mindState: SceneMindState
): VoiceConstraints {
  const isPressureHeavy = sceneType.primary === 'combat' || sceneType.primary === 'intrigue';
  const isInterior = sceneType.primary === 'emotion' || sceneType.primary === 'dialogue';
  const prefersConcreteLanguage = /cang thang|u am|gay gat/i.test(
    project.tone
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  );

  return {
    bannedPhrases: DEFAULT_BANNED_PHRASES,
    bannedDiscourseMoves: DEFAULT_BANNED_MOVES,
    sentenceRhythm: isPressureHeavy ? 'breathless' : isInterior ? 'mixed' : 'compressed',
    abstractionLevel: mindState.emotionCurve.includes('ashamed') || isInterior || prefersConcreteLanguage ? 'low' : 'medium',
    sensoryBias: isPressureHeavy
      ? ['breath', 'pain', 'sound']
      : sceneType.primary === 'exploration'
        ? ['visual', 'sound', 'touch']
        : ['touch', 'breath', 'visual'],
  };
}

export function renderVoiceConstraintsSection(constraints: VoiceConstraints): string {
  const lines = [
    '## RÀNG BUỘC GIỌNG VĂN',
    `- Cấm cụm dễ lộ giọng AI: ${constraints.bannedPhrases.join(' | ')}`,
    `- Cấm thao tác văn xuôi: ${constraints.bannedDiscourseMoves.join(' | ')}`,
    `- Nhịp câu: ${constraints.sentenceRhythm}`,
    `- Mức trừu tượng: ${constraints.abstractionLevel}`,
    `- Thiên cảm giác: ${constraints.sensoryBias.join(' | ')}`,
  ];

  return lines.join('\n');
}
