import { corsHeaders, json, serviceClient, rateLimit } from '../_shared/studio.ts';

function normalizePhone(value: unknown) {
  return String(value || '').replace(/\D/g, '').replace(/^20/, '0');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const limited = rateLimit(req, 'track-order', 20, 1000 * 60 * 10);
  if (limited) return limited;
  if (req.method !== 'POST') return json({ found: false, message: 'Method not allowed.' }, 405);

  const supabase = serviceClient();

  try {
    const body = await req.json().catch(() => ({}));
    const orderNumber = String(body.orderNumber || body.order_number || '').trim().toUpperCase();
    const phone = normalizePhone(body.phone);

    if (!orderNumber || !phone) {
      return json({ found: false, message: 'Order number and phone are required.' }, 400);
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, customer_phone, governorate, city, total, payment_status, order_status, status_history, created_at')
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (error) throw error;
    if (!order || normalizePhone(order.customer_phone) !== phone) {
      return json({ found: false, message: 'We could not find an order matching this number and phone.' }, 404);
    }

    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('product_name, quantity, size, size_label, weight_range, color, image, product_image_url')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    if (itemsError) throw itemsError;

    const safeItems = (items || []).map((item) => ({
      name: item.product_name,
      quantity: Number(item.quantity || 1),
      size: item.size_label || item.size || '',
      weightRange: item.weight_range || undefined,
      color: item.color || undefined,
      image: item.product_image_url || item.image || undefined,
    }));

    const history = Array.isArray(order.status_history) ? order.status_history : [];

    return json({
      found: true,
      order: {
        orderNumber: order.order_number,
        status: order.order_status,
        paymentStatus: order.payment_status,
        total: Number(order.total || 0),
        createdAt: order.created_at,
        governorate: order.governorate,
        city: order.city,
        items: safeItems,
        trackingUpdates: history.map((entry) => ({
          status: entry.status || order.order_status,
          message: entry.message || 'Order updated.',
          timestamp: entry.timestamp || order.created_at,
        })),
      },
    });
  } catch (error) {
    return json({ found: false, message: error instanceof Error ? error.message : 'Could not check this order.' }, 500);
  }
});
