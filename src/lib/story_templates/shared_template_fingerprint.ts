import type { StoryTemplate } from '../../types/story_template';

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function fnv1a32Hex(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}

export function createSharedTemplateSourceFingerprint(sourceTitle: string, sourceText: string): string {
  const normalizedTitle = normalizeWhitespace(sourceTitle);
  const normalizedText = normalizeWhitespace(sourceText);
  return `stf_${normalizedText.length.toString(36)}_${fnv1a32Hex(normalizedTitle)}_${fnv1a32Hex(normalizedText)}`;
}

export function attachTemplateSharingMetadata(
  template: StoryTemplate,
  sharing: NonNullable<StoryTemplate['sharing']>,
): StoryTemplate {
  return {
    ...template,
    sharing: {
      ...template.sharing,
      ...sharing,
    },
  };
}
