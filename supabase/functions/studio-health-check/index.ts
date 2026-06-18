/* eslint-disable @typescript-eslint/no-explicit-any */
import { corsHeaders, json, requireStudio, serviceClient } from '../_shared/studio.ts';

type Check = {
  key: string;
  label: string;
  status: 'ok' | 'warn' | 'fail';
  message: string;
  fix?: string;
};

async function tableCheck(supabase: ReturnType<typeof serviceClient>, table: string, label = table): Promise<Check> {
  const { error } = await supabase.from(table).select('*').limit(1);
  if (error) {
    return { key: `table:${table}`, label, status: 'fail', message: error.message, fix: 'Run supabase db push, then redeploy Edge Functions.' };
  }
  return { key: `table:${table}`, label, status: 'ok', message: `${label} table is reachable.` };
}

function secretCheck(name: string, required = true, label = name): Check {
  const value = Deno.env.get(name);
  if (value && value.trim().length > 0) return { key: `secret:${name}`, label, status: 'ok', message: `${label} is configured.` };
  return {
    key: `secret:${name}`,
    label,
    status: required ? 'fail' : 'warn',
    message: `${label} is ${required ? 'missing' : 'not configured yet'}.`,
    fix: required ? `supabase secrets set ${name}=...` : `Configure ${name} only when you are ready to use this integration.`,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const blocked = await requireStudio(req); if (blocked) return blocked;
  try {
    const supabase = serviceClient();
    const checks: Check[] = [];

    checks.push(secretCheck('ALLOWED_ORIGIN', true, 'Allowed website origin'));
    checks.push(secretCheck('STUDIO_ACCESS_PIN', true, 'Studio PIN'));
    checks.push(secretCheck('STUDIO_SESSION_SECRET', true, 'Studio session secret'));
    checks.push(secretCheck('SHIPBLU_API_KEY', false, 'ShipBlu API key'));

    const tableNames = [
      ['products', 'Products'],
      ['product_variants', 'Product variants'],
      ['orders', 'Orders'],
      ['order_items', 'Order items'],
      ['shipping_settings', 'Shipping settings'],
      ['shipping_zones', 'Shipping zones'],
      ['shipping_shipments', 'Shipping shipments'],
      ['visitor_profiles', 'Visitor profiles'],
      ['visitor_events', 'Visitor events'],
      ['lead_profiles', 'Lead CRM'],
      ['rate_limit_buckets', 'DB rate limiting'],
      ['customer_profiles', 'Customer profiles'],
      ['lead_tasks', 'Lead tasks'],
      ['admin_action_notes', 'Action notes'],
    ] as const;

    const tableChecks = await Promise.all(tableNames.map(([table, label]) => tableCheck(supabase, table, label)));
    checks.push(...tableChecks);

    const { data: settings, error: settingsError } = await supabase.from('shipping_settings').select('*').eq('id', 'main').maybeSingle();
    if (settingsError) {
      checks.push({ key: 'shipping:settings', label: 'Shipping settings row', status: 'fail', message: settingsError.message, fix: 'Run db push and open Shipping once.' });
    } else if (!settings) {
      checks.push({ key: 'shipping:settings', label: 'Shipping settings row', status: 'warn', message: 'Shipping settings are not initialized yet.', fix: 'Open Shipping and save settings.' });
    } else {
      checks.push({ key: 'shipping:settings', label: 'Shipping settings row', status: 'ok', message: `Shipping is ${settings.shipping_enabled ? 'enabled' : 'disabled'} and provider is ${settings.provider_enabled ? 'enabled' : 'manual'}.` });
    }

    const { data: zones } = await supabase.from('shipping_zones').select('id,shipblu_zone_id,enabled').eq('enabled', true).limit(200);
    const activeZones = zones || [];
    const zonesWithShipBlu = activeZones.filter((zone: any) => zone.shipblu_zone_id).length;
    checks.push({
      key: 'shipping:zones',
      label: 'ShipBlu zone mapping',
      status: activeZones.length === 0 ? 'warn' : zonesWithShipBlu > 0 ? 'ok' : 'warn',
      message: activeZones.length === 0 ? 'No active shipping zones yet.' : `${zonesWithShipBlu}/${activeZones.length} active zones have ShipBlu zone IDs.`,
      fix: activeZones.length === 0 || zonesWithShipBlu === 0 ? 'Open Shipping → Zones and add fees + ShipBlu zone IDs for supported cities.' : undefined,
    });

    const { data: orderRpc, error: rpcError } = await supabase.rpc('nexora_rate_limit_v5_5', { bucket_key_value: 'health-check', limit_value: 99999, window_seconds: 60 });
    checks.push(rpcError ? { key: 'rpc:rate_limit', label: 'DB rate-limit RPC', status: 'fail', message: rpcError.message, fix: 'Run supabase db push for V5.5 migration.' } : { key: 'rpc:rate_limit', label: 'DB rate-limit RPC', status: 'ok', message: `Rate limiter is ready (${orderRpc?.remaining ?? 'ok'} remaining in health bucket).` });

    const { data: diagnostics, error: diagnosticsError } = await supabase.rpc('nexora_diagnostics_v5_5_1');
    const diag: any = diagnostics || {};
    if (diagnosticsError) {
      checks.push({ key: 'checkout:diagnostics', label: 'Checkout diagnostics RPC', status: 'fail', message: diagnosticsError.message, fix: 'Run supabase db push for V5.5.1 migration.' });
    } else {
      checks.push({ key: 'checkout:order-rpc', label: 'Atomic order RPC', status: diag.orderRpcReady ? 'ok' : 'fail', message: diag.orderRpcReady ? 'create-order can call the atomic order transaction.' : 'Atomic order RPC is missing.', fix: diag.orderRpcReady ? undefined : 'Run supabase db push then redeploy create-order.' });
      checks.push({ key: 'checkout:shipping-rpc', label: 'Shipping RPC', status: diag.shippingRpcReady ? 'ok' : 'fail', message: diag.shippingRpcReady ? 'Delivery calculation RPC is ready.' : 'Shipping calculation RPC is missing.', fix: diag.shippingRpcReady ? undefined : 'Run supabase db push for V5.4/V5.5.1 migrations.' });
      checks.push({ key: 'checkout:products', label: 'Checkout sellable products', status: diag.activeProductsCount > 0 ? 'ok' : 'warn', message: `${diag.activeProductsCount || 0} active products out of ${diag.productsCount || 0} products.`, fix: diag.activeProductsCount > 0 ? undefined : 'Open Catalog → Products and publish at least one active product.' });
      checks.push({ key: 'checkout:variants-stock', label: 'Variant stock available', status: diag.activeVariantsWithStock > 0 ? 'ok' : 'warn', message: `${diag.activeVariantsWithStock || 0} active variants have stock available.`, fix: diag.activeVariantsWithStock > 0 ? undefined : 'Open Inventory and add stock to size/color variants.' });
      checks.push({ key: 'checkout:shipping-zones', label: 'Shipping zones ready', status: diag.shippingZonesCount > 0 && diag.shippingEnabled ? 'ok' : 'warn', message: `${diag.shippingZonesCount || 0} active shipping zones. Shipping is ${diag.shippingEnabled ? 'enabled' : 'disabled'}.`, fix: diag.shippingZonesCount > 0 && diag.shippingEnabled ? undefined : 'Open Shipping and enable delivery zones before testing checkout.' });
    }

    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const score = Math.max(0, Math.round(((checks.length - failed - warnings * 0.5) / checks.length) * 100));

    await supabase.from('system_setup_events').insert({ check_key: 'studio-health-check', status: failed ? 'fail' : warnings ? 'warn' : 'ok', message: `Score ${score}%`, metadata: { failed, warnings, total: checks.length } }).then(() => undefined).catch(() => undefined);

    return json({ score, failed, warnings, checks, generatedAt: new Date().toISOString() }, 200, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not run setup health check.' }, 500, req);
  }
});
