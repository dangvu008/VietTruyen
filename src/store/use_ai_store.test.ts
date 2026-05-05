import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const getUser = vi.fn();
  const from = vi.fn();
  return { getUser, from };
});

vi.mock('../lib/supabase/supabase_client', () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  },
}));

function createStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

function buildQueryResult<T>(data: T) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(async () => ({ data, error: null })),
        })),
        limit: vi.fn(async () => ({ data, error: null })),
      })),
    })),
  };
}

describe('use_ai_store', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', createStorageMock());
  });

  it('fetches subscription safely when token_usage row for current month does not exist', async () => {
    mocks.getUser.mockResolvedValue({
      data: {
        user: { id: 'user-1' },
      },
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'subscriptions') {
        return buildQueryResult([{ tier: 'pro', status: 'active' }]);
      }
      if (table === 'token_usage') {
        return buildQueryResult([]);
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const { useAiStore } = await import('./use_ai_store');

    await useAiStore.getState().fetchSubscription();

    expect(useAiStore.getState().subscription).toMatchObject({
      tier: 'pro',
      status: 'active',
      tokensUsed: 0,
      tokensLimit: 50000,
    });
  });
});
