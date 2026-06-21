// ============================================================
// NEXORA — Admin Orders Page
// Invoice view + item images + manual payments + follow-up log
// ============================================================

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  Copy,
  Download,
  Eye,
  MessageCircle,
  Package,
  Phone,
  Printer,
  RefreshCw,
  Search,
  Send,
  Ship,
  Smartphone,
  Truck,
} from 'lucide-react';
import { formatPrice, formatTimestamp, getStatusColor, getStatusLabel, getNextStatus } from '@/lib/utils';
import { buildAdminOrderWhatsAppMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { getPaymentMethodLabel, getPaymentStatusLabel } from '@/lib/payments';
import type { Order, OrderStatus } from '@/types';
import toast from 'react-hot-toast';

const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];
const PAYMENT_STATUSES: Order['paymentStatus'][] = ['pending', 'pending_confirmation', 'waiting_transfer', 'paid', 'collected', 'failed', 'refunded'];

const FOLLOWUP_TYPES = [
  { value: 'whatsapp_sent', label: 'تم إرسال رسالة' },
  { value: 'second_followup', label: 'تذكير إضافي' },
  { value: 'reminder_sent', label: 'تم إرسال تذكير' },
  { value: 'called', label: 'تم الاتصال' },
  { value: 'no_answer', label: 'لم يرد' },
  { value: 'confirmed', label: 'تم التأكيد' },
  { value: 'cancelled', label: 'تم الإلغاء' },
  { value: 'payment_received', label: 'تم تأكيد الدفع' },
  { value: 'valu_followup', label: 'متابعة ValU' },
  { value: 'shipblu', label: 'تحديث الشحن' },
  { value: 'note', label: 'ملاحظة داخلية' },
];

function paymentLabel(method?: string) { return getPaymentMethodLabel(method, 'ar'); }
function paymentStatusLabel(status?: string) { return getPaymentStatusLabel(status, 'ar'); }

function followupLabel(type?: string) {
  return FOLLOWUP_TYPES.find((item) => item.value === type)?.label || String(type || 'Note');
}

function AdminCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[28px] border border-[#e6ded1] bg-white/90 p-5 shadow-[0_18px_50px_rgba(43,33,29,0.06)]">
      <h4 className="mb-4 text-[10px] font-black uppercase tracking-[0.24em] text-[#9a8461]">{title}</h4>
      {children}
    </section>
  );
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [followupType, setFollowupType] = useState('whatsapp_sent');
  const [followupNote, setFollowupNote] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const { getOrders } = await import('@/lib/supabase/db');
      const nextOrders = await getOrders();
      setOrders(nextOrders);
      setSelectedOrder((current) => nextOrders.find((order) => order.id === current?.id) || current);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus = statusFilter ? order.status === statusFilter : true;
      const matchesPayment = paymentFilter ? order.paymentMethod === paymentFilter || order.paymentStatus === paymentFilter : true;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q
        || order.orderNumber.toLowerCase().includes(q)
        || order.customer.fullName.toLowerCase().includes(q)
        || order.customer.phone.includes(q);
      return matchesStatus && matchesPayment && matchesSearch;
    });
  }, [orders, statusFilter, paymentFilter, searchQuery]);

  const orderQueues = useMemo(() => {
    const newOrders = orders.filter((order) => order.status === 'pending').length;
    const waitingTransfer = orders.filter((order) => order.paymentStatus === 'waiting_transfer').length;
    const valuFollowup = orders.filter((order) => order.paymentMethod === 'valu' && order.paymentStatus !== 'paid' && order.paymentStatus !== 'collected').length;
    const readyToShip = orders.filter((order) => ['confirmed', 'preparing'].includes(order.status) && (!order.shippingStatus || order.shippingStatus === 'not_created')).length;
    return { newOrders, waitingTransfer, valuFollowup, readyToShip };
  }, [orders]);

  const buildWhatsAppMessage = (order: Order, purpose: 'confirm' | 'payment' | 'shipping' | 'valu' = 'confirm') => buildAdminOrderWhatsAppMessage(order, purpose);

  const logFollowup = async (orderId: string, type: string, note: string) => {
    try {
      const { addOrderFollowup } = await import('@/lib/supabase/db');
      await addOrderFollowup(orderId, type, note);
      toast.success('Follow-up saved');
      setFollowupNote('');
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save follow-up');
    }
  };

  const openWhatsApp = async (order: Order, purpose: 'confirm' | 'payment' | 'shipping') => {
    const message = buildWhatsAppMessage(order, purpose);
    window.open(buildWhatsAppUrl(order.customer.phone, message), '_blank', 'noopener,noreferrer');
    await logFollowup(order.id, purpose === 'payment' ? (order.paymentMethod === 'valu' ? 'valu_followup' : 'reminder_sent') : 'whatsapp_sent', message);
  };

  const copyOrderMessage = async (order: Order) => {
    await navigator.clipboard.writeText(buildWhatsAppMessage(order));
    toast.success('WhatsApp message copied');
  };

  const markCollected = async (orderId: string) => {
    try {
      const { markOrderPaymentCollected } = await import('@/lib/supabase/db');
      await markOrderPaymentCollected(orderId);
      toast.success('Payment marked as collected');
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update payment status');
    }
  };

  const updatePayment = async (order: Order, paymentStatus: Order['paymentStatus']) => {
    try {
      const { updateOrderPaymentStatus } = await import('@/lib/supabase/db');
      await updateOrderPaymentStatus(order.id, paymentStatus, paymentReference, paymentNotes);
      toast.success('Payment status updated');
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update payment status');
    }
  };

  const createShipment = async (orderId: string) => {
    try {
      const { createOrderShipment } = await import('@/lib/supabase/db');
      const shipment = await createOrderShipment(orderId);
      toast.success(`Shipment created${shipment?.trackingNumber ? `: ${shipment.trackingNumber}` : ''}`);
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create shipment. Check Shipping settings and ShipBlu zone id.');
    }
  };

  const refreshShipment = async (orderId: string) => {
    try {
      const { refreshOrderShipment } = await import('@/lib/supabase/db');
      await refreshOrderShipment(orderId);
      toast.success('Shipment status refreshed.');
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not refresh shipment.');
    }
  };

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const { updateOrderStatus } = await import('@/lib/supabase/db');
      await updateOrderStatus(orderId, newStatus);
      toast.success(`Status updated to ${getStatusLabel(newStatus)}`);
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update order status');
    }
  };

  const printInvoice = () => {
    window.print();
  };

  const exportOrdersCsv = () => {
    const headers = ['order_number', 'customer_name', 'phone', 'governorate', 'city', 'total', 'order_status', 'payment_method', 'payment_status', 'items', 'created_at'];
    const rows = filteredOrders.map((order) => [
      order.orderNumber,
      order.customer.fullName,
      order.customer.phone,
      order.customer.governorate,
      order.customer.city,
      String(order.total),
      order.status,
      order.paymentMethod,
      order.paymentStatus,
      order.items.map((item) => `${item.name} ${item.size}${item.color ? `/${item.color}` : ''} x${item.quantity}`).join(' | '),
      order.createdAt.toISOString(),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nexora-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 text-[#2b211d]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-black uppercase tracking-[0.22em] text-[#2b211d]">Orders HQ</h1>
          <p className="mt-1 text-xs text-[#8a8175]">{orders.length} orders · Payments, fulfillment, customer follow-ups</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a8461]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order, customer, phone..."
              className="w-full rounded-2xl border border-[#e6ded1] bg-white px-10 py-3 text-xs text-[#2b211d] outline-none transition-colors focus:border-[#b99a62] sm:w-72"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-3 text-xs text-[#5f584f] outline-none">
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
          </select>
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-3 text-xs text-[#5f584f] outline-none">
            <option value="">All payments</option>
            <option value="cod">COD</option>
            <option value="instapay">Instapay</option>
            <option value="vodafone_cash">Vodafone Cash</option>
            <option value="valu">ValU Installments</option>
            {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{paymentStatusLabel(s)}</option>)}
          </select>
          <button onClick={exportOrdersCsv} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#e6ded1] bg-white px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5f584f] hover:border-[#b99a62]"><Download className="h-3.5 w-3.5" /> CSV</button>
          <button onClick={loadOrders} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2b211d] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: 'طلبات جديدة', value: orderQueues.newOrders, helper: 'تحتاج تأكيد سريع على واتساب' },
          { label: 'في انتظار إثبات الدفع', value: orderQueues.waitingTransfer, helper: 'Instapay / Vodafone Cash screenshots' },
          { label: 'متابعة ValU', value: orderQueues.valuFollowup, helper: 'تأكيد تفاصيل التقسيط يدويًا' },
          { label: 'جاهز للشحن', value: orderQueues.readyToShip, helper: 'إنشاء شحنة أو تحديث الحالة' },
        ].map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => {
              if (card.label === 'في انتظار إثبات الدفع') setPaymentFilter('waiting_transfer');
              else if (card.label === 'متابعة ValU') setPaymentFilter('valu');
              else if (card.label === 'طلبات جديدة') setStatusFilter('pending');
              else if (card.label === 'جاهز للشحن') setStatusFilter('confirmed');
            }}
            className="rounded-[26px] border border-[#e6ded1] bg-white p-4 text-left shadow-[0_14px_38px_rgba(43,33,29,0.05)] transition hover:-translate-y-0.5 hover:border-[#b99a62]"
          >
            <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#9a8461]">{card.label}</span>
            <span className="mt-3 block text-2xl font-black text-[#2b211d]">{card.value}</span>
            <span className="mt-1 block text-[11px] leading-5 text-[#8a8175]">{card.helper}</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[28px] border border-[#e6ded1] bg-white shadow-[0_18px_50px_rgba(43,33,29,0.06)]">
        <table className="w-full min-w-[980px] text-left">
          <thead>
            <tr className="border-b border-[#efe8dc] bg-[#faf7f1]">
              <th className="p-4 text-[10px] font-black uppercase tracking-wider text-[#9a8461]">Order</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-wider text-[#9a8461]">Items</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-wider text-[#9a8461]">Customer</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-wider text-[#9a8461]">Total</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-wider text-[#9a8461]">Payment</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-wider text-[#9a8461]">Status</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-wider text-[#9a8461]">Follow-up</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-wider text-[#9a8461]">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="p-8 text-center text-xs text-[#8a8175]">Loading orders...</td></tr>
            ) : filteredOrders.length ? filteredOrders.map((order) => (
              <tr key={order.id} className="border-b border-[#efe8dc]/80 hover:bg-[#faf7f1]">
                <td className="p-4">
                  <p className="text-xs font-black text-[#b99a62]">{order.orderNumber}</p>
                  <p className="mt-1 text-[10px] text-[#8a8175]">{formatTimestamp(order.createdAt)}</p>
                </td>
                <td className="p-4">
                  <div className="flex -space-x-2">
                    {order.items.slice(0, 4).map((item, index) => (
                      <img key={`${order.id}-${item.productId}-${index}`} src={item.image || '/assets/nexora-logo.png'} alt={item.name} className="h-10 w-10 rounded-full border-2 border-white object-cover bg-[#faf7f1]" />
                    ))}
                    {order.items.length > 4 && <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[#efe8dc] text-[10px] font-bold text-[#5f584f]">+{order.items.length - 4}</span>}
                  </div>
                </td>
                <td className="p-4">
                  <p className="text-xs font-semibold text-[#2b211d]">{order.customer.fullName}</p>
                  <p className="mt-1 text-[10px] text-[#8a8175]">{order.customer.phone}</p>
                </td>
                <td className="p-4 text-xs font-black text-[#2b211d]">{formatPrice(order.total)}</td>
                <td className="p-4">
                  <p className="text-xs text-[#2b211d]">{paymentLabel(order.paymentMethod)}</p>
                  <p className="mt-1 text-[10px] text-[#8a8175]">{paymentStatusLabel(order.paymentStatus)}</p>
                </td>
                <td className="p-4"><span className={`status-badge ${getStatusColor(order.status)} text-[9px]`}>{getStatusLabel(order.status)}</span></td>
                <td className="p-4 text-[10px] text-[#8a8175]">{followupLabel(order.followupStatus)}</td>
                <td className="p-4">
                  <Link to={`/nexora-admin/orders/${order.id}`} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f584f] hover:border-[#b99a62] hover:text-[#b99a62]"><Eye className="h-3.5 w-3.5" /> Open</Link>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={8} className="p-8 text-center text-xs text-[#8a8175]">No orders found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedOrder && (
        <div className="print:fixed print:inset-0 print:z-50 print:overflow-auto print:bg-white">
          <div className="rounded-[32px] border border-[#e6ded1] bg-[#fbf7ef] p-5 shadow-[0_24px_80px_rgba(43,33,29,0.1)] print:rounded-none print:border-0 print:shadow-none">
            <div className="mb-5 flex flex-col gap-4 border-b border-[#e6ded1] pb-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a8461]">NEXORA invoice</p>
                <h2 className="mt-2 text-2xl font-black tracking-[0.08em] text-[#2b211d]">{selectedOrder.orderNumber}</h2>
                <p className="mt-1 text-xs text-[#8a8175]">{formatTimestamp(selectedOrder.createdAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2 print:hidden">
                <button onClick={printInvoice} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f584f]"><Printer className="h-3.5 w-3.5" /> Print</button>
                <button onClick={() => void openWhatsApp(selectedOrder, 'confirm')} className="inline-flex items-center gap-2 rounded-full bg-[#2b211d] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</button>
                <button onClick={() => setSelectedOrder(null)} className="rounded-full border border-[#e6ded1] bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f584f]">Close</button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <AdminCard title="Customer">
                <p className="text-sm font-bold text-[#2b211d]">{selectedOrder.customer.fullName}</p>
                <p className="mt-1 text-xs text-[#5f584f]">{selectedOrder.customer.phone}</p>
                <p className="mt-3 text-xs leading-6 text-[#8a8175]">{selectedOrder.customer.address}, {selectedOrder.customer.city}, {selectedOrder.customer.governorate}</p>
                {selectedOrder.customer.notes && <p className="mt-3 rounded-2xl bg-[#faf7f1] p-3 text-xs text-[#5f584f]">{selectedOrder.customer.notes}</p>}
              </AdminCard>

              <AdminCard title="Payment">
                <p className="text-sm font-bold text-[#2b211d]">{paymentLabel(selectedOrder.paymentMethod)}</p>
                <p className="mt-1 text-xs text-[#8a8175]">{paymentStatusLabel(selectedOrder.paymentStatus)}</p>
                <p className="mt-2 text-xs text-[#8a8175]">Confirm on WhatsApp: {selectedOrder.paymentConfirmationPhone || '01037141322'}</p>
                <div className="mt-4 grid gap-2 print:hidden">
                  <select onChange={(e) => void updatePayment(selectedOrder, e.target.value as Order['paymentStatus'])} defaultValue="" className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs text-[#5f584f] outline-none">
                    <option value="" disabled>Update payment status</option>
                    {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{paymentStatusLabel(status)}</option>)}
                  </select>
                  <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Payment reference optional" className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none" />
                  <input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Payment notes optional" className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none" />
                  <button onClick={() => void markCollected(selectedOrder.id)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-green-700"><CheckCircle className="h-3.5 w-3.5" /> Mark paid</button>
                </div>
              </AdminCard>

              <AdminCard title="Shipping">
                <p className="text-sm font-bold text-[#2b211d]">{selectedOrder.shippingProvider || 'Manual'} · {selectedOrder.shippingStatus || 'not_created'}</p>
                <p className="mt-1 text-xs text-[#8a8175]">Estimate: {selectedOrder.deliveryEstimate || '—'}</p>
                {selectedOrder.trackingNumber && <p className="mt-2 text-xs font-bold text-[#b99a62]">Tracking: {selectedOrder.trackingNumber}</p>}
                <div className="mt-4 flex flex-wrap gap-2 print:hidden">
                  <button onClick={() => void createShipment(selectedOrder.id)} disabled={Boolean(selectedOrder.trackingNumber)} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f584f] disabled:opacity-50"><Ship className="h-3.5 w-3.5" /> Create shipment</button>
                  <button onClick={() => void refreshShipment(selectedOrder.id)} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f584f]"><Truck className="h-3.5 w-3.5" /> Refresh</button>
                </div>
              </AdminCard>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <AdminCard title="Items invoice">
                <div className="space-y-3">
                  {selectedOrder.items.map((item, index) => (
                    <div key={`${item.productId}-${item.variantId || index}`} className="flex gap-4 rounded-3xl border border-[#efe8dc] bg-[#faf7f1] p-3">
                      <img src={item.image || '/assets/nexora-logo.png'} alt={item.name} className="h-20 w-20 rounded-2xl object-cover bg-white" />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[#2b211d]">{item.name}</p>
                        <p className="mt-1 text-xs text-[#8a8175]">Size: {item.size}{item.color ? ` · Color: ${item.color}` : ''}</p>
                        <p className="mt-1 text-xs text-[#8a8175]">Qty: {item.quantity} · Unit: {formatPrice(item.price)}</p>
                      </div>
                      <p className="shrink-0 text-sm font-black text-[#2b211d]">{formatPrice(item.lineTotal || item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 space-y-2 rounded-3xl bg-white p-4 text-sm">
                  <div className="flex justify-between"><span className="text-[#8a8175]">Subtotal</span><span>{formatPrice(selectedOrder.subtotal)}</span></div>
                  {selectedOrder.discount > 0 && <div className="flex justify-between"><span className="text-[#8a8175]">Discount</span><span>-{formatPrice(selectedOrder.discount)}</span></div>}
                  <div className="flex justify-between"><span className="text-[#8a8175]">Shipping</span><span>{formatPrice(selectedOrder.shippingFee)}</span></div>
                  {selectedOrder.paymentMethod === 'cod' && Number(selectedOrder.codFee || 0) > 0 && <div className="flex justify-between"><span className="text-[#8a8175]">COD fee</span><span>{formatPrice(Number(selectedOrder.codFee || 0))}</span></div>}
                  <div className="flex justify-between border-t border-[#efe8dc] pt-3 text-lg font-black text-[#2b211d]"><span>Total</span><span>{formatPrice(selectedOrder.total)}</span></div>
                </div>
              </AdminCard>

              <AdminCard title="Follow-up timeline">
                <div className="space-y-3 print:hidden">
                  <div className="grid gap-2">
                    <select value={followupType} onChange={(e) => setFollowupType(e.target.value)} className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none">
                      {FOLLOWUP_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    <textarea value={followupNote} onChange={(e) => setFollowupNote(e.target.value)} rows={3} placeholder="مثال: بعتله رسالة تأكيد / رنيت ومردش / أكد الطلب" className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-2 text-xs outline-none" />
                    <button onClick={() => void logFollowup(selectedOrder.id, followupType, followupNote)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2b211d] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><Send className="h-3.5 w-3.5" /> Save note</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => void openWhatsApp(selectedOrder, 'payment')} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f584f]"><Smartphone className="h-3.5 w-3.5" /> تذكير الدفع</button>
                    <button onClick={() => void openWhatsApp(selectedOrder, 'shipping')} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f584f]"><Truck className="h-3.5 w-3.5" /> تحديث الشحن</button>
                    <button onClick={() => void copyOrderMessage(selectedOrder)} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f584f]"><Copy className="h-3.5 w-3.5" /> Copy</button>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {(selectedOrder.followups || []).length ? (selectedOrder.followups || []).map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-[#efe8dc] bg-white px-3 py-2 text-xs">
                      <p className="font-bold text-[#2b211d]">{followupLabel(entry.type)}</p>
                      <p className="mt-1 text-[#5f584f]">{entry.note || '—'}</p>
                      <p className="mt-1 text-[10px] text-[#9a8461]">{formatTimestamp(entry.createdAt)} · {entry.createdBy || 'studio'}</p>
                    </div>
                  )) : <p className="text-xs text-[#8a8175]">No follow-up entries yet.</p>}
                  {(selectedOrder.trackingUpdates || []).map((entry, index) => (
                    <div key={`${entry.status}-${index}`} className="rounded-2xl border border-[#efe8dc] bg-white px-3 py-2 text-xs">
                      <p className="font-bold text-[#2b211d]">{getStatusLabel(entry.status)}</p>
                      <p className="mt-1 text-[#5f584f]">{entry.message}</p>
                      <p className="mt-1 text-[10px] text-[#9a8461]">{formatTimestamp(entry.timestamp)}</p>
                    </div>
                  ))}
                </div>
              </AdminCard>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              {ORDER_STATUSES.map((status) => (
                <button key={status} onClick={() => void updateStatus(selectedOrder.id, status)} className={`rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${selectedOrder.status === status ? 'border-[#b99a62] bg-[#b99a62]/10 text-[#b99a62]' : 'border-[#e6ded1] bg-white text-[#5f584f] hover:border-[#b99a62]'}`}>
                  {getStatusLabel(status)}
                </button>
              ))}
              {getNextStatus(selectedOrder.status) && (
                <button onClick={() => void updateStatus(selectedOrder.id, getNextStatus(selectedOrder.status)! as OrderStatus)} className="inline-flex items-center gap-2 rounded-full bg-[#b99a62] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white"><Package className="h-3.5 w-3.5" /> Next: {getStatusLabel(getNextStatus(selectedOrder.status)! as OrderStatus)}</button>
              )}
              <a href={`tel:${selectedOrder.customer.phone}`} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f584f]"><Phone className="h-3.5 w-3.5" /> Call</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
