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

const DESKTOP_GOOGLE_AUTH_UNSUPPORTED_MESSAGE =
  'Đăng nhập Google hiện chưa được hỗ trợ trong ứng dụng desktop. Hãy dùng đăng nhập email, chế độ khách, hoặc mở bản web để dùng Google OAuth.';

function getBrowserOrigin(): string | null {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return null;
  }

  return window.location.origin;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || window.location?.protocol === 'tauri:');
}

function isHttpOrigin(value: string | null | undefined): value is string {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function getConfiguredAuthRedirectTo(): string | undefined {
  const envRedirect = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();
  if (isHttpOrigin(envRedirect)) {
    return envRedirect;
  }

  const origin = getBrowserOrigin();
  if (isHttpOrigin(origin)) {
    return origin;
  }

  return undefined;
}

function getSafeEmailRedirectTo(): string | undefined {
  return getConfiguredAuthRedirectTo();
}

function shouldRetrySignUpWithoutRedirect(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('requested function was not found')
    || message.includes('redirect_to')
    || message.includes('redirect not allowed')
    || message.includes('invalid redirect')
  );
}

// ─── Sign in with Google OAuth ─────────────────────────────
export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  if (isTauriRuntime()) {
    return {
      error: new Error(DESKTOP_GOOGLE_AUTH_UNSUPPORTED_MESSAGE),
    };
  }

  const redirectTo = getConfiguredAuthRedirectTo();
  const origin = getBrowserOrigin();

  if (!redirectTo && origin) {
    return {
      error: new Error(
        'Google OAuth trong desktop mode cần callback HTTP hợp lệ. Hãy cấu hình `VITE_AUTH_REDIRECT_URL` hoặc chạy app qua dev server web.'
      ),
    };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      ...(redirectTo ? { redirectTo } : {}),
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  return { error: error ? new Error(error.message) : null };
}

// ─── Sign in with Email / Password ─────────────────────────
export async function signInWithEmailPassword(email: string, password: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { error: error ? new Error(error.message) : null };
}

// ─── Sign up with Email / Password ─────────────────────────
export async function signUpWithEmailPassword(email: string, password: string): Promise<{ error: Error | null }> {
  const emailRedirectTo = getSafeEmailRedirectTo();

  const primaryAttempt = await supabase.auth.signUp({
    email,
    password,
    ...(emailRedirectTo ? {
      options: {
        emailRedirectTo,
      },
    } : {}),
  });

  let error = primaryAttempt.error;
  if (error && emailRedirectTo && shouldRetrySignUpWithoutRedirect(new Error(error.message))) {
    const fallbackAttempt = await supabase.auth.signUp({
      email,
      password,
    });
    error = fallbackAttempt.error;
  }

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
