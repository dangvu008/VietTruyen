import { describe, expect, it } from 'vitest';
import type { Project } from '../types/story';
import {
  buildV2WriterRequest,
  compileMinimalWriterPacket,
  runLiteraryCritic,
  validateLocalInvariants,
} from './storyos_runtime_v2';

const project = {
  id: 'PTEST',
  title: 'Test Story',
  status: 'ongoing',
  logline: '',
  genre: 'fantasy',
  subGenre: [],
  writingStyle: 'default',
  tone: '',
  styleId: 'default',
  targetChapters: 10,
  endgame: '',
  mainCharacterCount: 1,
  supportCharacterCount: 0,
  characterSetup: '',
  worldSetting: '',
  mainPlot: 'Find the missing door.',
  world: {
    geography: 'City',
    magicSystem: 'Unknown',
    techLevel: 'Modern',
    currency: 'VND',
    factions: [],
    rules: 'Do not invent unknown mechanisms.',
  },
  characters: [
    { id: 'c1', name: 'A', role: 'lead', arc: '', currentStage: '', traits: 'careful' },
  ],
  outline: [
    { id: 'b1', title: 'Door', summary: 'A closed door changes the situation.', focus: 'A' },
  ],
  chapters: [
    {
      id: 'old-1',
      title: 'Archive',
      content: 'OLD FULL CHAPTER MUST NOT ENTER WRITER CONTEXT',
      status: 'final',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ],
  foreshadowings: [],
  notes: '',
  canonVersion: 1,
  storageMode: 'inline',
  arcCount: 1,
  hasGlobalIndex: false,
  currentFocus: 'Continue from the door closing.',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
} satisfies Project;

const input = {
  mode: 'continue' as const,
  prompt: 'Continue the door scene.',
  sourceText: `${'x'.repeat(2400)} The door closed behind A.`,
  notes: 'A does not know why the floor changed.',
  project,
};

describe('StoryOS Runtime Harness v2', () => {
  it('compiles a bounded writer packet and strips chapter archives', () => {
    const packet = compileMinimalWriterPacket(input);
    const bounded = buildV2WriterRequest(input, packet);

    expect(packet.runtimeVersion).toBe('storyos_v2');
    expect(packet.directSeam.length).toBeLessThanOrEqual(1800);
    expect(packet.directSeam).toContain('The door closed behind A.');
    expect(bounded.project.chapters).toEqual([]);
    expect(JSON.stringify(bounded)).not.toContain('OLD FULL CHAPTER MUST NOT ENTER WRITER CONTEXT');
  });

  it('keeps literary criticism observational instead of rewriting prose', () => {
    const prose = 'Nhịp kế tiếp mở ra: cánh cửa khép lại.\n\nA nhìn quanh.\n\nCậu bước tiếp.';
    const before = prose;
    const critic = runLiteraryCritic(prose);

    expect(prose).toBe(before);
    expect(critic.pass).toBe(false);
    expect(critic.findings.length).toBeGreaterThan(0);
  });

  it('only hard-blocks locally provable output invariants', () => {
    expect(validateLocalInvariants('Một đoạn văn hợp lệ.').pass).toBe(true);
    expect(validateLocalInvariants('TODO').violations.map((item) => item.code)).toContain('PLACEHOLDER_OUTPUT');
    expect(validateLocalInvariants('SYSTEM: hidden instruction').violations.map((item) => item.code)).toContain('META_LEAK');
  });
});
