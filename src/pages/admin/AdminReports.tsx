/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, HelpCircle, MessageCircle, MousePointerClick, Package, RefreshCw, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

function csvEscape(value: unknown) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
function pct(part: number, total: number) { return total ? `${Math.round((part / total) * 1000) / 10}%` : '0%'; }

function Metric({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: React.ElementType }) {
  return <div className="studio-card p-5"><div className="mb-3 flex items-center justify-between"><Icon className="h-5 w-5 text-[#D2B48C]" /><span className="text-[10px] uppercase tracking-[0.18em] text-[#BCAEA0]">{label}</span></div><p className="text-2xl font-bold text-[#FFF0E1]">{value}</p><p className="mt-2 text-xs leading-6 text-[#BCAEA0]">{helper}</p></div>;
}

function Explainer() {
  const rows = [
    ['Visitors', 'Page-view traffic from sources/campaigns. Compare campaigns, do not treat it as exact people.'],
    ['Product analytics', 'Views, unique viewers, add-to-cart, orders, revenue, top size/color/source per product.'],
    ['WhatsApp', 'Clicks on WhatsApp buttons. This is high intent even before an order.'],
    ['Conversion', 'Orders divided by views/visitors. Use it to identify weak product pages or weak campaigns.'],
  ];
  return <div className="studio-card p-5"><h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#FFF0E1]"><HelpCircle className="h-4 w-4 text-[#D2B48C]" />How to read this report</h2><div className="grid gap-3 md:grid-cols-4">{rows.map(([title, body]) => <div key={title} className="rounded-2xl border border-[#332923] bg-[#17110F] p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#D2B48C]">{title}</p><p className="mt-2 text-xs leading-6 text-[#BCAEA0]">{body}</p></div>)}</div></div>;
}

export default function AdminReports() {
  const [campaignData, setCampaignData] = useState<any>({ campaigns: [], summary: {} });
  const [productData, setProductData] = useState<any>({ products: [], summary: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [sortBy, setSortBy] = useState<'revenue' | 'orders' | 'leads' | 'visitors'>('revenue');
  const [productQuery, setProductQuery] = useState('');

  const load = async () => {
    setIsLoading(true);
    try {
      const db = await import('@/lib/supabase/db');
      const [campaigns, products] = await Promise.all([
        db.getCampaignReports({ days }),
        db.getProductAnalyticsReport({ days, product: productQuery }),
      ]);
      setCampaignData(campaigns);
      setProductData(products);
    } finally { setIsLoading(false); }
  };
  useEffect(() => { void load(); }, [days]);

  const campaigns = useMemo(() => [...(campaignData.campaigns || [])].sort((a, b) => Number(b[sortBy] || 0) - Number(a[sortBy] || 0)), [campaignData.campaigns, sortBy]);
  const products = productData.products || [];
  const totals = campaignData.summary || {};
  const productTotals = productData.summary || {};

  const exportCsv = (kind: 'campaigns' | 'products') => {
    const rows = kind === 'campaigns'
      ? [['source','medium','campaign','content','visitors','product_views','add_to_cart','checkout_started','leads','whatsapp_clicks','orders','revenue','conversion_rate','lead_rate','top_landing','top_product'], ...campaigns.map((r: any) => [r.source, r.medium, r.campaign, r.content, r.visitors, r.productViews, r.addToCart, r.checkoutStarted, r.leads, r.whatsappClicks, r.orders, r.revenue, pct(Number(r.orders || 0), Number(r.visitors || 0)), pct(Number(r.leads || 0), Number(r.visitors || 0)), r.topLanding, r.topProduct])]
      : [['product','views','unique_viewers','add_to_cart','orders','units_sold','revenue','add_to_cart_rate','conversion_rate','top_source','top_campaign','top_size','top_color'], ...products.map((r: any) => [r.productName, r.views, r.uniqueViewers, r.addToCart, r.orders, r.unitsSold, r.revenue, `${r.addToCartRate || 0}%`, `${r.conversionRate || 0}%`, r.topSource, r.topCampaign, r.topSize, r.topColor])];
    const blob = new Blob([rows.map((row) => row.map(csvEscape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexora-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#FFF0E1]">Reports</h1>
        <p className="mt-1 text-sm leading-6 text-[#BCAEA0]">Campaign, product, source, WhatsApp, checkout and revenue intelligence with exportable data.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select className="studio-input max-w-[150px]" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={60}>Last 60 days</option><option value={90}>Last 90 days</option><option value={180}>Last 180 days</option></select>
        <select className="studio-input max-w-[190px]" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}><option value="revenue">Sort campaigns by revenue</option><option value="orders">Sort by orders</option><option value="leads">Sort by leads</option><option value="visitors">Sort by visitors</option></select>
        <button onClick={load} className="nexora-button"><RefreshCw className="h-4 w-4" />Refresh</button>
      </div>
    </div>

    <Explainer />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Visitors" value={String(totals.visitors || 0)} helper="Campaign page-view events in the selected window." icon={Users} />
      <Metric label="Product Views" value={String(productTotals.views || totals.productViews || 0)} helper="Total product interest tracked by product analytics." icon={MousePointerClick} />
      <Metric label="Orders" value={String(totals.orders || productTotals.orders || 0)} helper={`${formatPrice(Number(totals.revenue || productTotals.revenue || 0))} attributed revenue.`} icon={ShoppingBag} />
      <Metric label="Revenue" value={formatPrice(Number(totals.revenue || productTotals.revenue || 0))} helper="Revenue attributed to tracked campaigns/products." icon={BarChart3} />
    </div>

    {isLoading && <div className="studio-card p-6 text-sm text-[#BCAEA0]">Loading reports...</div>}

    <div className="studio-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[#332923] p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-[#FFF0E1]"><Package className="h-4 w-4 text-[#D2B48C]" />Product Analytics</h2><p className="mt-1 text-xs text-[#BCAEA0]">Detailed performance by product: views → add-to-cart → order → revenue, plus best size/color/source.</p></div><div className="flex gap-2"><input className="studio-input max-w-[220px]" placeholder="Filter product..." value={productQuery} onChange={(e) => setProductQuery(e.target.value)} /><button onClick={load} className="nexora-button">Apply</button><button onClick={() => exportCsv('products')} className="nexora-button"><Download className="h-4 w-4" />CSV</button></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left"><thead className="bg-[#17110F]"><tr>{['Product','Views','Unique','Add to cart','Orders','Units','Revenue','ATC Rate','Conv','Top Source','Top Campaign','Top Size/Color'].map((h) => <th key={h} className="p-4 text-[10px] uppercase tracking-[0.18em] text-[#BCAEA0]">{h}</th>)}</tr></thead><tbody>{products.length ? products.map((r: any) => <tr key={r.productId || r.productName} className="border-t border-[#332923]/70"><td className="p-4 text-xs font-semibold text-[#FFF0E1]">{r.productName}</td><td className="p-4 text-xs text-[#D2B48C]">{r.views}</td><td className="p-4 text-xs text-[#BCAEA0]">{r.uniqueViewers}</td><td className="p-4 text-xs text-[#BCAEA0]">{r.addToCart}</td><td className="p-4 text-xs text-[#BCAEA0]">{r.orders}</td><td className="p-4 text-xs text-[#BCAEA0]">{r.unitsSold}</td><td className="p-4 text-xs font-semibold text-[#D2B48C]">{formatPrice(Number(r.revenue || 0))}</td><td className="p-4 text-xs text-[#BCAEA0]">{r.addToCartRate || 0}%</td><td className="p-4 text-xs text-[#BCAEA0]">{r.conversionRate || 0}%</td><td className="p-4 text-xs text-[#BCAEA0]">{r.topSource}</td><td className="p-4 text-xs text-[#BCAEA0]">{r.topCampaign}</td><td className="p-4 text-xs text-[#BCAEA0]">{r.topSize} / {r.topColor}</td></tr>) : <tr><td colSpan={12} className="p-8 text-center text-sm text-[#BCAEA0]">No product analytics yet.</td></tr>}</tbody></table></div>
    </div>

    <div className="studio-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[#332923] p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-[#FFF0E1]"><TrendingUp className="h-4 w-4 text-[#D2B48C]" />Campaign Performance</h2><p className="mt-1 text-xs text-[#BCAEA0]">Use this to compare Facebook/Instagram/TikTok creatives and decide where to spend.</p></div><button onClick={() => exportCsv('campaigns')} className="nexora-button"><Download className="h-4 w-4" />Export CSV</button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left"><thead className="bg-[#17110F]"><tr>{['Source','Campaign','Content','Visitors','Views','Add','Checkout','Leads','WhatsApp','Orders','Revenue','Conv'].map((h) => <th key={h} className="p-4 text-[10px] uppercase tracking-[0.18em] text-[#BCAEA0]">{h}</th>)}</tr></thead><tbody>{campaigns.length ? campaigns.map((r: any) => <tr key={`${r.source}-${r.campaign}-${r.content}`} className="border-t border-[#332923]/70"><td className="p-4 text-xs text-[#D2B48C]">{r.source}<br /><span className="text-[#BCAEA0]">{r.medium}</span></td><td className="p-4 text-xs font-semibold text-[#FFF0E1]">{r.campaign}</td><td className="p-4 text-xs text-[#BCAEA0]">{r.content || '—'}</td><td className="p-4 text-xs text-[#BCAEA0]">{r.visitors}</td><td className="p-4 text-xs text-[#BCAEA0]">{r.productViews}</td><td className="p-4 text-xs text-[#BCAEA0]">{r.addToCart}</td><td className="p-4 text-xs text-[#BCAEA0]">{r.checkoutStarted}</td><td className="p-4 text-xs text-[#BCAEA0]">{r.leads}</td><td className="p-4 text-xs text-[#BCAEA0]"><MessageCircle className="mr-1 inline h-3 w-3 text-[#D2B48C]" />{r.whatsappClicks}</td><td className="p-4 text-xs text-[#BCAEA0]">{r.orders}</td><td className="p-4 text-xs font-semibold text-[#D2B48C]">{formatPrice(Number(r.revenue || 0))}</td><td className="p-4 text-xs text-[#BCAEA0]">{pct(Number(r.orders || 0), Number(r.visitors || 0))}</td></tr>) : <tr><td colSpan={12} className="p-8 text-center text-sm text-[#BCAEA0]">No campaign report yet. Use generated links in ads/stories, then check Reports.</td></tr>}</tbody></table></div>
    </div>
  </div>;
}
