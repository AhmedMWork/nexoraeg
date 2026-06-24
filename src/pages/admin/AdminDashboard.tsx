/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, CheckCircle2, CreditCard, Package, RefreshCw, Star, Truck, WalletCards } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminActionLink, AdminHero, AdminMetricCard, AdminPageShell, AdminPanel, AdminProgressBar, AdminStatusPill } from '@/components/admin/AdminCommandCenter';
import { formatPrice, formatTimestamp, getStatusLabel } from '@/lib/utils';
import { getPaymentMethodLabel } from '@/lib/payments';
import type { Order, Product, Review } from '@/types';

type CommandData = {
  orders: Order[];
  products: Product[];
  reviews: Review[];
  growth: any;
  productReport: any;
  health: any;
};

const chartColors = ['#9D7159', '#D6B58F', '#D09A82', '#6F5D50', '#B39D89', '#231916'];

function shortDay(date: Date) {
  return date.toLocaleDateString('en-EG', { month: 'short', day: '2-digit' });
}

export default function AdminDashboard() {
  const [data, setData] = useState<CommandData>({ orders: [], products: [], reviews: [], growth: {}, productReport: {}, health: null });
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      const db = await import('@/lib/supabase/db');
      const [orders, products, reviews, growth, productReport, health] = await Promise.all([
        db.getOrders().catch(() => []),
        db.getAdminProducts().catch(() => []),
        db.getReviews().catch(() => []),
        db.getGrowthDashboard().catch(() => ({})),
        db.getProductAnalyticsReport({ days: 30 }).catch(() => ({})),
        db.getStudioHealthCheck().catch((error) => ({ error: error instanceof Error ? error.message : 'Health check failed', checks: [], failed: 1, warnings: 0, score: 0 })),
      ]);
      setData({ orders, products, reviews, growth, productReport, health });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const metrics = useMemo(() => {
    const activeOrders = data.orders.filter((o) => !['cancelled', 'returned', 'failed'].includes(o.status));
    const revenue = activeOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const pendingOrders = data.orders.filter((o) => ['pending', 'confirmed'].includes(o.status)).length;
    const waitingTransfer = data.orders.filter((o) => o.paymentStatus === 'waiting_transfer').length;
    const valuFollowup = data.orders.filter((o) => o.paymentMethod === 'valu' && !['paid', 'collected'].includes(String(o.paymentStatus))).length;
    const readyToShip = data.orders.filter((o) => ['confirmed', 'preparing', 'packed'].includes(o.status) && (!o.shippingStatus || o.shippingStatus === 'not_created')).length;
    const failedShipping = data.orders.filter((o) => ['failed', 'cancelled', 'error'].includes(String(o.shippingStatus || ''))).length;
    const lowStockProducts = data.products.filter((p) => p.sizes.some((s) => Number(s.stock || 0) <= Number(s.lowStockThreshold || 3))).length;
    const outOfStock = data.products.filter((p) => p.sizes.every((s) => Number(s.stock || 0) <= 0)).length;
    const pendingReviews = data.reviews.filter((r) => !r.isApproved && !['rejected', 'hidden', 'archived'].includes(String(r.status || ''))).length;
    const publishedProducts = data.products.filter((p) => p.status !== 'draft' && p.status !== 'hidden' && p.status !== 'archived').length;
    const productViews = Number(data.productReport?.summary?.views || 0);
    const productOrders = Number(data.productReport?.summary?.orders || data.orders.length || 0);
    const conversion = productViews ? Math.round((productOrders / productViews) * 1000) / 10 : 0;
    const aov = activeOrders.length ? Math.round(revenue / activeOrders.length) : 0;
    const healthFailed = Number(data.health?.failed || 0);
    const healthWarnings = Number(data.health?.warnings || 0);
    return { revenue, pendingOrders, waitingTransfer, valuFollowup, readyToShip, failedShipping, lowStockProducts, outOfStock, pendingReviews, publishedProducts, conversion, aov, healthFailed, healthWarnings };
  }, [data]);

  const revenueTrend = useMemo(() => {
    const map = new Map<string, { day: string; revenue: number; orders: number }>();
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      map.set(date.toISOString().slice(0, 10), { day: shortDay(date), revenue: 0, orders: 0 });
    }
    data.orders.forEach((order) => {
      const key = order.createdAt.toISOString().slice(0, 10);
      const row = map.get(key);
      if (row && !['cancelled', 'returned', 'failed'].includes(order.status)) {
        row.revenue += Number(order.total || 0);
        row.orders += 1;
      }
    });
    return Array.from(map.values());
  }, [data.orders]);

  const statusFunnel = useMemo(() => {
    const counts = new Map<string, number>();
    data.orders.forEach((order) => counts.set(order.status, (counts.get(order.status) || 0) + 1));
    return ['pending', 'confirmed', 'preparing', 'packed', 'shipped', 'delivered', 'cancelled'].map((status) => ({ status: getStatusLabel(status, 'en'), count: counts.get(status) || 0 }));
  }, [data.orders]);

  const paymentSplit = useMemo(() => {
    const counts = new Map<string, number>();
    data.orders.forEach((order) => counts.set(order.paymentMethod, (counts.get(order.paymentMethod) || 0) + 1));
    return Array.from(counts.entries()).map(([method, value]) => ({ name: getPaymentMethodLabel(method, 'en'), value }));
  }, [data.orders]);

  const priorityQueue = [
    { label: 'New orders', value: metrics.pendingOrders, tone: metrics.pendingOrders ? 'warn' : 'good', to: '/nexora-admin/orders' },
    { label: 'Waiting payment proof', value: metrics.waitingTransfer, tone: metrics.waitingTransfer ? 'warn' : 'good', to: '/nexora-admin/orders' },
    { label: 'ValU follow-up', value: metrics.valuFollowup, tone: metrics.valuFollowup ? 'warn' : 'good', to: '/nexora-admin/orders' },
    { label: 'Ready to ship', value: metrics.readyToShip, tone: metrics.readyToShip ? 'info' : 'good', to: '/nexora-admin/shipping' },
    { label: 'Pending reviews', value: metrics.pendingReviews, tone: metrics.pendingReviews ? 'warn' : 'good', to: '/nexora-admin/reviews' },
    { label: 'Low stock', value: metrics.lowStockProducts, tone: metrics.lowStockProducts ? 'danger' : 'good', to: '/nexora-admin/inventory' },
  ] as const;

  return (
    <AdminPageShell>
      <AdminHero
        eyebrow="NEXORA Commerce OS"
        title="Admin Command Center"
        description="A practical HQ for revenue, orders, payment follow-ups, shipping readiness, reviews and inventory. Every card links to an action, not just a number."
        actions={<button onClick={load} className="nexora-button-primary"><RefreshCw className="h-4 w-4" /> Refresh command center</button>}
        meta={<><AdminStatusPill tone={metrics.healthFailed ? 'danger' : metrics.healthWarnings ? 'warn' : 'good'}>{metrics.healthFailed ? 'Needs attention' : 'Operational'}</AdminStatusPill><AdminStatusPill tone="accent">{formatTimestamp(new Date(), 'en-EG')}</AdminStatusPill></>}
      />

      {isLoading && <div className="studio-card p-4 text-sm text-[#735B4F]">Loading command center...</div>}

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-6">
        <AdminMetricCard label="Revenue" value={formatPrice(metrics.revenue)} helper="Loaded non-cancelled order revenue." icon={<WalletCards className="h-4 w-4" />} tone="good" to="/nexora-admin/reports" />
        <AdminMetricCard label="Orders" value={data.orders.length} helper={`${metrics.pendingOrders} need review.`} icon={<Package className="h-4 w-4" />} tone={metrics.pendingOrders ? 'warn' : 'neutral'} to="/nexora-admin/orders" />
        <AdminMetricCard label="AOV" value={formatPrice(metrics.aov)} helper="Average active order value." icon={<CreditCard className="h-4 w-4" />} tone="accent" to="/nexora-admin/reports" />
        <AdminMetricCard label="Conversion" value={`${metrics.conversion}%`} helper="Product views to orders." icon={<BarChart3 className="h-4 w-4" />} tone="info" to="/nexora-admin/analytics" />
        <AdminMetricCard label="Reviews" value={metrics.pendingReviews} helper="Pending moderation queue." icon={<Star className="h-4 w-4" />} tone={metrics.pendingReviews ? 'warn' : 'good'} to="/nexora-admin/reviews" />
        <AdminMetricCard label="Shipping issues" value={metrics.failedShipping} helper="Failed or blocked shipment actions." icon={<Truck className="h-4 w-4" />} tone={metrics.failedShipping ? 'danger' : 'good'} to="/nexora-admin/shipping" />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
        <AdminPanel title="Revenue & Order Trend" description="Last seven days, based on loaded orders. Use Reports for full exports.">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
                <defs><linearGradient id="nexoraRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#9D7159" stopOpacity={0.35} /><stop offset="95%" stopColor="#9D7159" stopOpacity={0.02} /></linearGradient></defs>
                <CartesianGrid stroke="#E9DDCF" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#735B4F', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#735B4F', fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
                <Tooltip formatter={(value, name) => name === 'revenue' ? formatPrice(Number(value)) : value} contentStyle={{ borderRadius: 18, border: '1px solid #E4D6C5', background: '#FFFDF8' }} />
                <Area type="monotone" dataKey="revenue" stroke="#9D7159" strokeWidth={3} fill="url(#nexoraRevenue)" />
                <Area type="monotone" dataKey="orders" stroke="#D09A82" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </AdminPanel>

        <AdminPanel title="Payment Method Split" description="Understand follow-up load by payment method.">
          <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr] 2xl:grid-cols-1">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentSplit.length ? paymentSplit : [{ name: 'No data', value: 1 }]} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={4}>
                    {(paymentSplit.length ? paymentSplit : [{ name: 'No data', value: 1 }]).map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 18, border: '1px solid #E4D6C5', background: '#FFFDF8' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {(paymentSplit.length ? paymentSplit : [{ name: 'No orders yet', value: 0 }]).map((row, index) => (
                <div key={row.name} className="flex items-center justify-between rounded-2xl border border-[#E4D6C5] bg-[#FAF5EE] px-3 py-2 text-xs">
                  <span className="flex items-center gap-2 text-[#6F5D50]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: chartColors[index % chartColors.length] }} />{row.name}</span>
                  <strong className="text-[#231916]">{row.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </AdminPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <AdminPanel title="Priority Queue" description="Open each queue directly. This replaces hunting through tables.">
          <div className="grid gap-3 sm:grid-cols-2">
            {priorityQueue.map((item) => (
              <Link key={item.label} to={item.to} className="rounded-[24px] border border-[#E4D6C5] bg-[#FAF5EE] p-4 transition hover:-translate-y-0.5 hover:border-[#D6B58F]">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-sm font-black text-[#231916]">{item.label}</p><p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#231916]">{item.value}</p></div>
                  <AdminStatusPill tone={item.tone as any}>{Number(item.value) ? 'Action' : 'Clear'}</AdminStatusPill>
                </div>
              </Link>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="Order Pipeline" description="Current status distribution from loaded orders." actions={<AdminActionLink to="/nexora-admin/workflow">Manage workflow</AdminActionLink>}>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusFunnel} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
                <CartesianGrid stroke="#E9DDCF" vertical={false} />
                <XAxis dataKey="status" tick={{ fill: '#735B4F', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#735B4F', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ borderRadius: 18, border: '1px solid #E4D6C5', background: '#FFFDF8' }} />
                <Bar dataKey="count" radius={[12, 12, 0, 0]} fill="#9D7159" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AdminPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <AdminPanel title="Recent Orders" description="Latest customer activity" actions={<AdminActionLink to="/nexora-admin/orders">View all</AdminActionLink>} className="xl:col-span-2">
          <div className="space-y-3">
            {data.orders.slice(0, 6).map((order) => (
              <Link key={order.id} to={`/nexora-admin/orders/${order.id}`} className="flex flex-col gap-3 rounded-2xl border border-[#E4D6C5] bg-[#FAF5EE] p-3 transition hover:border-[#D6B58F] sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-black text-[#231916]">{order.orderNumber} · {order.customer.fullName}</p><p className="mt-1 text-xs text-[#6F5D50]">{getPaymentMethodLabel(order.paymentMethod, 'en')} · {formatTimestamp(order.createdAt, 'en-EG')}</p></div>
                <div className="flex items-center gap-2"><AdminStatusPill tone={order.paymentStatus === 'waiting_transfer' ? 'warn' : order.status === 'delivered' ? 'good' : 'neutral'}>{getStatusLabel(order.status, 'en')}</AdminStatusPill><strong className="text-sm">{formatPrice(order.total)}</strong></div>
              </Link>
            ))}
            {!data.orders.length && <p className="rounded-2xl border border-dashed border-[#D7C5B2] p-6 text-center text-xs text-[#6F5D50]">No orders loaded yet.</p>}
          </div>
        </AdminPanel>

        <AdminPanel title="Store Quality" description="Catalog and system readiness at a glance.">
          <div className="space-y-4">
            <div><div className="mb-2 flex justify-between text-xs"><span>Published catalog</span><strong>{metrics.publishedProducts}/{data.products.length}</strong></div><AdminProgressBar value={metrics.publishedProducts} max={Math.max(data.products.length, 1)} tone="good" /></div>
            <div><div className="mb-2 flex justify-between text-xs"><span>Low stock pressure</span><strong>{metrics.lowStockProducts}</strong></div><AdminProgressBar value={metrics.lowStockProducts} max={Math.max(data.products.length, 1)} tone={metrics.lowStockProducts ? 'warn' : 'good'} /></div>
            <div><div className="mb-2 flex justify-between text-xs"><span>Out of stock</span><strong>{metrics.outOfStock}</strong></div><AdminProgressBar value={metrics.outOfStock} max={Math.max(data.products.length, 1)} tone={metrics.outOfStock ? 'danger' : 'good'} /></div>
            <div className="rounded-2xl border border-[#E4D6C5] bg-[#FAF5EE] p-4">
              <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /><div><p className="text-sm font-black text-[#231916]">Readiness score</p><p className="mt-1 text-xs leading-6 text-[#6F5D50]">{metrics.healthFailed ? `${metrics.healthFailed} issue(s) need attention before production changes.` : 'No blocking health issue in the loaded report.'}</p></div></div>
            </div>
          </div>
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}
