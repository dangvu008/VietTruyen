import type { StylePreset } from '../data/style_presets';

export const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

export const sentenceSplit = (text: string) =>
  text
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

export const sanitize = (text: string) => text.replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();

export const deAi = (text: string) => {
  const replaced = text
    .replace(/\b(?:có lẽ|dường như|một cách nào đó)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/([.!?]){2,}/g, '$1');
  return sanitize(replaced);
};

export const applyCadence = (sentences: string[], cadence: StylePreset['cadence']) => {
  if (cadence === 'short') {
    return sentences.flatMap((sentence) => {
      if (sentence.split(' ').length <= 16) return [sentence];
      return sentence.split(/,|;|:/).map((chunk) => chunk.trim()).filter(Boolean);
    });
  }
  if (cadence === 'long') {
    const merged: string[] = [];
    for (let i = 0; i < sentences.length; i += 2) {
      const combo = [sentences[i], sentences[i + 1]].filter(Boolean).join(', ');
      merged.push(combo);
    }
    return merged;
  }
  return sentences;
};

export const injectLexicon = (sentences: string[], lexicon: string[], intensity: number) => {
  if (!lexicon.length) return sentences;
  const step = Math.max(1, Math.round(3 - intensity));
  return sentences.map((sentence, index) => {
    if (index % step !== 0) return sentence;
    const token = pick(lexicon);
    return sentence.endsWith('.') || sentence.endsWith('!') || sentence.endsWith('?')
      ? sentence.slice(0, -1) + `, ${token}.`
      : `${sentence}, ${token}.`;
  });
};

export const applyStyle = (text: string, style: StylePreset, intensity = 0.6) => {
  const base = deAi(text);
  const sentences = sentenceSplit(base);
  const cadenced = applyCadence(sentences, style.cadence);
  const lexed = injectLexicon(cadenced, style.lexicon, intensity);
  const withSignature = style.signature.length
    ? [style.signature[0], ...lexed].join('\n')
    : lexed.join(' ');
  return sanitize(withSignature.replace(/\n{2,}/g, '\n'));
};

export const polishText = (text: string, style: StylePreset) => {
  const trimmed = sanitize(text);
  const tightened = trimmed
    .replace(/\b(đã|đang)\s+\1\b/gi, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
  return applyStyle(tightened, style, 0.4);
};
