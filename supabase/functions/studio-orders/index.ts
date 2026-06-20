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

    return json({ error: 'Unknown action.' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Studio orders request failed.' }, 500);
  }
});
