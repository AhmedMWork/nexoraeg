/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, MousePointerClick, Globe2, MonitorSmartphone, Clock, Eye } from 'lucide-react';
import { formatTimestamp } from '@/lib/utils';

export default function AdminVisitors() {
  const [visitors, setVisitors] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      const { getVisitors } = await import('@/lib/supabase/db');
      setVisitors(await getVisitors());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => visitors.filter((visitor) => {
    const text = `${visitor.anonymousId} ${visitor.firstSource || ''} ${visitor.lastSource || ''} ${visitor.firstCampaign || ''} ${visitor.lastCampaign || ''} ${visitor.deviceType || ''} ${visitor.browser || ''}`.toLowerCase();
    return text.includes(query.toLowerCase());
  }), [visitors, query]);

  const sourceCounts = visitors.reduce<Record<string, number>>((acc, visitor) => {
    const source = visitor.lastSource || visitor.firstSource || 'direct';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {});
  const topSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No data';
  const known = visitors.filter((v) => v.isKnown).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#FFF0E1]">Visitors</h1>
          <p className="mt-1 text-sm text-[#BCAEA0]">Anonymous visitor intelligence: source, campaign, device, last page, and lead linkage.</p>
        </div>
        <button onClick={load} className="nexora-button"><RefreshCw className="h-4 w-4" />Refresh</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Visitors" value={String(visitors.length)} helper="Anonymous profiles captured from storefront events." icon={MousePointerClick} />
        <Metric label="Known" value={String(known)} helper="Visitors linked to a lead or customer." icon={Eye} />
        <Metric label="Top Source" value={topSource} helper="Highest volume last-touch source." icon={Globe2} />
        <Metric label="Devices" value={String(new Set(visitors.map((v) => v.deviceType).filter(Boolean)).size)} helper="Device categories observed." icon={MonitorSmartphone} />
      </div>

      <div className="studio-card p-4">
        <label className="flex items-center gap-3 rounded-2xl border border-[#332923] bg-[#0E0B0A] px-4 py-3">
          <Search className="h-4 w-4 text-[#D2B48C]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search source, campaign, visitor id, device" className="w-full bg-transparent text-sm text-[#FFF0E1] outline-none placeholder:text-[#8A7A72]" />
        </label>
      </div>

      <div className="studio-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead className="bg-[#17110F]"><tr>{['Visitor','Source','Campaign','Device','First landing','Last page','Events','Last seen'].map((h) => <th key={h} className="p-4 text-[10px] uppercase tracking-[0.18em] text-[#BCAEA0]">{h}</th>)}</tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={8} className="p-8 text-center text-sm text-[#BCAEA0]">Loading visitors...</td></tr> : filtered.length ? filtered.map((visitor) => (
                <tr key={visitor.id || visitor.anonymousId} className="border-t border-[#332923]/70">
                  <td className="p-4 text-xs font-semibold text-[#FFF0E1]"><span className="block max-w-[180px] truncate">{visitor.anonymousId}</span>{visitor.isKnown && <span className="mt-1 inline-flex rounded-full border border-emerald-400/30 px-2 py-0.5 text-[9px] uppercase tracking-[0.15em] text-emerald-300">Known</span>}</td>
                  <td className="p-4 text-xs text-[#D2B48C]">{visitor.lastSource || visitor.firstSource || 'direct'}<br /><span className="text-[#BCAEA0]">{visitor.lastMedium || visitor.firstMedium || 'none'}</span></td>
                  <td className="p-4 text-xs text-[#BCAEA0]">{visitor.lastCampaign || visitor.firstCampaign || '—'}</td>
                  <td className="p-4 text-xs text-[#BCAEA0]">{visitor.deviceType || 'unknown'}<br />{visitor.browser || ''} {visitor.os || ''}</td>
                  <td className="p-4 text-xs text-[#BCAEA0]"><span className="block max-w-[180px] truncate">{visitor.firstLandingPage || '—'}</span></td>
                  <td className="p-4 text-xs text-[#BCAEA0]"><span className="block max-w-[180px] truncate">{visitor.lastPage || '—'}</span></td>
                  <td className="p-4 text-xs font-semibold text-[#FFF0E1]">{visitor.eventCount || 0}</td>
                  <td className="p-4 text-xs text-[#BCAEA0]"><Clock className="mb-1 h-3.5 w-3.5 text-[#D2B48C]" />{visitor.lastSeenAt ? formatTimestamp(visitor.lastSeenAt) : '—'}</td>
                </tr>
              )) : <tr><td colSpan={8} className="p-8 text-center text-sm text-[#BCAEA0]">No visitor profiles yet. They will appear after the live site receives tracked visits.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: React.ElementType }) {
  return <div className="studio-card p-5"><div className="mb-3 flex items-center justify-between"><Icon className="h-5 w-5 text-[#D2B48C]" /><span className="text-[10px] uppercase tracking-[0.18em] text-[#BCAEA0]">{label}</span></div><p className="text-2xl font-bold text-[#FFF0E1]">{value}</p><p className="mt-2 text-xs leading-6 text-[#BCAEA0]">{helper}</p></div>;
}
