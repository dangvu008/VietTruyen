import { describe, expect, it, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  };
  const from = vi.fn();
  return { chain, from };
});

vi.mock('../supabase/supabase_client', () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock('../supabase/sync_service', () => ({
  uploadProject: vi.fn(),
  downloadProjects: vi.fn(),
}));

vi.mock('../supabase/version_service', () => ({
  saveVersion: vi.fn(),
  listVersions: vi.fn(),
  getVersion: vi.fn(),
}));

import { OnlineStorageProvider } from './online_storage_provider';

describe('OnlineStorageProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue(mocks.chain);
    mocks.chain.select.mockReturnValue(mocks.chain);
    mocks.chain.eq.mockReturnValue(mocks.chain);
    mocks.chain.order.mockResolvedValue({ data: [], error: null });
  });

  it('falls back locally and suppresses immediate chapter read retries after RLS recursion', async () => {
    mocks.chain.order.mockResolvedValueOnce({
      data: null,
      error: {
        code: '42P17',
        message: 'infinite recursion detected in policy for relation "projects"',
        status: 500,
      },
    });

    const provider = new OnlineStorageProvider('user-1');

    await expect(provider.getProjectChapters('project-rls-recursion')).resolves.toEqual([]);
    await expect(provider.getProjectChapters('project-rls-recursion')).resolves.toEqual([]);

    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith('chapters');
  });
});
