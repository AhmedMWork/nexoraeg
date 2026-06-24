import { corsHeaders, json, requireStudio, serviceClient } from '../_shared/studio.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const blocked = await requireStudio(req); if (blocked) return blocked;
  const supabase = serviceClient();
  const body = await req.json().catch(() => ({}));

  try {
    if (body.action === 'list') {
      const { data, error } = await supabase.from('reviews').select('*').order('sort_order').order('created_at', { ascending: false });
      if (error) throw error;
      return json({ reviews: data || [] });
    }

    if (body.action === 'create') {
      const r = body.review || {};
      const { data, error } = await supabase.from('reviews').insert({
        review_type: r.productId === 'brand' || r.reviewType === 'site' ? 'site' : 'product',
        product_id: r.productId === 'brand' ? null : r.productId || null,
        product_name: r.productName,
        customer_name: r.customerName,
        customer_phone: r.customerPhone || null,
        rating: Number(r.rating || 5),
        title: r.title,
        body_en: r.body,
        body: r.body,
        images: Array.isArray(r.images) ? r.images : [],
        admin_reply: r.adminReply || null,
        featured: Boolean(r.isFeatured),
        status: r.status || (r.isApproved ? 'published' : 'pending'),
        approved_at: (r.status === 'published' || r.isApproved) ? new Date().toISOString() : null,
        helpful_count: Number(r.helpfulCount || 0),
      }).select('id').single();
      if (error) throw error;
      return json({ id: data.id });
    }

    if (body.action === 'update') {
      const r = body.review || {};
      const patch: Record<string, unknown> = {};
      if ('customerName' in r) patch.customer_name = r.customerName;
      if ('customerPhone' in r) patch.customer_phone = r.customerPhone;
      if ('productName' in r) patch.product_name = r.productName;
      if ('productId' in r) { patch.product_id = r.productId === 'brand' ? null : r.productId; patch.review_type = r.productId === 'brand' ? 'site' : 'product'; }
      if ('reviewType' in r) patch.review_type = r.reviewType;
      if ('rating' in r) patch.rating = Number(r.rating);
      if ('title' in r) patch.title = r.title;
      if ('body' in r) { patch.body_en = r.body; patch.body = r.body; }
      if ('images' in r) patch.images = Array.isArray(r.images) ? r.images : [];
      if ('adminReply' in r) patch.admin_reply = r.adminReply;
      if ('isFeatured' in r) patch.featured = r.isFeatured;
      if ('status' in r) patch.status = r.status;
      if ('isApproved' in r) patch.status = r.isApproved ? 'published' : 'hidden';
      if (patch.status === 'published') patch.approved_at = new Date().toISOString();
      if ('helpfulCount' in r) patch.helpful_count = Number(r.helpfulCount || 0);
      const { error } = await supabase.from('reviews').update(patch).eq('id', body.id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (body.action === 'delete') {
      const { error } = await supabase.from('reviews').update({ status: 'archived' }).eq('id', body.id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Studio reviews request failed.' }, 500);
  }
});
