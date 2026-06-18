import { corsHeaders, json, serviceClient, rateLimit } from '../_shared/studio.ts';
function pick(value: unknown) { const text = String(value || '').trim(); return text || null; }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const limited = rateLimit(req, 'track-whatsapp-click', 80, 1000 * 60 * 10);
  if (limited) return limited;
  try {
    const body = await req.json().catch(() => ({}));
    const supabase = serviceClient();
    const attribution = body.attribution || {};
    const anonymousId = pick(body.visitorId || attribution.visitorId);
    let visitorId = null;
    if (anonymousId) {
      const { data: visitor } = await supabase.from('visitor_profiles').select('id').eq('anonymous_id', anonymousId).maybeSingle();
      visitorId = visitor?.id || null;
    }
    await supabase.from('whatsapp_clicks').insert({
      visitor_id: visitorId,
      anonymous_id: anonymousId,
      session_id: pick(body.sessionId || attribution.sessionId),
      phone: pick(body.phone),
      page_url: pick(body.pageUrl),
      product_id: pick(body.productId),
      product_name: pick(body.productName),
      cart_value: Number(body.cartValue || 0),
      source: pick(attribution.source),
      medium: pick(attribution.medium),
      campaign: pick(attribution.campaign),
      message: pick(body.message),
      metadata: { attribution, sourceType: body.sourceType || 'whatsapp' },
    });
    await supabase.from('visitor_events').insert({ visitor_id: visitorId, anonymous_id: anonymousId, session_id: pick(body.sessionId || attribution.sessionId), event_name: 'whatsapp_click', page_url: pick(body.pageUrl), source: pick(attribution.source), medium: pick(attribution.medium), campaign: pick(attribution.campaign), metadata: { productId: body.productId, productName: body.productName } });
    return json({ ok: true }, 200, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not track WhatsApp click.' }, 500, req);
  }
});
