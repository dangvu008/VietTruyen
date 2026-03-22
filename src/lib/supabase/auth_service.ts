/**
 * File: auth_service.ts
 * Purpose: Google OAuth authentication via Supabase
 * Layer: Infrastructure (Auth)
 * Domain: Auth → [signIn, signOut, onAuthStateChange]
 *
 * Data Contract:
 * - Input:  Google OAuth redirect
 * - Output: User session | null
 * - Allowed Deps: supabase_client ONLY
 */

import { supabase } from './supabase_client';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

// ─── Sign in with Google OAuth ─────────────────────────────
export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  return { error: error ? new Error(error.message) : null };
}

// ─── Sign out ──────────────────────────────────────────────
export async function signOut(): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signOut();
  return { error: error ? new Error(error.message) : null };
}

// ─── Get current session ───────────────────────────────────
export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ─── Get current user ──────────────────────────────────────
export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

// ─── Listen for auth state changes ─────────────────────────
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return data.subscription;
}
