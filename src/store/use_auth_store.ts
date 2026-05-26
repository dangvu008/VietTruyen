/**
 * File: use_auth_store.ts
 * Purpose: Zustand store for authentication state management
 * Layer: Application (State)
 * Domain: Auth → [user session, login/logout state]
 *
 * Data Contract:
 * - Input:  Auth events from Supabase
 * - Output: user, isLoading, isAuthenticated
 * - Allowed Deps: supabase auth_service, zustand ONLY
 */

import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import {
  signInWithGoogle as googleSignIn,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  signOut as authSignOut,
  getCurrentSession,
  onAuthStateChange,
} from '../lib/supabase/auth_service';
import { traceStoryDebugEvent } from '../lib/debug/story_debug_trace';
import { flushAllDebouncedStorages } from '../lib/storage/debounced_local_storage';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  initAuth: () => () => void;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  signInAsGuest: () => void;
}

let activeAuthCleanup: (() => void) | null = null;
let authInitVersion = 0;

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  initAuth: () => {
    authInitVersion += 1;
    const initVersion = authInitVersion;
    let didReceiveAuthEvent = false;
    activeAuthCleanup?.();
    traceStoryDebugEvent({
      domain: 'auth',
      action: 'init.start',
      level: 'info',
      summary: 'Auth initialization started.',
      details: { initVersion },
    });

    // Check existing session on app load
    getCurrentSession()
      .then((session) => {
        if (initVersion !== authInitVersion) return;

        const user = session?.user ?? null;
        traceStoryDebugEvent({
          domain: 'auth',
          action: 'init.session_loaded',
          level: 'info',
          summary: user ? 'Existing auth session loaded.' : 'No existing auth session found.',
          details: {
            initVersion,
            userId: user?.id ?? null,
            email: user?.email ?? null,
          },
        });
        set(() => {
          if (!user && didReceiveAuthEvent) {
            return { isLoading: false };
          }

          return {
            user,
            isAuthenticated: !!user,
            isLoading: false,
          };
        });
      })
      .catch((error) => {
        if (initVersion !== authInitVersion) return;
        console.error('[Auth] Session init failed:', error);
        traceStoryDebugEvent({
          domain: 'auth',
          action: 'init.failed',
          level: 'error',
          summary: 'Auth session initialization failed.',
          details: { initVersion, error },
        });
        set({ user: null, isAuthenticated: false, isLoading: false });
      });

    // Listen for auth changes (login, logout, token refresh)
    const subscription = onAuthStateChange((event, session) => {
      if (initVersion !== authInitVersion) return;
      didReceiveAuthEvent = true;

      const user = session?.user ?? null;
      traceStoryDebugEvent({
        domain: 'auth',
        action: 'state.change',
        level: 'info',
        summary: `Auth state changed: ${event}.`,
        details: {
          initVersion,
          event,
          userId: user?.id ?? null,
          email: user?.email ?? null,
          hasSession: Boolean(session),
        },
      });
      set({
        user,
        isAuthenticated: !!user,
        isLoading: false,
      });
    });

    activeAuthCleanup = () => {
      subscription.unsubscribe();
      if (initVersion === authInitVersion) {
        activeAuthCleanup = null;
      }
    };

    return activeAuthCleanup;
  },

  signInWithGoogle: async () => {
    set({ isLoading: true });
    traceStoryDebugEvent({
      domain: 'auth',
      action: 'signin.google.start',
      level: 'info',
      summary: 'Google sign-in started.',
    });
    // [Domain:Auth] Flush all debounced localStorage writes BEFORE redirect.
    // OAuth redirect navigates away immediately — if debounced writes haven't
    // flushed yet, project data is lost and only the seed project remains after
    // the redirect returns.
    flushAllDebouncedStorages();
    const { error } = await googleSignIn();
    if (error) {
      console.error('[Auth] Google sign-in failed:', error.message);
      traceStoryDebugEvent({
        domain: 'auth',
        action: 'signin.google.failed',
        level: 'error',
        summary: 'Google sign-in failed.',
        details: { error },
      });
      set({ isLoading: false });
    } else {
      traceStoryDebugEvent({
        domain: 'auth',
        action: 'signin.google.redirect',
        level: 'info',
        summary: 'Google sign-in accepted; waiting for auth redirect/state change.',
      });
    }
    // Redirect will happen — state updates via onAuthStateChange
    return { error };
  },

  signInWithEmail: async (email, password) => {
    set({ isLoading: true });
    traceStoryDebugEvent({
      domain: 'auth',
      action: 'signin.email.start',
      level: 'info',
      summary: 'Email sign-in started.',
      details: { email },
    });
    const { error } = await signInWithEmailPassword(email, password);
    if (error) {
      traceStoryDebugEvent({
        domain: 'auth',
        action: 'signin.email.failed',
        level: 'error',
        summary: 'Email sign-in failed.',
        details: { email, error },
      });
      set({ isLoading: false });
    } else {
      const session = await getCurrentSession();
      const user = session?.user ?? null;
      traceStoryDebugEvent({
        domain: 'auth',
        action: 'signin.email.success',
        level: 'info',
        summary: 'Email sign-in succeeded and session was loaded.',
        details: { userId: user?.id ?? null, email: user?.email ?? email },
      });
      set({
        user,
        isAuthenticated: !!user,
        isLoading: false,
      });
    }
    return { error };
  },

  signUpWithEmail: async (email, password) => {
    set({ isLoading: true });
    traceStoryDebugEvent({
      domain: 'auth',
      action: 'signup.email.start',
      level: 'info',
      summary: 'Email sign-up started.',
      details: { email },
    });
    const { error } = await signUpWithEmailPassword(email, password);
    if (error) {
      traceStoryDebugEvent({
        domain: 'auth',
        action: 'signup.email.failed',
        level: 'error',
        summary: 'Email sign-up failed.',
        details: { email, error },
      });
      set({ isLoading: false });
    } else {
      traceStoryDebugEvent({
        domain: 'auth',
        action: 'signup.email.success',
        level: 'info',
        summary: 'Email sign-up request succeeded.',
        details: { email },
      });
      // If sign up doesn't immediately log in (e.g. requires email confirmation), reset loading
      set({ isLoading: false });
    }
    return { error };
  },

  signOut: async () => {
    set({ isLoading: true });
    traceStoryDebugEvent({
      domain: 'auth',
      action: 'signout.start',
      level: 'info',
      summary: 'Sign-out started.',
      details: { userId: useAuthStore.getState().user?.id ?? null },
    });
    const { error } = await authSignOut();
    if (error) {
      console.error('[Auth] Sign-out failed:', error.message);
      traceStoryDebugEvent({
        domain: 'auth',
        action: 'signout.failed',
        level: 'error',
        summary: 'Sign-out failed.',
        details: { error },
      });
    } else {
      traceStoryDebugEvent({
        domain: 'auth',
        action: 'signout.success',
        level: 'info',
        summary: 'Sign-out completed; debug trace remains in localStorage.',
      });
    }
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  signInAsGuest: () => {
    const guestUser = {
      id: 'guest',
      email: 'guest@viettruyen.local',
      user_metadata: { full_name: 'Khách' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as any;

    traceStoryDebugEvent({
      domain: 'auth',
      action: 'signin.guest.success',
      level: 'info',
      summary: 'Logged in as guest user (local bypass).',
    });

    set({
      user: guestUser,
      isAuthenticated: true,
      isLoading: false,
    });
  },
}));
