import { corsHeaders, createStudioToken, json, rateLimit, clientId, auditLog } from '../_shared/studio.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const requester = clientId(req);
    const limited = rateLimit(req, 'studio-pin', 8, 1000 * 60 * 10);
    if (limited) {
      await auditLog('studio_login_rate_limited', 'studio_access', 'studio', { clientId: requester });
      return limited;
    }

    const body = await req.json().catch(() => ({}));
    const pin = String(body?.pin || '').trim();
    const expected = String(Deno.env.get('STUDIO_ACCESS_PIN') || '').trim();
    const requirePin = String(Deno.env.get('REQUIRE_STUDIO_PIN') || 'true').toLowerCase() !== 'false';

    if (requirePin && !expected) {
      await auditLog('studio_login_misconfigured', 'studio_access', 'studio', { clientId: requester });
      return json({ error: 'Studio PIN is not configured in Supabase secrets.' }, 500);
    }

    if (requirePin && (!pin || pin !== expected)) {
      await auditLog('studio_login_failed', 'studio_access', 'studio', { clientId: requester });
      return json({ error: 'Invalid Studio PIN.' }, 401);
    }

    await auditLog('studio_login_success', 'studio_access', 'studio', { clientId: requester });
    return json(await createStudioToken());
  } catch {
    return json({ error: 'Could not open Studio.' }, 400);
  }
});
