import { describe, expect, it } from 'vitest';
import { buildGraphPack, buildRiskPack, buildSemanticPack, renderPackSection } from './retrieval_pack_builder';
import type { RelevantNarrativeCommunity } from './memory_query';
import type { MemorySearchHit } from '../../types/memory_embedding';
import type { PropagationTask } from '../../types/narrative_memory';

describe('retrieval_pack_builder', () => {
  it('builds graph and risk packs with structured titles and bodies', () => {
    const communities: RelevantNarrativeCommunity[] = [
      {
        community: {
          id: 'community-1',
          projectId: 'project-1',
          label: 'Lâm Tề / Bí cảnh',
          memberNodeIds: ['n1', 'n2'],
          centroidNodeIds: ['n1'],
          score: 18,
          algorithmVersion: 'v1',
          updatedAt: '2026-01-01',
        },
        score: 18,
        matchedSeedIds: ['n1'],
        nodes: [
          { id: 'n1', projectId: 'project-1', nodeType: 'character', refId: 'c1', label: 'Lâm Tề', salience: 8, updatedAt: '2026-01-01' },
          { id: 'n2', projectId: 'project-1', nodeType: 'scene', refId: 's1', label: 'Bí cảnh', salience: 6, updatedAt: '2026-01-01' },
        ],
      },
    ];
    const warnings: PropagationTask[] = [
      {
        id: 'task-1',
        projectId: 'project-1',
        canonicalEditId: 'edit-1',
        chapterId: 'ch-5',
        chapterIndex: 5,
        entityId: 'c1',
        attributeKey: 'stage',
        severity: 'warning',
        reason: 'Nhân vật đã lộ cảnh giới mới',
        recommendedAction: 'Không để nhân vật tự xưng ở cảnh giới cũ',
        dependencyContext: 'Các chương trước vẫn gọi là Luyện Khí',
        status: 'pending',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ];

    const graphPack = buildGraphPack(communities, 2);
    const riskPack = buildRiskPack(warnings, 2);

    expect(graphPack[0]?.title).toBe('Lâm Tề / Bí cảnh');
    expect(graphPack[0]?.body).toContain('Lâm Tề (character)');
    expect(riskPack[0]?.title).toContain('Ch.5');
    expect(riskPack[0]?.body).toContain('Không để nhân vật tự xưng ở cảnh giới cũ');
    expect(riskPack[0]?.body).toContain('Các chương trước vẫn gọi là Luyện Khí');
  });

  it('renders section text from packs and truncates semantic bodies when asked', () => {
    const semanticHits: MemorySearchHit[] = [
      {
        score: 0.91,
        record: {
          id: 'semantic-1',
          projectId: 'project-1',
          entityIds: [],
          arcIds: [],
          contentType: 'scene',
          sourceText: 'Sương mù dày đặc bao phủ lối đi rất dài dẫn đến cánh cổng đá cổ xưa ở cuối thung lũng.',
          sourceTextHash: 'hash-1',
          embedding: [],
          chapterIndex: 3,
          updatedAt: '2026-01-01',
        },
      },
    ];

    const semanticPack = buildSemanticPack(semanticHits, 1);
    const section = renderPackSection('## TRÍCH ĐOẠN', semanticPack, { bodyMaxChars: 50 });

    expect(semanticPack[0]?.body).toContain('[scene]');
    expect(section).toContain('## TRÍCH ĐOẠN');
    expect(section.length).toBeLessThan(90);
  });
});
