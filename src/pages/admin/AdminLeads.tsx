/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, UserPlus, MessageCircle, Phone, Clock, Download, CheckCircle2 } from 'lucide-react';
import { formatTimestamp } from '@/lib/utils';

const WHATSAPP = import.meta.env.VITE_STORE_WHATSAPP || '201037141322';

function csvEscape(value: unknown) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }

export default function AdminLeads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      const { getLeads } = await import('@/lib/supabase/db');
      setLeads(await getLeads());
    } finally { setIsLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => leads.filter((lead) => `${lead.name || ''} ${lead.phone || ''} ${lead.email || ''} ${lead.source || ''} ${lead.campaign || ''} ${lead.interestProductName || ''} ${lead.status || ''}`.toLowerCase().includes(query.toLowerCase())), [leads, query]);

  const exportCsv = () => {
    const rows = [['name','phone','email','source','medium','campaign','interest','status','created_at'], ...filtered.map((lead) => [lead.name, lead.phone, lead.email, lead.source, lead.medium, lead.campaign, lead.interestProductName, lead.status, lead.createdAt?.toISOString?.() || ''])];
    const blob = new Blob([rows.map((row) => row.map(csvEscape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nexora-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const markContacted = async (lead: any) => {
    const { updateLeadStatus } = await import('@/lib/supabase/db');
    await updateLeadStatus(lead.id, 'contacted', lead.notes);
    await load();
  };

  const leadRevenueReady = leads.filter((lead) => ['checkout_abandoned','interested','new'].includes(lead.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-xl font-bold tracking-tight text-[#FFF0E1]">Leads</h1><p className="mt-1 text-sm text-[#BCAEA0]">People who joined the private list, clicked WhatsApp, requested notify-me, or started checkout.</p></div><div className="flex gap-2"><button onClick={exportCsv} className="nexora-button"><Download className="h-4 w-4" />Export CSV</button><button onClick={load} className="nexora-button"><RefreshCw className="h-4 w-4" />Refresh</button></div></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Leads" value={String(leads.length)} helper="Captured without requiring account login." icon={UserPlus} /><Metric label="Ready to contact" value={String(leadRevenueReady)} helper="New/interested/abandoned checkout leads." icon={Phone} /><Metric label="Sources" value={String(new Set(leads.map((l) => l.source).filter(Boolean)).size)} helper="Distinct sources producing leads." icon={MessageCircle} /><Metric label="Recent" value={String(leads.filter((l) => l.createdAt && Date.now() - l.createdAt.getTime() < 86400000).length)} helper="Leads captured in the last 24 hours." icon={Clock} /></div>
      <div className="studio-card p-4"><label className="flex items-center gap-3 rounded-2xl border border-[#332923] bg-[#0E0B0A] px-4 py-3"><Search className="h-4 w-4 text-[#D2B48C]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, campaign, product, status" className="w-full bg-transparent text-sm text-[#FFF0E1] outline-none placeholder:text-[#8A7A72]" /></label></div>
      <div className="grid gap-4">
        {isLoading ? <div className="studio-card p-8 text-center text-sm text-[#BCAEA0]">Loading leads...</div> : filtered.length ? filtered.map((lead) => {
          const message = `Hello from NEXORA. You showed interest${lead.interestProductName ? ` in ${lead.interestProductName}` : ''}. Need help choosing the right size?`;
          const whatsappLink = `https://wa.me/${(lead.phone || WHATSAPP).replace(/\D/g, '').replace(/^0/, '20')}?text=${encodeURIComponent(message)}`;
          return <article key={lead.id || `${lead.phone}-${lead.createdAt}`} className="studio-card p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h2 className="text-base font-semibold text-[#FFF0E1]">{lead.name || 'Unnamed lead'}</h2><div className="mt-2 flex flex-wrap gap-3 text-xs text-[#BCAEA0]"><span>{lead.phone || 'No phone'}</span>{lead.email && <span>{lead.email}</span>}<span className="text-[#D2B48C]">{lead.source || 'direct'} / {lead.campaign || 'no campaign'}</span></div><p className="mt-3 text-xs leading-6 text-[#BCAEA0]">Interest: <span className="text-[#FFF0E1]">{lead.interestProductName || lead.interestProductId || lead.notes || 'Private list / WhatsApp'}</span></p></div><div className="flex flex-wrap gap-2"><a href={whatsappLink} target="_blank" rel="noreferrer" className="nexora-button-primary min-h-10 px-4"><MessageCircle className="h-4 w-4" />WhatsApp</a>{lead.id && <button onClick={() => markContacted(lead)} className="nexora-button min-h-10 px-4"><CheckCircle2 className="h-4 w-4" />Contacted</button>}</div></div><div className="mt-4 flex flex-wrap gap-2 border-t border-[#332923] pt-4 text-[10px] uppercase tracking-[0.16em]"><span className="rounded-full border border-[#332923] px-3 py-1 text-[#BCAEA0]">{lead.status}</span><span className="rounded-full border border-[#332923] px-3 py-1 text-[#BCAEA0]">{lead.medium || 'unknown medium'}</span><span className="rounded-full border border-[#332923] px-3 py-1 text-[#BCAEA0]">{lead.createdAt ? formatTimestamp(lead.createdAt) : 'No date'}</span></div></article>;
        }) : <div className="studio-card p-8 text-center text-sm text-[#BCAEA0]">No leads yet. Private list, notify-me, WhatsApp clicks, and checkout contact capture will populate this view.</div>}
      </div>
    </div>
  );
}

function Metric({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: React.ElementType }) { return <div className="studio-card p-5"><div className="mb-3 flex items-center justify-between"><Icon className="h-5 w-5 text-[#D2B48C]" /><span className="text-[10px] uppercase tracking-[0.18em] text-[#BCAEA0]">{label}</span></div><p className="text-2xl font-bold text-[#FFF0E1]">{value}</p><p className="mt-2 text-xs leading-6 text-[#BCAEA0]">{helper}</p></div>; }
