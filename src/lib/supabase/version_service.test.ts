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

import { getVersion, saveVersion } from './version_service';

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
