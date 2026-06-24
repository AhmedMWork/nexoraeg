/* eslint-disable @typescript-eslint/no-explicit-any */
import { corsHeaders, json, requireStudio, serviceClient, auditLog } from '../_shared/studio.ts';

const defaultStatuses = [
  { status_key: 'pending', label: 'Pending', description: 'New order waiting for confirmation.', color: 'amber', sort_order: 10, is_active: true, is_default: true, is_final: false, next_status_key: 'confirmed' },
  { status_key: 'confirmed', label: 'Confirmed', description: 'Customer details and payment path are confirmed.', color: 'blue', sort_order: 20, is_active: true, is_default: false, is_final: false, next_status_key: 'preparing' },
  { status_key: 'preparing', label: 'Preparing', description: 'Items are being prepared.', color: 'purple', sort_order: 30, is_active: true, is_default: false, is_final: false, next_status_key: 'packed' },
  { status_key: 'packed', label: 'Packed', description: 'Order is packed.', color: 'indigo', sort_order: 40, is_active: true, is_default: false, is_final: false, next_status_key: 'shipped' },
  { status_key: 'shipped', label: 'Shipped', description: 'Shipment has left NEXORA.', color: 'cyan', sort_order: 50, is_active: true, is_default: false, is_final: false, next_status_key: 'out_for_delivery' },
  { status_key: 'out_for_delivery', label: 'Out for Delivery', description: 'Courier is delivering the order.', color: 'sky', sort_order: 60, is_active: true, is_default: false, is_final: false, next_status_key: 'delivered' },
  { status_key: 'delivered', label: 'Delivered', description: 'Order was delivered.', color: 'green', sort_order: 70, is_active: true, is_default: false, is_final: true, next_status_key: null },
  { status_key: 'cancelled', label: 'Cancelled', description: 'Order was cancelled.', color: 'red', sort_order: 80, is_active: true, is_default: false, is_final: true, next_status_key: null },
  { status_key: 'returned', label: 'Returned', description: 'Order was returned.', color: 'stone', sort_order: 90, is_active: true, is_default: false, is_final: true, next_status_key: null },
];

const defaultFollowups = [
  { type_key: 'whatsapp_sent', label: 'WhatsApp Sent', description: 'A WhatsApp message was sent.', icon: 'MessageCircle', color: 'green', sort_order: 10, is_active: true, is_quick_action: true, template_text: 'WhatsApp message sent.' },
  { type_key: 'additional_reminder', label: 'Additional Reminder', description: 'A follow-up reminder was sent.', icon: 'Bell', color: 'amber', sort_order: 20, is_active: true, is_quick_action: true, template_text: 'Additional reminder sent.' },
  { type_key: 'payment_confirmed', label: 'Payment Confirmed', description: 'Payment was confirmed.', icon: 'CheckCircle', color: 'emerald', sort_order: 30, is_active: true, is_quick_action: true, template_text: 'Payment confirmed.' },
  { type_key: 'payment_proof_received', label: 'Payment Proof Received', description: 'Customer sent payment proof.', icon: 'ReceiptText', color: 'blue', sort_order: 40, is_active: true, is_quick_action: true, template_text: 'Payment proof received.' },
  { type_key: 'shipping_update', label: 'Shipping Update', description: 'Shipment update.', icon: 'Truck', color: 'cyan', sort_order: 50, is_active: true, is_quick_action: true, template_text: 'Shipping update sent.' },
  { type_key: 'no_answer', label: 'No Answer', description: 'Customer did not answer.', icon: 'PhoneOff', color: 'red', sort_order: 60, is_active: true, is_quick_action: true, template_text: 'Customer did not answer.' },
  { type_key: 'valu_confirmed', label: 'ValU Confirmed', description: 'ValU confirmation completed.', icon: 'CreditCard', color: 'purple', sort_order: 70, is_active: true, is_quick_action: true, template_text: 'ValU installment details confirmed.' },
  { type_key: 'customer_requested_change', label: 'Customer Requested Change', description: 'Customer requested an order edit.', icon: 'Edit3', color: 'orange', sort_order: 80, is_active: true, is_quick_action: false, template_text: 'Customer requested order changes.' },
  { type_key: 'order_edited', label: 'Order Edited', description: 'Order details were edited.', icon: 'Edit3', color: 'gold', sort_order: 90, is_active: true, is_quick_action: false, template_text: 'Order edited.' },
  { type_key: 'status_update', label: 'Status Update', description: 'Order status changed.', icon: 'Activity', color: 'slate', sort_order: 100, is_active: true, is_quick_action: false, template_text: 'Order status updated.' },
  { type_key: 'note', label: 'Internal Note', description: 'Internal note.', icon: 'StickyNote', color: 'stone', sort_order: 110, is_active: true, is_quick_action: false, template_text: 'Internal note added.' },
];

function statusToRow(row: any, index: number) {
  return {
    status_key: String(row.key || row.status_key || '').trim(),
    label: String(row.label || '').trim(),
    description: row.description || null,
    color: row.color || 'stone',
    sort_order: Number(row.sortOrder ?? row.sort_order ?? index * 10),
    is_active: row.isActive ?? row.is_active ?? true,
    is_default: Boolean(row.isDefault ?? row.is_default),
    is_final: Boolean(row.isFinal ?? row.is_final),
    next_status_key: row.nextStatusKey ?? row.next_status_key ?? null,
  };
}
function followupToRow(row: any, index: number) {
  return {
    type_key: String(row.key || row.type_key || '').trim(),
    label: String(row.label || '').trim(),
    description: row.description || null,
    icon: row.icon || 'StickyNote',
    color: row.color || 'stone',
    sort_order: Number(row.sortOrder ?? row.sort_order ?? index * 10),
    is_active: row.isActive ?? row.is_active ?? true,
    is_quick_action: row.isQuickAction ?? row.is_quick_action ?? false,
    template_text: row.templateText ?? row.template_text ?? '',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const blocked = await requireStudio(req); if (blocked) return blocked;
  const supabase = serviceClient();
  const body = await req.json().catch(() => ({}));

  try {
    if (body.action === 'get' || !body.action) {
      const { data: loadedStatuses, error: statusError } = await supabase.from('order_statuses').select('*').order('sort_order');
      if (statusError) throw statusError;
      const { data: loadedFollowupTypes, error: followupError } = await supabase.from('followup_types').select('*').order('sort_order');
      if (followupError) throw followupError;
      let statuses = loadedStatuses;
      let followupTypes = loadedFollowupTypes;
      if (!statuses?.length) {
        const { data } = await supabase.from('order_statuses').upsert(defaultStatuses, { onConflict: 'status_key' }).select('*').order('sort_order');
        statuses = data || defaultStatuses;
      }
      if (!followupTypes?.length) {
        const { data } = await supabase.from('followup_types').upsert(defaultFollowups, { onConflict: 'type_key' }).select('*').order('sort_order');
        followupTypes = data || defaultFollowups;
      }
      return json({ statuses, followupTypes }, 200, req);
    }

    if (body.action === 'save') {
      const statuses = Array.isArray(body.statuses) ? body.statuses.map(statusToRow).filter((row: any) => row.status_key && row.label) : [];
      const followupTypes = Array.isArray(body.followupTypes) ? body.followupTypes.map(followupToRow).filter((row: any) => row.type_key && row.label) : [];
      if (statuses.length) {
        const { error } = await supabase.from('order_statuses').upsert(statuses, { onConflict: 'status_key' });
        if (error) throw error;
      }
      if (followupTypes.length) {
        const { error } = await supabase.from('followup_types').upsert(followupTypes, { onConflict: 'type_key' });
        if (error) throw error;
      }
      await auditLog('workflow_saved', 'workflow', 'main', { statuses: statuses.length, followupTypes: followupTypes.length });
      return json({ ok: true }, 200, req);
    }

    return json({ error: 'Unknown workflow action.' }, 400, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Workflow request failed.' }, 500, req);
  }
});
