import { describe, expect, it } from 'vitest';
import type { EntityDefinition } from '../../types/narrative_memory';
import type { Scene } from '../../types/chapter_summary';
import {
  characterKnowledgeCandidatesToStateRecords,
  extractExplicitCharacterKnowledge,
} from './character_knowledge_extractor';

const CHARACTERS: EntityDefinition[] = [
  {
    id: 'char-luc-tram',
    entityId: 'char-luc-tram',
    projectId: 'story-a',
    canonicalName: 'Lục Trầm',
    entityType: 'character',
    aliases: [],
    attributes: {},
    sourceType: 'project',
    confidence: 1,
    extractorVersion: 'test',
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z',
  },
];

function scene(content: string): Scene {
  return {
    id: 'scene-1',
    chapter_id: 'ch-10',
    sequence: 1,
    time: 'buổi sáng',
    location: 'Thanh Khê',
    pov_character: 'Lục Trầm',
    summary: '',
    content,
  };
}

describe('explicit character knowledge extraction', () => {
  it('extracts named explicit knowledge without asserting world truth', () => {
    const result = extractExplicitCharacterKnowledge({
      projectId: 'story-a',
      chapterId: 'ch-10',
      chapterIndex: 10,
      entityDefinitions: CHARACTERS,
      scenes: [scene('Lục Trầm nhận ra rằng cánh cửa đá chỉ mở khi trăng lên.')],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.entry.belief).toBe('knows');
    expect(result[0]?.entry.worldTruth).toBe('unknown');
    expect(result[0]?.entry.learnedAtChapter).toBe(10);
  });

  it('does not invent knowledge from pronoun-only or implied prose', () => {
    const result = extractExplicitCharacterKnowledge({
      projectId: 'story-a',
      chapterId: 'ch-10',
      chapterIndex: 10,
      entityDefinitions: CHARACTERS,
      scenes: [scene('Hắn nhìn cánh cửa rất lâu. Có lẽ phía sau còn thứ gì đó.')],
    });

    expect(result).toHaveLength(0);
  });

  it('converts evidence into the existing NarrativeStateFact namespace', () => {
    const candidates = extractExplicitCharacterKnowledge({
      projectId: 'story-a',
      chapterId: 'ch-10',
      chapterIndex: 10,
      entityDefinitions: CHARACTERS,
      scenes: [scene('Lục Trầm nghi ngờ rằng người áo đen đã theo dõi hắn từ trước.')],
    });
    const state = characterKnowledgeCandidatesToStateRecords({ candidates, chapterId: 'ch-10' });

    expect(state.facts).toHaveLength(1);
    expect(state.mutations).toHaveLength(1);
    expect(state.evidence).toHaveLength(1);
    expect(state.facts[0]?.predicate).toMatch(/^character_knowledge:/);
    expect(state.mutations[0]?.reviewStatus).toBe('needs_review');
  });
});
