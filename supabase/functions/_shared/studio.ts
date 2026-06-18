import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

function requestOrigin(req?: Request) {
  return req?.headers.get('origin') || '';
}

function allowedOrigin(req?: Request) {
  const configured = (Deno.env.get('ALLOWED_ORIGIN') || '').split(',').map((v) => v.trim()).filter(Boolean);
  const origin = requestOrigin(req);
  if (!configured.length) return '*';
  if (origin && configured.includes(origin)) return origin;
  return configured[0] || '*';
}

export function cors(req?: Request) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin(req),
    'Vary': 'Origin',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-studio-token, x-nexora-client, x-supabase-api-version, accept, origin, prefer',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

export const corsHeaders = cors();

export function json(data: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors(req),
      'Content-Type': 'application/json',
    },
  });
}

function normalizeSupabaseUrl(raw: string) {
  const cleaned = raw.trim().replace(/\/$/, '');
  try {
    const parsed = new URL(cleaned);
    if (!parsed.hostname.endsWith('.supabase.co')) return cleaned;
    // Supabase auto secrets should be the project root, but some projects
    // accidentally save /rest/v1 or /functions/v1. Normalize instead of
    // breaking every Edge Function.
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return cleaned;
  }
}

export function serviceClient() {
  const rawUrl = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const url = normalizeSupabaseUrl(rawUrl);

  if (!url) throw new Error('Missing SUPABASE_URL secret.');
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY secret.');

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

export function clientId(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
}

export function rateLimit(req: Request, key: string, limit = 20, windowMs = 1000 * 60 * 10) {
  const id = `${key}:${clientId(req)}`;
  const now = Date.now();
  const current = memoryBuckets.get(id);
  if (!current || current.resetAt < now) {
    memoryBuckets.set(id, { count: 1, resetAt: now + windowMs });
    return null;
  }
  current.count += 1;
  memoryBuckets.set(id, current);
  if (current.count > limit) {
    return json({ error: 'Too many requests. Please try again later.' }, 429, req);
  }
  return null;
}

export async function auditLog(action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  try {
    const supabase = serviceClient();
    await supabase.from('audit_logs').insert({
      admin_email: 'studio@nexora.local',
      action,
      entity_type: entityType,
      entity_id: entityId,
      after: metadata,
    });
  } catch {
    // Audit must not break critical store operations.
  }
}

async function hmacSHA256(message: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));

  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlEncode(value: unknown) {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  );

  return JSON.parse(atob(padded));
}

function sessionSecret() {
  const secret = Deno.env.get('STUDIO_SESSION_SECRET');
  if (!secret || secret.length < 24) throw new Error('Missing or weak STUDIO_SESSION_SECRET secret.');
  return secret;
}

export async function createStudioToken() {
  const expiresAt = Date.now() + 1000 * 60 * 60 * 4;

  const payload = base64UrlEncode({
    scope: 'studio',
    exp: expiresAt,
    iat: Date.now(),
  });

  const signature = await hmacSHA256(payload, sessionSecret());

  return {
    token: `${payload}.${signature}`,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

export async function verifyStudioToken(req: Request) {
  const token = req.headers.get('x-studio-token') || '';
  const [payload, signature] = token.split('.');

  if (!payload || !signature) return false;

  const expected = await hmacSHA256(payload, sessionSecret());
  if (expected !== signature) return false;

  try {
    const data = base64UrlDecode(payload);
    return data.scope === 'studio' && Date.now() < Number(data.exp || 0);
  } catch {
    return false;
  }
}

export async function requireStudio(req: Request) {
  if (!(await verifyStudioToken(req))) {
    return json({ error: 'Unauthorized studio request. Reopen Studio and try again.' }, 401, req);
  }

  return null;
}

export async function dbRateLimit(req: Request, key: string, limit = 20, windowSeconds = 600) {
  try {
    const supabase = serviceClient();
    const bucketKey = `${key}:${clientId(req)}`;
    const { data, error } = await supabase.rpc('nexora_rate_limit_v5_5', {
      bucket_key_value: bucketKey,
      limit_value: limit,
      window_seconds: windowSeconds,
    });
    if (error) throw error;
    if (data && data.allowed === false) {
      return json({ error: 'Too many attempts. Please wait and try again.', rateLimit: data }, 429, req);
    }
    return null;
  } catch {
    return rateLimit(req, key, limit, windowSeconds * 1000);
  }
}
