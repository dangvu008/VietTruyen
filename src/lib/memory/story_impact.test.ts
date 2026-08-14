import { describe, expect, it } from 'vitest';
import type { AttributeDependency } from '../../types/narrative_memory';
import type { NarrativeEdge, NarrativeNode } from '../../types/narrative_graph';
import { compileStoryImpact } from './story_impact';

const dependency = (
  chapterId: string,
  chapterIndex: number,
  importance: AttributeDependency['importance'],
  projectId = 'P001',
): AttributeDependency => ({
  id: `dep-${chapterId}-${projectId}`,
  chapterId,
  projectId,
  chapterIndex,
  entityId: 'luc-tram',
  entityType: 'character',
  attributeKey: 'age',
  importance,
  context: `Age reference in ${chapterId}`,
  snippets: [`${chapterId} says age`],
  dependencyStatus: 'fresh',
  confidence: 0.95,
  contentHash: `hash-${chapterId}`,
  createdAt: '2026-08-15T00:00:00Z',
  updatedAt: '2026-08-15T00:00:00Z',
});

const nodes: NarrativeNode[] = [
  { id: 'P001:character:luc-tram', projectId: 'P001', nodeType: 'character', refId: 'luc-tram', label: 'Lục Trầm', salience: 10, updatedAt: '2026-08-15T00:00:00Z' },
  { id: 'arc-1', projectId: 'P001', nodeType: 'arc', refId: 'arc-1', label: 'Thanh Khê', salience: 8, updatedAt: '2026-08-15T00:00:00Z' },
  { id: 'hook-1', projectId: 'P001', nodeType: 'foreshadowing', refId: 'hook-1', label: 'Bí mật Mộng Giới', salience: 7, updatedAt: '2026-08-15T00:00:00Z' },
  { id: 'noise-1', projectId: 'P001', nodeType: 'motif', refId: 'noise-1', label: 'Semantic-only noise', salience: 2, updatedAt: '2026-08-15T00:00:00Z' },
  { id: 'foreign-node', projectId: 'P002', nodeType: 'arc', refId: 'foreign', label: 'Foreign story', salience: 10, updatedAt: '2026-08-15T00:00:00Z' },
];

const edges: NarrativeEdge[] = [
  { id: 'edge-1', projectId: 'P001', fromNodeId: 'P001:character:luc-tram', toNodeId: 'arc-1', edgeType: 'dependency', weight: 1, evidenceChapterIds: ['ch-3'], updatedAt: '2026-08-15T00:00:00Z' },
  { id: 'edge-2', projectId: 'P001', fromNodeId: 'arc-1', toNodeId: 'hook-1', edgeType: 'foreshadow_link', weight: 0.9, evidenceChapterIds: ['ch-9'], updatedAt: '2026-08-15T00:00:00Z' },
  { id: 'edge-noise', projectId: 'P001', fromNodeId: 'P001:character:luc-tram', toNodeId: 'noise-1', edgeType: 'semantic_neighbor', weight: 0.99, evidenceChapterIds: [], updatedAt: '2026-08-15T00:00:00Z' },
  { id: 'foreign-edge', projectId: 'P002', fromNodeId: 'P001:character:luc-tram', toNodeId: 'foreign-node', edgeType: 'dependency', weight: 1, evidenceChapterIds: [], updatedAt: '2026-08-15T00:00:00Z' },
];

describe('storyImpact compiler', () => {
  it('combines chapter dependencies with bounded structural graph traversal', () => {
    const report = compileStoryImpact({
      projectId: 'P001', entityId: 'luc-tram', attributeKey: 'age',
      dependencies: [dependency('ch-3', 3, 'critical'), dependency('ch-9', 9, 'moderate')],
      nodes, edges, maxGraphDepth: 2,
    });
    expect(report.risk).toBe('high');
    expect(report.impactedChapters.map((chapter) => chapter.chapterId)).toEqual(['ch-3', 'ch-9']);
    expect(report.impactedGraphNodes.map((node) => node.nodeId)).toContain('arc-1');
    expect(report.impactedGraphNodes.map((node) => node.nodeId)).toContain('hook-1');
    expect(report.impactedGraphNodes.map((node) => node.nodeId)).not.toContain('noise-1');
    expect(report.impactedGraphNodes.map((node) => node.nodeId)).not.toContain('foreign-node');
  });

  it('filters dependencies before the effective chapter', () => {
    const report = compileStoryImpact({
      projectId: 'P001', entityId: 'luc-tram', attributeKey: 'age', effectiveFromChapter: 5,
      dependencies: [dependency('ch-3', 3, 'critical'), dependency('ch-9', 9, 'moderate')], nodes, edges,
    });
    expect(report.impactedChapters.map((chapter) => chapter.chapterId)).toEqual(['ch-9']);
  });

  it('rejects cross-project dependencies even if a caller supplies them', () => {
    const report = compileStoryImpact({
      projectId: 'P001', entityId: 'luc-tram',
      dependencies: [dependency('foreign-ch', 99, 'critical', 'P002')], nodes, edges,
    });
    expect(report.impactedChapters).toHaveLength(0);
  });
});
