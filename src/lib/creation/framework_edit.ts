import type { BrainstormResult } from '../../types/narrative_memory';

type BibleField = keyof BrainstormResult['bible'];
type WorldField = keyof BrainstormResult['world'];
type CharacterField = keyof BrainstormResult['characters'][number];
type OutlineField = keyof BrainstormResult['outline'][number];

export function parseCommaSeparatedValues(rawValue: string): string[] {
  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function updateBibleField(
  framework: BrainstormResult,
  field: BibleField,
  value: BrainstormResult['bible'][BibleField],
): BrainstormResult {
  return {
    ...framework,
    bible: {
      ...framework.bible,
      [field]: value,
    },
  };
}

export function updateWorldField(
  framework: BrainstormResult,
  field: WorldField,
  value: BrainstormResult['world'][WorldField],
): BrainstormResult {
  return {
    ...framework,
    world: {
      ...framework.world,
      [field]: value,
    },
  };
}

export function updateCharacterField(
  framework: BrainstormResult,
  index: number,
  field: CharacterField,
  value: BrainstormResult['characters'][number][CharacterField],
): BrainstormResult {
  return {
    ...framework,
    characters: framework.characters.map((character, characterIndex) =>
      characterIndex === index
        ? {
          ...character,
          [field]: value,
        }
        : character
    ),
  };
}

export function appendCharacter(framework: BrainstormResult): BrainstormResult {
  return {
    ...framework,
    characters: [
      ...framework.characters,
      {
        name: '',
        role: 'Phụ',
        traits: '',
        arc: '',
        currentStage: '',
      },
    ],
  };
}

export function removeCharacter(framework: BrainstormResult, index: number): BrainstormResult {
  return {
    ...framework,
    characters: framework.characters.filter((_, characterIndex) => characterIndex !== index),
  };
}

export function updateOutlineField(
  framework: BrainstormResult,
  index: number,
  field: OutlineField,
  value: BrainstormResult['outline'][number][OutlineField],
): BrainstormResult {
  return {
    ...framework,
    outline: framework.outline.map((item, outlineIndex) =>
      outlineIndex === index
        ? {
          ...item,
          [field]: value,
        }
        : item
    ),
  };
}

export function appendOutlineBeat(framework: BrainstormResult): BrainstormResult {
  return {
    ...framework,
    outline: [
      ...framework.outline,
      {
        title: '',
        summary: '',
        focus: '',
      },
    ],
  };
}

export function removeOutlineBeat(framework: BrainstormResult, index: number): BrainstormResult {
  return {
    ...framework,
    outline: framework.outline.filter((_, outlineIndex) => outlineIndex !== index),
  };
}

export function updateForeshadowingDescription(
  framework: BrainstormResult,
  index: number,
  value: string,
): BrainstormResult {
  return {
    ...framework,
    foreshadowings: framework.foreshadowings.map((item, foreshadowingIndex) =>
      foreshadowingIndex === index
        ? { ...item, description: value }
        : item
    ),
  };
}

export function appendForeshadowing(framework: BrainstormResult): BrainstormResult {
  return {
    ...framework,
    foreshadowings: [
      ...framework.foreshadowings,
      { description: '' },
    ],
  };
}

export function removeForeshadowing(framework: BrainstormResult, index: number): BrainstormResult {
  return {
    ...framework,
    foreshadowings: framework.foreshadowings.filter((_, foreshadowingIndex) => foreshadowingIndex !== index),
  };
}
