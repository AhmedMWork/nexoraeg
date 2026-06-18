/* eslint-disable @typescript-eslint/no-explicit-any */
import { corsHeaders, json, requireStudio, serviceClient } from '../_shared/studio.ts';

function shipbluBaseUrl(env = 'production') {
  return Deno.env.get('SHIPBLU_BASE_URL') || (env === 'staging' ? 'https://api.staging.shipblu.com' : 'https://api.shipblu.com');
}

async function testShipBlu(apiKey: string, environment: string) {
  const res = await fetch(`${shipbluBaseUrl(environment)}/api/v1/merchants/`, {
    method: 'GET',
    headers: { Authorization: `Api-Key ${apiKey}`, Accept: 'application/json' },
  });
  const text = await res.text();
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text.slice(0, 600) }; }
  return { ok: res.ok, status: res.status, payload };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const blocked = await requireStudio(req); if (blocked) return blocked;
  const supabase = serviceClient();

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'get';

    if (action === 'get') {
      const [{ data: settings }, { data: zones }, { data: shipments }] = await Promise.all([
        supabase.from('shipping_settings').select('*').eq('id', 'main').maybeSingle(),
        supabase.from('shipping_zones').select('*').order('governorate').order('city'),
        supabase.from('shipping_shipments').select('*').order('created_at', { ascending: false }).limit(10),
      ]);
      return json({ settings, zones: zones || [], shipments: shipments || [], providerConnected: Boolean(Deno.env.get('SHIPBLU_API_KEY')) }, 200, req);
    }

    if (action === 'save-settings') {
      const settings = body.settings || {};
      const allowed: Record<string, unknown> = {
        id: 'main',
        shipping_enabled: Boolean(settings.shipping_enabled ?? settings.shippingEnabled ?? true),
        default_shipping_fee: Number(settings.default_shipping_fee ?? settings.defaultShippingFee ?? 0),
        cod_fee: Number(settings.cod_fee ?? settings.codFee ?? 0),
        free_shipping_enabled: Boolean(settings.free_shipping_enabled ?? settings.freeShippingEnabled ?? false),
        free_shipping_threshold: Number(settings.free_shipping_threshold ?? settings.freeShippingThreshold ?? 0),
        fallback_delivery_estimate: String(settings.fallback_delivery_estimate ?? settings.fallbackDeliveryEstimate ?? '2-5 business days'),
        provider: String(settings.provider || 'shipblu'),
        provider_enabled: Boolean(settings.provider_enabled ?? settings.providerEnabled ?? false),
        provider_environment: String(settings.provider_environment ?? settings.providerEnvironment ?? 'production'),
        auto_create_shipments: Boolean(settings.auto_create_shipments ?? settings.autoCreateShipments ?? false),
        default_package_size: Number(settings.default_package_size ?? settings.defaultPackageSize ?? 1),
        default_pickup_zone_id: settings.default_pickup_zone_id ?? settings.defaultPickupZoneId ?? null,
        notes: settings.notes || null,
        updated_at: new Date().toISOString(),
      };
      if (Number(allowed.default_shipping_fee) < 0 || Number(allowed.cod_fee) < 0 || Number(allowed.free_shipping_threshold) < 0) return json({ error: 'Shipping fees cannot be negative.' }, 400, req);
      const { data, error } = await supabase.from('shipping_settings').upsert(allowed).select('*').single();
      if (error) throw error;
      return json({ settings: data }, 200, req);
    }

    if (action === 'upsert-zone') {
      const zone = body.zone || {};
      const row: Record<string, unknown> = {
        governorate: String(zone.governorate || '').trim(),
        city: String(zone.city || '*').trim() || '*',
        shipping_fee: Number(zone.shipping_fee ?? zone.shippingFee ?? 0),
        cod_fee: Number(zone.cod_fee ?? zone.codFee ?? 0),
        delivery_estimate: String(zone.delivery_estimate ?? zone.deliveryEstimate ?? '2-5 business days'),
        enabled: Boolean(zone.enabled ?? true),
        remote_area: Boolean(zone.remote_area ?? zone.remoteArea ?? false),
        shipblu_governorate_id: zone.shipblu_governorate_id ?? zone.shipbluGovernorateId ?? null,
        shipblu_city_id: zone.shipblu_city_id ?? zone.shipbluCityId ?? null,
        shipblu_zone_id: zone.shipblu_zone_id ?? zone.shipbluZoneId ?? null,
        notes: zone.notes || null,
        updated_at: new Date().toISOString(),
      };
      if (!row.governorate) return json({ error: 'Governorate is required.' }, 400, req);
      if (Number(row.shipping_fee) < 0 || Number(row.cod_fee) < 0) return json({ error: 'Shipping fees cannot be negative.' }, 400, req);
      if (zone.id) row.id = zone.id;
      const { data, error } = await supabase.from('shipping_zones').upsert(row).select('*').single();
      if (error) throw error;
      return json({ zone: data }, 200, req);
    }

    if (action === 'delete-zone') {
      const id = String(body.id || '');
      if (!id) return json({ error: 'Zone id is required.' }, 400, req);
      const { error } = await supabase.from('shipping_zones').delete().eq('id', id);
      if (error) throw error;
      return json({ ok: true }, 200, req);
    }

    if (action === 'test-provider') {
      const { data: settings } = await supabase.from('shipping_settings').select('*').eq('id', 'main').maybeSingle();
      const key = Deno.env.get('SHIPBLU_API_KEY');
      if (!key) return json({ ok: false, error: 'SHIPBLU_API_KEY is not set in Supabase secrets.' }, 200, req);
      const result = await testShipBlu(key, String(settings?.provider_environment || 'production'));
      return json(result, 200, req);
    }

    return json({ error: 'Unknown shipping action.' }, 400, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Shipping Studio request failed.' }, 500, req);
  }
});
