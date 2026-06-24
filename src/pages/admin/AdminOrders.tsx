import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Download, Edit3, Eye, MessageCircle, Printer, RefreshCw, Search, Truck, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminEmptyBlock, AdminFilterChip, AdminHero, AdminMetricCard, AdminPageShell, AdminPanel, AdminStatusPill } from '@/components/admin/AdminCommandCenter';
import { buildAdminOrderWhatsAppMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { getPaymentMethodLabel, getPaymentStatusLabel } from '@/lib/payments';
import { formatPrice, formatTimestamp, getStatusLabel } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types';

const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];
const PAYMENT_METHODS: Array<Order['paymentMethod']> = ['cod', 'instapay', 'vodafone_cash', 'valu'];
const PAYMENT_STATUSES: Order['paymentStatus'][] = ['pending', 'pending_confirmation', 'waiting_transfer', 'paid', 'collected', 'failed', 'refunded'];

type SavedView = 'all' | 'new' | 'waiting-proof' | 'valu' | 'ready-ship' | 'delayed' | 'reviewable';

function paymentTone(status: string): 'neutral' | 'good' | 'warn' | 'danger' | 'info' {
  if (['paid', 'collected'].includes(status)) return 'good';
  if (status === 'waiting_transfer' || status === 'pending_confirmation') return 'warn';
  if (status === 'failed' || status === 'refunded') return 'danger';
  return 'neutral';
}

function statusTone(status: string): 'neutral' | 'good' | 'warn' | 'danger' | 'info' | 'accent' {
  if (status === 'delivered') return 'good';
  if (['cancelled', 'returned', 'failed'].includes(status)) return 'danger';
  if (['pending', 'confirmed'].includes(status)) return 'warn';
  if (['shipped', 'out_for_delivery'].includes(status)) return 'info';
  return 'accent';
}

function isDelayed(order: Order) {
  return ['pending', 'confirmed', 'preparing'].includes(order.status) && Date.now() - order.createdAt.getTime() > 1000 * 60 * 60 * 48;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [shippingFilter, setShippingFilter] = useState('');
  const [savedView, setSavedView] = useState<SavedView>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const { getOrders } = await import('@/lib/supabase/db');
      const rows = await getOrders();
      setOrders(rows);
      setSelectedIds([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadOrders(); }, []);

  const queues = useMemo(() => ({
    all: orders.length,
    newOrders: orders.filter((order) => order.status === 'pending').length,
    waitingTransfer: orders.filter((order) => order.paymentStatus === 'waiting_transfer').length,
    valuFollowup: orders.filter((order) => order.paymentMethod === 'valu' && !['paid', 'collected'].includes(String(order.paymentStatus))).length,
    readyToShip: orders.filter((order) => ['confirmed', 'preparing', 'packed'].includes(order.status) && (!order.shippingStatus || order.shippingStatus === 'not_created')).length,
    delayed: orders.filter(isDelayed).length,
    paid: orders.filter((order) => ['paid', 'collected'].includes(order.paymentStatus)).length,
  }), [orders]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query
      || order.orderNumber.toLowerCase().includes(query)
      || order.customer.fullName.toLowerCase().includes(query)
      || order.customer.phone.includes(query)
      || String(order.trackingNumber || '').toLowerCase().includes(query)
      || order.items.some((item) => item.name.toLowerCase().includes(query));
    const matchesStatus = statusFilter ? order.status === statusFilter : true;
    const matchesPayment = paymentFilter ? order.paymentMethod === paymentFilter || order.paymentStatus === paymentFilter : true;
    const matchesShipping = shippingFilter ? String(order.shippingStatus || 'not_created') === shippingFilter : true;
    const matchesView = savedView === 'all'
      || (savedView === 'new' && order.status === 'pending')
      || (savedView === 'waiting-proof' && order.paymentStatus === 'waiting_transfer')
      || (savedView === 'valu' && order.paymentMethod === 'valu')
      || (savedView === 'ready-ship' && ['confirmed', 'preparing', 'packed'].includes(order.status) && (!order.shippingStatus || order.shippingStatus === 'not_created'))
      || (savedView === 'delayed' && isDelayed(order))
      || (savedView === 'reviewable' && order.status === 'delivered');
    return matchesSearch && matchesStatus && matchesPayment && matchesShipping && matchesView;
  }), [orders, paymentFilter, savedView, searchQuery, shippingFilter, statusFilter]);

  const selectedOrders = useMemo(() => orders.filter((order) => selectedIds.includes(order.id)), [orders, selectedIds]);
  const allVisibleSelected = filteredOrders.length > 0 && filteredOrders.every((order) => selectedIds.includes(order.id));

  const toggleSelected = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleVisible = () => setSelectedIds(allVisibleSelected ? [] : filteredOrders.map((order) => order.id));

  const openWhatsApp = async (order: Order, purpose: 'confirm' | 'payment' | 'shipping' = 'confirm') => {
    const message = buildAdminOrderWhatsAppMessage(order, purpose);
    window.open(buildWhatsAppUrl(order.customer.phone, message), '_blank', 'noopener,noreferrer');
    try {
      const { addOrderFollowup } = await import('@/lib/supabase/db');
      await addOrderFollowup(order.id, purpose === 'payment' ? 'payment_proof_received' : purpose === 'shipping' ? 'shipping_update' : 'whatsapp_sent', message);
    } catch {
      // Non-blocking audit trail.
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
      toast.error(error instanceof Error ? error.message : 'Shipment could not be created. Open Shipping diagnostics for the exact setup issue.');
    }
  };

  const updateSelectedStatus = async (status: OrderStatus) => {
    if (!selectedOrders.length) return;
    try {
      const { updateOrderStatus } = await import('@/lib/supabase/db');
      await Promise.all(selectedOrders.map((order) => updateOrderStatus(order.id, status, `Bulk status update to ${status}`, 'studio')));
      toast.success(`${selectedOrders.length} order(s) updated`);
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bulk status update failed');
    }
  };

  const bulkMarkPaid = async () => {
    if (!selectedOrders.length) return;
    try {
      const { markOrderPaymentCollected } = await import('@/lib/supabase/db');
      await Promise.all(selectedOrders.map((order) => markOrderPaymentCollected(order.id)));
      toast.success(`${selectedOrders.length} payment(s) marked paid`);
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bulk payment update failed');
    }
  };

  const exportOrdersCsv = () => {
    const headers = ['order_number', 'customer_name', 'phone', 'governorate', 'city', 'total', 'order_status', 'payment_method', 'payment_status', 'shipping_status', 'items', 'created_at'];
    const rows = filteredOrders.map((order) => [order.orderNumber, order.customer.fullName, order.customer.phone, order.customer.governorate, order.customer.city, String(order.total), order.status, order.paymentMethod, order.paymentStatus, String(order.shippingStatus || 'not_created'), order.items.map((item) => `${item.name} ${item.size}${item.color ? `/${item.color}` : ''} x${item.quantity}`).join(' | '), order.createdAt.toISOString()]);
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
    <AdminPageShell>
      <AdminHero
        eyebrow="Operations"
        title="Orders Operations Center"
        description="Search, filter, edit, collect payment, create shipments, print invoices and run bulk actions without losing any existing order capability."
        actions={<><button onClick={exportOrdersCsv} className="nexora-button"><Download className="h-4 w-4" /> Export CSV</button><button onClick={loadOrders} className="nexora-button-primary"><RefreshCw className="h-4 w-4" /> Refresh</button></>}
        meta={<><AdminStatusPill tone="accent">{filteredOrders.length} visible</AdminStatusPill><AdminStatusPill tone={selectedOrders.length ? 'info' : 'neutral'}>{selectedOrders.length} selected</AdminStatusPill></>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
        <AdminMetricCard label="All" value={queues.all} helper="Loaded orders" tone="neutral" />
        <AdminMetricCard label="New" value={queues.newOrders} helper="Needs confirmation" tone={queues.newOrders ? 'warn' : 'good'} />
        <AdminMetricCard label="Waiting proof" value={queues.waitingTransfer} helper="Transfer screenshot" tone={queues.waitingTransfer ? 'warn' : 'good'} />
        <AdminMetricCard label="ValU" value={queues.valuFollowup} helper="Manual follow-up" tone={queues.valuFollowup ? 'warn' : 'good'} />
        <AdminMetricCard label="Ready ship" value={queues.readyToShip} helper="Shipment action" tone={queues.readyToShip ? 'info' : 'good'} />
        <AdminMetricCard label="Paid" value={queues.paid} helper="Collected payments" tone="good" />
        <AdminMetricCard label="Delayed" value={queues.delayed} helper="Older than 48h" tone={queues.delayed ? 'danger' : 'good'} />
      </div>

      <AdminPanel title="Saved Views & Filters" description="Use saved views for daily queues, then refine with status, payment, shipping or search.">
        <div className="flex flex-wrap gap-2">
          {([
            ['all', 'All Orders'], ['new', 'New'], ['waiting-proof', 'Waiting Proof'], ['valu', 'ValU'], ['ready-ship', 'Ready to Ship'], ['delayed', 'Delayed'], ['reviewable', 'Delivered / Reviewable'],
          ] as Array<[SavedView, string]>).map(([key, label]) => <AdminFilterChip key={key} active={savedView === key} onClick={() => setSavedView(key)}>{label}</AdminFilterChip>)}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px_220px_190px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9D7159]" />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search order, customer, phone, product or tracking..." className="studio-input pl-11" />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="studio-input"><option value="">All statuses</option>{ORDER_STATUSES.map((status) => <option key={status} value={status}>{getStatusLabel(status, 'en')}</option>)}</select>
          <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} className="studio-input"><option value="">All payment</option>{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{getPaymentMethodLabel(method, 'en')}</option>)}{PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{getPaymentStatusLabel(status, 'en')}</option>)}</select>
          <select value={shippingFilter} onChange={(event) => setShippingFilter(event.target.value)} className="studio-input"><option value="">All shipping</option><option value="not_created">Not created</option><option value="manual">Manual</option><option value="created">Created</option><option value="in_transit">In transit</option><option value="delivered">Delivered</option><option value="failed">Failed</option></select>
        </div>
      </AdminPanel>

      {selectedOrders.length > 0 && (
        <div className="sticky top-[88px] z-10 rounded-[24px] border border-[#D6B58F] bg-[#FFFDF8] p-3 shadow-[0_18px_45px_rgba(43,33,29,.12)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm font-black text-[#231916]">{selectedOrders.length} selected order(s)</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => updateSelectedStatus('preparing')} className="nexora-button">Mark Preparing</button>
              <button onClick={() => updateSelectedStatus('packed')} className="nexora-button">Mark Packed</button>
              <button onClick={bulkMarkPaid} className="nexora-button"><CheckCircle className="h-4 w-4" /> Mark Paid</button>
              <button onClick={exportOrdersCsv} className="nexora-button"><Download className="h-4 w-4" /> Export Visible</button>
              <button onClick={() => setSelectedIds([])} className="nexora-button"><XCircle className="h-4 w-4" /> Clear</button>
            </div>
          </div>
        </div>
      )}

      <AdminPanel title="Orders Table" description="Every row keeps direct access to open, edit, WhatsApp, payment, shipment and print actions.">
        <div className="overflow-x-auto rounded-[24px] border border-[#E4D6C5]">
          <table className="w-full min-w-[1220px] text-left">
            <thead>
              <tr className="border-b border-[#E4D6C5] bg-[#FAF5EE]">
                <th className="p-4"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} aria-label="Select visible orders" /></th>
                {['Order', 'Customer', 'Items', 'Total', 'Payment', 'Order Status', 'Shipping', 'Created', 'Actions'].map((heading) => <th key={heading} className="p-4 text-[10px] font-black uppercase tracking-[0.18em] text-[#9D7159]">{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={10} className="p-8 text-center text-sm text-[#6F5D50]">Loading orders...</td></tr> : filteredOrders.length ? filteredOrders.map((order) => (
                <tr key={order.id} className={`border-b border-[#EFE5D9] transition hover:bg-[#FAF5EE] ${selectedIds.includes(order.id) ? 'bg-[#F2E7D8]/70' : ''}`}>
                  <td className="p-4"><input type="checkbox" checked={selectedIds.includes(order.id)} onChange={() => toggleSelected(order.id)} aria-label={`Select ${order.orderNumber}`} /></td>
                  <td className="p-4"><Link to={`/nexora-admin/orders/${order.id}`} className="text-xs font-black text-[#9D7159] hover:underline">{order.orderNumber}</Link><p className="mt-1 text-[10px] text-[#8E7664]">{isDelayed(order) ? 'Delayed attention' : 'On workflow'}</p></td>
                  <td className="p-4"><p className="text-xs font-bold text-[#231916]">{order.customer.fullName}</p><p className="mt-1 text-[10px] text-[#6F5D50]" dir="ltr">{order.customer.phone}</p><p className="mt-1 text-[10px] text-[#8E7664]">{order.customer.city}, {order.customer.governorate}</p></td>
                  <td className="p-4"><div className="flex -space-x-2">{order.items.slice(0, 4).map((item, index) => <img key={`${item.productId}-${index}`} src={item.image || '/assets/nexora-logo.png'} alt={item.name} className="h-10 w-10 rounded-full border-2 border-white bg-[#FAF5EE] object-cover" />)}{order.items.length > 4 && <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-[#EFE5D9] text-[10px] font-bold">+{order.items.length - 4}</span>}</div><p className="mt-2 text-[10px] text-[#6F5D50]">{order.items.length} item(s)</p></td>
                  <td className="p-4 text-xs font-black text-[#231916]">{formatPrice(order.total)}</td>
                  <td className="p-4"><p className="text-xs font-bold text-[#231916]">{getPaymentMethodLabel(order.paymentMethod, 'en')}</p><div className="mt-2"><AdminStatusPill tone={paymentTone(order.paymentStatus)}>{getPaymentStatusLabel(order.paymentStatus, 'en')}</AdminStatusPill></div></td>
                  <td className="p-4"><AdminStatusPill tone={statusTone(order.status)}>{getStatusLabel(order.status, 'en')}</AdminStatusPill></td>
                  <td className="p-4"><div className="flex items-center gap-2 text-xs text-[#6F5D50]"><Truck className="h-4 w-4 text-[#9D7159]" />{order.shippingStatus || 'not_created'}</div>{order.trackingNumber && <p className="mt-1 text-[10px] font-bold text-[#8C634B]">{order.trackingNumber}</p>}</td>
                  <td className="p-4 text-[10px] text-[#6F5D50]">{formatTimestamp(order.createdAt, 'en-EG')}</td>
                  <td className="p-4"><div className="flex flex-wrap gap-2">
                    <Link to={`/nexora-admin/orders/${order.id}`} className="nexora-button !min-h-0 !px-3 !py-2"><Eye className="h-3.5 w-3.5" /> Open</Link>
                    <Link to={`/nexora-admin/orders/${order.id}?edit=1`} className="nexora-button !min-h-0 !px-3 !py-2"><Edit3 className="h-3.5 w-3.5" /> Edit</Link>
                    <button onClick={() => void openWhatsApp(order, order.paymentStatus === 'waiting_transfer' ? 'payment' : 'confirm')} className="nexora-button !min-h-0 !px-3 !py-2"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</button>
                    {!['paid', 'collected'].includes(String(order.paymentStatus)) && <button onClick={() => void markPaid(order.id)} className="nexora-button !min-h-0 !px-3 !py-2"><CheckCircle className="h-3.5 w-3.5" /> Paid</button>}
                    {!order.trackingNumber && <button onClick={() => void createShipment(order.id)} className="nexora-button !min-h-0 !px-3 !py-2"><Truck className="h-3.5 w-3.5" /> Ship</button>}
                    <button onClick={() => window.print()} className="nexora-button !min-h-0 !px-3 !py-2"><Printer className="h-3.5 w-3.5" /> Print</button>
                  </div></td>
                </tr>
              )) : <tr><td colSpan={10} className="p-8"><AdminEmptyBlock title="No matching orders" description="Change filters, search query, or saved view to see more orders." /></td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </AdminPageShell>
  );
}
