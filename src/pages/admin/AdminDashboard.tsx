/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Package, ShoppingBag, Truck, UserPlus, AlertTriangle, RefreshCw, ShieldCheck, Warehouse, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminInsight, AdminPageHeader, AdminStatCard } from '@/components/admin/AdminPageHeader';
import { formatPrice } from '@/lib/utils';
import type { Order, Product } from '@/types';

type TodayState = {
  orders: Order[];
  products: Product[];
  growth: any;
  productReport: any;
  shipping: any;
  health: any;
};

function ActionButton({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="shrink-0 rounded-full border border-[#D6B58F]/45 bg-[#FFFDF8] px-3 py-2 text-xs font-bold text-[#8C634B] hover:bg-[#F2E7D8]">{children}</Link>;
}

function QuietShortcut({ to, icon: Icon, title, helper }: { to: string; icon: React.ElementType; title: string; helper: string }) {
  return (
    <Link to={to} className="group rounded-[24px] border border-[#E4D6C5] bg-[#FFFDF8] p-5 shadow-[0_18px_45px_rgba(43,33,29,.05)] transition hover:-translate-y-0.5 hover:border-[#D6B58F] hover:shadow-[0_24px_55px_rgba(43,33,29,.08)]">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#F2E7D8] text-[#9D7159] transition group-hover:bg-[#231916] group-hover:text-[#FFFDF8]"><Icon className="h-4 w-4" /></span>
      <h3 className="mt-4 text-sm font-semibold text-[#231916]">{title}</h3>
      <p className="mt-2 text-xs leading-6 text-[#735B4F]">{helper}</p>
    </Link>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<TodayState>({ orders: [], products: [], growth: {}, productReport: {}, shipping: {}, health: null });
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      const db = await import('@/lib/supabase/db');
      const [orders, products, growth, productReport, shipping, health] = await Promise.all([
        db.getOrders().catch(() => []),
        db.getAdminProducts().catch(() => []),
        db.getGrowthDashboard().catch(() => ({})),
        db.getProductAnalyticsReport({ days: 30 }).catch(() => ({})),
        db.getShippingAdmin().catch(() => ({})),
        db.getStudioHealthCheck().catch((error) => ({ error: error instanceof Error ? error.message : 'Health check failed', checks: [], failed: 1, warnings: 0, score: 0 })),
      ]);
      setData({ orders, products, growth, productReport, shipping, health });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load Today');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const metrics = useMemo(() => {
    const activeOrders = data.orders.filter((o) => !['cancelled', 'returned', 'failed'].includes(o.status));
    const revenue = activeOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const pendingOrders = data.orders.filter((o) => ['pending', 'confirmed'].includes(o.status)).length;
    const readyToShip = data.orders.filter((o) => ['confirmed', 'preparing'].includes(o.status) && (!o.shippingStatus || o.shippingStatus === 'not_created')).length;
    const failedShipping = data.orders.filter((o) => ['failed','cancelled'].includes(String(o.shippingStatus || ''))).length;
    const lowStockProducts = data.products.filter((p) => p.sizes.some((s) => Number(s.stock || 0) <= Number(s.lowStockThreshold || 3))).length;
    const missingImages = data.products.filter((p) => !p.images?.length).length;
    const missingSeo = data.products.filter((p) => !p.seoTitle || !p.seoDescription).length;
    const leads = Number(data.growth.leadsToday || 0);
    const whatsapp = Number(data.growth.whatsappClicksToday || 0);
    const healthFailed = Number(data.health?.failed || 0);
    const healthWarnings = Number(data.health?.warnings || 0);
    const productViews = Number(data.productReport?.summary?.views || 0);
    const productOrders = Number(data.productReport?.summary?.orders || 0);
    const conversion = productViews ? Math.round((productOrders / productViews) * 1000) / 10 : 0;
    return { revenue, pendingOrders, readyToShip, failedShipping, lowStockProducts, missingImages, missingSeo, leads, whatsapp, healthFailed, healthWarnings, productViews, productOrders, conversion };
  }, [data]);

  const actionInbox = [
    { title: `${metrics.pendingOrders} orders need review`, description: 'Confirm new orders, check customer details, then prepare or create shipment.', status: metrics.pendingOrders ? 'warn' : 'good', to: '/nexora-admin/orders' },
    { title: `${metrics.readyToShip} orders waiting for delivery action`, description: 'Create ShipBlu shipment or handle manually from Orders.', status: metrics.readyToShip ? 'warn' : 'good', to: '/nexora-admin/orders' },
    { title: `${metrics.lowStockProducts} products need stock attention`, description: 'Check size/color stock before pushing campaigns.', status: metrics.lowStockProducts ? 'warn' : 'good', to: '/nexora-admin/inventory' },
    { title: `${metrics.missingImages + metrics.missingSeo} catalog items need polish`, description: 'Images and SEO are now treated as catalog quality, not technical work.', status: metrics.missingImages + metrics.missingSeo ? 'warn' : 'good', to: '/nexora-admin/products' },
  ] as const;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Today at NEXORA"
        title="Clean daily dashboard"
        description="A lighter owner-friendly view. Technical diagnostics are kept in Setup & Recovery so the daily admin stays calm and focused."
        actions={<button onClick={load} className="nexora-button flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Refresh</button>}
      />

      {isLoading && <div className="studio-card p-4 text-sm text-[#735B4F]">Loading Today...</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Revenue loaded" value={formatPrice(metrics.revenue)} helper="Non-cancelled orders currently loaded." tone="good" />
        <AdminStatCard label="Orders to handle" value={metrics.pendingOrders + metrics.readyToShip} helper="Confirm, prepare, ship or follow up." tone={metrics.pendingOrders || metrics.readyToShip ? 'warn' : 'good'} />
        <AdminStatCard label="Stock alerts" value={metrics.lowStockProducts} helper="Products with low variant stock." tone={metrics.lowStockProducts ? 'warn' : 'good'} />
        <AdminStatCard label="Product funnel" value={`${metrics.conversion}%`} helper={`${metrics.productViews} views → ${metrics.productOrders} orders.`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="studio-card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#231916]">Action Inbox</h2>
              <p className="mt-1 text-xs leading-6 text-[#735B4F]">Only practical daily tasks are shown here. Setup checks stay under Setup.</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-[#9D7159]" />
          </div>
          <div className="space-y-3">
            {actionInbox.map((item) => (
              <AdminInsight key={item.title} title={item.title} description={item.description} status={item.status as any} action={<ActionButton to={item.to}>Open <ArrowRight className="ml-1 inline h-3 w-3" /></ActionButton>} />
            ))}
          </div>
        </section>

        <section className="studio-card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#231916]">Quiet system note</h2>
              <p className="mt-1 text-xs leading-6 text-[#735B4F]">Diagnostics are available, but no longer crowd the daily workflow.</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-[#9D7159]" />
          </div>
          <div className="rounded-[24px] border border-[#E4D6C5] bg-[#FAF5EE] p-4">
            <p className="text-sm font-semibold text-[#231916]">
              {metrics.healthFailed ? `${metrics.healthFailed} setup issue${metrics.healthFailed === 1 ? '' : 's'} found` : 'Setup looks ready'}
            </p>
            <p className="mt-2 text-xs leading-6 text-[#735B4F]">
              {metrics.healthFailed || metrics.healthWarnings
                ? 'Open Setup & Recovery only when checkout, shipping or admin loading needs diagnosis.'
                : 'You can focus on orders, products and customers. Technical status is tucked away.'}
            </p>
            <Link to="/nexora-admin/controls" className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#D6B58F]/50 bg-[#FFFDF8] px-4 py-2 text-xs font-bold text-[#8C634B] hover:bg-[#F2E7D8]">
              Open Setup & Recovery <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-2xl border border-[#E4D6C5] bg-[#FFFDF8] p-3"><span className="block font-semibold text-[#231916]">{metrics.leads}</span><span className="text-[#735B4F]">Leads today</span></div>
            <div className="rounded-2xl border border-[#E4D6C5] bg-[#FFFDF8] p-3"><span className="block font-semibold text-[#231916]">{metrics.whatsapp}</span><span className="text-[#735B4F]">WhatsApp clicks</span></div>
            <div className="rounded-2xl border border-[#E4D6C5] bg-[#FFFDF8] p-3"><span className="block font-semibold text-[#231916]">{metrics.failedShipping}</span><span className="text-[#735B4F]">Shipping issues</span></div>
            <div className="rounded-2xl border border-[#E4D6C5] bg-[#FFFDF8] p-3"><span className="block font-semibold text-[#231916]">{metrics.missingImages}</span><span className="text-[#735B4F]">Missing images</span></div>
          </div>
        </section>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <QuietShortcut to="/nexora-admin/orders" icon={ShoppingBag} title="Orders" helper="Confirm, prepare and ship." />
        <QuietShortcut to="/nexora-admin/products" icon={Package} title="Catalog" helper="Products, images, variants and SEO." />
        <QuietShortcut to="/nexora-admin/inventory" icon={Warehouse} title="Inventory" helper="Size/color stock and low stock." />
        <QuietShortcut to="/nexora-admin/shipping" icon={Truck} title="Shipping" helper="Fees, zones and ShipBlu." />
        <QuietShortcut to="/nexora-admin/customers" icon={UsersRound} title="Customers" helper="Profiles, notes and value." />
        <QuietShortcut to="/nexora-admin/leads" icon={UserPlus} title="Leads" helper="Pipeline and follow-ups." />
      </section>
    </div>
  );
}
