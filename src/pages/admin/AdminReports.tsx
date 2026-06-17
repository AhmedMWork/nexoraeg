/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, HelpCircle, MessageCircle, MousePointerClick, RefreshCw, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

function csvEscape(value: unknown) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
function pct(part: number, total: number) { return total ? `${Math.round((part / total) * 100)}%` : '0%'; }

function Metric({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: React.ElementType }) {
  return <div className="studio-card p-5"><div className="mb-3 flex items-center justify-between"><Icon className="h-5 w-5 text-[#D2B48C]" /><span className="text-[10px] uppercase tracking-[0.18em] text-[#BCAEA0]">{label}</span></div><p className="text-2xl font-bold text-[#FFF0E1]">{value}</p><p className="mt-2 text-xs leading-6 text-[#BCAEA0]">{helper}</p></div>;
}

function Explainer() {
  const rows = [
    ['Visitors', 'Page-view events from people who came through a source/campaign link. One person may generate more than one page view.'],
    ['Leads', 'People who left a phone/email through Private List, WhatsApp, checkout contact, or lead forms.'],
    ['WhatsApp', 'Clicks on WhatsApp buttons. This is high intent even before an order.'],
    ['Orders / Revenue', 'Orders where the source/campaign was attached during checkout.'],
    ['Conversion', 'Orders divided by visitors. Use it to compare campaigns, not as a legal/accounting metric.'],
  ];
  return <div className="studio-card p-5"><h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#FFF0E1]"><HelpCircle className="h-4 w-4 text-[#D2B48C]" />What this report means</h2><div className="grid gap-3 md:grid-cols-5">{rows.map(([title, body]) => <div key={title} className="rounded-2xl border border-[#332923] bg-[#17110F] p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#D2B48C]">{title}</p><p className="mt-2 text-xs leading-6 text-[#BCAEA0]">{body}</p></div>)}</div></div>;
}

export default function AdminReports() {
  const [data, setData] = useState<any>({ campaigns: [], summary: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'revenue' | 'orders' | 'leads' | 'visitors'>('revenue');

  const load = async () => {
    setIsLoading(true);
    try {
      const { getCampaignReports } = await import('@/lib/supabase/db');
      setData(await getCampaignReports());
    } finally { setIsLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const campaigns = useMemo(() => [...(data.campaigns || [])].sort((a, b) => Number(b[sortBy] || 0) - Number(a[sortBy] || 0)), [data.campaigns, sortBy]);
  const totals = useMemo(() => campaigns.reduce((acc: any, row: any) => ({
    visitors: acc.visitors + Number(row.visitors || 0),
    productViews: acc.productViews + Number(row.productViews || 0),
    addToCart: acc.addToCart + Number(row.addToCart || 0),
    checkoutStarted: acc.checkoutStarted + Number(row.checkoutStarted || 0),
    leads: acc.leads + Number(row.leads || 0),
    whatsapp: acc.whatsapp + Number(row.whatsappClicks || 0),
    orders: acc.orders + Number(row.orders || 0),
    revenue: acc.revenue + Number(row.revenue || 0),
  }), { visitors: 0, productViews: 0, addToCart: 0, checkoutStarted: 0, leads: 0, whatsapp: 0, orders: 0, revenue: 0 }), [campaigns]);

  const exportCsv = () => {
    const rows = [[
      'source','medium','campaign','content','visitors','product_views','add_to_cart','checkout_started','leads','whatsapp_clicks','orders','revenue','conversion_rate','lead_rate','top_landing','top_product'
    ], ...campaigns.map((r: any) => [
      r.source, r.medium, r.campaign, r.content, r.visitors, r.productViews, r.addToCart, r.checkoutStarted, r.leads, r.whatsappClicks, r.orders, r.revenue, pct(Number(r.orders || 0), Number(r.visitors || 0)), pct(Number(r.leads || 0), Number(r.visitors || 0)), r.topLanding, r.topProduct,
    ])];
    const blob = new Blob([rows.map((row) => row.map(csvEscape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexora-growth-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#FFF0E1]">Growth Reports</h1>
          <p className="mt-1 text-sm leading-6 text-[#BCAEA0]">More detailed campaign and source reporting: traffic, product interest, leads, WhatsApp intent, orders, and revenue.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="studio-input max-w-[190px]" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
            <option value="revenue">Sort by revenue</option>
            <option value="orders">Sort by orders</option>
            <option value="leads">Sort by leads</option>
            <option value="visitors">Sort by visitors</option>
          </select>
          <button onClick={exportCsv} className="nexora-button"><Download className="h-4 w-4" />Export</button>
          <button onClick={load} className="nexora-button"><RefreshCw className="h-4 w-4" />Refresh</button>
        </div>
      </div>

      {isLoading && <div className="studio-card p-4 text-sm text-[#BCAEA0]">Loading reports...</div>}

      <Explainer />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Visitors" value={String(totals.visitors)} helper="Tracked campaign/source page views." icon={Users} />
        <Metric label="Product views" value={String(totals.productViews)} helper="Product pages viewed after attribution." icon={MousePointerClick} />
        <Metric label="Add to cart" value={String(totals.addToCart)} helper={`${pct(totals.addToCart, totals.productViews)} of product views added to cart.`} icon={ShoppingBag} />
        <Metric label="Leads" value={String(totals.leads)} helper={`${pct(totals.leads, totals.visitors)} visitor-to-lead rate.`} icon={TrendingUp} />
        <Metric label="WhatsApp" value={String(totals.whatsapp)} helper="Direct contact intent clicks." icon={MessageCircle} />
        <Metric label="Orders" value={String(totals.orders)} helper={`${pct(totals.orders, totals.visitors)} visitor-to-order rate.`} icon={BarChart3} />
        <Metric label="Revenue" value={formatPrice(totals.revenue)} helper="Attributed COD order value." icon={TrendingUp} />
        <Metric label="Avg order" value={formatPrice(totals.orders ? totals.revenue / totals.orders : 0)} helper="Revenue divided by orders." icon={BarChart3} />
      </div>

      <div className="studio-card overflow-hidden">
        <div className="border-b border-[#332923] p-5">
          <h2 className="text-sm font-semibold text-[#FFF0E1]">Campaign table</h2>
          <p className="mt-1 text-xs leading-6 text-[#BCAEA0]">Use this to decide which Facebook/Instagram/TikTok links deserve more budget. Example: if Leads are high but Orders are low, follow up on WhatsApp.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] text-left">
            <thead className="bg-[#17110F]">
              <tr>{['Source','Campaign','Content','Visitors','Product views','Add cart','Checkout','Leads','WhatsApp','Orders','Revenue','Conv.','Top landing','Top product'].map((h) => <th key={h} className="p-4 text-[10px] uppercase tracking-[0.18em] text-[#BCAEA0]">{h}</th>)}</tr>
            </thead>
            <tbody>
              {campaigns.length ? campaigns.map((row: any) => {
                const visitors = Number(row.visitors || 0);
                const orders = Number(row.orders || 0);
                return <tr key={`${row.source}-${row.campaign}-${row.content}`} className="border-t border-[#332923]/70">
                  <td className="p-4 text-xs font-semibold text-[#D2B48C]">{row.source || 'direct'}<br /><span className="text-[#BCAEA0]">{row.medium || '—'}</span></td>
                  <td className="p-4 text-xs text-[#FFF0E1]">{row.campaign || 'no campaign'}</td>
                  <td className="p-4 text-xs text-[#BCAEA0]">{row.content || '—'}</td>
                  <td className="p-4 text-xs text-[#BCAEA0]">{visitors}</td>
                  <td className="p-4 text-xs text-[#BCAEA0]">{row.productViews || 0}</td>
                  <td className="p-4 text-xs text-[#BCAEA0]">{row.addToCart || 0}</td>
                  <td className="p-4 text-xs text-[#BCAEA0]">{row.checkoutStarted || 0}</td>
                  <td className="p-4 text-xs text-[#BCAEA0]">{row.leads || 0}</td>
                  <td className="p-4 text-xs text-[#BCAEA0]">{row.whatsappClicks || 0}</td>
                  <td className="p-4 text-xs text-[#BCAEA0]">{orders}</td>
                  <td className="p-4 text-xs text-[#D2B48C]">{formatPrice(Number(row.revenue || 0))}</td>
                  <td className="p-4 text-xs text-[#BCAEA0]">{pct(orders, visitors)}</td>
                  <td className="p-4 text-xs text-[#BCAEA0]">{row.topLanding || '—'}</td>
                  <td className="p-4 text-xs text-[#BCAEA0]">{row.topProduct || '—'}</td>
                </tr>;
              }) : <tr><td colSpan={14} className="p-8 text-center text-sm leading-7 text-[#BCAEA0]">No report data yet. Create a Campaign Link, put it in your ad/bio/story, then traffic will appear here.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="studio-card p-5">
        <h2 className="mb-2 text-sm font-semibold text-[#FFF0E1]">Simple example</h2>
        <p className="text-xs leading-7 text-[#BCAEA0]">
          If you create an Instagram Story link with campaign <b className="text-[#FFF0E1]">summer_drop</b> and content <b className="text-[#FFF0E1]">black_tee_story</b>, every visitor/order from that link will be grouped here. You will see: visitors, product views, add-to-cart, WhatsApp clicks, leads, orders, and revenue.
        </p>
      </div>
    </div>
  );
}
