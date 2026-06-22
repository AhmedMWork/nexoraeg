// ============================================================
// NEXORA — English Orders HQ
// Clear daily operations table with direct edit access.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Download, Eye, MessageCircle, Pencil, RefreshCw, Search, Ship, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatPrice, formatTimestamp, getStatusColor, getStatusLabel } from '@/lib/utils';
import { buildAdminOrderWhatsAppMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { getPaymentMethodLabel, getPaymentStatusLabel } from '@/lib/payments';
import type { Order, OrderStatus } from '@/types';

const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];
const PAYMENT_STATUSES: Order['paymentStatus'][] = ['pending', 'pending_confirmation', 'waiting_transfer', 'paid', 'collected', 'failed', 'refunded'];

function paymentLabel(method?: string) { return getPaymentMethodLabel(method, 'en'); }
function paymentStatusLabel(status?: string) { return getPaymentStatusLabel(status, 'en'); }
function statusLabel(status?: string) { return getStatusLabel(String(status || 'pending'), 'en'); }

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const { getOrders } = await import('@/lib/supabase/db');
      setOrders(await getOrders());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadOrders(); }, []);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const matchesStatus = statusFilter ? order.status === statusFilter : true;
    const matchesPayment = paymentFilter ? order.paymentMethod === paymentFilter || order.paymentStatus === paymentFilter : true;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query
      || order.orderNumber.toLowerCase().includes(query)
      || order.customer.fullName.toLowerCase().includes(query)
      || order.customer.phone.includes(query);
    return matchesStatus && matchesPayment && matchesSearch;
  }), [orders, statusFilter, paymentFilter, searchQuery]);

  const queues = useMemo(() => ({
    newOrders: orders.filter((order) => order.status === 'pending').length,
    waitingTransfer: orders.filter((order) => order.paymentStatus === 'waiting_transfer').length,
    valuFollowup: orders.filter((order) => order.paymentMethod === 'valu' && !['paid', 'collected'].includes(String(order.paymentStatus))).length,
    readyToShip: orders.filter((order) => ['confirmed', 'preparing', 'packed'].includes(order.status) && (!order.shippingStatus || order.shippingStatus === 'not_created')).length,
    lateOrders: orders.filter((order) => ['pending', 'confirmed', 'preparing'].includes(order.status) && Date.now() - order.createdAt.getTime() > 1000 * 60 * 60 * 24 * 2).length,
  }), [orders]);

  const openWhatsApp = async (order: Order, purpose: 'confirm' | 'payment' | 'shipping' = 'confirm') => {
    const message = buildAdminOrderWhatsAppMessage(order, purpose);
    window.open(buildWhatsAppUrl(order.customer.phone, message), '_blank', 'noopener,noreferrer');
    try {
      const { addOrderFollowup } = await import('@/lib/supabase/db');
      await addOrderFollowup(order.id, purpose === 'payment' ? 'reminder_sent' : 'whatsapp_sent', message);
    } catch {
      // Follow-up logging should not block the action.
    }
  };

  const markPaid = async (orderId: string) => {
    try {
      const { markOrderPaymentCollected } = await import('@/lib/supabase/db');
      await markOrderPaymentCollected(orderId);
      toast.success('Payment marked as paid');
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not mark payment as paid');
    }
  };

  const createShipment = async (orderId: string) => {
    try {
      const { createOrderShipment } = await import('@/lib/supabase/db');
      const shipment = await createOrderShipment(orderId);
      toast.success(shipment?.trackingNumber ? `Shipment created: ${shipment.trackingNumber}` : 'Shipment created');
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create shipment. Review shipping settings.');
    }
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
    <div className="space-y-6 text-[#2b211d]" dir="ltr">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a8461]">NEXORA ORDERS</p>
          <h1 className="mt-2 text-2xl font-black text-[#2b211d]">Orders Management</h1>
          <p className="mt-1 text-sm text-[#8a8175]">{orders.length} orders · payment confirmation · order editing · shipping follow-up</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a8461]" />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search order, customer, or phone..." className="w-full rounded-2xl border border-[#e6ded1] bg-white py-3 pl-10 pr-4 text-xs text-[#2b211d] outline-none transition-colors focus:border-[#b99a62] sm:w-80" />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-3 text-xs text-[#5f584f] outline-none">
            <option value="">All order statuses</option>
            {ORDER_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </select>
          <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} className="rounded-2xl border border-[#e6ded1] bg-white px-3 py-3 text-xs text-[#5f584f] outline-none">
            <option value="">All payment methods</option>
            <option value="cod">Cash on Delivery</option>
            <option value="instapay">Instapay</option>
            <option value="vodafone_cash">Vodafone Cash</option>
            <option value="valu">ValU</option>
            {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{paymentStatusLabel(status)}</option>)}
          </select>
          <button onClick={exportOrdersCsv} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#e6ded1] bg-white px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5f584f] hover:border-[#b99a62]"><Download className="h-3.5 w-3.5" /> CSV</button>
          <button onClick={loadOrders} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2b211d] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {[
          { label: 'New Orders', value: queues.newOrders, helper: 'Need quick confirmation', action: () => setStatusFilter('pending') },
          { label: 'Waiting Payment Proof', value: queues.waitingTransfer, helper: 'Instapay / Vodafone', action: () => setPaymentFilter('waiting_transfer') },
          { label: 'ValU Follow-up', value: queues.valuFollowup, helper: 'Installment confirmation', action: () => setPaymentFilter('valu') },
          { label: 'Ready to Ship', value: queues.readyToShip, helper: 'Create shipment', action: () => setStatusFilter('confirmed') },
          { label: 'Delayed Orders', value: queues.lateOrders, helper: 'Needs review', action: () => setStatusFilter('') },
        ].map((card) => (
          <button key={card.label} type="button" onClick={card.action} className="rounded-[26px] border border-[#e6ded1] bg-white p-4 text-left shadow-[0_14px_38px_rgba(43,33,29,0.05)] transition hover:-translate-y-0.5 hover:border-[#b99a62]">
            <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#9a8461]">{card.label}</span>
            <span className="mt-3 block text-2xl font-black text-[#2b211d]">{card.value}</span>
            <span className="mt-1 block text-[11px] leading-5 text-[#8a8175]">{card.helper}</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[28px] border border-[#e6ded1] bg-white shadow-[0_18px_50px_rgba(43,33,29,0.06)]">
        <table className="w-full min-w-[1060px] text-left">
          <thead>
            <tr className="border-b border-[#efe8dc] bg-[#faf7f1]">
              {['Order', 'Items', 'Customer', 'Total', 'Payment', 'Status', 'Shipping', 'Actions'].map((heading) => <th key={heading} className="p-4 text-[10px] font-black uppercase tracking-wider text-[#9a8461]">{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="p-8 text-center text-xs text-[#8a8175]">Loading orders...</td></tr>
            ) : filteredOrders.length ? filteredOrders.map((order) => (
              <tr key={order.id} className="border-b border-[#efe8dc]/80 hover:bg-[#faf7f1]">
                <td className="p-4">
                  <p className="text-xs font-black text-[#b99a62]">{order.orderNumber}</p>
                  <p className="mt-1 text-[10px] text-[#8a8175]">{formatTimestamp(order.createdAt, 'en-EG')}</p>
                </td>
                <td className="p-4">
                  <div className="flex justify-start -space-x-2">
                    {order.items.slice(0, 4).map((item, index) => <img key={`${order.id}-${item.productId}-${index}`} src={item.image || '/assets/nexora-logo.png'} alt={item.name} className="h-10 w-10 rounded-full border-2 border-white bg-[#faf7f1] object-cover" />)}
                    {order.items.length > 4 && <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[#efe8dc] text-[10px] font-bold text-[#5f584f]">+{order.items.length - 4}</span>}
                  </div>
                </td>
                <td className="p-4">
                  <p className="text-xs font-semibold text-[#2b211d]">{order.customer.fullName}</p>
                  <p className="mt-1 text-[10px] text-[#8a8175]" dir="ltr">{order.customer.phone}</p>
                </td>
                <td className="p-4 text-xs font-black text-[#2b211d]">{formatPrice(order.total)}</td>
                <td className="p-4">
                  <p className="text-xs text-[#2b211d]">{paymentLabel(order.paymentMethod)}</p>
                  <p className="mt-1 text-[10px] text-[#8a8175]">{paymentStatusLabel(order.paymentStatus)}</p>
                </td>
                <td className="p-4"><span className={`status-badge ${getStatusColor(order.status)} text-[9px]`}>{statusLabel(order.status)}</span></td>
                <td className="p-4 text-[10px] text-[#8a8175]">{order.shippingStatus || 'Not created'}</td>
                <td className="p-4">
                  <div className="flex flex-wrap justify-start gap-2">
                    <Link to={`/nexora-admin/orders/${order.id}`} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f584f] hover:border-[#b99a62] hover:text-[#b99a62]"><Eye className="h-3.5 w-3.5" /> Open</Link>
                    <Link to={`/nexora-admin/orders/${order.id}`} className="inline-flex items-center gap-2 rounded-full border border-[#d7b98e] bg-[#fbf7ef] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a6c3d]"><Pencil className="h-3.5 w-3.5" /> Edit</Link>
                    <button onClick={() => void openWhatsApp(order)} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f584f]"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</button>
                    {!['paid', 'collected'].includes(String(order.paymentStatus)) && <button onClick={() => void markPaid(order.id)} className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700"><CheckCircle className="h-3.5 w-3.5" /> Paid</button>}
                    {!order.trackingNumber && <button onClick={() => void createShipment(order.id)} className="inline-flex items-center gap-2 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f584f]"><Ship className="h-3.5 w-3.5" /> Ship</button>}
                    {order.trackingNumber && <span className="inline-flex items-center gap-1 rounded-full border border-[#e6ded1] bg-white px-3 py-2 text-[10px] font-bold text-[#5f584f]"><Truck className="h-3.5 w-3.5" /> {order.trackingNumber}</span>}
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={8} className="p-8 text-center text-xs text-[#8a8175]">No matching orders.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
