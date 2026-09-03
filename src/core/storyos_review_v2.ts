import type { MinimalWriterPacket } from './storyos_runtime_v2';
import { buildRuntimeSkillPacket, type RuntimeSkillPacket, type SkillBody, type SkillManifest } from './storyos_skill_registry';

export interface ReviewRegistry {
  manifests: SkillManifest[];
  bodies: Record<string, SkillBody | undefined>;
}

export interface StoryOsReviewPacket {
  policy: 'separate-review-v1';
  prose: string;
  authorityContext: {
    characters: MinimalWriterPacket['relevantCharacters'];
    outline: MinimalWriterPacket['relevantOutline'];
    world: MinimalWriterPacket['world'];
    directSeam: string;
  };
  skills: RuntimeSkillPacket;
}

export const buildStoryOsReviewPacket = (
  prose: string,
  writerPacket: MinimalWriterPacket,
  registry: ReviewRegistry,
): StoryOsReviewPacket => ({
  policy: 'separate-review-v1',
  prose,
  authorityContext: {
    characters: writerPacket.relevantCharacters,
    outline: writerPacket.relevantOutline,
    world: writerPacket.world,
    directSeam: writerPacket.directSeam,
  },
  skills: buildRuntimeSkillPacket({
    mode: 'polish',
    taskText: 'Review chapter character consistency, knowledge boundary, and timeline continuity.',
    manifests: registry.manifests,
    bodies: registry.bodies,
    requestedSkillIds: ['review.character', 'review.knowledge-boundary', 'review.timeline'],
    maxSkills: 4,
    maxTokens: 1800,
  }),
});
