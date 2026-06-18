/* eslint-disable @typescript-eslint/no-explicit-any */
import { corsHeaders, json, requireStudio, serviceClient, auditLog } from '../_shared/studio.ts';

function shipbluBaseUrl(env = 'production') {
  return Deno.env.get('SHIPBLU_BASE_URL') || (env === 'staging' ? 'https://api.staging.shipblu.com' : 'https://api.shipblu.com');
}

function extractTracking(payload: any) {
  return String(payload?.tracking_number || payload?.trackingNumber || payload?.airwaybill || payload?.id || payload?.order_id || '').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const blocked = await requireStudio(req); if (blocked) return blocked;
  const supabase = serviceClient();

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body.orderId || '');
    if (!orderId) return json({ error: 'Order id is required.' }, 400, req);

    const [{ data: settings }, { data: order, error: orderError }, { data: existing }] = await Promise.all([
      supabase.from('shipping_settings').select('*').eq('id', 'main').maybeSingle(),
      supabase.from('orders').select('*').eq('id', orderId).maybeSingle(),
      supabase.from('shipping_shipments').select('*').eq('order_id', orderId).maybeSingle(),
    ]);
    if (orderError) throw orderError;
    if (!order) return json({ error: 'Order not found.' }, 404, req);
    if (existing?.id) return json({ shipment: existing, message: 'Shipment already exists.' }, 200, req);
    if (!settings?.provider_enabled) return json({ error: 'Shipping provider is not enabled in Admin Shipping.' }, 400, req);
    const apiKey = Deno.env.get('SHIPBLU_API_KEY');
    if (!apiKey) return json({ error: 'SHIPBLU_API_KEY is not set in Supabase secrets.' }, 400, req);

    const quote = order.shipping_quote || {};
    const zoneId = Number(quote.shipbluZoneId || body.shipbluZoneId || 0);
    if (!zoneId) {
      return json({ error: 'This order city does not have a ShipBlu zone id. Add it in Admin > Shipping before creating the shipment.' }, 400, req);
    }

    const requestBody = {
      customer: {
        full_name: order.customer_name,
        email: order.customer_email || 'orders@nexora.local',
        phone: order.customer_phone,
        address: { line_1: order.address, line_2: `${order.city}, ${order.governorate}`, zone: zoneId },
      },
      packages: [{ package_size: Number(settings.default_package_size || 1) }],
      notes: order.notes || `NEXORA ${order.order_number}`,
      cash_amount: Number(order.total || 0),
      merchant_order_reference: order.order_number,
    };

    const response = await fetch(`${shipbluBaseUrl(settings.provider_environment)}/api/v1/delivery-orders/`, {
      method: 'POST',
      headers: { Authorization: `Api-Key ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(requestBody),
    });
    const text = await response.text();
    let payload: any = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text.slice(0, 1000) }; }
    if (!response.ok) return json({ error: 'ShipBlu rejected the shipment request.', status: response.status, details: payload }, 400, req);

    const providerOrderId = String(payload?.id || payload?.order?.id || payload?.tracking_number || '');
    const tracking = extractTracking(payload);
    const { data: shipment, error } = await supabase.from('shipping_shipments').insert({
      order_id: orderId,
      provider: 'shipblu',
      provider_order_id: providerOrderId,
      tracking_number: tracking || providerOrderId,
      status: String(payload?.status || 'CREATED'),
      shipping_fee: order.shipping_fee,
      cod_amount: order.total,
      delivery_estimate: order.delivery_estimate,
      raw_response: payload || {},
    }).select('*').single();
    if (error) throw error;

    await supabase.from('orders').update({ shipping_status: shipment.status, shipping_provider: 'shipblu', tracking_number: shipment.tracking_number, shipment_id: shipment.id, updated_at: new Date().toISOString() }).eq('id', orderId);
    await supabase.from('shipping_events').insert({ shipment_id: shipment.id, order_id: orderId, provider: 'shipblu', status: shipment.status, message: 'Shipment created on ShipBlu.', raw_payload: payload || {} });
    await auditLog('shipment_created', 'order', orderId, { provider: 'shipblu', trackingNumber: shipment.tracking_number });
    return json({ shipment }, 200, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not create shipment.' }, 500, req);
  }
});
