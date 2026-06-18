 
import { corsHeaders, json, serviceClient, rateLimit } from '../_shared/studio.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const limited = rateLimit(req, 'calculate-shipping', 60, 1000 * 60 * 10);
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    const governorate = String(body.governorate || '').trim();
    const city = String(body.city || '').trim();
    const subtotal = Number(body.subtotal || 0);
    const couponFreeShipping = Boolean(body.couponFreeShipping);

    if (!governorate || !city) {
      return json({ available: false, reason: 'Choose a governorate and city to calculate delivery.', shippingFee: 0, codFee: 0, totalDeliveryFee: 0 }, 200, req);
    }

    const supabase = serviceClient();
    const { data, error } = await supabase.rpc('nexora_calculate_shipping_v5_4', {
      governorate_value: governorate,
      city_value: city,
      subtotal_value: subtotal,
      coupon_free_shipping: couponFreeShipping,
    });
    if (error) return json({ available: false, reason: error.message || 'Could not calculate shipping.', shippingFee: 0, codFee: 0, totalDeliveryFee: 0 }, 200, req);
    return json(data, 200, req);
  } catch (error) {
    return json({ available: false, reason: error instanceof Error ? error.message : 'Could not calculate shipping.', shippingFee: 0, codFee: 0, totalDeliveryFee: 0 }, 200, req);
  }
});
