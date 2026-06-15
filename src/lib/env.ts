// ============================================================
// NEXORA V5 — Environment helpers
// Runtime-safe validation for browser public configuration.
// ============================================================

export function requiredPublicEnv(name: string): string {
  const value = import.meta.env[name];
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${name} is required. Add it to Vercel Environment Variables before deploying NEXORA.`);
  }
  return value.trim();
}

export function optionalPublicEnv(name: string, fallback = ''): string {
  const value = import.meta.env[name];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

export function absoluteUrl(pathOrUrl: string, baseUrl: string): string {
  if (!pathOrUrl) return baseUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = baseUrl.replace(/\/$/, '');
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}
