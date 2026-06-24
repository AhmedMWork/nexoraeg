import { corsHeaders, json, rateLimit, serviceClient } from '../_shared/studio.ts';

function cleanText(value: unknown, max = 1200) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const limited = rateLimit(req, 'submit-review', 8, 1000 * 60 * 30);
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    const reviewType = body.reviewType === 'site' ? 'site' : 'product';
    const customerName = cleanText(body.customerName, 80);
    const customerPhone = cleanText(body.customerPhone, 40);
    const title = cleanText(body.title, 120);
    const reviewBody = cleanText(body.body, 1200);
    const rating = Math.max(1, Math.min(5, Number(body.rating || 0)));

    if (!customerName) return json({ error: 'Customer name is required.' }, 400, req);
    if (!reviewBody || reviewBody.length < 8) return json({ error: 'Review text must be at least 8 characters.' }, 400, req);
    if (!rating) return json({ error: 'Rating is required.' }, 400, req);
    if (reviewType === 'product' && !body.productId) return json({ error: 'Product id is required for product reviews.' }, 400, req);

    const supabase = serviceClient();
    const { data, error } = await supabase.from('reviews').insert({
      review_type: reviewType,
      product_id: reviewType === 'product' ? body.productId : null,
      product_name: cleanText(body.productName || (reviewType === 'site' ? 'NEXORA Experience' : ''), 160),
      customer_name: customerName,
      customer_phone: customerPhone || null,
      rating,
      title,
      body_en: reviewBody,
      body: reviewBody,
      images: [],
      featured: false,
      status: 'pending',
      helpful_count: 0,
      metadata: { experienceType: cleanText(body.experienceType, 80), orderNumber: cleanText(body.orderNumber, 80), source: 'customer' },
    }).select('id').single();
    if (error) throw error;
    return json({ id: data.id, status: 'pending' }, 200, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not submit review.' }, 500, req);
  }
});
