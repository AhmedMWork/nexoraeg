 
import { corsHeaders, json, serviceClient, rateLimit, auditLog } from '../_shared/studio.ts';

function publicCheckoutStatus(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('cart is empty')
    || normalized.includes('unavailable')
    || normalized.includes('not available')
    || normalized.includes('valid egyptian phone')
    || normalized.includes('required')
    || normalized.includes('coupon')
    || normalized.includes('minimum order')
    || normalized.includes('usage limit')
  ) return 400;
  return 500;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const limited = rateLimit(req, 'create-order', 12, 1000 * 60 * 10);
  if (limited) return limited;

  const supabase = serviceClient();

  try {
    const body = await req.json().catch(() => ({}));
    const { data, error } = await supabase.rpc('nexora_create_order_atomic_v5_4', { payload: { ...body, paymentMethod: 'cod' } });

    if (error) {
      const message = error.message || 'Could not create order.';
      await auditLog('checkout_failed', 'order', 'create-order', { message, source: body?.attribution?.source, campaign: body?.attribution?.campaign });
      return json({ error: message }, publicCheckoutStatus(message), req);
    }

    const result = data as { orderId: string; orderNumber: string; total: number; idempotent?: boolean };
    await auditLog('order_created', 'order', result.orderId, {
      orderNumber: result.orderNumber,
      total: result.total,
      idempotent: Boolean(result.idempotent),
      source: body?.attribution?.source,
      campaign: body?.attribution?.campaign,
    });
    return json(result, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create order.';
    await auditLog('checkout_failed', 'order', 'create-order', { message });
    return json({ error: message }, publicCheckoutStatus(message), req);
  }
});
