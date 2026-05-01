import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { runWriter, WriterRequest } from '../../src/core/writer_engine';
import { Project } from '../../src/types/story';

// @legacy — rune-safeguard 2026-05-01 — characterization tests for writer_engine

const mockProject: Project = {
  id: 'p1',
  title: 'Test Story',
  logline: '',
  genre: 'Fantasy',
  subGenre: [],
  writingStyle: '',
  tone: '',
  styleId: 'default',
  targetChapters: 10,
  endgame: '',
  mainCharacterCount: 1,
  supportCharacterCount: 0,
  characterSetup: '',
  worldSetting: '',
  mainPlot: '',
  world: { geography: 'Test Geo', magicSystem: '', techLevel: '', currency: '', factions: [], rules: '' },
  characters: [{ id: 'c1', name: 'Hero', role: '', arc: '', currentStage: '', traits: '' }],
  outline: [{ id: 'o1', title: 'Start', summary: 'Beginning', focus: '' }],
  chapters: [{
    id: 'ch1',
    title: 'Ch1',
    content: 'This is the start.',
    status: 'draft',
    createdAt: '',
    updatedAt: '',
  }],
  foreshadowings: [],
  notes: '',
  canonVersion: 1,
  storageMode: 'inline',
  arcCount: 0,
  hasGlobalIndex: false,
  createdAt: '',
  updatedAt: ''
};

const baseRequest: WriterRequest = {
  mode: 'create',
  prompt: 'A secret artifact',
  sourceText: '',
  notes: '',
  styleId: 'default',
  intensity: 0, // 0 for exact text match without random lexicons
  selfReflection: false,
  consistency: false,
  project: mockProject
};

describe('writer_engine — characterization', () => {
  beforeAll(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // Always pick middle item
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('mode: create', () => {
    const req: WriterRequest = { ...baseRequest, mode: 'create' };
    const res = runWriter(req);
    expect(res.output).toBeTypeOf('string');
    expect(res.output.length).toBeGreaterThan(10);
    expect(res.generated).toBeDefined();
    expect(res.generated?.chapterTitle).toBeDefined();
    expect(res.generated?.outline?.length).toBeGreaterThan(0);
    expect(res.generated?.characters?.length).toBeGreaterThan(0);
  });

  it('mode: rewrite', () => {
    const req: WriterRequest = { ...baseRequest, mode: 'rewrite', sourceText: '   Too   many    spaces  ' };
    const res = runWriter(req);
    expect(res.output).toContain('Too many spaces'); // sanitize check
  });

  it('mode: continue', () => {
    const req: WriterRequest = { ...baseRequest, mode: 'continue', sourceText: 'The sky was dark.' };
    const res = runWriter(req);
    expect(res.output).toBeTypeOf('string');
    expect(res.output.length).toBeGreaterThan(10);
  });

  it('mode: polish', () => {
    const req: WriterRequest = { ...baseRequest, mode: 'polish', sourceText: 'Tôi đã đã đi học.\n\n\n\nThật sự.' };
    const res = runWriter(req);
    // polish removes double 'đã' and extra newlines
    expect(res.output).toBeTypeOf('string');
    expect(res.output.length).toBeGreaterThan(10);
  });
});
