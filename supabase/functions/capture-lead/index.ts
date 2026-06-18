import { corsHeaders, json, serviceClient, rateLimit } from '../_shared/studio.ts';

function pick(value: unknown) { const text = String(value || '').trim(); return text || null; }
function normalizePhone(value: unknown) { return String(value || '').replace(/\D/g, '').replace(/^20/, '0'); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const limited = rateLimit(req, 'capture-lead', 40, 1000 * 60 * 10);
  if (limited) return limited;
  try {
    const body = await req.json().catch(() => ({}));
    const supabase = serviceClient();
    const attribution = body.attribution || {};
    const anonymousId = pick(body.visitorId || attribution.visitorId);
    const sessionId = pick(body.sessionId || attribution.sessionId);
    const phone = normalizePhone(body.phone);
    const email = pick(body.email);
    if (!phone && !email) return json({ error: 'phone or email is required.' }, 400, req);

    let visitorId: string | null = null;
    if (anonymousId) {
      const { data: visitor } = await supabase.from('visitor_profiles').select('*').eq('anonymous_id', anonymousId).maybeSingle();
      if (visitor) visitorId = visitor.id;
      else {
        const { data: created } = await supabase.from('visitor_profiles').insert({ anonymous_id: anonymousId, first_source: attribution.source, first_medium: attribution.medium, first_campaign: attribution.campaign, first_landing_page: attribution.landingPage, last_source: attribution.source, last_medium: attribution.medium, last_campaign: attribution.campaign, last_page: attribution.landingPage, is_known: true }).select('id').single();
        visitorId = created?.id || null;
      }
    }

    const leadPayload = {
      visitor_id: visitorId,
      anonymous_id: anonymousId,
      session_id: sessionId,
      name: pick(body.name),
      phone: phone || null,
      email,
      source: pick(attribution.source),
      medium: pick(attribution.medium),
      campaign: pick(attribution.campaign),
      content: pick(attribution.content),
      interest_product_id: pick(body.productId),
      interest_product_name: pick(body.productName),
      status: pick(body.status) || 'new',
      notes: pick(body.notes || body.sourceType),
      metadata: { sourceType: body.sourceType || 'lead', attribution, ...(body.metadata || {}) },
    };

    let lead = null;
    if (phone) {
      const { data } = await supabase.from('lead_profiles').select('*').eq('phone', phone).order('created_at', { ascending: false }).limit(1).maybeSingle();
      lead = data;
    }
    if (lead) {
      await supabase.from('lead_profiles').update({ ...leadPayload, status: lead.status === 'ordered' ? 'ordered' : leadPayload.status, updated_at: new Date().toISOString() }).eq('id', lead.id);
    } else {
      const { data, error } = await supabase.from('lead_profiles').insert(leadPayload).select('*').single();
      if (error) throw error;
      lead = data;
    }

    if (visitorId && lead?.id) await supabase.from('visitor_profiles').update({ is_known: true, lead_id: lead.id, last_seen_at: new Date().toISOString() }).eq('id', visitorId);
    return json({ ok: true, id: lead?.id }, 200, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not capture lead.' }, 500, req);
  }
});
