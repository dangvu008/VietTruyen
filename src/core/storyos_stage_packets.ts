import {
  buildRuntimeSkillPacket,
  type RuntimeSkillPacket,
  type SkillBody,
  type SkillManifest,
} from './storyos_skill_registry';

export interface StoryOsStageRegistry {
  manifests: SkillManifest[];
  bodies: Record<string, SkillBody | undefined>;
}

export interface StoryOsPlanningPacket {
  policy: 'planning-stage-v1';
  objective: string;
  skills: RuntimeSkillPacket;
}

export interface StoryOsAuthorMemoryPacket {
  policy: 'author-memory-stage-v1';
  feedback: string;
  skills: RuntimeSkillPacket;
}

/** Planning skills are composed outside Writer so planning instructions never pollute prose generation. */
export const buildStoryOsPlanningPacket = (
  objective: string,
  registry: StoryOsStageRegistry,
): StoryOsPlanningPacket => ({
  policy: 'planning-stage-v1',
  objective: objective.trim(),
  skills: buildRuntimeSkillPacket({
    mode: 'create',
    taskText: objective,
    manifests: registry.manifests,
    bodies: registry.bodies,
    allowedDomains: ['planning', 'design'],
    maxSkills: 5,
    maxTokens: 2800,
  }),
});

/** Explicit author feedback is learned in a separate memory stage, never inside a Writer turn. */
export const buildStoryOsAuthorMemoryPacket = (
  feedback: string,
  registry: StoryOsStageRegistry,
): StoryOsAuthorMemoryPacket => ({
  policy: 'author-memory-stage-v1',
  feedback: feedback.trim(),
  skills: buildRuntimeSkillPacket({
    mode: 'polish',
    taskText: feedback,
    manifests: registry.manifests,
    bodies: registry.bodies,
    requestedSkillIds: ['memory.author-feedback'],
    allowedDomains: ['memory'],
    maxSkills: 2,
    maxTokens: 900,
  }),
});
