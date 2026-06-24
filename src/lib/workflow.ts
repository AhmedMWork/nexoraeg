/* eslint-disable @typescript-eslint/no-explicit-any */
import type { OrderStatus } from '@/types';

export type WorkflowStatus = {
  id?: string;
  key: OrderStatus | string;
  label: string;
  description?: string;
  color?: string;
  sortOrder: number;
  isActive: boolean;
  isDefault?: boolean;
  isFinal?: boolean;
  nextStatusKey?: string | null;
};

export type FollowupTypeConfig = {
  id?: string;
  key: string;
  label: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  isQuickAction: boolean;
  templateText?: string;
};

export const DEFAULT_ORDER_WORKFLOW_STATUSES: WorkflowStatus[] = [
  { key: 'pending', label: 'Pending', description: 'New order waiting for confirmation.', color: 'amber', sortOrder: 10, isActive: true, isDefault: true, nextStatusKey: 'confirmed' },
  { key: 'confirmed', label: 'Confirmed', description: 'Customer details and payment path are confirmed.', color: 'blue', sortOrder: 20, isActive: true, nextStatusKey: 'preparing' },
  { key: 'preparing', label: 'Preparing', description: 'Items are being prepared by the team.', color: 'purple', sortOrder: 30, isActive: true, nextStatusKey: 'packed' },
  { key: 'packed', label: 'Packed', description: 'Order is packed and ready for courier handoff.', color: 'indigo', sortOrder: 40, isActive: true, nextStatusKey: 'shipped' },
  { key: 'shipped', label: 'Shipped', description: 'Shipment has left NEXORA.', color: 'cyan', sortOrder: 50, isActive: true, nextStatusKey: 'out_for_delivery' },
  { key: 'out_for_delivery', label: 'Out for Delivery', description: 'Courier is delivering the order.', color: 'sky', sortOrder: 60, isActive: true, nextStatusKey: 'delivered' },
  { key: 'delivered', label: 'Delivered', description: 'Order was delivered successfully.', color: 'green', sortOrder: 70, isActive: true, isFinal: true },
  { key: 'cancelled', label: 'Cancelled', description: 'Order was cancelled before completion.', color: 'red', sortOrder: 80, isActive: true, isFinal: true },
  { key: 'returned', label: 'Returned', description: 'Order was returned after delivery.', color: 'stone', sortOrder: 90, isActive: true, isFinal: true },
];

export const DEFAULT_FOLLOWUP_TYPES: FollowupTypeConfig[] = [
  { key: 'whatsapp_sent', label: 'WhatsApp Sent', description: 'A WhatsApp message was sent to the customer.', color: 'green', icon: 'MessageCircle', sortOrder: 10, isActive: true, isQuickAction: true, templateText: 'WhatsApp message sent.' },
  { key: 'additional_reminder', label: 'Additional Reminder', description: 'A follow-up reminder was sent.', color: 'amber', icon: 'Bell', sortOrder: 20, isActive: true, isQuickAction: true, templateText: 'Additional reminder sent.' },
  { key: 'payment_confirmed', label: 'Payment Confirmed', description: 'Payment was confirmed by the team.', color: 'emerald', icon: 'CheckCircle', sortOrder: 30, isActive: true, isQuickAction: true, templateText: 'Payment confirmed.' },
  { key: 'payment_proof_received', label: 'Payment Proof Received', description: 'Customer sent a transfer screenshot or proof.', color: 'blue', icon: 'ReceiptText', sortOrder: 40, isActive: true, isQuickAction: true, templateText: 'Payment proof received on WhatsApp.' },
  { key: 'shipping_update', label: 'Shipping Update', description: 'Shipment status or delivery details changed.', color: 'cyan', icon: 'Truck', sortOrder: 50, isActive: true, isQuickAction: true, templateText: 'Shipping update sent.' },
  { key: 'no_answer', label: 'No Answer', description: 'Customer did not answer the follow-up.', color: 'red', icon: 'PhoneOff', sortOrder: 60, isActive: true, isQuickAction: true, templateText: 'Customer did not answer.' },
  { key: 'valu_confirmed', label: 'ValU Confirmed', description: 'ValU installment confirmation was completed.', color: 'purple', icon: 'CreditCard', sortOrder: 70, isActive: true, isQuickAction: true, templateText: 'ValU installment details confirmed.' },
  { key: 'customer_requested_change', label: 'Customer Requested Change', description: 'Customer requested an order edit.', color: 'orange', icon: 'Edit3', sortOrder: 80, isActive: true, isQuickAction: false, templateText: 'Customer requested order changes.' },
  { key: 'order_edited', label: 'Order Edited', description: 'Order details were updated by admin.', color: 'gold', icon: 'Edit3', sortOrder: 90, isActive: true, isQuickAction: false, templateText: 'Order edited.' },
  { key: 'status_update', label: 'Status Update', description: 'Order status changed.', color: 'slate', icon: 'Activity', sortOrder: 100, isActive: true, isQuickAction: false, templateText: 'Order status updated.' },
  { key: 'note', label: 'Internal Note', description: 'Internal team note.', color: 'stone', icon: 'StickyNote', sortOrder: 110, isActive: true, isQuickAction: false, templateText: 'Internal note added.' },
];

export function normalizeOrderWorkflow(value?: unknown): WorkflowStatus[] {
  const rows = Array.isArray(value) ? value : [];
  const normalized = rows.map((row: any, index) => ({
    id: row.id,
    key: String(row.status_key || row.key || row.value || '').trim(),
    label: String(row.label || row.name || row.status_key || row.key || '').trim(),
    description: row.description || '',
    color: row.color || 'stone',
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? index * 10),
    isActive: row.is_active ?? row.isActive ?? true,
    isDefault: Boolean(row.is_default ?? row.isDefault),
    isFinal: Boolean(row.is_final ?? row.isFinal),
    nextStatusKey: row.next_status_key ?? row.nextStatusKey ?? null,
  })).filter((row) => row.key && row.label);
  return (normalized.length ? normalized : DEFAULT_ORDER_WORKFLOW_STATUSES).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function normalizeFollowupTypes(value?: unknown): FollowupTypeConfig[] {
  const rows = Array.isArray(value) ? value : [];
  const normalized = rows.map((row: any, index) => ({
    id: row.id,
    key: String(row.type_key || row.key || row.value || '').trim(),
    label: String(row.label || row.name || row.type_key || row.key || '').trim(),
    description: row.description || '',
    color: row.color || 'stone',
    icon: row.icon || 'StickyNote',
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? index * 10),
    isActive: row.is_active ?? row.isActive ?? true,
    isQuickAction: row.is_quick_action ?? row.isQuickAction ?? false,
    templateText: row.template_text ?? row.templateText ?? '',
  })).filter((row) => row.key && row.label);
  return (normalized.length ? normalized : DEFAULT_FOLLOWUP_TYPES).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getWorkflowStatusLabel(statuses: WorkflowStatus[], key?: string) {
  return statuses.find((status) => status.key === key)?.label || DEFAULT_ORDER_WORKFLOW_STATUSES.find((status) => status.key === key)?.label || String(key || 'Status');
}

export function getWorkflowNextStatus(statuses: WorkflowStatus[], key?: string) {
  const sorted = normalizeOrderWorkflow(statuses).filter((status) => status.isActive !== false);
  const current = sorted.find((status) => status.key === key);
  if (current?.nextStatusKey) return current.nextStatusKey;
  const index = sorted.findIndex((status) => status.key === key);
  const next = index >= 0 ? sorted[index + 1] : null;
  return next?.isFinal ? null : next?.key || null;
}

export function getFollowupTypeLabel(types: FollowupTypeConfig[], key?: string) {
  const normalizedKey = key === 'second_followup' ? 'additional_reminder' : key === 'payment_received' ? 'payment_confirmed' : key === 'shipblu' ? 'shipping_update' : key;
  return types.find((type) => type.key === normalizedKey)?.label || DEFAULT_FOLLOWUP_TYPES.find((type) => type.key === normalizedKey)?.label || String(key || 'Note');
}

export function normalizeFollowupKey(key?: string) {
  if (key === 'second_followup') return 'additional_reminder';
  if (key === 'payment_received') return 'payment_confirmed';
  if (key === 'shipblu') return 'shipping_update';
  if (key === 'waiting_screenshot') return 'payment_proof_received';
  return key || 'note';
}
