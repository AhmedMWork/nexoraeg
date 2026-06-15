// ============================================================
// NEXORA V5 — Supabase Client
// Public browser client only. Service-role operations stay inside
// Supabase Edge Functions and must never be exposed to the browser.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { requiredPublicEnv } from '@/lib/env';

export const supabaseUrl = requiredPublicEnv('VITE_SUPABASE_URL');
export const supabaseKey = requiredPublicEnv('VITE_SUPABASE_PUBLISHABLE_KEY');

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const STUDIO_TOKEN_KEY = 'nexora-studio-token-v5';
const STUDIO_ACCESS_KEY = 'nexora-studio-access-v5';
const STUDIO_EXPIRES_KEY = 'nexora-studio-expires-v5';

function hasSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function getStudioToken(): string | null {
  if (!hasSessionStorage()) return null;
  const token = sessionStorage.getItem(STUDIO_TOKEN_KEY);
  const expiresAt = Number(sessionStorage.getItem(STUDIO_EXPIRES_KEY) || 0);
  if (token && expiresAt && Date.now() > expiresAt) {
    clearStudioToken();
    return null;
  }
  return token;
}

export function setStudioToken(token: string, expiresAt?: string): void {
  if (!hasSessionStorage()) return;
  sessionStorage.setItem(STUDIO_TOKEN_KEY, token);
  sessionStorage.setItem(STUDIO_ACCESS_KEY, 'true');
  if (expiresAt) sessionStorage.setItem(STUDIO_EXPIRES_KEY, String(new Date(expiresAt).getTime()));
}

export function clearStudioToken(): void {
  if (!hasSessionStorage()) return;
  sessionStorage.removeItem(STUDIO_TOKEN_KEY);
  sessionStorage.removeItem(STUDIO_ACCESS_KEY);
  sessionStorage.removeItem(STUDIO_EXPIRES_KEY);
}

export async function createStudioSession(pin: string): Promise<string> {
  const cleanedPin = String(pin || '').trim();
  if (!cleanedPin) {
    throw new Error('Studio PIN is required.');
  }

  const { data, error } = await supabase.functions.invoke<{ token: string; expiresAt: string }>('verify-studio-access', {
    body: { pin: cleanedPin },
  });

  if (error || !data?.token) {
    throw new Error(error?.message || 'Could not open Studio session.');
  }

  setStudioToken(data.token, data.expiresAt);
  return data.token;
}

export async function ensureStudioToken(): Promise<string> {
  const existing = getStudioToken();
  if (existing) return existing;
  throw new Error('Studio session is locked or expired. Enter your Studio PIN again.');
}

export async function invokeStudioFunction<TPayload extends Record<string, unknown>, TResult>(
  name: string,
  payload: TPayload,
): Promise<TResult> {
  const token = await ensureStudioToken();

  const { data, error } = await supabase.functions.invoke<TResult>(name, {
    body: payload,
    headers: { 'x-studio-token': token },
  });

  if (error) {
    const maybeExpired = /unauthorized|jwt|token|401/i.test(error.message || '');
    if (maybeExpired) clearStudioToken();
    throw new Error(error.message || 'Studio request failed.');
  }
  return data as TResult;
}
