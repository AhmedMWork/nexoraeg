import { corsHeaders, json, serviceClient, dbRateLimit } from '../_shared/studio.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const limited = await dbRateLimit(req, 'checkout-health-check', 30, 600);
  if (limited) return limited;

  try {
    const supabase = serviceClient();
    const { data, error } = await supabase.rpc('nexora_diagnostics_v5_5_1');
    if (error) {
      return json({ ok: false, error: error.message, fix: 'Run supabase db push for V5.5.1, then redeploy functions.' }, 200, req);
    }
    const diag: Record<string, unknown> = data || {};
    const blockers: string[] = [];
    if (!diag.orderRpcReady) blockers.push('Atomic order RPC is missing.');
    if (!diag.shippingRpcReady) blockers.push('Shipping RPC is missing.');
    if (Number(diag.activeProductsCount || 0) <= 0) blockers.push('No active products are available.');
    if (Number(diag.activeVariantsWithStock || 0) <= 0) blockers.push('No active product variants have stock.');
    if (!diag.shippingEnabled || Number(diag.shippingZonesCount || 0) <= 0) blockers.push('Shipping is disabled or no active delivery zones exist.');

    return json({
      ok: blockers.length === 0,
      blockers,
      diagnostics: diag,
      message: blockers.length === 0 ? 'Checkout is ready to create orders.' : 'Checkout is not fully ready. Fix the blockers first.',
    }, 200, req);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Checkout health check failed.' }, 200, req);
  }
});
