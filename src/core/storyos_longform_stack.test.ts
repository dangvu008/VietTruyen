import { describe, expect, it } from 'vitest';
import { storyOsBuiltinBodies, storyOsBuiltinManifests } from './storyos_builtin_skills';
import { buildRuntimeSkillPacket, renderRuntimeSkillPacket } from './storyos_skill_registry';
import { buildStoryOsReviewPacket } from './storyos_review_v2';
import { compileNotionSkillRegistry } from './storyos_notion_adapter';
import { validateChapterStateProposal, type ChapterStateProposal } from './storyos_state_loop';
import type { MinimalWriterPacket } from './storyos_runtime_v2';

const writerPacket: MinimalWriterPacket = {
  runtimeVersion: 'storyos_v2',
  contextPolicy: 'sol-advisor-v1',
  projectId: 'P1',
  storyTitle: 'Story',
  mode: 'continue',
  objective: 'Continue the confrontation and end on a difficult choice.',
  currentFocus: 'A knows only what she saw.',
  directSeam: 'A saw the sealed letter but did not read its contents.',
  relevantCharacters: [{ id: 'a', name: 'A', role: 'lead', arc: '', currentStage: '', traits: 'careful' }],
  relevantOutline: [{ id: 'b1', title: 'Choice', summary: 'A must choose whether to open the letter.', focus: 'A' }],
  world: { geography: 'City', magicSystem: '', techLevel: 'modern', currency: 'VND', factions: [], rules: '' },
  continuityNotes: '',
};

describe('StoryOS long-form stack', () => {
  it('routes extracted prose skills without loading review skills into Writer context', () => {
    const packet = buildRuntimeSkillPacket({
      mode: 'continue',
      taskText: 'Viết kết chương cliffhanger từ lựa chọn của A.',
      manifests: storyOsBuiltinManifests,
      bodies: storyOsBuiltinBodies,
    });
    const ids = packet.selected.map((skill) => skill.skillId);
    expect(ids).toContain('prose.cliffhanger');
    expect(ids.some((id) => id.startsWith('review.'))).toBe(false);
    expect(renderRuntimeSkillPacket(packet)).not.toContain('review.timeline');
  });

  it('builds review context separately and deterministically selects review skills', () => {
    const review = buildStoryOsReviewPacket('A called the stranger by a name she never learned.', writerPacket, {
      manifests: storyOsBuiltinManifests,
      bodies: storyOsBuiltinBodies,
    });
    expect(review.policy).toBe('separate-review-v1');
    expect(review.skills.selected.map((skill) => skill.skillId)).toEqual([
      'review.character',
      'review.knowledge-boundary',
      'review.timeline',
    ]);
    expect(review.skills.totalEstimatedTokens).toBeLessThanOrEqual(1800);
  });

  it('compiles Notion rows into the same registry contract and keeps the newest version', () => {
    const snapshot = compileNotionSkillRegistry([
      {
        skillId: 'prose.cliffhanger', version: '1.0.0', domain: 'prose', status: 'active', purpose: 'old', tokenBudget: 500,
      },
      {
        skillId: 'prose.cliffhanger', version: '1.2.0', domain: 'prose', status: 'active', purpose: 'new', tokenBudget: 99999,
        triggers: ['kết chương', 'kết chương'], hardRules: ['keep canon'], guidance: ['bridge forward'], antiPatterns: ['false danger'],
      },
    ]);
    expect(snapshot.manifests).toHaveLength(1);
    expect(snapshot.manifests[0].version).toBe('1.2.0');
    expect(snapshot.manifests[0].tokenBudget).toBe(1600);
    expect(snapshot.manifests[0].triggers).toEqual(['kết chương']);
  });

  it('blocks stale or weak state extraction proposals before authority mutation', () => {
    const proposal: ChapterStateProposal = {
      policy: 'state-extractor-v1',
      projectId: 'P1',
      chapterId: 'C10',
      expectedCanonVersion: 3,
      summary: 'A opens the letter.',
      events: [{
        eventId: 'evt-C10-1', type: 'open_loop_created', subjectId: 'letter', payload: { question: 'Who sent it?' }, confidence: 0.95, evidence: 'The seal carried no name.',
      }],
      deltas: [{ entityId: 'a', field: 'knowledge.letter_contents', newValue: 'known', confidence: 0.95, evidence: 'A read the letter.' }],
      openLoopIds: ['letter-sender'],
      resolvedLoopIds: [],
    };
    expect(validateChapterStateProposal(proposal, 3).pass).toBe(true);
    expect(validateChapterStateProposal(proposal, 4).violations.map((v) => v.code)).toContain('STALE_CANON');

    const weak = { ...proposal, events: [{ ...proposal.events[0], confidence: 0.4 }] };
    expect(validateChapterStateProposal(weak, 3).violations.map((v) => v.code)).toContain('LOW_CONFIDENCE');
  });
});
