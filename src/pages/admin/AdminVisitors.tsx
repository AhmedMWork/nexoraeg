/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, MousePointerClick, Globe2, MonitorSmartphone, Clock, Eye, Route, Users, Layers } from 'lucide-react';
import { formatTimestamp, formatPrice } from '@/lib/utils';

function friendlyEvent(name: string) {
  const map: Record<string, string> = {
    page_view: 'Opened page', product_view: 'Viewed product', add_to_cart: 'Added to cart', checkout_started: 'Started checkout', checkout_start: 'Started checkout', checkout_contact_entered: 'Entered phone', whatsapp_clicked: 'Clicked WhatsApp', lead_captured: 'Became lead', order_created: 'Created order', coupon_attempted: 'Tried coupon', coupon_applied: 'Applied coupon', search_used: 'Searched', filter_used: 'Used filter',
  };
  return map[name] || name.replace(/_/g, ' ');
}

export default function AdminVisitors() {
  const [visitors, setVisitors] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [journey, setJourney] = useState<any[]>([]);
  const [loadingJourney, setLoadingJourney] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const { getVisitors } = await import('@/lib/supabase/db');
      setVisitors(await getVisitors());
    } finally { setIsLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const openJourney = async (visitor: any) => {
    setSelected(visitor);
    setLoadingJourney(true);
    try {
      const { getVisitorJourney } = await import('@/lib/supabase/db');
      setJourney(await getVisitorJourney(visitor.id));
    } finally { setLoadingJourney(false); }
  };

  const filtered = useMemo(() => visitors.filter((visitor) => {
    const text = `${visitor.anonymousId} ${visitor.firstSource || ''} ${visitor.lastSource || ''} ${visitor.firstCampaign || ''} ${visitor.lastCampaign || ''} ${visitor.deviceType || ''} ${visitor.browser || ''}`.toLowerCase();
    return text.includes(query.toLowerCase());
  }), [visitors, query]);

  const sourceCounts = visitors.reduce<Record<string, number>>((acc, visitor) => { const source = visitor.lastSource || visitor.firstSource || 'direct'; acc[source] = (acc[source] || 0) + 1; return acc; }, {});
  const topSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No data';
  const known = visitors.filter((v) => v.isKnown).length;
  const totalActions = visitors.reduce((sum, v) => sum + Number(v.eventCount || 0), 0);
  const deviceTypes = new Set(visitors.map((v) => v.deviceType).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#FFF0E1]">Visitors</h1>
          <p className="mt-1 text-sm leading-6 text-[#BCAEA0]">Visitor profiles are anonymous devices/sessions until a customer enters a phone, clicks WhatsApp, joins a list, or orders. Actions are events, not people.</p>
        </div>
        <button onClick={load} className="nexora-button"><RefreshCw className="h-4 w-4" />Refresh</button>
      </div>

      <div className="studio-card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#FFF0E1]"><Layers className="h-4 w-4 text-[#D2B48C]" />What do these numbers mean?</h2>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ['Unique visitors', 'Approximate anonymous people/devices. This is the closest number to “how many people opened the site”.'],
            ['Sessions', 'Visits/browsing sessions. A returning visitor can create multiple sessions.'],
            ['Actions', 'Events inside the site: product view, add to cart, checkout, WhatsApp click. One visitor can create many actions.'],
            ['Known visitors', 'Anonymous visitors linked to a phone/lead/customer. These are the people you can actually follow up with.'],
          ].map(([title, body]) => <div key={title} className="rounded-2xl border border-[#332923] bg-[#17110F] p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#D2B48C]">{title}</p><p className="mt-2 text-xs leading-6 text-[#BCAEA0]">{body}</p></div>)}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Unique Visitors" value={String(visitors.length)} helper="Anonymous visitor profiles captured from storefront events." icon={Users} />
        <Metric label="Known" value={String(known)} helper="Visitors linked to lead/customer data you can contact." icon={Eye} />
        <Metric label="Actions" value={String(totalActions)} helper="Total tracked actions. This can be much larger than visitors." icon={MousePointerClick} />
        <Metric label="Top Source" value={topSource} helper="Highest volume last-touch source." icon={Globe2} />
        <Metric label="Devices" value={String(deviceTypes)} helper="Device categories observed." icon={MonitorSmartphone} />
      </div>

      <div className="studio-card p-4">
        <label className="flex items-center gap-3 rounded-2xl border border-[#332923] bg-[#0E0B0A] px-4 py-3">
          <Search className="h-4 w-4 text-[#D2B48C]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search source, campaign, visitor id, device" className="w-full bg-transparent text-sm text-[#FFF0E1] outline-none placeholder:text-[#8A7A72]" />
        </label>
      </div>

      <div className="studio-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left">
            <thead className="bg-[#17110F]"><tr>{['Visitor','Source','Campaign','Device','First landing','Last page','Actions','Last seen','Journey'].map((h) => <th key={h} className="p-4 text-[10px] uppercase tracking-[0.18em] text-[#BCAEA0]">{h}</th>)}</tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={9} className="p-8 text-center text-sm text-[#BCAEA0]">Loading visitors...</td></tr> : filtered.length ? filtered.map((visitor) => (
                <tr key={visitor.id || visitor.anonymousId} className="border-t border-[#332923]/70">
                  <td className="p-4 text-xs font-semibold text-[#FFF0E1]"><span className="block max-w-[180px] truncate">{visitor.anonymousId}</span>{visitor.isKnown && <span className="mt-1 inline-flex rounded-full border border-emerald-400/30 px-2 py-0.5 text-[9px] uppercase tracking-[0.15em] text-emerald-300">Known</span>}</td>
                  <td className="p-4 text-xs text-[#D2B48C]">{visitor.lastSource || visitor.firstSource || 'direct'}<br /><span className="text-[#BCAEA0]">{visitor.lastMedium || visitor.firstMedium || 'none'}</span></td>
                  <td className="p-4 text-xs text-[#BCAEA0]">{visitor.lastCampaign || visitor.firstCampaign || '—'}</td>
                  <td className="p-4 text-xs text-[#BCAEA0]">{visitor.deviceType || 'unknown'}<br />{visitor.browser || ''} {visitor.os || ''}</td>
                  <td className="p-4 text-xs text-[#BCAEA0]"><span className="block max-w-[180px] truncate">{visitor.firstLandingPage || '—'}</span></td>
                  <td className="p-4 text-xs text-[#BCAEA0]"><span className="block max-w-[180px] truncate">{visitor.lastPage || '—'}</span></td>
                  <td className="p-4 text-xs font-semibold text-[#FFF0E1]">{visitor.eventCount || 0}<br /><span className="font-normal text-[#8A7A72]">actions</span></td>
                  <td className="p-4 text-xs text-[#BCAEA0]"><Clock className="mb-1 h-3.5 w-3.5 text-[#D2B48C]" />{visitor.lastSeenAt ? formatTimestamp(visitor.lastSeenAt) : '—'}</td>
                  <td className="p-4"><button onClick={() => openJourney(visitor)} className="nexora-button px-3 py-1.5 text-[10px]"><Route className="h-3.5 w-3.5" />Open</button></td>
                </tr>
              )) : <tr><td colSpan={9} className="p-8 text-center text-sm text-[#BCAEA0]">No visitor profiles yet. They will appear after the live site receives tracked visits.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <div className="studio-card p-5">
        <div className="mb-4 flex items-center justify-between gap-4"><div><h2 className="text-sm font-semibold text-[#FFF0E1]">Journey timeline</h2><p className="mt-1 max-w-3xl text-xs leading-6 text-[#BCAEA0]">This shows what the visitor did before becoming known or leaving. Use it to understand intent, not to identify private social accounts.</p></div><button onClick={() => setSelected(null)} className="text-xs text-[#D2B48C]">Close</button></div>
        <div className="grid gap-3 lg:grid-cols-3"><div className="rounded-2xl border border-[#332923] bg-[#17110F] p-4 text-xs"><p className="font-semibold text-[#FFF0E1]">Source</p><p className="mt-1 text-[#D2B48C]">{selected.lastSource || selected.firstSource || 'direct'}</p><p className="mt-1 text-[#BCAEA0]">{selected.lastCampaign || selected.firstCampaign || 'No campaign'}</p></div><div className="rounded-2xl border border-[#332923] bg-[#17110F] p-4 text-xs"><p className="font-semibold text-[#FFF0E1]">First landing</p><p className="mt-1 truncate text-[#BCAEA0]">{selected.firstLandingPage || '—'}</p></div><div className="rounded-2xl border border-[#332923] bg-[#17110F] p-4 text-xs"><p className="font-semibold text-[#FFF0E1]">Last page</p><p className="mt-1 truncate text-[#BCAEA0]">{selected.lastPage || '—'}</p></div></div>
        <div className="mt-5 space-y-3">
          {loadingJourney ? <p className="text-sm text-[#BCAEA0]">Loading journey...</p> : journey.length ? journey.map((event) => <div key={event.id} className="rounded-2xl border border-[#332923] bg-[#0E0B0A] p-4 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-[#FFF0E1]">{friendlyEvent(event.eventName)}</p><p className="text-[#8A7A72]">{formatTimestamp(event.createdAt)}</p></div><p className="mt-1 text-[#BCAEA0]">{event.pageUrl || '—'}</p>{event.cartValue > 0 && <p className="mt-1 text-[#D2B48C]">Cart value: {formatPrice(event.cartValue)}</p>}{event.metadata?.productName && <p className="mt-1 text-[#D2B48C]">Product: {String(event.metadata.productName)}</p>}</div>) : <p className="text-sm text-[#BCAEA0]">No journey events found for this visitor yet.</p>}
        </div>
      </div>}
    </div>
  );
}

function Metric({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: React.ElementType }) {
  return <div className="studio-card p-5"><div className="mb-3 flex items-center justify-between"><Icon className="h-5 w-5 text-[#D2B48C]" /><span className="text-[10px] uppercase tracking-[0.18em] text-[#BCAEA0]">{label}</span></div><p className="text-2xl font-bold text-[#FFF0E1]">{value}</p><p className="mt-2 text-xs leading-6 text-[#BCAEA0]">{helper}</p></div>;
}
