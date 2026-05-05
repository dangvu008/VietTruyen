import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.hoisted(() => vi.fn());
const eq = vi.hoisted(() => vi.fn());
const deleteFn = vi.hoisted(() => vi.fn());
const insert = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());

vi.mock('./supabase_client', () => ({
  supabase: {
    auth: {
      getSession,
    },
    from,
  },
}));

describe('memory_embedding_service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('VITEST', '');

    getSession.mockResolvedValue({
      data: {
        session: { access_token: 'token' },
      },
    });

    eq.mockResolvedValue({ error: null });
    deleteFn.mockReturnValue({ eq });
    insert.mockResolvedValue({ error: null });
    from.mockReturnValue({
      delete: deleteFn,
      insert,
    });
  });

  it('skips remote mirror when there is no authenticated session', async () => {
    getSession.mockResolvedValue({
      data: {
        session: null,
      },
    });

    const { mirrorProjectMemoryEmbeddings } = await import('./memory_embedding_service');

    await mirrorProjectMemoryEmbeddings('project-1', []);

    expect(from).not.toHaveBeenCalled();
  });

  it('disables remote mirror after schema/RLS failures to prevent repeated console spam', async () => {
    eq.mockResolvedValueOnce({
      error: {
        status: 404,
        code: 'PGRST205',
        message: "Could not find the table 'public.memory_embeddings' in the schema cache",
      },
    });

    const { mirrorProjectMemoryEmbeddings } = await import('./memory_embedding_service');

    await mirrorProjectMemoryEmbeddings('project-1', []);
    await mirrorProjectMemoryEmbeddings('project-1', []);

    expect(from).toHaveBeenCalledTimes(1);
  });
});
