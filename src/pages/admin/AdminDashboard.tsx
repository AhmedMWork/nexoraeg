/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Package, ShoppingBag, Truck, UserPlus, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminInsight, AdminPageHeader, AdminStatCard, SetupBadge } from '@/components/admin/AdminPageHeader';
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
  return <Link to={to} className="shrink-0 rounded-2xl border border-[#D7B98E]/30 px-3 py-2 text-xs font-bold text-[#D7B98E] hover:bg-[#D7B98E]/10">{children}</Link>;
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
      toast.error(error instanceof Error ? error.message : 'Could not load NEXORA HQ');
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
    const soldOut = data.products.filter((p) => (p.sizes.reduce((sum, s) => sum + Number(s.stock || 0), 0)) <= 0).length;
    const leads = Number(data.growth.leadsToday || 0);
    const whatsapp = Number(data.growth.whatsappClicksToday || 0);
    const healthScore = Number(data.health?.score || 0);
    const healthFailed = Number(data.health?.failed || 0);
    const healthWarnings = Number(data.health?.warnings || 0);
    const productViews = Number(data.productReport?.summary?.views || 0);
    const productOrders = Number(data.productReport?.summary?.orders || 0);
    const conversion = productViews ? Math.round((productOrders / productViews) * 1000) / 10 : 0;
    return { revenue, pendingOrders, readyToShip, failedShipping, lowStockProducts, missingImages, missingSeo, soldOut, leads, whatsapp, healthScore, healthFailed, healthWarnings, productViews, productOrders, conversion };
  }, [data]);

  const actionInbox = [
    { title: `${metrics.pendingOrders} orders need confirmation`, description: 'Pending/confirmed orders are the first daily priority. Confirm, prepare, then create shipment.', status: metrics.pendingOrders ? 'warn' : 'good', to: '/nexora-admin/orders' },
    { title: `${metrics.readyToShip} orders ready for shipment`, description: 'Orders prepared without shipment should be sent to ShipBlu or handled manually from Orders.', status: metrics.readyToShip ? 'warn' : 'good', to: '/nexora-admin/orders' },
    { title: `${metrics.lowStockProducts} low-stock products`, description: 'Review size/color stock before campaigns so ads do not push sold-out variants.', status: metrics.lowStockProducts ? 'warn' : 'good', to: '/nexora-admin/inventory' },
    { title: `${metrics.missingImages + metrics.missingSeo} catalog setup gaps`, description: 'Products missing images or SEO reduce trust and performance.', status: metrics.missingImages + metrics.missingSeo ? 'warn' : 'good', to: '/nexora-admin/products' },
    { title: `${metrics.healthFailed} failed setup checks`, description: 'Run Launch Checklist whenever Edge Functions return non-2xx. It explains the exact setup issue.', status: metrics.healthFailed ? 'danger' : metrics.healthWarnings ? 'warn' : 'good', to: '/nexora-admin/controls' },
  ] as const;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Today command center"
        description="Daily action inbox for orders, shipping, stock, leads, catalog quality, and launch readiness. Built to reduce admin noise and show exactly what needs action."
        actions={<button onClick={load} className="nexora-button flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Refresh HQ</button>}
      />

      {isLoading && <div className="studio-card p-4 text-sm text-[#A7AEBB]">Loading NEXORA HQ...</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Revenue" value={formatPrice(metrics.revenue)} helper="Non-cancelled order value currently loaded in HQ." tone="good" />
        <AdminStatCard label="Needs action" value={metrics.pendingOrders + metrics.readyToShip + metrics.lowStockProducts} helper="Orders, shipments, and stock alerts that need attention today." tone={metrics.pendingOrders || metrics.readyToShip || metrics.lowStockProducts ? 'warn' : 'good'} />
        <AdminStatCard label="Product funnel" value={`${metrics.conversion}%`} helper={`${metrics.productViews} product views → ${metrics.productOrders} orders in the report window.`} />
        <AdminStatCard label="Setup score" value={`${metrics.healthScore}%`} helper={`${metrics.healthFailed} failed / ${metrics.healthWarnings} warnings from health check.`} tone={metrics.healthFailed ? 'danger' : metrics.healthWarnings ? 'warn' : 'good'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="studio-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#F5F1EA]">Action Inbox</h2>
              <p className="mt-1 text-xs text-[#A7AEBB]">No fake alerts. Every item links to the exact page needed to resolve it.</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-[#D7B98E]" />
          </div>
          <div className="space-y-3">
            {actionInbox.map((item) => (
              <AdminInsight key={item.title} title={item.title} description={item.description} status={item.status as any} action={<ActionButton to={item.to}>Open <ArrowRight className="ml-1 inline h-3 w-3" /></ActionButton>} />
            ))}
          </div>
        </div>

        <div className="studio-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#F5F1EA]">Launch Checklist snapshot</h2>
              <p className="mt-1 text-xs text-[#A7AEBB]">Use this when anything says Edge Function non-2xx.</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
          </div>
          <div className="space-y-2">
            {(data.health?.checks || []).slice(0, 8).map((check: any) => (
              <div key={check.key} className="flex items-start justify-between gap-3 rounded-2xl border border-[#2E3442] bg-[#11141A] p-3">
                <div>
                  <p className="text-sm font-semibold text-[#F5F1EA]">{check.label}</p>
                  <p className="mt-1 text-xs leading-5 text-[#A7AEBB]">{check.message}</p>
                </div>
                <SetupBadge ok={check.status === 'ok'} label={check.status} />
              </div>
            ))}
            <Link to="/nexora-admin/controls" className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-[#D7B98E]/30 p-3 text-xs font-bold text-[#D7B98E] hover:bg-[#D7B98E]/10">Open full checklist <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link to="/nexora-admin/orders" className="studio-card p-5 hover:border-[#D7B98E]">
          <ShoppingBag className="mb-3 h-5 w-5 text-[#D7B98E]" /><h3 className="font-semibold">Orders OS</h3><p className="mt-2 text-xs leading-6 text-[#A7AEBB]">Confirm orders, open customer drawer, create shipment, copy WhatsApp messages.</p>
        </Link>
        <Link to="/nexora-admin/products" className="studio-card p-5 hover:border-[#D7B98E]">
          <Package className="mb-3 h-5 w-5 text-[#D7B98E]" /><h3 className="font-semibold">Products HQ</h3><p className="mt-2 text-xs leading-6 text-[#A7AEBB]">Catalog setup, images, colors, sizes, SEO, and product analytics.</p>
        </Link>
        <Link to="/nexora-admin/leads" className="studio-card p-5 hover:border-[#D7B98E]">
          <UserPlus className="mb-3 h-5 w-5 text-[#D7B98E]" /><h3 className="font-semibold">Leads CRM</h3><p className="mt-2 text-xs leading-6 text-[#A7AEBB]">Pipeline, statuses, follow-up tasks and WhatsApp-ready actions.</p>
        </Link>
        <Link to="/nexora-admin/shipping" className="studio-card p-5 hover:border-[#D7B98E]">
          <Truck className="mb-3 h-5 w-5 text-[#D7B98E]" /><h3 className="font-semibold">Shipping Ops</h3><p className="mt-2 text-xs leading-6 text-[#A7AEBB]">Fees, ShipBlu zones, manual mode, provider setup and tracking.</p>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Leads today" value={metrics.leads} helper="New CRM leads captured from private list, WhatsApp or checkout." />
        <AdminStatCard label="WhatsApp clicks" value={metrics.whatsapp} helper="High-intent customer actions that need follow up." />
        <AdminStatCard label="Sold out products" value={metrics.soldOut} helper="Products with zero visible stock across sizes." tone={metrics.soldOut ? 'warn' : 'good'} />
        <AdminStatCard label="Shipping failures" value={metrics.failedShipping} helper="Failed/cancelled shipment statuses that need manual review." tone={metrics.failedShipping ? 'danger' : 'good'} />
      </div>
    </div>
  );
}
