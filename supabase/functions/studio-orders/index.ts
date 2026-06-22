import { corsHeaders, json, requireStudio, serviceClient, auditLog } from '../_shared/studio.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const blocked = await requireStudio(req); if (blocked) return blocked;
  const supabase = serviceClient();
  const body = await req.json().catch(() => ({}));

  try {
    if (body.action === 'list') {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;

      const orderIds = (orders || []).map((o) => o.id);
      const { data: items } = orderIds.length
        ? await supabase.from('order_items').select('*').in('order_id', orderIds).order('created_at', { ascending: true })
        : { data: [] };
      const { data: followups } = orderIds.length
        ? await supabase.from('order_followups').select('*').in('order_id', orderIds).order('created_at', { ascending: false })
        : { data: [] };

      return json({ orders: orders || [], items: items || [], followups: followups || [] });
    }

    if (body.action === 'update-status') {
      const { data: order } = await supabase.from('orders').select('order_status, status_history').eq('id', body.orderId).single();
      const history = Array.isArray(order?.status_history) ? order.status_history : [];
      const oldStatus = order?.order_status || null;
      const message = body.message || `Order marked as ${body.status}`;
      history.push({ status: body.status, message, timestamp: new Date().toISOString(), updatedBy: body.updatedBy || 'studio' });
      await supabase.from('orders').update({ order_status: body.status, status_history: history, updated_at: new Date().toISOString() }).eq('id', body.orderId);
      await supabase.from('order_status_history').insert({ order_id: body.orderId, old_status: oldStatus, new_status: body.status, note: message, changed_by: body.updatedBy || 'studio' }).then(() => undefined);
      await supabase.from('order_followups').insert({ order_id: body.orderId, type: 'status_update', note: message, created_by: body.updatedBy || 'studio' }).then(() => undefined);
      await auditLog('studio_order_status_updated', 'order', body.orderId, { oldStatus, newStatus: body.status });
      return json({ ok: true });
    }

    if (body.action === 'mark-payment-collected') {
      await supabase.from('orders').update({ payment_status: 'collected', payment_confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', body.orderId);
      await supabase.from('order_followups').insert({ order_id: body.orderId, type: 'payment_received', note: 'Payment marked as collected/received.', created_by: 'studio' }).then(() => undefined);
      await auditLog('studio_order_payment_collected', 'order', body.orderId, {});
      return json({ ok: true });
    }

    if (body.action === 'update-payment-status') {
      const patch: Record<string, unknown> = {
        payment_status: body.paymentStatus || 'pending',
        payment_reference: body.paymentReference || null,
        payment_notes: body.paymentNotes || null,
        updated_at: new Date().toISOString(),
      };
      if (['paid', 'collected'].includes(String(body.paymentStatus))) patch.payment_confirmed_at = new Date().toISOString();
      await supabase.from('orders').update(patch).eq('id', body.orderId);
      await supabase.from('order_followups').insert({
        order_id: body.orderId,
        type: String(body.paymentStatus) === 'paid' ? 'payment_received' : 'payment_update',
        note: body.paymentNotes || `Payment status updated to ${body.paymentStatus}`,
        created_by: 'studio',
      }).then(() => undefined);
      await auditLog('studio_order_payment_updated', 'order', body.orderId, { paymentStatus: body.paymentStatus });
      return json({ ok: true });
    }

    if (body.action === 'add-followup') {
      const note = String(body.note || '').trim();
      if (!note) return json({ error: 'Follow-up note is required.' }, 400);
      await supabase.from('order_followups').insert({
        order_id: body.orderId,
        type: body.type || 'note',
        note,
        created_by: body.createdBy || 'studio',
      });
      await supabase.from('orders').update({ followup_status: body.type || 'note', updated_at: new Date().toISOString() }).eq('id', body.orderId).then(() => undefined);
      await auditLog('studio_order_followup_added', 'order', body.orderId, { type: body.type || 'note' });
      return json({ ok: true });
    }


    if (body.action === 'update-order-admin') {
      const orderId = String(body.orderId || '');
      if (!orderId) return json({ error: 'Order id is required.' }, 400);

      const { data: existing, error: existingError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      if (existingError || !existing) throw existingError || new Error('Order not found.');

      const items = Array.isArray(body.items) ? body.items : null;
      const subtotal = items
        ? items.reduce((sum: number, item: Record<string, unknown>) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0)
        : Number(existing.subtotal || 0);
      const discount = Number(body.discount ?? existing.discount_total ?? 0);
      const shippingFee = Number(body.shippingFee ?? existing.shipping_fee ?? 0);
      const paymentMethod = String(body.paymentMethod || existing.payment_method || 'cod');
      const codFee = paymentMethod === 'cod' ? Number(body.codFee ?? existing.cod_fee ?? 0) : 0;
      const total = Math.max(0, subtotal - discount + shippingFee + codFee);
      const customer = body.customer || {};
      const statusHistory = Array.isArray(existing.status_history) ? existing.status_history : [];
      const reason = String(body.reason || 'تم تعديل الطلب من لوحة التحكم.');
      statusHistory.push({ status: existing.order_status || 'pending', message: reason, timestamp: new Date().toISOString(), updatedBy: 'studio' });

      const patch: Record<string, unknown> = {
        customer_name: customer.fullName ?? existing.customer_name,
        customer_phone: customer.phone ?? existing.customer_phone,
        customer_email: customer.email ?? existing.customer_email,
        governorate: customer.governorate ?? existing.governorate,
        city: customer.city ?? existing.city,
        address: customer.address ?? existing.address,
        notes: customer.notes ?? existing.notes,
        subtotal,
        discount_total: discount,
        shipping_fee: shippingFee,
        cod_fee: codFee,
        total,
        coupon_code: body.couponCode ?? existing.coupon_code,
        payment_method: paymentMethod,
        payment_status: body.paymentStatus || existing.payment_status,
        status_history: statusHistory,
        updated_at: new Date().toISOString(),
      };

      const { error: orderUpdateError } = await supabase.from('orders').update(patch).eq('id', orderId);
      if (orderUpdateError) throw orderUpdateError;

      if (items) {
        const { error: deleteError } = await supabase.from('order_items').delete().eq('order_id', orderId);
        if (deleteError) throw deleteError;
        const rows = items.map((item: Record<string, unknown>) => {
          const quantity = Math.max(1, Number(item.quantity || 1));
          const price = Math.max(0, Number(item.price || 0));
          const productId = String(item.productId || item.product_id || '').trim() || null;
          const variantId = String(item.variantId || item.variant_id || '').trim() || null;
          return {
            order_id: orderId,
            product_id: productId,
            variant_id: variantId,
            product_name: String(item.name || item.product_name || 'NEXORA item'),
            slug: String(item.slug || ''),
            size: String(item.size || ''),
            color: item.color ? String(item.color) : null,
            color_hex: item.colorHex ? String(item.colorHex) : null,
            color_pattern: item.colorPattern ? String(item.colorPattern) : null,
            quantity,
            unit_price: price,
            total: price * quantity,
            image: String(item.image || ''),
            size_label: item.sizeLabel ? String(item.sizeLabel) : null,
            weight_range: item.weightRange ? String(item.weightRange) : null,
            product_snapshot: item.productSnapshot || {},
          };
        });
        if (rows.length) {
          const { error: insertError } = await supabase.from('order_items').insert(rows);
          if (insertError) throw insertError;
        }
      }

      await supabase.from('order_followups').insert({
        order_id: orderId,
        type: 'order_edited',
        note: reason,
        created_by: 'studio',
      }).then(() => undefined);
      await supabase.from('order_events').insert({
        order_id: orderId,
        event_type: 'order_edited',
        title: 'تم تعديل الطلب',
        note: reason,
        metadata: { beforeTotal: existing.total, afterTotal: total, paymentMethod },
        created_by: 'studio',
      }).then(() => undefined);
      await auditLog('studio_order_edited', 'order', orderId, { beforeTotal: existing.total, afterTotal: total, paymentMethod });
      return json({ ok: true, total });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Studio orders request failed.' }, 500);
  }
});
