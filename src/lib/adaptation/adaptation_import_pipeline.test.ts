import { describe, expect, it, vi } from 'vitest';

import {
  analyzeAdaptationPreviewProject,
  buildAdaptationAnalysisReadyMessage,
  buildAdaptationConfigFromDraft,
  buildAdaptationUserNotes,
  prepareAdaptationSourceDraft,
} from './adaptation_import_pipeline';
import type { Project } from '../../types/story';

function makePreviewProject(): Project {
  const now = new Date().toISOString();

  return {
    id: 'preview-1',
    title: 'Thiên Hà',
    logline: '',
    genre: '',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: '',
    targetChapters: 2,
    endgame: '',
    mainCharacterCount: 2,
    supportCharacterCount: 3,
    characterSetup: '',
    worldSetting: '',
    mainPlot: '',
    world: {
      geography: '',
      magicSystem: '',
      techLevel: '',
      currency: '',
      factions: [],
      rules: '',
      facts: [],
    },
    characters: [],
    outline: [],
    chapters: [
      {
        id: 'c1',
        title: 'Chương 1',
        content: 'Minh bước xuống núi.',
        sequenceNumber: 1,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'c2',
        title: 'Chương 2',
        content: 'Cậu tiến vào thành.',
        sequenceNumber: 2,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      },
    ],
    foreshadowings: [],
    notes: '',
    canonVersion: 1,
    storageMode: 'indexeddb',
    arcCount: 0,
    hasGlobalIndex: false,
    createdAt: now,
    updatedAt: now,
  };
}

describe('adaptation_import_pipeline', () => {
  it('prepares a cleaned preview project from the parsed document', async () => {
    const parseDocumentMock = vi.fn().mockResolvedValue({
      title: 'Thiên Hà',
      text: '<p>Chương 1</p><p>Minh bước xuống núi.</p>',
    });
    const preprocessMock = vi.fn().mockReturnValue({
      cleanText: 'Chương 1\nMinh bước xuống núi.',
      stats: {
        rawChars: 40,
        cleanChars: 28,
        rawTokens: 12,
        cleanTokens: 8,
        reducedChars: 12,
        reducedTokens: 4,
        reductionPercent: 33.3,
      },
    });
    const previewProject = makePreviewProject();
    const buildPreviewMock = vi.fn().mockReturnValue(previewProject);

    const result = await prepareAdaptationSourceDraft(
      { name: 'thien-ha.html' } as File,
      undefined,
      {
        parseDocument: parseDocumentMock,
        preprocessTextForLlmInput: preprocessMock,
        buildAdaptationPreviewProject: buildPreviewMock,
      },
    );

    expect(parseDocumentMock).toHaveBeenCalled();
    expect(preprocessMock).toHaveBeenCalledWith('<p>Chương 1</p><p>Minh bước xuống núi.</p>');
    expect(buildPreviewMock).toHaveBeenCalledWith({
      title: 'Thiên Hà',
      text: 'Chương 1\nMinh bước xuống núi.',
    });
    expect(result.previewProject).toBe(previewProject);
    expect(result.inputStats.reductionPercent).toBe(33.3);
  });

  it('analyzes a preview project and composes a ready message', async () => {
    const syncMock = vi.fn().mockResolvedValue(undefined);
    const previewProject = makePreviewProject();

    const result = await analyzeAdaptationPreviewProject(
      previewProject,
      undefined,
      {
        syncProjectMemoryBridge: syncMock,
        getEntityDefinitions: vi.fn().mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]),
        getProjectNarrativeNodes: vi.fn().mockResolvedValue([{ id: 'n1' }]),
        getProjectNarrativeEdges: vi.fn().mockResolvedValue([{ id: 'edge-1' }, { id: 'edge-2' }]),
        getProjectNarrativeCommunities: vi.fn().mockResolvedValue([{ id: 'community-1' }]),
        getProjectMemoryEmbeddings: vi.fn().mockResolvedValue([{ id: 'emb-1' }, { id: 'emb-2' }, { id: 'emb-3' }]),
      },
    );

    expect(syncMock).toHaveBeenCalledWith(previewProject, {
      onProgress: undefined,
    });
    expect(result.stats).toEqual({
      chapterCount: 2,
      entityCount: 2,
      graphNodeCount: 1,
      graphEdgeCount: 2,
      communityCount: 1,
      embeddingCount: 3,
    });
    expect(result.readyMessage).toContain('2 chương');
    expect(result.readyMessage).toContain('2 entity defs');
  });

  it('builds stable adaptation notes and config from the import profile', () => {
    const notes = buildAdaptationUserNotes({
      sourceRole: 'reference',
      rewriteStrength: 'bold',
      startPoint: 'continue_after_import',
      prompt: 'Giữ canon nhưng đổi sang giọng lạnh hơn.',
    });

    expect(notes).toContain('nguồn tham chiếu');
    expect(notes).toContain('mạnh - cho phép rẽ nhánh rõ rệt');
    expect(notes).toContain('viết tiếp sau nội dung đã nhập');

    const config = buildAdaptationConfigFromDraft({
      sourceTitle: 'Thiên Hà',
      sourceText: 'Chương 1\nMinh bước xuống núi.',
      newTitle: 'Thiên Hà — Phóng tác',
      prompt: 'Giữ canon nhưng đổi sang giọng lạnh hơn.',
      sourceRole: 'reference',
      rewriteStrength: 'bold',
      startPoint: 'continue_after_import',
    });

    expect(config.uploadedSource?.title).toBe('Thiên Hà');
    expect(config.newTitle).toBe('Thiên Hà — Phóng tác');
    expect(config.adaptationType).toBe('reskin');
    expect(config.userNotes).toContain('nguồn tham chiếu');
  });

  it('formats the ready message from analysis stats', () => {
    expect(
      buildAdaptationAnalysisReadyMessage({
        chapterCount: 6,
        entityCount: 9,
        graphNodeCount: 12,
        graphEdgeCount: 22,
        communityCount: 3,
        embeddingCount: 18,
      }),
    ).toBe('Memory đã sẵn sàng: 6 chương, 9 entity defs, 18 embedding chunks.');
  });
});
