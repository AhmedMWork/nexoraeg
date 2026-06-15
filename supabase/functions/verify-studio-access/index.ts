import { corsHeaders, createStudioToken, json, serviceClient } from '../_shared/studio.ts';

const attempts = new Map<string, { count: number; resetAt: number }>();

function getClientId(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown';
}

function rateLimited(clientId: string) {
  const now = Date.now();
  const current = attempts.get(clientId);
  if (!current || current.resetAt < now) {
    attempts.set(clientId, { count: 1, resetAt: now + 1000 * 60 * 10 });
    return false;
  }
  current.count += 1;
  attempts.set(clientId, current);
  return current.count > 8;
}

async function audit(action: string, metadata: Record<string, unknown>) {
  try {
    const supabase = serviceClient();
    await supabase.from('audit_logs').insert({
      admin_email: 'studio@nexora.local',
      action,
      entity_type: 'studio_access',
      entity_id: 'studio',
      after: metadata,
    });
  } catch {
    // Audit must not break Studio access availability.
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const clientId = getClientId(req);
    if (rateLimited(clientId)) {
      await audit('studio_login_rate_limited', { clientId });
      return json({ error: 'Too many attempts. Try again later.' }, 429);
    }

    const body = await req.json().catch(() => ({}));
    const pin = String(body?.pin || '').trim();
    const expected = String(Deno.env.get('STUDIO_ACCESS_PIN') || '').trim();
    const requirePin = String(Deno.env.get('REQUIRE_STUDIO_PIN') || 'true').toLowerCase() !== 'false';

    if (requirePin && !expected) {
      await audit('studio_login_misconfigured', { clientId });
      return json({ error: 'Studio PIN is not configured in Supabase secrets.' }, 500);
    }

    if (requirePin && (!pin || pin !== expected)) {
      await audit('studio_login_failed', { clientId });
      return json({ error: 'Invalid Studio PIN.' }, 401);
    }

    await audit('studio_login_success', { clientId });
    return json(await createStudioToken());
  } catch {
    return json({ error: 'Could not open Studio.' }, 400);
  }
});
