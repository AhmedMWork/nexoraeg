import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Copy, MessageCircle, Package, Phone, Printer, Send, Ship, Smartphone, Truck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatPrice, formatTimestamp, getStatusColor, getStatusLabel, getNextStatus } from '@/lib/utils';
import { buildAdminOrderWhatsAppMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { getPaymentMethodLabel, getPaymentStatusLabel } from '@/lib/payments';
import type { Order, OrderStatus } from '@/types';
import { getSizeDisplayLabel, SHIPPING_ESTIMATE_TEXT_AR } from '@/lib/sizeLabels';

const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];
const PAYMENT_STATUSES: Order['paymentStatus'][] = ['pending', 'pending_confirmation', 'waiting_transfer', 'paid', 'collected', 'failed', 'refunded'];

const FOLLOWUP_TYPES = [
  { value: 'whatsapp_sent', label: 'تم إرسال رسالة' },
  { value: 'second_followup', label: 'تذكير إضافي' },
  { value: 'reminder_sent', label: 'تم إرسال تذكير' },
  { value: 'called', label: 'تم الاتصال' },
  { value: 'no_answer', label: 'لم يرد' },
  { value: 'confirmed', label: 'تم التأكيد' },
  { value: 'payment_received', label: 'تم تأكيد الدفع' },
  { value: 'waiting_screenshot', label: 'في انتظار إثبات التحويل' },
  { value: 'valu_followup', label: 'متابعة ValU' },
  { value: 'shipblu', label: 'تحديث الشحن' },
  { value: 'note', label: 'ملاحظة داخلية' },
];

function paymentLabel(method?: string) { return getPaymentMethodLabel(method, 'ar'); }
function paymentStatusLabel(status?: string) { return getPaymentStatusLabel(status, 'ar'); }

function followupLabel(type?: string) {
  return FOLLOWUP_TYPES.find((item) => item.value === type)?.label || String(type || 'Note');
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[28px] border border-[#e6ded1] bg-white/95 p-5 shadow-[0_18px_50px_rgba(43,33,29,0.06)]">
      <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.24em] text-[#9a8461]">{title}</h3>
      {children}
    </section>
  );
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
      await updateOrderStatus(order.id, status);
      toast.success(`Order is now ${getStatusLabel(status)}`);
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
      toast.success('Payment updated');
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
      toast.success('Payment marked as paid');
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
      await logFollowup('shipblu', 'ShipBlu shipment creation requested.');
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
      await logFollowup('shipblu', 'ShipBlu status refreshed.');
      toast.success('Shipment refreshed');
      await loadOrder();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not refresh shipment');
    }
  };

  if (isLoading) return <div className="p-8 text-sm text-[#8a8175]">Loading order...</div>;
  if (!order) return (
    <div className="space-y-4 p-6">
      <button onClick={() => navigate('/nexora-admin/orders')} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-4 py-2 text-xs font-bold text-[#5f584f]"><ArrowLeft className="h-4 w-4" /> Back to Orders</button>
      <Card title="Order not found"><p className="text-sm text-[#8a8175]">This order could not be found. Refresh the orders list and try again.</p></Card>
    </div>
  );

  return (
    <div className="space-y-6 text-[#2b211d] print:bg-white">
      <div className="flex flex-col gap-4 rounded-[32px] border border-[#e6ded1] bg-[#fbf7ef] p-5 lg:flex-row lg:items-center lg:justify-between print:border-0 print:bg-white">
        <div>
          <div className="mb-3 flex flex-wrap gap-2 print:hidden">
            <button onClick={() => navigate('/nexora-admin/orders')} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#5f584f]"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
            <button onClick={() => navigate('/nexora-admin/orders')} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#5f584f]"><X className="h-3.5 w-3.5" /> Close</button>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a8461]">NEXORA order page</p>
          <h1 className="mt-2 text-3xl font-black tracking-[0.08em] text-[#2b211d]">{order.orderNumber}</h1>
          <p className="mt-1 text-xs text-[#8a8175]">{formatTimestamp(order.createdAt)} · {order.items.length} item(s)</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f584f]"><Printer className="h-3.5 w-3.5" /> Print invoice</button>
          <button onClick={() => void openWhatsApp('confirm')} className="inline-flex items-center gap-2 rounded-full bg-[#2b211d] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Customer">
          <p className="text-lg font-black text-[#2b211d]">{order.customer.fullName}</p>
          <p className="mt-1 text-sm text-[#5f584f]">{order.customer.phone}</p>
          <p className="mt-3 text-xs leading-6 text-[#8a8175]">{order.customer.address}<br />{order.customer.city}, {order.customer.governorate}</p>
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            <a href={`tel:${order.customer.phone}`} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#5f584f]"><Phone className="h-3.5 w-3.5" /> Call</a>
            <button onClick={() => void openWhatsApp('payment')} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#5f584f]"><Smartphone className="h-3.5 w-3.5" /> Payment message</button>
          </div>
        </Card>

        <Card title="Payment">
          <p className="text-sm font-black text-[#2b211d]">{paymentLabel(order.paymentMethod)}</p>
          <p className="mt-1 text-xs text-[#8a8175]">{paymentStatusLabel(order.paymentStatus)} · {order.paymentConfirmationPhone || '01037141322'}</p>
          <div className="mt-4 grid gap-2 print:hidden">
            <select value={order.paymentStatus} onChange={(e) => void updatePayment(e.target.value as Order['paymentStatus'])} className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none">
              {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{paymentStatusLabel(status)}</option>)}
            </select>
            <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Payment reference" className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none" />
            <input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Payment notes" className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none" />
            <button onClick={markPaid} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-green-700"><CheckCircle className="h-3.5 w-3.5" /> Paid</button>
          </div>
        </Card>

        <Card title="ShipBlu / Delivery">
          <p className="text-sm font-black text-[#2b211d]">{order.shippingProvider || 'ShipBlu'} · {order.shippingStatus || 'not_created'}</p>
          <p className="mt-1 text-xs text-[#8a8175]">Estimate: {order.deliveryEstimate || SHIPPING_ESTIMATE_TEXT_AR}</p>
          {order.trackingNumber && <p className="mt-2 text-xs font-bold text-[#b99a62]">Tracking: {order.trackingNumber}</p>}
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            <button onClick={createShipment} disabled={Boolean(order.trackingNumber)} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#5f584f] disabled:opacity-50"><Ship className="h-3.5 w-3.5" /> ShipBlu</button>
            <button onClick={refreshShipment} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#5f584f]"><Truck className="h-3.5 w-3.5" /> Refresh</button>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card title="Invoice items">
          <div className="space-y-3">
            {order.items.map((item, index) => (
              <div key={`${item.productId}-${item.variantId || index}`} className="flex gap-4 rounded-3xl border border-[#efe8dc] bg-[#faf7f1] p-3">
                <img src={item.image || '/assets/nexora-logo.png'} alt={item.name} className="h-24 w-24 rounded-2xl object-cover bg-white" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#2b211d]">{item.name}</p>
                  <p className="mt-1 text-xs text-[#8a8175]">Size: {item.sizeLabel || getSizeDisplayLabel(item.size, item.weightRange)}{item.color ? ` · Color: ${item.color}` : ''}</p>
                  <p className="mt-1 text-xs text-[#8a8175]">Qty: {item.quantity} · Unit: {formatPrice(item.price)}</p>
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

        <Card title="Follow-up timeline">
          <div className="space-y-3 print:hidden">
            <div className="grid gap-2">
              <select value={followupType} onChange={(e) => setFollowupType(e.target.value)} className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none">
                {FOLLOWUP_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <textarea value={followupNote} onChange={(e) => setFollowupNote(e.target.value)} rows={3} placeholder="مثال: تم إرسال رسالة تأكيد / العميل لم يرد / تم استلام إثبات التحويل / تم تأكيد ValU" className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none" />
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
                <p className="mt-1 text-[10px] text-[#9a8461]">{formatTimestamp(entry.createdAt)} · {entry.createdBy || 'studio'}</p>
              </div>
            )) : <p className="text-xs text-[#8a8175]">No follow-up entries yet.</p>}
          </div>
        </Card>
      </div>

      <div className="rounded-[28px] border border-[#e6ded1] bg-white p-5 print:hidden">
        <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.24em] text-[#9a8461]">Order status</h3>
        <div className="mb-4 flex flex-wrap gap-2">
          <span className={`status-badge ${getStatusColor(order.status)} text-[10px]`}>{getStatusLabel(order.status)}</span>
          <span className="rounded-full border border-[#e6ded1] px-3 py-1 text-[10px] font-bold uppercase text-[#5f584f]">{paymentLabel(order.paymentMethod)}</span>
          <span className="rounded-full border border-[#e6ded1] px-3 py-1 text-[10px] font-bold uppercase text-[#5f584f]">{paymentStatusLabel(order.paymentStatus)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {ORDER_STATUSES.map((status) => <button key={status} onClick={() => void updateStatus(status)} className={`rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${order.status === status ? 'border-[#b99a62] bg-[#b99a62]/10 text-[#b99a62]' : 'border-[#e6ded1] bg-white text-[#5f584f] hover:border-[#b99a62]'}`}>{getStatusLabel(status)}</button>)}
          {getNextStatus(order.status) && <button onClick={() => void updateStatus(getNextStatus(order.status)! as OrderStatus)} className="inline-flex items-center gap-2 rounded-full bg-[#b99a62] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><Package className="h-3.5 w-3.5" /> Next: {getStatusLabel(getNextStatus(order.status)! as OrderStatus)}</button>}
        </div>
      </div>
    </div>
  );
}
