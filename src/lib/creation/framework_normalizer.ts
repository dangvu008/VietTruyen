/**
 * File: framework_normalizer.ts
 * Purpose: Normalize framework payloads before persisting or rendering
 * Layer: Application helper
 * Domain: CreationChat -> [framework preview cleanup]
 */
import type { BrainstormResult } from '../../types/narrative_memory';

type PartialBrainstormResult = Partial<BrainstormResult> | null | undefined;

function normalizeText(value: unknown): string {
  return String(value ?? '').replace(/\u0000/g, '').trim();
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeText).filter(Boolean);
}

function normalizeRegisterLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | undefined {
  const numeric = Number(value);
  return numeric === 1 || numeric === 2 || numeric === 3 || numeric === 4 || numeric === 5
    ? numeric
    : undefined;
}

function normalizeEraRegister(value: unknown): BrainstormResult['bible']['narrativeEraRegister'] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Record<string, unknown>;
  const frame = input.frame === 'period' || input.frame === 'mixed' || input.frame === 'contemporary'
    ? input.frame
    : undefined;
  const level = normalizeRegisterLevel(input.level);
  if (!frame || !level) return undefined;
  return {
    frame,
    level,
    narratorLevel: normalizeRegisterLevel(input.narratorLevel),
    dialogueLevel: normalizeRegisterLevel(input.dialogueLevel),
    thoughtLevel: normalizeRegisterLevel(input.thoughtLevel),
    notes: normalizeText(input.notes) || undefined,
  };
}

function normalizePsychology(value: unknown) {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const normalized = {
    coreWound: normalizeText(input.coreWound),
    deepFear: normalizeText(input.deepFear),
    hiddenDesire: normalizeText(input.hiddenDesire),
    selfDeception: normalizeText(input.selfDeception),
    bodyLanguage: normalizeText(input.bodyLanguage),
  };

  return Object.values(normalized).some(Boolean) ? normalized : undefined;
}

export function normalizeCreationFramework(input: PartialBrainstormResult): BrainstormResult {
  const bible = input?.bible;
  const world = input?.world;

  return {
    bible: {
      genre: normalizeText(bible?.genre),
      subGenre: normalizeStringList(bible?.subGenre),
      writingStyle: normalizeText(bible?.writingStyle),
      narrativeEraRegister: normalizeEraRegister(bible?.narrativeEraRegister),
      title: normalizeText(bible?.title),
      logline: normalizeText(bible?.logline),
      endgame: normalizeText(bible?.endgame),
      mainCharacterCount: Number.isFinite(bible?.mainCharacterCount) ? Number(bible?.mainCharacterCount) : 0,
      supportCharacterCount: Number.isFinite(bible?.supportCharacterCount) ? Number(bible?.supportCharacterCount) : 0,
      characterSetup: normalizeText(bible?.characterSetup),
      worldSetting: normalizeText(bible?.worldSetting),
      mainPlot: normalizeText(bible?.mainPlot),
    },
    characters: Array.isArray(input?.characters)
      ? input.characters.map((item) => ({
          name: normalizeText(item?.name),
          role: normalizeText(item?.role),
          traits: normalizeText(item?.traits),
          arc: normalizeText(item?.arc),
          currentStage: normalizeText(item?.currentStage),
          psychology: normalizePsychology(item?.psychology),
        }))
      : [],
    world: {
      geography: normalizeText(world?.geography),
      magicSystem: normalizeText(world?.magicSystem),
      techLevel: normalizeText(world?.techLevel),
      currency: normalizeText(world?.currency),
      factions: normalizeStringList(world?.factions),
      rules: normalizeText(world?.rules),
    },
    outline: Array.isArray(input?.outline)
      ? input.outline.map((item) => ({
          title: normalizeText(item?.title),
          summary: normalizeText(item?.summary),
          focus: normalizeText(item?.focus),
        }))
      : [],
    chapterSkeleton: Array.isArray(input?.chapterSkeleton)
      ? input.chapterSkeleton.map((item) => ({
          title: normalizeText(item?.title),
          summary: normalizeText(item?.summary),
          keyEvents: normalizeStringList(item?.keyEvents),
          entityRefs: normalizeStringList(item?.entityRefs),
        }))
      : [],
    foreshadowings: Array.isArray(input?.foreshadowings)
      ? input.foreshadowings.map((item) => ({
          description: normalizeText(item?.description),
        }))
      : [],
  };
}