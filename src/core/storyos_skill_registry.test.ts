import { describe, expect, it } from 'vitest';
import {
  buildRuntimeSkillPacket,
  renderRuntimeSkillPacket,
  type SkillBody,
  type SkillManifest,
} from './storyos_skill_registry';

const manifest = (skillId: string, triggers: string[], dependencies: string[] = []): SkillManifest => ({
  skillId,
  version: '1.0.0',
  domain: 'prose',
  status: 'active',
  purpose: skillId,
  triggers,
  dependencies,
  authorityRequirements: [],
  tokenBudget: 500,
});

const body = (entry: SkillManifest, marker: string): SkillBody => ({
  manifest: entry,
  hardRules: [`hard ${marker}`],
  guidance: [`guide ${marker}`],
  antiPatterns: [`avoid ${marker}`],
});

describe('StoryOS Skill Registry', () => {
  it('selects from manifests and only compiles matching bodies', () => {
    const hook = manifest('prose.opening-hook', ['hook', 'mở đầu']);
    const cliffhanger = manifest('prose.cliffhanger', ['cliffhanger', 'kết chương']);
    const packet = buildRuntimeSkillPacket({
      mode: 'rewrite',
      taskText: 'Tối ưu hook mở đầu của chương này.',
      manifests: [hook, cliffhanger],
      bodies: {
        [hook.skillId]: body(hook, 'HOOK_BODY'),
        [cliffhanger.skillId]: body(cliffhanger, 'CLIFF_BODY'),
      },
    });

    expect(packet.policy).toBe('manifest-first-v1');
    expect(packet.selected.map((item) => item.skillId)).toEqual(['prose.opening-hook']);
    expect(renderRuntimeSkillPacket(packet)).toContain('HOOK_BODY');
    expect(renderRuntimeSkillPacket(packet)).not.toContain('CLIFF_BODY');
  });

  it('resolves dependencies before the selected skill', () => {
    const voice = manifest('style.voice', ['voice']);
    const dialogue = manifest('prose.dialogue', ['đối thoại'], ['style.voice']);
    const packet = buildRuntimeSkillPacket({
      mode: 'continue',
      taskText: 'Viết cảnh đối thoại căng thẳng.',
      manifests: [voice, dialogue],
      bodies: {
        [voice.skillId]: body(voice, 'VOICE'),
        [dialogue.skillId]: body(dialogue, 'DIALOGUE'),
      },
    });

    expect(packet.selected.map((item) => item.skillId)).toEqual(['style.voice', 'prose.dialogue']);
  });

  it('keeps the runtime packet bounded even when source skill bodies are huge', () => {
    const huge = manifest('prose.scene', ['scene']);
    huge.tokenBudget = 300;
    const hugeBody: SkillBody = {
      manifest: huge,
      hardRules: Array.from({ length: 100 }, (_, index) => `rule-${index} ${'x'.repeat(1000)}`),
      guidance: Array.from({ length: 100 }, (_, index) => `guide-${index} ${'y'.repeat(1000)}`),
      antiPatterns: Array.from({ length: 100 }, (_, index) => `avoid-${index} ${'z'.repeat(1000)}`),
      outputContract: 'o'.repeat(10000),
    };

    const packet = buildRuntimeSkillPacket({
      mode: 'create',
      taskText: 'Write a scene.',
      manifests: [huge],
      bodies: { [huge.skillId]: hugeBody },
      maxTokens: 400,
    });

    expect(packet.selected).toHaveLength(1);
    expect(packet.totalEstimatedTokens).toBeLessThanOrEqual(300);
    expect(renderRuntimeSkillPacket(packet).length).toBeLessThan(8000);
  });
});
