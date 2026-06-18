/* eslint-disable @typescript-eslint/no-explicit-any */
import { corsHeaders, json, requireStudio, serviceClient, auditLog } from '../_shared/studio.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const blocked = await requireStudio(req); if (blocked) return blocked;
  const supabase = serviceClient();
  const body = await req.json();
  try {
    if (body.action === 'list') {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return json({ products: data || [] });
    }
    if (body.action === 'inventory-list') {
      const [{ data: products, error: productsError }, { data: variants, error: variantsError }] = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('product_variants').select('*').order('sort_order', { ascending: true }),
      ]);
      if (productsError) throw productsError;
      if (variantsError) throw variantsError;
      return json({ products: products || [], variants: variants || [] });
    }
    if (body.action === 'create') {
      const { data, error } = await supabase.from('products').insert(body.product).select('id').single();
      if (error) throw error;
      await auditLog('studio_product_created', 'product', data.id, { slug: body.product?.slug });
      return json({ id: data.id });
    }
    if (body.action === 'update') {
      const { error } = await supabase.from('products').update(body.product).eq('id', body.id);
      if (error) throw error;
      await auditLog('studio_product_updated', 'product', body.id, { fields: Object.keys(body.product || {}) });
      return json({ ok: true });
    }
    if (body.action === 'archive') {
      const { error } = await supabase.from('products').update({ status: 'archived' }).eq('id', body.id);
      if (error) throw error;
      await auditLog('studio_product_archived', 'product', body.id, {});
      return json({ ok: true });
    }
    if (body.action === 'adjust-stock') {
      const { data: product, error } = await supabase.from('products').select('*').eq('id', body.productId).single();
      if (error) throw error;
      const stock = product.stock_by_size || {};
      const before = Number(stock[body.size] || 0);
      const after = Math.max(0, before + Number(body.quantity || 0));
      stock[body.size] = after;
      const total = Object.values(stock).reduce((s: number, v: any) => s + Number(v || 0), 0);
      await supabase.from('products').update({ stock_by_size: stock, stock_total: total, status: total <= 0 ? 'sold_out' : product.status === 'sold_out' ? 'active' : product.status }).eq('id', body.productId);
      await supabase.from('inventory_logs').insert({ product_id: body.productId, size: body.size, change: Number(body.quantity || 0), reason: body.reason || 'manual_adjustment', previous_stock: before, new_stock: after, note: body.note });
      await auditLog('studio_stock_adjusted', 'product', body.productId, { size: body.size, quantity: body.quantity, reason: body.reason });
      return json({ ok: true });
    }

    if (body.action === 'variants-list') {
      const { data, error } = await supabase.from('product_variants').select('*').eq('product_id', body.productId).order('sort_order', { ascending: true });
      if (error) throw error;
      return json({ variants: data || [] });
    }
    if (body.action === 'variants-upsert') {
      const variants = Array.isArray(body.variants) ? body.variants : [];
      for (const variant of variants) {
        const row = { ...variant, product_id: body.productId };
        if (row.id) {
          const id = row.id;
          delete row.id;
          await supabase.from('product_variants').update(row).eq('id', id);
        } else {
          delete row.id;
          await supabase.from('product_variants').insert(row);
        }
      }
      await auditLog('studio_product_variants_upserted', 'product', body.productId, { count: variants.length });
      return json({ ok: true });
    }
    if (body.action === 'variants-delete') {
      const { error } = await supabase.from('product_variants').delete().eq('id', body.id);
      if (error) throw error;
      await auditLog('studio_product_variant_deleted', 'product_variant', body.id, {});
      return json({ ok: true });
    }
    if (body.action === 'adjust-variant-stock') {
      const { data: variant, error } = await supabase.from('product_variants').select('*').eq('id', body.variantId).single();
      if (error) throw error;
      const before = Number(variant.stock || 0);
      const after = Math.max(0, before + Number(body.quantity || 0));
      await supabase.from('product_variants').update({ stock: after, status: after <= 0 ? 'sold_out' : 'active' }).eq('id', body.variantId);
      await supabase.rpc('nexora_sync_product_stock_from_variants', { product_id_value: variant.product_id }).then(() => undefined).catch(() => undefined);
      await supabase.from('inventory_logs').insert({ product_id: variant.product_id, variant_id: variant.id, sku: variant.sku, size: variant.size, change: Number(body.quantity || 0), reason: body.reason || 'manual_adjustment', previous_stock: before, new_stock: after, note: body.note });
      await auditLog('studio_variant_stock_adjusted', 'product_variant', body.variantId, { quantity: body.quantity, reason: body.reason });
      return json({ ok: true });
    }

    if (body.action === 'inventory-logs') {
      let q = supabase.from('inventory_logs').select('*').order('created_at', { ascending: false }).limit(200);
      if (body.productId) q = q.eq('product_id', body.productId);
      const { data, error } = await q;
      if (error) throw error;
      return json({ logs: data || [] });
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Studio products request failed.' }, 500);
  }
});
