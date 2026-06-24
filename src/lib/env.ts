// ============================================================
// NEXORA — Environment helpers
// Runtime-safe validation for browser public configuration.
// ============================================================

const INVALID_SUPABASE_URL_PARTS = ['/rest/v1', '/functions/v1', '/auth/v1'];

export function requiredPublicEnv(name: string): string {
  const value = import.meta.env[name];
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${name} is required. Add it to Vercel Environment Variables before deploying NEXORA.`);
  }
  const cleaned = value.trim();
  if (name === 'VITE_SUPABASE_URL') validateSupabaseUrl(cleaned);
  return cleaned;
}

export function optionalPublicEnv(name: string, fallback = ''): string {
  const value = import.meta.env[name];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

export function validateSupabaseUrl(value: string): void {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(value)) {
    const badPart = INVALID_SUPABASE_URL_PARTS.find((part) => value.includes(part));
    if (badPart) {
      throw new Error(`VITE_SUPABASE_URL must be the project root only, not a REST or Functions endpoint. Remove ${badPart}. Example: https://ccmuazjkgzjqzybxwrfd.supabase.co`);
    }
    if (/\/+$/.test(value)) return;
    throw new Error('VITE_SUPABASE_URL must look like https://YOUR_PROJECT_REF.supabase.co with no /rest/v1 or /functions/v1 suffix.');
  }
}

export function absoluteUrl(pathOrUrl: string, baseUrl: string): string {
  if (!pathOrUrl) return baseUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = baseUrl.replace(/\/$/, '');
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}
