import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle, Copy, Edit3, MessageCircle, Package, Phone, Printer, Save, Send, Smartphone, Trash2, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatPrice, formatTimestamp, getStatusColor } from '@/lib/utils';
import { buildAdminOrderWhatsAppMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { getPaymentMethodLabel, getPaymentStatusLabel } from '@/lib/payments';
import { computeCheckoutTotals } from '@/lib/orderMath';
import { DEFAULT_FOLLOWUP_TYPES, DEFAULT_ORDER_WORKFLOW_STATUSES, getFollowupTypeLabel, getWorkflowNextStatus, getWorkflowStatusLabel, normalizeFollowupKey, normalizeFollowupTypes, normalizeOrderWorkflow, type FollowupTypeConfig, type WorkflowStatus } from '@/lib/workflow';
import type { Order, OrderItem, OrderStatus } from '@/types';
import { getSizeDisplayLabel, SHIPPING_ESTIMATE_TEXT } from '@/lib/sizeLabels';

const PAYMENT_STATUSES: Order['paymentStatus'][] = ['pending', 'pending_confirmation', 'waiting_transfer', 'paid', 'collected', 'failed', 'refunded'];
const PAYMENT_METHODS: Order['paymentMethod'][] = ['cod', 'instapay', 'vodafone_cash', 'valu'];

function paymentLabel(method?: string) { return getPaymentMethodLabel(method, 'en'); }
function paymentStatusLabel(status?: string) { return getPaymentStatusLabel(status, 'en'); }

function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-[28px] border border-[#e6ded1] bg-white/95 p-5 shadow-[0_18px_50px_rgba(43,33,29,0.06)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a8461]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

type EditableOrder = {
  customer: Order['customer'];
  items: OrderItem[];
  paymentMethod: Order['paymentMethod'];
  paymentStatus: Order['paymentStatus'];
  shippingFee: number;
  codFee: number;
  discount: number;
  couponCode?: string;
  reason: string;
};

function cloneOrderForEdit(order: Order): EditableOrder {
  return {
    customer: { ...order.customer },
    items: order.items.map((item) => ({ ...item })),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    shippingFee: Number(order.shippingFee || 0),
    codFee: Number(order.codFee || 0),
    discount: Number(order.discount || 0),
    couponCode: order.couponCode || '',
    reason: 'Order updated after customer request.',
  };
}

function formatError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Request failed');
  if (/Shipment not found/i.test(message)) return 'Tracking refresh failed: shipment has not been created yet. Create a ShipBlu shipment or save a manual shipment first.';
  if (/SHIPBLU_API_KEY/i.test(message)) return 'Shipment setup required: ShipBlu API key is missing in Supabase secrets. Open Store Readiness to see the exact setup issue.';
  if (/provider is not enabled/i.test(message)) return 'Shipment setup required: enable ShipBlu in Admin Shipping or use Manual Shipment.';
  if (/zone id/i.test(message)) return 'Shipment setup required: this city does not have a ShipBlu zone id. Add the zone mapping in Shipping or use Manual Shipment.';
  return message;
}

function emptyManualShipment(order: Order) {
  return {
    courier: order.shippingProvider && order.shippingProvider !== 'shipblu' ? order.shippingProvider : 'manual_courier',
    trackingNumber: order.trackingNumber || '',
    status: order.shippingStatus && order.shippingStatus !== 'not_created' ? order.shippingStatus : 'manual_created',
    notes: '',
  };
}

export default function AdminOrderDetail() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [workflowStatuses, setWorkflowStatuses] = useState<WorkflowStatus[]>(DEFAULT_ORDER_WORKFLOW_STATUSES);
  const [followupTypes, setFollowupTypes] = useState<FollowupTypeConfig[]>(DEFAULT_FOLLOWUP_TYPES);
  const [followupType, setFollowupType] = useState('whatsapp_sent');
  const [followupNote, setFollowupNote] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<EditableOrder | null>(null);
  const [isManualShipmentOpen, setIsManualShipmentOpen] = useState(false);
  const [manualShipment, setManualShipment] = useState({ courier: 'manual_courier', trackingNumber: '', status: 'manual_created', notes: '' });

  const order = useMemo(() => {
    const needle = decodeURIComponent(orderId).toLowerCase();
    return orders.find((entry) => entry.id.toLowerCase() === needle || entry.orderNumber.toLowerCase() === needle) || null;
  }, [orders, orderId]);

  const activeStatuses = useMemo(() => normalizeOrderWorkflow(workflowStatuses).filter((status) => status.isActive !== false), [workflowStatuses]);
  const activeFollowups = useMemo(() => normalizeFollowupTypes(followupTypes).filter((type) => type.isActive !== false), [followupTypes]);
  const quickFollowups = useMemo(() => activeFollowups.filter((type) => type.isQuickAction).slice(0, 6), [activeFollowups]);

  const followupLabel = (type?: string) => getFollowupTypeLabel(activeFollowups, type);
  const statusLabel = (status?: string) => getWorkflowStatusLabel(activeStatuses, status);

  const loadOrder = async () => {
    setIsLoading(true);
    try {
      const { getOrders, getAdminWorkflow } = await import('@/lib/supabase/db');
      const [loadedOrders, workflow] = await Promise.all([getOrders(), getAdminWorkflow().catch(() => ({ statuses: DEFAULT_ORDER_WORKFLOW_STATUSES, followupTypes: DEFAULT_FOLLOWUP_TYPES }))]);
      setOrders(loadedOrders);
      setWorkflowStatuses(normalizeOrderWorkflow(workflow.statuses));
      setFollowupTypes(normalizeFollowupTypes(workflow.followupTypes));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load order');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadOrder(); }, [orderId]);
  useEffect(() => {
    if (order && !isEditing) {
      setEditDraft(cloneOrderForEdit(order));
      setManualShipment(emptyManualShipment(order));
    }
  }, [order, isEditing]);

  const sortedFollowups = useMemo(() => [...(order?.followups || [])].sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt))), [order]);
  const latestFollowup = sortedFollowups[0] || null;
  const previousFollowups = sortedFollowups.slice(1);

  const editSubtotal = useMemo(() => editDraft?.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0) || 0, [editDraft]);
  const editTotals = useMemo(() => editDraft ? computeCheckoutTotals({ subtotal: editSubtotal, discount: editDraft.discount, deliveryFee: editDraft.shippingFee, codFee: editDraft.codFee, paymentMethod: editDraft.paymentMethod }) : null, [editDraft, editSubtotal]);

  const buildWhatsAppMessage = (target: Order, purpose: 'confirm' | 'payment' | 'shipping' | 'valu' = 'confirm') => buildAdminOrderWhatsAppMessage(target, purpose);

  const logFollowup = async (type: string, note: string) => {
    if (!order) return;
    const normalizedType = normalizeFollowupKey(type);
    try {
      const { addOrderFollowup } = await import('@/lib/supabase/db');
      await addOrderFollowup(order.id, normalizedType, note || followupLabel(normalizedType));
      toast.success('Follow-up saved');
      setFollowupNote('');
      await loadOrder();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save follow-up');
    }
  };

  const openWhatsApp = async (purpose: 'confirm' | 'payment' | 'shipping' | 'valu') => {
    if (!order) return;
    const message = buildWhatsAppMessage(order, purpose);
    window.open(buildWhatsAppUrl(order.customer.phone, message), '_blank', 'noopener,noreferrer');
    await logFollowup(purpose === 'payment' ? 'additional_reminder' : purpose === 'valu' ? 'valu_confirmed' : purpose === 'shipping' ? 'shipping_update' : 'whatsapp_sent', message);
  };

  const updateStatus = async (status: OrderStatus | string) => {
    if (!order) return;
    const selected = activeStatuses.find((item) => item.key === status);
    if (selected?.isFinal && !window.confirm(`Move order to final status: ${selected.label}?`)) return;
    try {
      const { updateOrderStatus } = await import('@/lib/supabase/db');
      await updateOrderStatus(order.id, status as OrderStatus, `Status changed: ${statusLabel(order.status)} → ${statusLabel(status)}`, 'studio');
      toast.success('Order status updated');
      await loadOrder();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update order');
    }
  };

  const updatePayment = async (paymentStatus: Order['paymentStatus']) => {
    if (!order) return;
    try {
      const { updateOrderPaymentStatus } = await import('@/lib/supabase/db');
      await updateOrderPaymentStatus(order.id, paymentStatus, paymentReference, paymentNotes);
      toast.success('Payment status updated');
      await loadOrder();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update payment');
    }
  };

  const markPaid = async () => {
    if (!order) return;
    try {
      const { markOrderPaymentCollected } = await import('@/lib/supabase/db');
      await markOrderPaymentCollected(order.id);
      toast.success('Payment confirmed');
      await loadOrder();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not mark payment as paid');
    }
  };

  const createShipment = async () => {
    if (!order) return;
    try {
      const { createOrderShipment } = await import('@/lib/supabase/db');
      await createOrderShipment(order.id);
      await logFollowup('shipping_update', 'ShipBlu shipment requested.');
      toast.success('Shipment request sent');
      await loadOrder();
    } catch (error) {
      toast.error(formatError(error));
      setIsManualShipmentOpen(true);
    }
  };

  const refreshShipment = async () => {
    if (!order) return;
    try {
      const { refreshOrderShipment } = await import('@/lib/supabase/db');
      await refreshOrderShipment(order.id);
      await logFollowup('shipping_update', 'Shipment status refreshed.');
      toast.success('Shipment refreshed');
      await loadOrder();
    } catch (error) {
      toast.error(formatError(error));
    }
  };

  const saveManualShipment = async () => {
    if (!order) return;
    try {
      const { createManualShipment } = await import('@/lib/supabase/db');
      await createManualShipment(order.id, manualShipment);
      await logFollowup('shipping_update', `Manual shipment saved: ${manualShipment.courier} ${manualShipment.trackingNumber || ''}`.trim());
      toast.success('Manual shipment saved');
      setIsManualShipmentOpen(false);
      await loadOrder();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save manual shipment');
    }
  };

  const startEdit = () => {
    if (!order) return;
    setEditDraft(cloneOrderForEdit(order));
    setIsEditing(true);
  };
  const updateDraftItem = (index: number, patch: Partial<OrderItem>) => setEditDraft((current) => current ? { ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) } : current);
  const removeDraftItem = (index: number) => setEditDraft((current) => current ? { ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) } : current);
  const addDraftItem = () => setEditDraft((current) => current ? { ...current, items: [...current.items, { productId: '', name: 'New product', slug: '', price: 0, size: '', quantity: 1, image: '/assets/nexora-logo.png' }] } : current);

  const saveOrderEdit = async () => {
    if (!order || !editDraft || !editTotals) return;
    if (!editDraft.items.length) { toast.error('Cannot save an order without items.'); return; }
    try {
      const { updateOrderAdmin } = await import('@/lib/supabase/db');
      await updateOrderAdmin({
        orderId: order.id,
        customer: editDraft.customer,
        items: editDraft.items,
        paymentMethod: editDraft.paymentMethod,
        paymentStatus: editDraft.paymentStatus,
        shippingFee: editDraft.shippingFee,
        codFee: editTotals.codFee,
        discount: editDraft.discount,
        couponCode: editDraft.couponCode,
        reason: editDraft.reason,
      });
      toast.success('Order updated and change log saved');
      setIsEditing(false);
      await loadOrder();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update order');
    }
  };

  if (isLoading) return <div className="p-8 text-sm text-[#8a8175]">Loading order...</div>;
  if (!order) return (
    <div className="space-y-4 p-6" dir="ltr">
      <button onClick={() => navigate('/nexora-admin/orders')} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-4 py-2 text-xs font-bold text-[#5f584f]"><ArrowRight className="h-4 w-4" /> Back to orders</button>
      <Card title="Order not found"><p className="text-sm text-[#8a8175]">Could not find this order. Refresh the orders list and try again.</p></Card>
    </div>
  );

  const nextStatus = getWorkflowNextStatus(activeStatuses, order.status);
  const canCreateShipment = !order.trackingNumber;

  return (
    <div className="space-y-6 text-[#2b211d] print:bg-white" dir="ltr">
      <div className="flex flex-col gap-4 rounded-[32px] border border-[#e6ded1] bg-[#fbf7ef] p-5 lg:flex-row lg:items-center lg:justify-between print:border-0 print:bg-white">
        <div>
          <div className="mb-3 flex flex-wrap gap-2 print:hidden">
            <button onClick={() => navigate('/nexora-admin/orders')} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#5f584f]"><ArrowRight className="h-3.5 w-3.5" /> Back</button>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a8461]">Order Details</p>
          <h1 className="mt-2 text-3xl font-black tracking-[0.08em] text-[#2b211d]">{order.orderNumber}</h1>
          <p className="mt-1 text-xs text-[#8a8175]">{formatTimestamp(order.createdAt, 'en-EG')} · {order.items.length} item{order.items.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button onClick={startEdit} className="inline-flex items-center gap-2 rounded-full bg-[#b99a62] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><Edit3 className="h-3.5 w-3.5" /> Edit Order</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f584f]"><Printer className="h-3.5 w-3.5" /> Print</button>
          <button onClick={() => void openWhatsApp('confirm')} className="inline-flex items-center gap-2 rounded-full bg-[#2b211d] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</button>
        </div>
      </div>

      {isEditing && editDraft && editTotals && (
        <section className="rounded-[32px] border border-[#d7b98e] bg-[#fffaf2] p-5 shadow-[0_22px_70px_rgba(185,154,98,0.14)] print:hidden">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a8461]">Edit Mode</p><h2 className="mt-1 text-xl font-black text-[#2b211d]">Edit customer, items, and payment details</h2><p className="mt-1 text-xs leading-6 text-[#8a8175]">Every change is recorded in the follow-up history for a clear order timeline.</p></div>
            <div className="flex flex-wrap gap-2"><button onClick={saveOrderEdit} className="nexora-button-primary"><Save className="h-4 w-4" /> Save Changes</button><button onClick={() => setIsEditing(false)} className="nexora-button">Cancel</button></div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Customer Details"><div className="grid gap-3"><input value={editDraft.customer.fullName} onChange={(event) => setEditDraft({ ...editDraft, customer: { ...editDraft.customer, fullName: event.target.value } })} className="studio-input" placeholder="Customer name" /><input value={editDraft.customer.phone} onChange={(event) => setEditDraft({ ...editDraft, customer: { ...editDraft.customer, phone: event.target.value } })} className="studio-input" placeholder="Phone number" dir="ltr" /><input value={editDraft.customer.governorate} onChange={(event) => setEditDraft({ ...editDraft, customer: { ...editDraft.customer, governorate: event.target.value } })} className="studio-input" placeholder="Governorate" /><input value={editDraft.customer.city} onChange={(event) => setEditDraft({ ...editDraft, customer: { ...editDraft.customer, city: event.target.value } })} className="studio-input" placeholder="City" /><textarea value={editDraft.customer.address} onChange={(event) => setEditDraft({ ...editDraft, customer: { ...editDraft.customer, address: event.target.value } })} className="studio-input min-h-24" placeholder="Detailed address" /></div></Card>
            <Card title="Payment & Shipping"><div className="grid gap-3"><select value={editDraft.paymentMethod} onChange={(event) => setEditDraft({ ...editDraft, paymentMethod: event.target.value as Order['paymentMethod'] })} className="studio-input">{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{paymentLabel(method)}</option>)}</select><select value={editDraft.paymentStatus} onChange={(event) => setEditDraft({ ...editDraft, paymentStatus: event.target.value as Order['paymentStatus'] })} className="studio-input">{PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{paymentStatusLabel(status)}</option>)}</select><input type="number" min="0" value={editDraft.shippingFee} onChange={(event) => setEditDraft({ ...editDraft, shippingFee: Number(event.target.value) })} className="studio-input" placeholder="Shipping" /><input type="number" min="0" value={editDraft.codFee} onChange={(event) => setEditDraft({ ...editDraft, codFee: Number(event.target.value) })} className="studio-input" placeholder="COD fee" /><input type="number" min="0" value={editDraft.discount} onChange={(event) => setEditDraft({ ...editDraft, discount: Number(event.target.value) })} className="studio-input" placeholder="Discount" /><input value={editDraft.couponCode || ''} onChange={(event) => setEditDraft({ ...editDraft, couponCode: event.target.value.toUpperCase() })} className="studio-input" placeholder="Coupon code" /></div></Card>
            <Card title="New Total"><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-[#8a8175]">Items</span><span>{formatPrice(editSubtotal)}</span></div><div className="flex justify-between"><span className="text-[#8a8175]">Discount</span><span>-{formatPrice(editDraft.discount)}</span></div><div className="flex justify-between"><span className="text-[#8a8175]">Shipping</span><span>{formatPrice(editDraft.shippingFee)}</span></div>{editDraft.paymentMethod === 'cod' && <div className="flex justify-between"><span className="text-[#8a8175]">COD fee</span><span>{formatPrice(editTotals.codFee)}</span></div>}<div className="flex justify-between border-t border-[#efe8dc] pt-3 text-lg font-black"><span>Total</span><span>{formatPrice(editTotals.total)}</span></div></div><textarea value={editDraft.reason} onChange={(event) => setEditDraft({ ...editDraft, reason: event.target.value })} className="studio-input mt-4 min-h-20" placeholder="Change reason" /></Card>
          </div>
          <Card title="Editable Items"><div className="space-y-3">{editDraft.items.map((item, index) => <div key={`${item.productId}-${index}`} className="grid gap-2 rounded-3xl border border-[#efe8dc] bg-white p-3 md:grid-cols-[1.5fr_90px_120px_110px_90px_auto]"><input value={item.name} onChange={(event) => updateDraftItem(index, { name: event.target.value })} className="studio-input" placeholder="Product name" /><input value={item.size || ''} onChange={(event) => updateDraftItem(index, { size: event.target.value })} className="studio-input" placeholder="Size" /><input value={item.color || ''} onChange={(event) => updateDraftItem(index, { color: event.target.value })} className="studio-input" placeholder="Color" /><input type="number" min="0" value={item.price} onChange={(event) => updateDraftItem(index, { price: Number(event.target.value) })} className="studio-input" placeholder="Price" /><input type="number" min="1" value={item.quantity} onChange={(event) => updateDraftItem(index, { quantity: Number(event.target.value) })} className="studio-input" placeholder="Qty" /><button onClick={() => removeDraftItem(index)} className="nexora-button justify-center text-red-700"><Trash2 className="h-4 w-4" /></button></div>)}<button onClick={addDraftItem} className="nexora-button">Add Item</button></div></Card>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Customer Details"><p className="text-lg font-black text-[#2b211d]">{order.customer.fullName}</p><p className="mt-1 text-sm text-[#5f584f]" dir="ltr">{order.customer.phone}</p><p className="mt-3 text-xs leading-6 text-[#8a8175]">{order.customer.address}<br />{order.customer.city}, {order.customer.governorate}</p><div className="mt-4 flex flex-wrap gap-2 print:hidden"><a href={`tel:${order.customer.phone}`} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#5f584f]"><Phone className="h-3.5 w-3.5" /> Call</a><button onClick={() => void openWhatsApp('payment')} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#5f584f]"><Smartphone className="h-3.5 w-3.5" /> Payment message</button></div></Card>
        <Card title="Payment"><p className="text-sm font-black text-[#2b211d]">{paymentLabel(order.paymentMethod)}</p><p className="mt-1 text-xs text-[#8a8175]">{paymentStatusLabel(order.paymentStatus)} · <span dir="ltr">{order.paymentConfirmationPhone || '01037141322'}</span></p><div className="mt-4 grid gap-2 print:hidden"><select value={order.paymentStatus} onChange={(event) => void updatePayment(event.target.value as Order['paymentStatus'])} className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none">{PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{paymentStatusLabel(status)}</option>)}</select><input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Transaction / reference number" className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none" /><input value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} placeholder="Payment notes" className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none" /><button onClick={markPaid} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-green-700"><CheckCircle className="h-3.5 w-3.5" /> Confirm Payment</button></div></Card>
        <Card title="Shipping"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#faf0e3] text-[#9a6c3d]"><Truck className="h-5 w-5" /></span><div><p className="text-sm font-black text-[#2b211d]">{order.shippingProvider || 'ShipBlu'} · {order.shippingStatus || 'not_created'}</p><p className="mt-1 text-xs text-[#8a8175]">ETA: {order.deliveryEstimate || SHIPPING_ESTIMATE_TEXT}</p>{order.trackingNumber && <p className="mt-2 text-xs font-bold text-[#b99a62]">Tracking: {order.trackingNumber}</p>}</div></div><div className="mt-4 flex flex-wrap gap-2 print:hidden"><button onClick={createShipment} disabled={!canCreateShipment} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#5f584f] disabled:opacity-50"><Truck className="h-3.5 w-3.5" /> Create Shipment</button><button onClick={refreshShipment} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#5f584f]"><Truck className="h-3.5 w-3.5" /> Refresh</button><button onClick={() => setIsManualShipmentOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-full border border-[#d7b98e] bg-[#fffaf2] px-3 py-2 text-[10px] font-bold uppercase text-[#8a6c3d]">Manual Shipment</button></div>{isManualShipmentOpen && <div className="mt-4 grid gap-2 rounded-3xl border border-[#efe8dc] bg-[#faf7f1] p-3 print:hidden"><input value={manualShipment.courier} onChange={(e) => setManualShipment({ ...manualShipment, courier: e.target.value })} className="studio-input" placeholder="Courier" /><input value={manualShipment.trackingNumber} onChange={(e) => setManualShipment({ ...manualShipment, trackingNumber: e.target.value })} className="studio-input" placeholder="Tracking number" /><input value={manualShipment.status} onChange={(e) => setManualShipment({ ...manualShipment, status: e.target.value })} className="studio-input" placeholder="Shipping status" /><textarea value={manualShipment.notes} onChange={(e) => setManualShipment({ ...manualShipment, notes: e.target.value })} className="studio-input" placeholder="Delivery notes" /><button onClick={saveManualShipment} className="nexora-button-primary"><Save className="h-4 w-4" /> Save Manual Shipment</button></div>}</Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card title="Order Items"><div className="space-y-3">{order.items.map((item, index) => <div key={`${item.productId}-${item.variantId || index}`} className="flex gap-4 rounded-3xl border border-[#efe8dc] bg-[#faf7f1] p-3"><img src={item.image || '/assets/nexora-logo.png'} alt={item.name} className="h-24 w-24 rounded-2xl bg-white object-cover" /><div className="min-w-0 flex-1"><p className="font-bold text-[#2b211d]">{item.name}</p><p className="mt-1 text-xs text-[#8a8175]">Size: {item.sizeLabel || getSizeDisplayLabel(item.size, item.weightRange)}{item.color ? ` · Color: ${item.color}` : ''}</p><p className="mt-1 text-xs text-[#8a8175]">Qty: {item.quantity} · Unit price: {formatPrice(item.price)}</p></div><p className="shrink-0 text-sm font-black text-[#2b211d]">{formatPrice(item.lineTotal || item.price * item.quantity)}</p></div>)}</div><div className="mt-5 space-y-2 rounded-3xl bg-white p-4 text-sm"><div className="flex justify-between"><span className="text-[#8a8175]">Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>{order.discount > 0 && <div className="flex justify-between"><span className="text-[#8a8175]">Discount</span><span>-{formatPrice(order.discount)}</span></div>}<div className="flex justify-between"><span className="text-[#8a8175]">Shipping</span><span>{formatPrice(order.shippingFee)}</span></div>{order.paymentMethod === 'cod' && Number(order.codFee || 0) > 0 && <div className="flex justify-between"><span className="text-[#8a8175]">COD fee</span><span>{formatPrice(Number(order.codFee || 0))}</span></div>}<div className="flex justify-between border-t border-[#efe8dc] pt-3 text-lg font-black text-[#2b211d]"><span>Total</span><span>{formatPrice(order.total)}</span></div></div></Card>

        <Card title="Follow-up History" action={<button onClick={() => navigate('/nexora-admin/workflow')} className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#b99a62]">Edit types</button>}>
          {latestFollowup && <div className="mb-4 rounded-[24px] border border-[#d7b98e] bg-[#fffaf2] p-4 shadow-[0_16px_42px_rgba(185,154,98,0.12)]"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#b99a62]">Latest Activity</p><h4 className="mt-2 text-sm font-black text-[#2b211d]">{followupLabel(latestFollowup.type)}</h4><p className="mt-1 text-xs leading-6 text-[#5f584f]">{latestFollowup.note || '—'}</p><p className="mt-2 text-[10px] text-[#9a8461]">{formatTimestamp(latestFollowup.createdAt, 'en-EG')} · {latestFollowup.createdBy || 'studio'}</p></div>}
          <div className="space-y-3 print:hidden"><div className="grid gap-2"><select value={followupType} onChange={(event) => setFollowupType(event.target.value)} className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none">{activeFollowups.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select><textarea value={followupNote} onChange={(event) => setFollowupNote(event.target.value)} rows={3} placeholder="Example: confirmation sent / no answer / payment proof received / ValU confirmed" className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none" /><button onClick={() => void logFollowup(followupType, followupNote)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2b211d] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><Send className="h-3.5 w-3.5" /> Save follow-up</button></div><div className="flex flex-wrap gap-2">{quickFollowups.map((type) => <button key={type.key} onClick={() => void logFollowup(type.key, type.templateText || type.label)} className="rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#5f584f]">{type.label}</button>)}<button onClick={() => navigator.clipboard.writeText(buildWhatsAppMessage(order)).then(() => toast.success('Copied'))} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#5f584f]"><Copy className="h-3.5 w-3.5" /> Copy</button></div></div>
          <div className="mt-4 space-y-2">{previousFollowups.length ? previousFollowups.map((entry) => <div key={entry.id} className="rounded-2xl border border-[#efe8dc] bg-white px-3 py-2 text-xs"><p className="font-bold text-[#2b211d]">{followupLabel(entry.type)}</p><p className="mt-1 text-[#5f584f]">{entry.note || '—'}</p><p className="mt-1 text-[10px] text-[#9a8461]">{formatTimestamp(entry.createdAt, 'en-EG')} · {entry.createdBy || 'studio'}</p></div>) : <p className="text-xs text-[#8a8175]">No previous follow-ups.</p>}</div>
        </Card>
      </div>

      <div className="rounded-[28px] border border-[#e6ded1] bg-white p-5 print:hidden">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a8461]">Order Status</h3><p className="mt-2 text-xs text-[#8a8175]">Current status: <strong className="text-[#2b211d]">{statusLabel(order.status)}</strong></p></div>{nextStatus && <button onClick={() => void updateStatus(nextStatus)} className="inline-flex items-center gap-2 rounded-full bg-[#b99a62] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><Package className="h-3.5 w-3.5" /> Move to {statusLabel(nextStatus)}</button>}</div>
        <div className="mb-4 flex flex-wrap gap-2"><span className={`status-badge ${getStatusColor(order.status)} text-[10px]`}>{statusLabel(order.status)}</span><span className="rounded-full border border-[#e6ded1] px-3 py-1 text-[10px] font-bold uppercase text-[#5f584f]">{paymentLabel(order.paymentMethod)}</span><span className="rounded-full border border-[#e6ded1] px-3 py-1 text-[10px] font-bold uppercase text-[#5f584f]">{paymentStatusLabel(order.paymentStatus)}</span></div>
        <div className="flex flex-wrap gap-2">{activeStatuses.map((status) => <button key={status.key} onClick={() => void updateStatus(status.key)} className={`rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${order.status === status.key ? 'border-[#b99a62] bg-[#b99a62]/10 text-[#b99a62]' : 'border-[#e6ded1] bg-white text-[#5f584f] hover:border-[#b99a62]'}`}>{status.label}</button>)}</div>
      </div>
    </div>
  );
}
