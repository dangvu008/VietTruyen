import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const responses: Array<{ data: unknown; error: unknown }> = [];
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    in: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  };
  const from = vi.fn();

  return {
    responses,
    builder,
    from,
  };
});

vi.mock('./supabase_client', () => ({
  supabase: {
    from: mocks.from,
  },
}));

import { getVersion, saveVersion, selectVersionsToKeep } from './version_service';

function queueResponse(data: unknown, error: unknown = null) {
  mocks.responses.push({ data, error });
}

describe('version_service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.responses.length = 0;

    const nextResponse = () => Promise.resolve(mocks.responses.shift() ?? { data: null, error: null });

    mocks.from.mockReturnValue(mocks.builder);
    mocks.builder.select.mockReturnValue(mocks.builder);
    mocks.builder.eq.mockReturnValue(mocks.builder);
    mocks.builder.order.mockReturnValue(mocks.builder);
    mocks.builder.limit.mockReturnValue(mocks.builder);
    mocks.builder.insert.mockReturnValue(mocks.builder);
    mocks.builder.in.mockReturnValue(mocks.builder);
    mocks.builder.maybeSingle.mockImplementation(nextResponse);
    mocks.builder.single.mockImplementation(nextResponse);
  });

  it('creates version 1 when no prior chapter_versions row exists', async () => {
    queueResponse(null, null);
    queueResponse({
      id: 'version-1',
      chapter_id: 'chapter-1',
      project_id: 'project-1',
      version_number: 1,
      title: 'Chương 1',
      content: 'Nội dung mới',
      summary: null,
      word_count: 3,
      author_id: 'user-1',
      change_note: null,
      created_at: '2026-05-04T00:00:00.000Z',
    });

    const version = await saveVersion(
      'chapter-1',
      'project-1',
      'user-1',
      'Nội dung mới',
      'Chương 1',
    );

    expect(version.version_number).toBe(1);
    expect(mocks.builder.maybeSingle).toHaveBeenCalled();
    expect(mocks.builder.insert).toHaveBeenCalledOnce();
  });

  it('returns null when a requested version row does not exist', async () => {
    queueResponse(null, null);

    await expect(getVersion('missing-version')).resolves.toBeNull();
  });
});

describe('selectVersionsToKeep', () => {
  function makeVersion(id: string, versionNumber: number, daysAgo: number) {
    const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    return { id, version_number: versionNumber, created_at: date.toISOString() };
  }

  it('keeps all versions when count <= KEEP_LATEST (5)', () => {
    const versions = [
      makeVersion('a', 3, 0),
      makeVersion('b', 2, 1),
      makeVersion('c', 1, 2),
    ];
    const keep = selectVersionsToKeep(versions);
    expect(keep.size).toBe(3);
  });

  it('always keeps version 1 even when very old', () => {
    const versions = [
      makeVersion('v10', 10, 0),
      makeVersion('v9', 9, 0),
      makeVersion('v8', 8, 0),
      makeVersion('v7', 7, 1),
      makeVersion('v6', 6, 1),
      makeVersion('v5', 5, 2),
      makeVersion('v4', 4, 3),
      makeVersion('v3', 3, 60),
      makeVersion('v2', 2, 90),
      makeVersion('v1', 1, 365),
    ];
    const keep = selectVersionsToKeep(versions);
    expect(keep.has('v1')).toBe(true);
  });

  it('always keeps the latest 5 versions regardless of age', () => {
    const versions = [
      makeVersion('v8', 8, 0),
      makeVersion('v7', 7, 0),
      makeVersion('v6', 6, 0),
      makeVersion('v5', 5, 0),
      makeVersion('v4', 4, 0),
      makeVersion('v3', 3, 1),
      makeVersion('v2', 2, 2),
      makeVersion('v1', 1, 3),
    ];
    const keep = selectVersionsToKeep(versions);
    expect(keep.has('v8')).toBe(true);
    expect(keep.has('v7')).toBe(true);
    expect(keep.has('v6')).toBe(true);
    expect(keep.has('v5')).toBe(true);
    expect(keep.has('v4')).toBe(true);
  });

  it('keeps 1 per day within 30-day window, pruning same-day duplicates', () => {
    // 10 versions all on "today" — keep latest 5 + the highest version for today's date
    const versions = Array.from({ length: 10 }, (_, i) =>
      makeVersion(`v${10 - i}`, 10 - i, 0),
    );
    // Add version 1 far in the past
    versions.push(makeVersion('v-orig', 1, 200));

    const keep = selectVersionsToKeep(versions);
    // latest 5 (v10..v6) + v1 original + 1 daily representative (v10, already in latest 5)
    // + 1 monthly for the 200-day-ago month
    // So pruned: v5, v4, v3, v2
    expect(keep.has('v5')).toBe(false);
    expect(keep.has('v4')).toBe(false);
    expect(keep.has('v3')).toBe(false);
    expect(keep.has('v2')).toBe(false);
    expect(keep.has('v-orig')).toBe(true);
  });

  it('keeps 1 per month beyond the 30-day window', () => {
    const versions = [
      makeVersion('recent', 20, 0),
      makeVersion('r2', 19, 1),
      makeVersion('r3', 18, 2),
      makeVersion('r4', 17, 3),
      makeVersion('r5', 16, 4),
      // Beyond 30 days — two versions in same month (use large gap to guarantee same month)
      makeVersion('old-a', 5, 35),
      makeVersion('old-b', 4, 37),
      // A clearly different month
      makeVersion('older-a', 3, 140),
      makeVersion('older-b', 2, 145),
      makeVersion('v1', 1, 365),
    ];
    const keep = selectVersionsToKeep(versions);

    // Latest 5: recent, r2, r3, r4, r5
    // Version 1: v1
    // Monthly: old-a (higher version), older-a (higher version)
    expect(keep.has('old-a')).toBe(true);
    expect(keep.has('old-b')).toBe(false);
    expect(keep.has('older-a')).toBe(true);
    expect(keep.has('older-b')).toBe(false);
  });

  it('handles aggressive editing scenario: 50 versions in 1 day', () => {
    const versions = Array.from({ length: 50 }, (_, i) =>
      makeVersion(`v${50 - i}`, 50 - i, 0),
    );
    versions.push(makeVersion('v1', 1, 100));

    const keep = selectVersionsToKeep(versions);
    // Should keep: latest 5 (v50..v46) + v1 + daily rep (v50, already in latest 5) + monthly rep for v1's month
    // Everything else pruned
    const pruned = versions.filter((v) => !keep.has(v.id));
    expect(pruned.length).toBeGreaterThanOrEqual(44);
    expect(keep.has('v50')).toBe(true);
    expect(keep.has('v1')).toBe(true);
  });
});
