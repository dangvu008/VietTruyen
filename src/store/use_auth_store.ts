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
  signOut as authSignOut,
  getCurrentSession,
  onAuthStateChange,
} from '../lib/supabase/auth_service';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean; // Guest mode — uses app without login / no cloud sync

  // Actions
  initAuth: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isGuest: false,

  initAuth: () => {
    // Check existing session on app load
    getCurrentSession().then((session) => {
      set({
        user: session?.user ?? null,
        isAuthenticated: !!session?.user,
        isLoading: false,
      });
    });

    // Listen for auth changes (login, logout, token refresh)
    onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      set({
        user,
        isAuthenticated: !!user,
        isGuest: false,
        isLoading: false,
      });
    });
  },

  signInWithGoogle: async () => {
    set({ isLoading: true });
    const { error } = await googleSignIn();
    if (error) {
      console.error('[Auth] Google sign-in failed:', error.message);
      set({ isLoading: false });
    }
    // Redirect will happen — state updates via onAuthStateChange
  },

  signOut: async () => {
    set({ isLoading: true });
    const { error } = await authSignOut();
    if (error) {
      console.error('[Auth] Sign-out failed:', error.message);
    }
    set({
      user: null,
      isAuthenticated: false,
      isGuest: false,
      isLoading: false,
    });
  },

  continueAsGuest: () => {
    set({
      isGuest: true,
      isLoading: false,
      isAuthenticated: false,
      user: null,
    });
  },
}));
