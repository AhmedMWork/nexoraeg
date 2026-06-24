/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Download, MousePointerClick, Package, RefreshCw, ShoppingBag, Users } from 'lucide-react';
import { AdminHero, AdminMetricCard, AdminPageShell, AdminPanel, AdminStatusPill } from '@/components/admin/AdminCommandCenter';
import { formatPrice } from '@/lib/utils';

const chartColors = ['#9D7159', '#D6B58F', '#D09A82', '#6F5D50', '#B39D89'];

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function pct(part: number, total: number) {
  return total ? `${Math.round((part / total) * 1000) / 10}%` : '0%';
}

export default function AdminReports() {
  const [campaignData, setCampaignData] = useState<any>({ campaigns: [], summary: {} });
  const [productData, setProductData] = useState<any>({ products: [], summary: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [sortBy, setSortBy] = useState<'revenue' | 'orders' | 'leads' | 'visitors'>('revenue');
  const [productQuery, setProductQuery] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const db = await import('@/lib/supabase/db');
      const [campaigns, products] = await Promise.all([
        db.getCampaignReports({ days }).catch(() => ({ campaigns: [], summary: {} })),
        db.getProductAnalyticsReport({ days, product: productQuery }).catch(() => ({ products: [], summary: {} })),
      ]);
      setCampaignData(campaigns);
      setProductData(products);
    } finally {
      setIsLoading(false);
    }
  }, [days, productQuery]);

  useEffect(() => { void load(); }, [load]);

  const campaigns = useMemo(() => [...(campaignData.campaigns || [])].sort((a, b) => Number(b[sortBy] || 0) - Number(a[sortBy] || 0)), [campaignData.campaigns, sortBy]);
  const products = productData.products || [];
  const totals = campaignData.summary || {};
  const productTotals = productData.summary || {};

  const campaignChart = campaigns.slice(0, 8).map((row: any) => ({ name: row.campaign || row.source || 'Campaign', revenue: Number(row.revenue || 0), orders: Number(row.orders || 0), visitors: Number(row.visitors || 0) }));
  const productChart = products.slice(0, 7).map((row: any) => ({ name: row.productName || 'Product', revenue: Number(row.revenue || 0), orders: Number(row.orders || 0), views: Number(row.views || 0) }));
  const sourceSplit = Object.entries(campaigns.reduce<Record<string, number>>((acc, row: any) => { const key = row.source || 'Direct'; acc[key] = (acc[key] || 0) + Number(row.visitors || 0); return acc; }, {})).map(([name, value]) => ({ name, value }));

  const exportCsv = (kind: 'campaigns' | 'products') => {
    const rows = kind === 'campaigns'
      ? [['source', 'medium', 'campaign', 'content', 'visitors', 'product_views', 'add_to_cart', 'checkout_started', 'leads', 'whatsapp_clicks', 'orders', 'revenue', 'conversion_rate', 'lead_rate', 'top_landing', 'top_product'], ...campaigns.map((r: any) => [r.source, r.medium, r.campaign, r.content, r.visitors, r.productViews, r.addToCart, r.checkoutStarted, r.leads, r.whatsappClicks, r.orders, r.revenue, pct(Number(r.orders || 0), Number(r.visitors || 0)), pct(Number(r.leads || 0), Number(r.visitors || 0)), r.topLanding, r.topProduct])]
      : [['product', 'views', 'unique_viewers', 'add_to_cart', 'orders', 'units_sold', 'revenue', 'add_to_cart_rate', 'conversion_rate', 'top_source', 'top_campaign', 'top_size', 'top_color'], ...products.map((r: any) => [r.productName, r.views, r.uniqueViewers, r.addToCart, r.orders, r.unitsSold, r.revenue, `${r.addToCartRate || 0}%`, `${r.conversionRate || 0}%`, r.topSource, r.topCampaign, r.topSize, r.topColor])];
    const blob = new Blob([rows.map((row) => row.map(csvEscape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexora-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminPageShell>
      <AdminHero
        eyebrow="Insights"
        title="Reports & Decision Center"
        description="Revenue, campaigns, products, conversion, WhatsApp and traffic data in one export-ready place. Charts are interactive and tables remain available for detailed work."
        actions={<><select className="studio-input max-w-[150px]" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={60}>Last 60 days</option><option value={90}>Last 90 days</option><option value={180}>Last 180 days</option></select><button onClick={load} className="nexora-button-primary"><RefreshCw className="h-4 w-4" /> Refresh</button></>}
        meta={<><AdminStatusPill tone="accent">{days} days</AdminStatusPill><AdminStatusPill tone="info">Export ready</AdminStatusPill></>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Visitors" value={String(totals.visitors || 0)} helper="Campaign visits during selected range." icon={<Users className="h-4 w-4" />} />
        <AdminMetricCard label="Product Views" value={String(productTotals.views || totals.productViews || 0)} helper="Total tracked product interest." icon={<MousePointerClick className="h-4 w-4" />} tone="info" />
        <AdminMetricCard label="Orders" value={String(totals.orders || productTotals.orders || 0)} helper={`${formatPrice(Number(totals.revenue || productTotals.revenue || 0))} attributed revenue.`} icon={<ShoppingBag className="h-4 w-4" />} tone="good" />
        <AdminMetricCard label="Revenue" value={formatPrice(Number(totals.revenue || productTotals.revenue || 0))} helper="Revenue attributed to tracked campaigns/products." icon={<BarChart3 className="h-4 w-4" />} tone="accent" />
      </div>

      {isLoading && <div className="studio-card p-6 text-sm text-[#6F5D50]">Loading reports...</div>}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminPanel title="Top Campaign Revenue" description="Compare which campaigns are producing tracked revenue." actions={<button onClick={() => exportCsv('campaigns')} className="nexora-button"><Download className="h-4 w-4" /> Campaign CSV</button>}>
          <div className="h-[310px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={campaignChart} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
                <CartesianGrid stroke="#E9DDCF" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#735B4F', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#735B4F', fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
                <Tooltip formatter={(value, name) => name === 'revenue' ? formatPrice(Number(value)) : value} contentStyle={{ borderRadius: 18, border: '1px solid #E4D6C5', background: '#FFFDF8' }} />
                <Bar dataKey="revenue" fill="#9D7159" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AdminPanel>
        <AdminPanel title="Traffic Source Split" description="Visitor distribution across tracked sources.">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sourceSplit.length ? sourceSplit : [{ name: 'No data', value: 1 }]} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={4}>{(sourceSplit.length ? sourceSplit : [{ name: 'No data', value: 1 }]).map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}</Pie>
                <Tooltip contentStyle={{ borderRadius: 18, border: '1px solid #E4D6C5', background: '#FFFDF8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">{(sourceSplit.length ? sourceSplit : [{ name: 'No data', value: 0 }]).map((row, index) => <div key={row.name} className="flex items-center justify-between rounded-2xl border border-[#E4D6C5] bg-[#FAF5EE] px-3 py-2 text-xs"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: chartColors[index % chartColors.length] }} />{row.name}</span><strong>{row.value}</strong></div>)}</div>
        </AdminPanel>
      </div>

      <AdminPanel title="Product Performance" description="Product views, add-to-cart, orders, revenue and size/color signals." actions={<><input className="studio-input max-w-[220px]" placeholder="Filter product..." value={productQuery} onChange={(e) => setProductQuery(e.target.value)} /><button onClick={load} className="nexora-button">Apply</button><button onClick={() => exportCsv('products')} className="nexora-button"><Download className="h-4 w-4" /> Product CSV</button></>}>
        <div className="mb-5 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={productChart} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
              <CartesianGrid stroke="#E9DDCF" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#735B4F', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#735B4F', fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
              <Tooltip formatter={(value, name) => name === 'revenue' ? formatPrice(Number(value)) : value} contentStyle={{ borderRadius: 18, border: '1px solid #E4D6C5', background: '#FFFDF8' }} />
              <Bar dataKey="revenue" fill="#D09A82" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-x-auto rounded-[24px] border border-[#E4D6C5]">
          <table className="w-full min-w-[1120px] text-left"><thead className="bg-[#FAF5EE]"><tr>{['Product', 'Views', 'Unique', 'Add to cart', 'Orders', 'Units', 'Revenue', 'ATC Rate', 'Conv', 'Top Source', 'Top Campaign', 'Top Size/Color'].map((h) => <th key={h} className="p-4 text-[10px] font-black uppercase tracking-[0.18em] text-[#9D7159]">{h}</th>)}</tr></thead><tbody>{products.length ? products.map((r: any) => <tr key={r.productId || r.productName} className="border-t border-[#E4D6C5]"><td className="p-4 text-xs font-semibold text-[#231916]"><Package className="mr-2 inline h-3.5 w-3.5 text-[#9D7159]" />{r.productName}</td><td className="p-4 text-xs text-[#6F5D50]">{r.views}</td><td className="p-4 text-xs text-[#6F5D50]">{r.uniqueViewers}</td><td className="p-4 text-xs text-[#6F5D50]">{r.addToCart}</td><td className="p-4 text-xs text-[#6F5D50]">{r.orders}</td><td className="p-4 text-xs text-[#6F5D50]">{r.unitsSold}</td><td className="p-4 text-xs font-semibold text-[#9D7159]">{formatPrice(Number(r.revenue || 0))}</td><td className="p-4 text-xs text-[#6F5D50]">{r.addToCartRate || 0}%</td><td className="p-4 text-xs text-[#6F5D50]">{r.conversionRate || 0}%</td><td className="p-4 text-xs text-[#6F5D50]">{r.topSource}</td><td className="p-4 text-xs text-[#6F5D50]">{r.topCampaign}</td><td className="p-4 text-xs text-[#6F5D50]">{r.topSize} / {r.topColor}</td></tr>) : <tr><td colSpan={12} className="p-8 text-center text-sm text-[#6F5D50]">No product analytics yet.</td></tr>}</tbody></table>
        </div>
      </AdminPanel>

      <AdminPanel title="Campaign Performance Table" description="Sort campaigns by revenue, orders, leads or visitors.">
        <div className="mb-4 flex flex-wrap items-center gap-2"><select className="studio-input max-w-[220px]" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}><option value="revenue">Sort by revenue</option><option value="orders">Sort by orders</option><option value="leads">Sort by leads</option><option value="visitors">Sort by visitors</option></select><AdminStatusPill tone="accent">{campaigns.length} rows</AdminStatusPill></div>
        <div className="overflow-x-auto rounded-[24px] border border-[#E4D6C5]"><table className="w-full min-w-[1180px] text-left"><thead className="bg-[#FAF5EE]"><tr>{['Source', 'Campaign', 'Content', 'Visitors', 'Views', 'Add', 'Checkout', 'Leads', 'WhatsApp', 'Orders', 'Revenue', 'Conv'].map((h) => <th key={h} className="p-4 text-[10px] font-black uppercase tracking-[0.18em] text-[#9D7159]">{h}</th>)}</tr></thead><tbody>{campaigns.length ? campaigns.map((r: any) => <tr key={`${r.source}-${r.campaign}-${r.content}`} className="border-t border-[#E4D6C5]"><td className="p-4 text-xs text-[#9D7159]">{r.source}<br /><span className="text-[#6F5D50]">{r.medium}</span></td><td className="p-4 text-xs font-semibold text-[#231916]">{r.campaign}</td><td className="p-4 text-xs text-[#6F5D50]">{r.content || '—'}</td><td className="p-4 text-xs text-[#6F5D50]">{r.visitors}</td><td className="p-4 text-xs text-[#6F5D50]">{r.productViews}</td><td className="p-4 text-xs text-[#6F5D50]">{r.addToCart}</td><td className="p-4 text-xs text-[#6F5D50]">{r.checkoutStarted}</td><td className="p-4 text-xs text-[#6F5D50]">{r.leads}</td><td className="p-4 text-xs text-[#6F5D50]">{r.whatsappClicks}</td><td className="p-4 text-xs text-[#6F5D50]">{r.orders}</td><td className="p-4 text-xs font-semibold text-[#9D7159]">{formatPrice(Number(r.revenue || 0))}</td><td className="p-4 text-xs text-[#6F5D50]">{pct(Number(r.orders || 0), Number(r.visitors || 0))}</td></tr>) : <tr><td colSpan={12} className="p-8 text-center text-sm text-[#6F5D50]">No campaign reports yet.</td></tr>}</tbody></table></div>
      </AdminPanel>
    </AdminPageShell>
  );
}
