import { describe, expect, it } from 'vitest';
import type { ChapterMetadata, AttributeDependency, CanonicalEdit, PropagationTask } from '../../types/narrative_memory';
import type { Arc, Project } from '../../types/story';
import { buildNarrativeGraph, buildNarrativeNodeId } from './narrative_graph_builder';

function makeProject(): Project {
  return {
    id: 'project-graph',
    title: 'Đấu Phá',
    logline: '',
    genre: 'Tiên hiệp',
    subGenre: [],
    writingStyle: '',
    tone: '',
    styleId: 'tien-hiep',
    targetChapters: 100,
    endgame: '',
    mainCharacterCount: 2,
    supportCharacterCount: 1,
    characterSetup: '',
    worldSetting: '',
    mainPlot: '',
    world: {
      geography: 'Gia Mã đế quốc',
      magicSystem: 'Đấu khí',
      techLevel: 'Cổ đại',
      currency: 'Kim tệ',
      factions: ['Vân Lam Tông'],
      rules: 'Cường giả vi tôn',
      facts: [],
    },
    characters: [
      {
        id: 'char_1',
        name: 'Tiêu Viêm',
        role: 'Chính',
        arc: '',
        currentStage: 'Đấu Giả',
        traits: 'Lì lợm',
        aliases: ['Tiêu thiếu gia'],
        facts: [],
      },
      {
        id: 'char_2',
        name: 'Dược Lão',
        role: 'Sư phụ',
        arc: '',
        currentStage: 'Linh hồn',
        traits: 'Lão luyện',
        aliases: [],
        facts: [],
      },
    ],
    outline: [
      {
        id: 'beat-1',
        title: 'Khởi đầu hành trình',
        summary: 'Tiêu Viêm gặp Dược Lão và chuẩn bị rời đi.',
        focus: 'Tiêu Viêm',
      },
      {
        id: 'beat-2',
        title: 'Rời khỏi gia tộc',
        summary: 'Dược Lão nhắc lại lời hẹn.',
        focus: 'Dược Lão',
      },
    ],
    chapters: [
      {
        id: 'ch_1',
        title: 'Chương 1',
        summary: 'Tiêu Viêm gặp Dược Lão tại Gia Mã đế quốc.',
        content: 'Tiêu Viêm và Dược Lão cùng nói về Vân Lam Tông.',
        sequenceNumber: 1,
        status: 'draft',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'ch_2',
        title: 'Chương 2',
        summary: 'Dược Lão nhắc lại lời hẹn.',
        content: 'Tiêu Viêm chuẩn bị rời đi.',
        sequenceNumber: 2,
        status: 'draft',
        createdAt: '2026-01-02',
        updatedAt: '2026-01-02',
      },
    ],
    foreshadowings: [
      {
        id: 'f_1',
        description: 'Dược Lão đã từng nợ Tiêu gia một ân tình lớn.',
        relatedEntityId: 'char_2',
        isResolved: false,
        createdAt: '2026-01-01',
      },
    ],
    notes: '',
    canonVersion: 1,
    storageMode: 'indexeddb',
    arcCount: 1,
    hasGlobalIndex: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-02',
  };
}

describe('narrative_graph_builder', () => {
  it('builds nodes, edges, and communities from narrative memory signals', () => {
    const project = makeProject();
    const metadata: ChapterMetadata[] = [
      {
        chapterId: 'ch_1',
        projectId: project.id,
        chapterIndex: 1,
        contentHash: 'hash-1',
        warnings: [],
        entityRefs: [
          {
            entityId: 'char_1',
            entityName: 'Tiêu Viêm',
            entityType: 'character',
            attributeKeys: ['name'],
            importance: 'critical',
            context: 'Tiêu Viêm xuất hiện',
          },
          {
            entityId: 'char_2',
            entityName: 'Dược Lão',
            entityType: 'character',
            attributeKeys: ['name'],
            importance: 'critical',
            context: 'Dược Lão xuất hiện',
          },
        ],
        extractorVersion: 'memory-v1',
        extractedAt: '2026-01-01',
      },
    ];
    const dependencies: AttributeDependency[] = [
      {
        id: 'dep-1',
        chapterId: 'ch_1',
        projectId: project.id,
        chapterIndex: 1,
        entityId: 'char_1',
        entityType: 'character',
        attributeKey: 'name',
        importance: 'critical',
        context: 'Tiêu Viêm xuất hiện',
        snippets: ['Tiêu Viêm'],
        dependencyStatus: 'fresh',
        confidence: 1,
        contentHash: 'hash-1',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ];
    const arcs: Arc[] = [
      {
        id: 'arc-1',
        projectId: project.id,
        index: 0,
        label: 'Arc 1',
        title: 'Khởi đầu',
        chapterStart: 1,
        chapterEnd: 2,
        chapterIds: ['ch_1', 'ch_2'],
        summary: '',
        premise: '',
        escalation: '',
        climax: '',
        exitState: '',
        unresolvedDebts: [],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-02',
      },
    ];
    const canonicalEdits: CanonicalEdit[] = [
      {
        id: 'edit-1',
        projectId: project.id,
        entityId: 'char_2',
        entityType: 'character',
        attributeKey: 'status',
        oldValue: 'ẩn cư',
        newValue: 'lộ diện',
        effectiveFromChapter: 2,
        reason: 'Dược Lão xuất hiện công khai',
        sourceType: 'canonical_edit',
        confidence: 1,
        propagationStatus: 'pending',
        createdAt: '2026-01-02',
      },
    ];
    const propagationTasks: PropagationTask[] = [
      {
        id: 'task-1',
        projectId: project.id,
        canonicalEditId: 'edit-1',
        chapterId: 'ch_2',
        chapterIndex: 2,
        entityId: 'char_2',
        attributeKey: 'status',
        severity: 'warning',
        reason: 'Cần cập nhật tình trạng nhân vật',
        recommendedAction: 'Kiểm tra lời thoại',
        dependencyContext: 'Dược Lão đã lộ diện',
        status: 'pending',
        createdAt: '2026-01-02',
        updatedAt: '2026-01-02',
      },
    ];

    const graph = buildNarrativeGraph({
      project,
      arcs,
      metadata,
      dependencies,
      canonicalEdits,
      propagationTasks,
    });

    const char1NodeId = buildNarrativeNodeId(project.id, 'character', 'char_1');
    const char2NodeId = buildNarrativeNodeId(project.id, 'character', 'char_2');
    const beatNodeId = buildNarrativeNodeId(project.id, 'beat', 'beat:0');
    const sceneNodeId = buildNarrativeNodeId(project.id, 'scene', 'ch_1:scene:0');
    const retconNodeId = buildNarrativeNodeId(project.id, 'retcon_event', 'edit-1');

    expect(graph.nodes.some((node) => node.id === char1NodeId)).toBe(true);
    expect(graph.nodes.some((node) => node.id === beatNodeId)).toBe(true);
    expect(graph.nodes.some((node) => node.id === sceneNodeId)).toBe(true);
    expect(graph.nodes.some((node) => node.id === retconNodeId)).toBe(true);
    expect(
      graph.edges.some(
        (edge) =>
          edge.edgeType === 'co_presence' &&
          [edge.fromNodeId, edge.toNodeId].includes(char1NodeId) &&
          [edge.fromNodeId, edge.toNodeId].includes(char2NodeId) &&
          edge.weight === 5
      )
    ).toBe(true);
    expect(graph.edges.some((edge) => edge.edgeType === 'foreshadow_link')).toBe(true);
    expect(graph.edges.some((edge) => edge.edgeType === 'canonical_impact')).toBe(true);
    expect(graph.edges.some((edge) => edge.edgeType === 'scene_membership')).toBe(true);
    expect(graph.edges.some((edge) => edge.edgeType === 'beat_alignment')).toBe(true);
    expect(graph.edges.some((edge) => edge.edgeType === 'retcon_targets')).toBe(true);
    expect(graph.edges.some((edge) => edge.edgeType === 'continuity_risk')).toBe(true);
    expect(graph.communities.some((community) => community.memberNodeIds.includes(char1NodeId) && community.memberNodeIds.includes(char2NodeId))).toBe(true);
  });
});
