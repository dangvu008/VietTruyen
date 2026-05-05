import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { Project } from '../../types/story';
import { buildCanonBundle, generateCanonBundleArchive } from './canon_bundle';

const SAMPLE_PROJECT: Project = {
  id: 'project-1',
  title: 'Long Thành Ký',
  status: 'ongoing',
  logline: 'Một kiếm khách trở lại cố hương để giải lời nguyền của gia tộc.',
  genre: 'Tiên hiệp',
  subGenre: ['Báo thù', 'Gia tộc'],
  writingStyle: 'Cổ phong',
  tone: 'Trầm, dồn nén',
  styleId: 'classic-1',
  targetChapters: 120,
  endgame: 'Phá lời nguyền và dựng lại Long Thành.',
  mainCharacterCount: 2,
  supportCharacterCount: 4,
  characterSetup: 'Nhân vật chính và tuyến phụ đều có ràng buộc huyết thống.',
  worldSetting: 'Một vùng đất cổ bị chia cắt bởi ba thế lực.',
  mainPlot: 'Truy tìm chân tướng vụ thảm sát Long Thành.',
  world: {
    geography: 'Long Thành nằm cạnh biển đen và dãy Tuyết Lĩnh.',
    magicSystem: 'Linh khí vận hành theo kinh mạch và huyết mạch.',
    techLevel: 'Cổ đại',
    currency: 'Linh thạch',
    factions: ['Huyết Các', 'Thiên Kiếm Môn'],
    rules: 'Ai phá huyết khế sẽ bị phản phệ.',
    facts: [{ id: 'wf-1', key: 'sea', value: 'Biển đen chỉ lộ đường vào lúc trăng đỏ.' }],
  },
  characters: [
    {
      id: 'char-linh',
      name: 'Linh',
      role: 'Chính',
      arc: 'Từ kẻ lưu vong thành người kế vị',
      currentStage: 'Đã biết bí mật huyết thống',
      traits: 'Điềm tĩnh, lì lợm',
      aliases: ['Linh công tử'],
      facts: [{ id: 'cf-1', key: 'weapon', value: 'Dùng đoạn kiếm bạc' }],
    },
    {
      id: 'char-khanh',
      name: 'Khánh',
      role: 'Đồng hành',
      arc: 'Từ gián điệp thành tri kỷ',
      currentStage: 'Đang che giấu thân phận',
      traits: 'Sắc sảo, kín tiếng',
    },
  ],
  outline: [
    { id: 'beat-1', title: 'Trở về Long Thành', summary: 'Linh quay lại quê cũ.', focus: 'Inciting incident' },
    { id: 'beat-2', title: 'Huyết khế thức tỉnh', summary: 'Bí mật gia tộc lộ diện.', focus: 'Revelation' },
  ],
  chapters: [
    {
      id: 'chapter-1',
      title: 'Mưa Trên Cổng Cũ',
      summary: 'Linh trở lại Long Thành và gặp Khánh.',
      content: 'Linh đứng dưới mưa trước cổng thành cũ. Khánh xuất hiện từ bóng tối.',
      sequenceNumber: 1,
      status: 'draft',
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T12:00:00.000Z',
      meta: {
        chapterId: 'chapter-1',
        chapterNumber: 1,
        coolPoints: [],
        microPayoffs: [],
        isTransition: false,
        generatedAt: '2026-05-01T12:00:00.000Z',
        ending: {
          time: 'Đêm đầu đông',
          location: 'Cổng nam Long Thành',
          emotion: 'Bất an',
        },
        timeConstraint: {
          timeAnchor: 'Đêm đầu đông',
          requiresTransition: false,
        },
        summary: {
          plotSummary: 'Linh trở lại Long Thành và bắt đầu điều tra.',
          characters: ['Linh', 'Khánh'],
          stateChanges: ['Linh xác nhận cổng thành đã bị niêm phong'],
          foreshadowing: [],
          bridgePoint: 'Một dấu ấn huyết khế phát sáng trên tường thành.',
        },
      },
    },
  ],
  foreshadowings: [
    {
      id: 'fs-1',
      description: 'Dấu ấn huyết khế phát sáng khi Linh chạm tường thành.',
      relatedEntityId: 'char-linh',
      isResolved: false,
      createdAt: '2026-05-01T12:00:00.000Z',
    },
  ],
  notes: 'Giữ nhịp kể chậm ở hồi đầu.',
  canonVersion: 3,
  storageMode: 'provider',
  arcCount: 2,
  hasGlobalIndex: true,
  createdAt: '2026-05-01T09:00:00.000Z',
  updatedAt: '2026-05-01T12:00:00.000Z',
};

describe('canon_bundle', () => {
  it('builds a hybrid canon package with markdown, json indexes, and graph data', () => {
    const bundle = buildCanonBundle(SAMPLE_PROJECT, {
      includeBible: true,
      includeWorld: true,
      includeCharacters: true,
      includeOutline: true,
      includeChapters: true,
      includeNotes: true,
    });

    expect(bundle.manifest.format).toBe('viettruyen-canon-v1');
    expect(bundle.manifest.stats.chapterCount).toBe(1);
    expect(bundle.manifest.stats.characterCount).toBe(2);
    expect(bundle.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        'README.md',
        'manifest.json',
        'data/project.snapshot.json',
        'canon/series-bible.md',
        'canon/world.md',
        'characters/01-linh.md',
        'chapters/001-mua-tren-cong-cu.md',
        'indexes/context-map.json',
        'indexes/graph.json',
      ]),
    );

    const chapterFile = bundle.files.find((file) => file.path === 'chapters/001-mua-tren-cong-cu.md');
    expect(chapterFile?.content).toContain('sequenceNumber: 1');
    expect(chapterFile?.content).toContain('characters: ["Linh","Khánh"]');
    expect(chapterFile?.content).toContain('bridgePoint: "Một dấu ấn huyết khế phát sáng trên tường thành."');
    expect(chapterFile?.content).toContain('Linh đứng dưới mưa trước cổng thành cũ.');

    const graphFile = bundle.files.find((file) => file.path === 'indexes/graph.json');
    expect(graphFile).toBeTruthy();
    const graph = JSON.parse(graphFile!.content) as {
      nodes: Array<{ id: string; type: string }>;
      edges: Array<{ type: string; from: string; to: string }>;
    };

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'project:project-1', type: 'project' }),
        expect.objectContaining({ id: 'character:char-linh', type: 'character' }),
        expect.objectContaining({ id: 'chapter:chapter-1', type: 'chapter' }),
      ]),
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'has_character', from: 'project:project-1', to: 'character:char-linh' }),
        expect.objectContaining({ type: 'mentions_character', from: 'chapter:chapter-1', to: 'character:char-khanh' }),
      ]),
    );
  });

  it('packages the canon bundle as a zip archive', async () => {
    const archive = await generateCanonBundleArchive(SAMPLE_PROJECT, {
      includeBible: true,
      includeWorld: true,
      includeCharacters: true,
      includeOutline: true,
      includeChapters: true,
      includeNotes: true,
    });

    const zip = await JSZip.loadAsync(await archive.arrayBuffer());
    const manifestText = await zip.file('manifest.json')?.async('text');
    const readmeText = await zip.file('README.md')?.async('text');
    const chapterText = await zip.file('chapters/001-mua-tren-cong-cu.md')?.async('text');

    expect(manifestText).toContain('"format": "viettruyen-canon-v1"');
    expect(readmeText).toContain('Markdown là nguồn đọc/chỉnh sửa chính cho người viết');
    expect(chapterText).toContain('title: "Mưa Trên Cổng Cũ"');
  });
});
