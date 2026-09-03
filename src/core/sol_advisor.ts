import type { Character, OutlineBeat, WorldRules } from '../types/story';

export interface SolAdvisorInput {
  prompt: string;
  sourceText: string;
  notes: string;
  currentFocus: string;
  mainPlot: string;
  characters: Character[];
  outline: OutlineBeat[];
  world: WorldRules;
}

export interface SolAdvisorContext {
  policy: 'sol-advisor-v1';
  objective: string;
  currentFocus: string;
  directSeam: string;
  relevantCharacters: Character[];
  relevantOutline: OutlineBeat[];
  world: WorldRules;
  continuityNotes: string;
}

const compact = (text: string, maxChars: number) => {
  const value = text.replace(/\s+/g, ' ').trim();
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars).trim()}…`;
};

const tail = (text: string, maxChars: number) => {
  const value = text.trim();
  if (value.length <= maxChars) return value;
  return value.slice(value.length - maxChars).replace(/^\S*\s/, '').trim();
};

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3);

const scoreText = (candidate: string, haystack: string) => {
  const words = new Set(tokenize(candidate));
  let score = 0;
  for (const word of words) {
    if (haystack.includes(word)) score += 1;
  }
  return score;
};

const compactCharacter = (character: Character): Character => ({
  id: character.id,
  name: compact(character.name, 120),
  role: compact(character.role, 160),
  arc: compact(character.arc, 360),
  currentStage: compact(character.currentStage, 320),
  traits: compact(character.traits, 360),
  aliases: character.aliases?.slice(0, 6).map((alias) => compact(alias, 100)),
  facts: character.facts?.slice(0, 8).map((fact) => ({
    ...fact,
    key: compact(fact.key, 100),
    value: compact(fact.value, 260),
  })),
  psychology: character.psychology
    ? {
        coreWound: character.psychology.coreWound ? compact(character.psychology.coreWound, 220) : undefined,
        deepFear: character.psychology.deepFear ? compact(character.psychology.deepFear, 220) : undefined,
        hiddenDesire: character.psychology.hiddenDesire ? compact(character.psychology.hiddenDesire, 220) : undefined,
        selfDeception: character.psychology.selfDeception ? compact(character.psychology.selfDeception, 220) : undefined,
        bodyLanguage: character.psychology.bodyLanguage ? compact(character.psychology.bodyLanguage, 220) : undefined,
      }
    : undefined,
});

const compactOutlineBeat = (beat: OutlineBeat): OutlineBeat => ({
  ...beat,
  title: compact(beat.title, 180),
  summary: compact(beat.summary, 520),
  focus: compact(beat.focus, 220),
  foreshadowingHint: beat.foreshadowingHint ? compact(beat.foreshadowingHint, 320) : undefined,
});

const rankOutline = (outline: OutlineBeat[], haystack: string) =>
  [...outline]
    .map((beat, index) => ({
      beat,
      index,
      score: scoreText(`${beat.title} ${beat.summary} ${beat.focus}`, haystack),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .map(({ beat }) => compactOutlineBeat(beat));

const rankCharacters = (characters: Character[], haystack: string) =>
  [...characters]
    .map((character, index) => ({
      character,
      index,
      score: scoreText(
        `${character.name} ${character.aliases?.join(' ') ?? ''} ${character.role} ${character.currentStage} ${character.traits}`,
        haystack,
      ),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 6)
    .map(({ character }) => compactCharacter(character));

const compactFacts = (facts: WorldRules['facts'], maxItems: number) =>
  facts?.slice(0, maxItems).map((fact) => ({
    ...fact,
    key: compact(fact.key, 120),
    value: compact(fact.value, 320),
  }));

const compactWorld = (world: WorldRules): WorldRules => ({
  geography: compact(world.geography, 600),
  magicSystem: compact(world.magicSystem, 600),
  techLevel: compact(world.techLevel, 300),
  currency: compact(world.currency, 120),
  factions: world.factions.slice(0, 8).map((faction) => compact(faction, 220)),
  rules: compact(world.rules, 1000),
  facts: compactFacts(world.facts, 12),
});

/**
 * sol-advisor is the context-selection layer between authoritative story state and Writer.
 * It is intentionally stateless: every execution turn derives a bounded working context
 * from fresh authority state instead of carrying forward accumulated tool/history noise.
 */
export const adviseWriterContext = (input: SolAdvisorInput): SolAdvisorContext => {
  const directSeam = tail(input.sourceText, 1800);
  const continuityNotes = compact(input.notes, 1200);
  const currentFocus = compact(input.currentFocus || input.notes || '', 800);
  const objective = compact(input.prompt || input.currentFocus || input.mainPlot || '', 1200);
  const haystack = `${input.prompt} ${continuityNotes} ${directSeam} ${currentFocus}`.toLowerCase();

  return {
    policy: 'sol-advisor-v1',
    objective,
    currentFocus,
    directSeam,
    relevantCharacters: rankCharacters(input.characters, haystack),
    relevantOutline: rankOutline(input.outline, haystack),
    world: compactWorld(input.world),
    continuityNotes,
  };
};
