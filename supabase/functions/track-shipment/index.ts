/* eslint-disable @typescript-eslint/no-explicit-any */
import { corsHeaders, json, requireStudio, serviceClient } from '../_shared/studio.ts';

function shipbluBaseUrl(env = 'production') {
  return Deno.env.get('SHIPBLU_BASE_URL') || (env === 'staging' ? 'https://api.staging.shipblu.com' : 'https://api.shipblu.com');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const blocked = await requireStudio(req); if (blocked) return blocked;
  const supabase = serviceClient();
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body.orderId || '');
    const { data: settings } = await supabase.from('shipping_settings').select('*').eq('id', 'main').maybeSingle();
    const { data: shipment } = await supabase.from('shipping_shipments').select('*').eq('order_id', orderId).maybeSingle();
    if (!shipment) return json({ error: 'Shipment not found.' }, 404, req);
    const key = Deno.env.get('SHIPBLU_API_KEY');
    if (!key || !shipment.provider_order_id) return json({ shipment, providerLive: false, message: 'Local shipment exists, but ShipBlu API key/order id is not available.' }, 200, req);

    const res = await fetch(`${shipbluBaseUrl(settings?.provider_environment || 'production')}/api/v1/delivery-orders/${shipment.provider_order_id}/`, {
      headers: { Authorization: `Api-Key ${key}`, Accept: 'application/json' },
    });
    const text = await res.text();
    let payload: any = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text.slice(0, 1000) }; }
    if (!res.ok) return json({ shipment, providerLive: false, error: 'Could not refresh from ShipBlu.', status: res.status, details: payload }, 200, req);

    const status = String(payload?.status || shipment.status || 'CREATED');
    const { data: updated } = await supabase.from('shipping_shipments').update({ status, raw_response: payload || {}, updated_at: new Date().toISOString() }).eq('id', shipment.id).select('*').single();
    await supabase.from('orders').update({ shipping_status: status, updated_at: new Date().toISOString() }).eq('id', orderId);
    await supabase.from('shipping_events').insert({ shipment_id: shipment.id, order_id: orderId, provider: 'shipblu', status, message: 'Shipment status refreshed from ShipBlu.', raw_payload: payload || {} });
    return json({ shipment: updated || shipment, providerLive: true, providerPayload: payload }, 200, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not track shipment.' }, 500, req);
  }
});
