import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentSession = vi.hoisted(() => vi.fn());
const onAuthStateChange = vi.hoisted(() => vi.fn());
const signInWithEmailPassword = vi.hoisted(() => vi.fn());

vi.mock('../lib/supabase/auth_service', () => ({
  getCurrentSession,
  onAuthStateChange,
  signInWithEmailPassword,
  signInWithGoogle: vi.fn(),
  signUpWithEmailPassword: vi.fn(),
  signOut: vi.fn(),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

function createSession(userId: string) {
  return {
    user: {
      id: userId,
      email: `${userId}@example.com`,
    },
  };
}

describe('use_auth_store', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getCurrentSession.mockResolvedValue(null);
    onAuthStateChange.mockReturnValue({ unsubscribe: vi.fn() });
  });

  it('does not let a stale empty session overwrite a successful auth event', async () => {
    const deferredSession = createDeferred<null>();
    let authCallback: Parameters<typeof onAuthStateChange>[0] | null = null;

    getCurrentSession.mockReturnValue(deferredSession.promise);
    onAuthStateChange.mockImplementation((callback) => {
      authCallback = callback;
      return { unsubscribe: vi.fn() };
    });

    const { useAuthStore } = await import('./use_auth_store');

    useAuthStore.getState().initAuth();
    authCallback?.('SIGNED_IN', createSession('user-1'));
    deferredSession.resolve(null);
    await deferredSession.promise;

    expect(useAuthStore.getState()).toMatchObject({
      user: expect.objectContaining({ id: 'user-1' }),
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('sets the authenticated user after email login even if the auth listener is late', async () => {
    signInWithEmailPassword.mockResolvedValue({ error: null });
    getCurrentSession.mockResolvedValue(createSession('email-user'));

    const { useAuthStore } = await import('./use_auth_store');

    const result = await useAuthStore.getState().signInWithEmail('me@example.com', 'secret123');

    expect(result.error).toBeNull();
    expect(useAuthStore.getState()).toMatchObject({
      user: expect.objectContaining({ id: 'email-user' }),
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('clears stale authenticated state when init finds no session and no newer auth event arrived', async () => {
    const { useAuthStore } = await import('./use_auth_store');

    useAuthStore.setState({
      user: createSession('stale-user').user as never,
      isAuthenticated: true,
      isLoading: true,
    });

    useAuthStore.getState().initAuth();
    await Promise.resolve();

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('cleans up the auth subscription returned from initAuth', async () => {
    const unsubscribe = vi.fn();
    onAuthStateChange.mockReturnValue({ unsubscribe });

    const { useAuthStore } = await import('./use_auth_store');

    const cleanup = useAuthStore.getState().initAuth();
    cleanup();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
