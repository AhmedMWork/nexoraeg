import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle, Copy, Edit3, MessageCircle, Package, Phone, Printer, Save, Send, Ship, Smartphone, Trash2, Truck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatPrice, formatTimestamp, getStatusColor, getStatusLabel, getNextStatus } from '@/lib/utils';
import { buildAdminOrderWhatsAppMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { getPaymentMethodLabel, getPaymentStatusLabel } from '@/lib/payments';
import { computeCheckoutTotals } from '@/lib/orderMath';
import type { Order, OrderItem, OrderStatus } from '@/types';
import { getSizeDisplayLabel, SHIPPING_ESTIMATE_TEXT } from '@/lib/sizeLabels';

const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];
const PAYMENT_STATUSES: Order['paymentStatus'][] = ['pending', 'pending_confirmation', 'waiting_transfer', 'paid', 'collected', 'failed', 'refunded'];
const PAYMENT_METHODS: Order['paymentMethod'][] = ['cod', 'instapay', 'vodafone_cash', 'valu'];

const FOLLOWUP_TYPES = [
  { value: 'whatsapp_sent', label: 'WhatsApp sent' },
  { value: 'second_followup', label: 'Additional reminder' },
  { value: 'reminder_sent', label: 'Reminder sent' },
  { value: 'called', label: 'Called' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'payment_received', label: 'Payment confirmed' },
  { value: 'waiting_screenshot', label: 'Waiting payment proof' },
  { value: 'valu_followup', label: 'ValU follow-up' },
  { value: 'order_edited', label: 'Order edited' },
  { value: 'shipblu', label: 'Shipping update' },
  { value: 'note', label: 'Internal note' },
];

function paymentLabel(method?: string) { return getPaymentMethodLabel(method, 'en'); }
function paymentStatusLabel(status?: string) { return getPaymentStatusLabel(status, 'en'); }
function followupLabel(type?: string) { return FOLLOWUP_TYPES.find((item) => item.value === type)?.label || String(type || 'Note'); }

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

export default function AdminOrderDetail() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [followupType, setFollowupType] = useState('whatsapp_sent');
  const [followupNote, setFollowupNote] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<EditableOrder | null>(null);

  const order = useMemo(() => {
    const needle = decodeURIComponent(orderId).toLowerCase();
    return orders.find((entry) => entry.id.toLowerCase() === needle || entry.orderNumber.toLowerCase() === needle) || null;
  }, [orders, orderId]);

  const loadOrder = async () => {
    setIsLoading(true);
    try {
      const { getOrders } = await import('@/lib/supabase/db');
      setOrders(await getOrders());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load order');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadOrder(); }, [orderId]);
  useEffect(() => { if (order && !isEditing) setEditDraft(cloneOrderForEdit(order)); }, [order, isEditing]);

  const editSubtotal = useMemo(() => editDraft?.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0) || 0, [editDraft]);
  const editTotals = useMemo(() => editDraft ? computeCheckoutTotals({ subtotal: editSubtotal, discount: editDraft.discount, deliveryFee: editDraft.shippingFee, codFee: editDraft.codFee, paymentMethod: editDraft.paymentMethod }) : null, [editDraft, editSubtotal]);

  const buildWhatsAppMessage = (target: Order, purpose: 'confirm' | 'payment' | 'shipping' | 'valu' = 'confirm') => buildAdminOrderWhatsAppMessage(target, purpose);

  const logFollowup = async (type: string, note: string) => {
    if (!order) return;
    try {
      const { addOrderFollowup } = await import('@/lib/supabase/db');
      await addOrderFollowup(order.id, type, note || followupLabel(type));
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
    await logFollowup(purpose === 'payment' ? 'reminder_sent' : purpose === 'valu' ? 'valu_followup' : 'whatsapp_sent', message);
  };

  const updateStatus = async (status: OrderStatus) => {
    if (!order) return;
    try {
      const { updateOrderStatus } = await import('@/lib/supabase/db');
      await updateOrderStatus(order.id, status, `Order status changed to ${getStatusLabel(status, 'en')}`, 'studio');
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
      await logFollowup('shipblu', 'ShipBlu shipment requested.');
      toast.success('Shipment request sent');
      await loadOrder();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create shipment');
    }
  };

  const refreshShipment = async () => {
    if (!order) return;
    try {
      const { refreshOrderShipment } = await import('@/lib/supabase/db');
      await refreshOrderShipment(order.id);
      await logFollowup('shipblu', 'Shipment status refreshed.');
      toast.success('Shipment refreshed');
      await loadOrder();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not refresh shipment');
    }
  };

  const startEdit = () => {
    if (!order) return;
    setEditDraft(cloneOrderForEdit(order));
    setIsEditing(true);
  };

  const updateDraftItem = (index: number, patch: Partial<OrderItem>) => {
    setEditDraft((current) => current ? { ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) } : current);
  };

  const removeDraftItem = (index: number) => {
    setEditDraft((current) => current ? { ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) } : current);
  };

  const addDraftItem = () => {
    setEditDraft((current) => current ? {
      ...current,
      items: [...current.items, { productId: '', name: 'New product', slug: '', price: 0, size: '', quantity: 1, image: '/assets/nexora-logo.png' }],
    } : current);
  };

  const saveOrderEdit = async () => {
    if (!order || !editDraft || !editTotals) return;
    if (!editDraft.items.length) {
      toast.error('Cannot save an order without items.');
      return;
    }
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

  return (
    <div className="space-y-6 text-[#2b211d] print:bg-white" dir="ltr">
      <div className="flex flex-col gap-4 rounded-[32px] border border-[#e6ded1] bg-[#fbf7ef] p-5 lg:flex-row lg:items-center lg:justify-between print:border-0 print:bg-white">
        <div>
          <div className="mb-3 flex flex-wrap gap-2 print:hidden">
            <button onClick={() => navigate('/nexora-admin/orders')} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#5f584f]"><ArrowRight className="h-3.5 w-3.5" /> Back</button>
            <button onClick={() => navigate('/nexora-admin/orders')} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#5f584f]"><X className="h-3.5 w-3.5" /> Close</button>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a8461]">Order Details</p>
          <h1 className="mt-2 text-3xl font-black tracking-[0.08em] text-[#2b211d]">{order.orderNumber}</h1>
          <p className="mt-1 text-xs text-[#8a8175]">{formatTimestamp(order.createdAt, 'en-EG')} · {order.items.length} item</p>
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
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a8461]">Edit Mode</p>
              <h2 className="mt-1 text-xl font-black text-[#2b211d]">Edit customer, items, and payment details</h2>
              <p className="mt-1 text-xs leading-6 text-[#8a8175]">Every change is recorded in the follow-up history for a clear order timeline.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={saveOrderEdit} className="nexora-button-primary"><Save className="h-4 w-4" /> Save Changes</button>
              <button onClick={() => setIsEditing(false)} className="nexora-button">Cancel</button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Customer Details">
              <div className="grid gap-3">
                <input value={editDraft.customer.fullName} onChange={(event) => setEditDraft({ ...editDraft, customer: { ...editDraft.customer, fullName: event.target.value } })} className="studio-input" placeholder="Customer name" />
                <input value={editDraft.customer.phone} onChange={(event) => setEditDraft({ ...editDraft, customer: { ...editDraft.customer, phone: event.target.value } })} className="studio-input" placeholder="Phone number" dir="ltr" />
                <input value={editDraft.customer.governorate} onChange={(event) => setEditDraft({ ...editDraft, customer: { ...editDraft.customer, governorate: event.target.value } })} className="studio-input" placeholder="Governorate" />
                <input value={editDraft.customer.city} onChange={(event) => setEditDraft({ ...editDraft, customer: { ...editDraft.customer, city: event.target.value } })} className="studio-input" placeholder="City" />
                <textarea value={editDraft.customer.address} onChange={(event) => setEditDraft({ ...editDraft, customer: { ...editDraft.customer, address: event.target.value } })} className="studio-input min-h-24" placeholder="Detailed address" />
              </div>
            </Card>

            <Card title="Payment & Shipping">
              <div className="grid gap-3">
                <select value={editDraft.paymentMethod} onChange={(event) => setEditDraft({ ...editDraft, paymentMethod: event.target.value as Order['paymentMethod'] })} className="studio-input">
                  {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{paymentLabel(method)}</option>)}
                </select>
                <select value={editDraft.paymentStatus} onChange={(event) => setEditDraft({ ...editDraft, paymentStatus: event.target.value as Order['paymentStatus'] })} className="studio-input">
                  {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{paymentStatusLabel(status)}</option>)}
                </select>
                <input type="number" min="0" value={editDraft.shippingFee} onChange={(event) => setEditDraft({ ...editDraft, shippingFee: Number(event.target.value) })} className="studio-input" placeholder="Shipping" />
                <input type="number" min="0" value={editDraft.codFee} onChange={(event) => setEditDraft({ ...editDraft, codFee: Number(event.target.value) })} className="studio-input" placeholder="COD fee" />
                <input type="number" min="0" value={editDraft.discount} onChange={(event) => setEditDraft({ ...editDraft, discount: Number(event.target.value) })} className="studio-input" placeholder="Discount" />
                <input value={editDraft.couponCode || ''} onChange={(event) => setEditDraft({ ...editDraft, couponCode: event.target.value.toUpperCase() })} className="studio-input" placeholder="Coupon code" />
              </div>
            </Card>

            <Card title="New Total">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[#8a8175]">Items</span><span>{formatPrice(editSubtotal)}</span></div>
                <div className="flex justify-between"><span className="text-[#8a8175]">Discount</span><span>-{formatPrice(editDraft.discount)}</span></div>
                <div className="flex justify-between"><span className="text-[#8a8175]">Shipping</span><span>{formatPrice(editDraft.shippingFee)}</span></div>
                {editDraft.paymentMethod === 'cod' && <div className="flex justify-between"><span className="text-[#8a8175]">COD fee</span><span>{formatPrice(editTotals.codFee)}</span></div>}
                <div className="border-t border-[#efe8dc] pt-3 text-lg font-black flex justify-between"><span>Total</span><span className="text-[#b99a62]">{formatPrice(editTotals.total)}</span></div>
                <textarea value={editDraft.reason} onChange={(event) => setEditDraft({ ...editDraft, reason: event.target.value })} className="studio-input mt-4 min-h-20" placeholder="Edit Reason" />
              </div>
            </Card>
          </div>

          <Card title="Order Items" action={<button onClick={addDraftItem} className="rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold text-[#5f584f]">Add Item</button>}>
            <div className="space-y-3">
              {editDraft.items.map((item, index) => (
                <div key={`${item.productId}-${index}`} className="grid gap-3 rounded-3xl border border-[#efe8dc] bg-white p-3 md:grid-cols-[1.2fr_0.7fr_0.7fr_0.55fr_0.7fr_auto] md:items-center">
                  <input value={item.name} onChange={(event) => updateDraftItem(index, { name: event.target.value })} className="studio-input" placeholder="Product name" />
                  <input value={item.size || ''} onChange={(event) => updateDraftItem(index, { size: event.target.value, sizeLabel: event.target.value })} className="studio-input" placeholder="Size" />
                  <input value={item.color || ''} onChange={(event) => updateDraftItem(index, { color: event.target.value })} className="studio-input" placeholder="Color" />
                  <input type="number" min="1" value={item.quantity} onChange={(event) => updateDraftItem(index, { quantity: Number(event.target.value) })} className="studio-input" placeholder="Qty" />
                  <input type="number" min="0" value={item.price} onChange={(event) => updateDraftItem(index, { price: Number(event.target.value) })} className="studio-input" placeholder="Price" />
                  <button onClick={() => removeDraftItem(index)} className="text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Customer Details">
          <p className="text-lg font-black text-[#2b211d]">{order.customer.fullName}</p>
          <p className="mt-1 text-sm text-[#5f584f]" dir="ltr">{order.customer.phone}</p>
          <p className="mt-3 text-xs leading-6 text-[#8a8175]">{order.customer.address}<br />{order.customer.city}, {order.customer.governorate}</p>
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            <a href={`tel:${order.customer.phone}`} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#5f584f]"><Phone className="h-3.5 w-3.5" /> Call</a>
            <button onClick={() => void openWhatsApp('payment')} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#5f584f]"><Smartphone className="h-3.5 w-3.5" /> Payment message</button>
          </div>
        </Card>

        <Card title="Payment">
          <p className="text-sm font-black text-[#2b211d]">{paymentLabel(order.paymentMethod)}</p>
          <p className="mt-1 text-xs text-[#8a8175]">{paymentStatusLabel(order.paymentStatus)} · <span dir="ltr">{order.paymentConfirmationPhone || '01037141322'}</span></p>
          <div className="mt-4 grid gap-2 print:hidden">
            <select value={order.paymentStatus} onChange={(event) => void updatePayment(event.target.value as Order['paymentStatus'])} className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none">
              {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{paymentStatusLabel(status)}</option>)}
            </select>
            <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Transaction / reference number" className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none" />
            <input value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} placeholder="Payment notes" className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none" />
            <button onClick={markPaid} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-green-700"><CheckCircle className="h-3.5 w-3.5" /> Confirm Payment</button>
          </div>
        </Card>

        <Card title="Shipping">
          <p className="text-sm font-black text-[#2b211d]">{order.shippingProvider || 'ShipBlu'} · {order.shippingStatus || 'not_created'}</p>
          <p className="mt-1 text-xs text-[#8a8175]">ETA: {order.deliveryEstimate || SHIPPING_ESTIMATE_TEXT}</p>
          {order.trackingNumber && <p className="mt-2 text-xs font-bold text-[#b99a62]">Tracking: {order.trackingNumber}</p>}
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            <button onClick={createShipment} disabled={Boolean(order.trackingNumber)} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#5f584f] disabled:opacity-50"><Ship className="h-3.5 w-3.5" /> Create Shipment</button>
            <button onClick={refreshShipment} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#5f584f]"><Truck className="h-3.5 w-3.5" /> Refresh</button>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card title="Order Items">
          <div className="space-y-3">
            {order.items.map((item, index) => (
              <div key={`${item.productId}-${item.variantId || index}`} className="flex gap-4 rounded-3xl border border-[#efe8dc] bg-[#faf7f1] p-3">
                <img src={item.image || '/assets/nexora-logo.png'} alt={item.name} className="h-24 w-24 rounded-2xl object-cover bg-white" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#2b211d]">{item.name}</p>
                  <p className="mt-1 text-xs text-[#8a8175]">Size: {item.sizeLabel || getSizeDisplayLabel(item.size, item.weightRange)}{item.color ? ` · Color: ${item.color}` : ''}</p>
                  <p className="mt-1 text-xs text-[#8a8175]">Qty: {item.quantity} · Unit price: {formatPrice(item.price)}</p>
                </div>
                <p className="shrink-0 text-sm font-black text-[#2b211d]">{formatPrice(item.lineTotal || item.price * item.quantity)}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-2 rounded-3xl bg-white p-4 text-sm">
            <div className="flex justify-between"><span className="text-[#8a8175]">Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
            {order.discount > 0 && <div className="flex justify-between"><span className="text-[#8a8175]">Discount</span><span>-{formatPrice(order.discount)}</span></div>}
            <div className="flex justify-between"><span className="text-[#8a8175]">Shipping</span><span>{formatPrice(order.shippingFee)}</span></div>
            {order.paymentMethod === 'cod' && Number(order.codFee || 0) > 0 && <div className="flex justify-between"><span className="text-[#8a8175]">COD fee</span><span>{formatPrice(Number(order.codFee || 0))}</span></div>}
            <div className="flex justify-between border-t border-[#efe8dc] pt-3 text-lg font-black text-[#2b211d]"><span>Total</span><span>{formatPrice(order.total)}</span></div>
          </div>
        </Card>

        <Card title="Follow-up History">
          <div className="space-y-3 print:hidden">
            <div className="grid gap-2">
              <select value={followupType} onChange={(event) => setFollowupType(event.target.value)} className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none">
                {FOLLOWUP_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <textarea value={followupNote} onChange={(event) => setFollowupNote(event.target.value)} rows={3} placeholder="Example: confirmation sent / no answer / payment proof received / ValU confirmed" className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none" />
              <button onClick={() => void logFollowup(followupType, followupNote)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2b211d] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><Send className="h-3.5 w-3.5" /> Save follow-up</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {['whatsapp_sent', 'second_followup', 'payment_received', 'shipblu'].map((type) => <button key={type} onClick={() => void logFollowup(type, followupLabel(type))} className="rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#5f584f]">{followupLabel(type)}</button>)}
              <button onClick={() => navigator.clipboard.writeText(buildWhatsAppMessage(order)).then(() => toast.success('Copied'))} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#5f584f]"><Copy className="h-3.5 w-3.5" /> Copy</button>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {(order.followups || []).length ? (order.followups || []).map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-[#efe8dc] bg-white px-3 py-2 text-xs">
                <p className="font-bold text-[#2b211d]">{followupLabel(entry.type)}</p>
                <p className="mt-1 text-[#5f584f]">{entry.note || '—'}</p>
                <p className="mt-1 text-[10px] text-[#9a8461]">{formatTimestamp(entry.createdAt, 'en-EG')} · {entry.createdBy || 'studio'}</p>
              </div>
            )) : <p className="text-xs text-[#8a8175]">No follow-ups yet.</p>}
          </div>
        </Card>
      </div>

      <div className="rounded-[28px] border border-[#e6ded1] bg-white p-5 print:hidden">
        <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.24em] text-[#9a8461]">Order Status</h3>
        <div className="mb-4 flex flex-wrap gap-2">
          <span className={`status-badge ${getStatusColor(order.status)} text-[10px]`}>{getStatusLabel(order.status, 'en')}</span>
          <span className="rounded-full border border-[#e6ded1] px-3 py-1 text-[10px] font-bold uppercase text-[#5f584f]">{paymentLabel(order.paymentMethod)}</span>
          <span className="rounded-full border border-[#e6ded1] px-3 py-1 text-[10px] font-bold uppercase text-[#5f584f]">{paymentStatusLabel(order.paymentStatus)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {ORDER_STATUSES.map((status) => <button key={status} onClick={() => void updateStatus(status)} className={`rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${order.status === status ? 'border-[#b99a62] bg-[#b99a62]/10 text-[#b99a62]' : 'border-[#e6ded1] bg-white text-[#5f584f] hover:border-[#b99a62]'}`}>{getStatusLabel(status, 'en')}</button>)}
          {getNextStatus(order.status) && <button onClick={() => void updateStatus(getNextStatus(order.status)! as OrderStatus)} className="inline-flex items-center gap-2 rounded-full bg-[#b99a62] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><Package className="h-3.5 w-3.5" /> Next: {getStatusLabel(getNextStatus(order.status)! as OrderStatus, 'en')}</button>}
        </div>
      </div>
    </div>
  );
}
