import { beforeEach, describe, expect, it, vi } from 'vitest';

const signInWithOAuth = vi.hoisted(() => vi.fn());
const signInWithPassword = vi.hoisted(() => vi.fn());
const signUp = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());
const onAuthStateChange = vi.hoisted(() => vi.fn());

vi.mock('./supabase_client', () => ({
  supabase: {
    auth: {
      signInWithOAuth,
      signInWithPassword,
      signUp,
      signOut,
      getSession,
      getUser,
      onAuthStateChange,
    },
  },
}));

import { signInWithGoogle, signUpWithEmailPassword } from './auth_service';

describe('auth_service signUpWithEmailPassword', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    signUp.mockReset();
  });

  it('omits emailRedirectTo for non-http browser origins', async () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'tauri://localhost',
      },
    });
    signUp.mockResolvedValue({ error: null });

    await signUpWithEmailPassword('user@gmail.com', 'secret123');

    expect(signUp).toHaveBeenCalledTimes(1);
    expect(signUp).toHaveBeenCalledWith({
      email: 'user@gmail.com',
      password: 'secret123',
    });
  });

  it('retries without emailRedirectTo when Supabase rejects the redirect-based flow', async () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://127.0.0.1:1420',
      },
    });
    signUp
      .mockResolvedValueOnce({ error: new Error('Requested function was not found') })
      .mockResolvedValueOnce({ error: null });

    const result = await signUpWithEmailPassword('user@gmail.com', 'secret123');

    expect(result.error).toBeNull();
    expect(signUp).toHaveBeenCalledTimes(2);
    expect(signUp).toHaveBeenNthCalledWith(1, {
      email: 'user@gmail.com',
      password: 'secret123',
      options: {
        emailRedirectTo: 'http://127.0.0.1:1420',
      },
    });
    expect(signUp).toHaveBeenNthCalledWith(2, {
      email: 'user@gmail.com',
      password: 'secret123',
    });
  });
});

describe('auth_service signInWithGoogle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    signInWithOAuth.mockReset();
  });

  it('uses the current browser origin as redirectTo when running on http', async () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://127.0.0.1:1420',
      },
    });
    signInWithOAuth.mockResolvedValue({ error: null });

    const result = await signInWithGoogle();

    expect(result.error).toBeNull();
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'http://127.0.0.1:1420',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
  });

  it('prefers VITE_AUTH_REDIRECT_URL when desktop origin is non-http', async () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'tauri://localhost',
      },
    });
    vi.stubEnv('VITE_AUTH_REDIRECT_URL', 'http://127.0.0.1:1420');
    signInWithOAuth.mockResolvedValue({ error: null });

    const result = await signInWithGoogle();

    expect(result.error).toBeNull();
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'http://127.0.0.1:1420',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
  });

  it('fails fast with a clear error when desktop origin has no valid HTTP callback', async () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'tauri://localhost',
      },
    });

    const result = await signInWithGoogle();

    expect(signInWithOAuth).not.toHaveBeenCalled();
    expect(result.error?.message).toContain('VITE_AUTH_REDIRECT_URL');
  });
});
