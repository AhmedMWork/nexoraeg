import { corsHeaders, json, serviceClient, rateLimit } from '../_shared/studio.ts';

function pick(value: unknown) {
  const text = String(value || '').trim();
  return text || null;
}

function uuidOrNull(value: unknown) {
  const text = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const limited = rateLimit(req, 'track-visitor-event', 120, 1000 * 60 * 10);
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = serviceClient();
    const attribution = body.attribution || {};
    const device = body.device || {};
    const anonymousId = pick(body.visitorId || attribution.visitorId);
    const sessionId = pick(body.sessionId || attribution.sessionId);
    const eventName = pick(body.eventName) || 'event';
    if (!anonymousId) return json({ error: 'visitorId is required.' }, 400, req);

    const profilePayload = {
      anonymous_id: anonymousId,
      last_seen_at: new Date().toISOString(),
      last_source: pick(attribution.source),
      last_medium: pick(attribution.medium),
      last_campaign: pick(attribution.campaign),
      last_page: pick(body.pageUrl || body.path),
      device_type: pick(device.type),
      browser: pick(device.browser),
      os: pick(device.os),
    };

    let { data: existing } = await supabase.from('visitor_profiles').select('*').eq('anonymous_id', anonymousId).maybeSingle();
    if (!existing) {
      const { data, error } = await supabase.from('visitor_profiles').insert({
        ...profilePayload,
        first_source: pick(attribution.source),
        first_medium: pick(attribution.medium),
        first_campaign: pick(attribution.campaign),
        first_landing_page: pick(attribution.landingPage || body.pageUrl),
        event_count: 1,
      }).select('*').single();
      if (error) throw error;
      existing = data;
    } else {
      await supabase.from('visitor_profiles').update({
        ...profilePayload,
        event_count: Number(existing.event_count || 0) + 1,
      }).eq('id', existing.id);
    }

    const eventRow = {
      visitor_id: existing.id,
      anonymous_id: anonymousId,
      session_id: sessionId,
      event_name: eventName,
      page_url: pick(body.pageUrl),
      product_id: uuidOrNull(body.payload?.productId),
      cart_value: Number(body.payload?.cartValue || body.payload?.total || 0),
      source: pick(attribution.source),
      medium: pick(attribution.medium),
      campaign: pick(attribution.campaign),
      content: pick(attribution.content),
      term: pick(attribution.term),
      fbclid: pick(attribution.fbclid),
      fbc: pick(attribution.fbc),
      fbp: pick(attribution.fbp),
      gclid: pick(attribution.gclid),
      ttclid: pick(attribution.ttclid),
      referrer: pick(attribution.referrer),
      device_type: pick(device.type),
      browser: pick(device.browser),
      os: pick(device.os),
      language: pick(device.language),
      screen_size: pick(device.screen),
      metadata: body.payload || {},
    };
    await supabase.from('visitor_events').insert(eventRow);
    await supabase.from('analytics_events').insert({
      event_name: eventName,
      session_id: sessionId,
      visitor_id: anonymousId,
      path: pick(body.path) || pick(body.pageUrl),
      page_url: pick(body.pageUrl),
      referrer: pick(attribution.referrer),
      language: pick(device.language),
      device: pick(device.type),
      source: pick(attribution.source),
      medium: pick(attribution.medium),
      campaign: pick(attribution.campaign),
      content: pick(attribution.content),
      payload: body.payload || {},
      metadata: { attribution, device },
    });

    return json({ ok: true }, 200, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not track visitor event.' }, 500, req);
  }
});
