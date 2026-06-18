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

    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const score = Math.max(0, Math.round(((checks.length - failed - warnings * 0.5) / checks.length) * 100));

    await supabase.from('system_setup_events').insert({ check_key: 'studio-health-check', status: failed ? 'fail' : warnings ? 'warn' : 'ok', message: `Score ${score}%`, metadata: { failed, warnings, total: checks.length } }).then(() => undefined).catch(() => undefined);

    return json({ score, failed, warnings, checks, generatedAt: new Date().toISOString() }, 200, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not run setup health check.' }, 500, req);
  }
});
