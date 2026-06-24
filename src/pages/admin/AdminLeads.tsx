/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, MessageCircle, Clock, Download, CheckCircle2, Plus, CalendarClock } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminPageHeader, AdminStatCard, AdminTabBar } from '@/components/admin/AdminPageHeader';
import { formatTimestamp } from '@/lib/utils';

const WHATSAPP = import.meta.env.VITE_STORE_WHATSAPP || '201037141322';
const pipeline = ['new', 'contacted', 'interested', 'waiting_reply', 'converted', 'lost'];
const tabs = ['Pipeline', 'All leads', 'Follow ups'];
function csvEscape(value: unknown) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }

export default function AdminLeads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(tabs[0]);
  const [taskTitle, setTaskTitle] = useState('');
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
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
  const ready = leads.filter((lead) => ['checkout_abandoned','interested','new'].includes(lead.status)).length;
  const sources = new Set(leads.map((l) => l.source).filter(Boolean)).size;
  const recent = leads.filter((l) => l.createdAt && Date.now() - l.createdAt.getTime() < 86400000).length;

  const exportCsv = () => {
    const rows = [['name','phone','email','source','medium','campaign','interest','status','created_at'], ...filtered.map((lead) => [lead.name, lead.phone, lead.email, lead.source, lead.medium, lead.campaign, lead.interestProductName, lead.status, lead.createdAt?.toISOString?.() || ''])];
    const blob = new Blob([rows.map((row) => row.map(csvEscape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `nexora-leads-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const setStatus = async (lead: any, status: string) => {
    try {
      const { updateLeadStatus } = await import('@/lib/supabase/db');
      await updateLeadStatus(lead.id, status, lead.notes);
      setLeads((rows) => rows.map((row) => row.id === lead.id ? { ...row, status } : row));
      toast.success(`Lead moved to ${status}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update lead'); }
  };

  const createTask = async () => {
    if (!selectedLead || !taskTitle.trim()) return;
    try {
      const { createLeadTask } = await import('@/lib/supabase/db');
      await createLeadTask(selectedLead.id, taskTitle.trim());
      toast.success('Follow-up task created');
      setTaskTitle('');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not create task'); }
  };

  const LeadCard = ({ lead }: { lead: any }) => {
    const message = `Hello from NEXORA. You showed interest${lead.interestProductName ? ` in ${lead.interestProductName}` : ''}. Need help choosing the right size?`;
    const whatsappLink = `https://wa.me/${(lead.phone || WHATSAPP).replace(/\D/g, '').replace(/^0/, '20')}?text=${encodeURIComponent(message)}`;
    return (
      <article className="studio-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#F5F1EA]">{lead.name || 'Unnamed lead'}</h2>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#A7AEBB]"><span>{lead.phone || 'No phone'}</span>{lead.email && <span>{lead.email}</span>}<span className="text-[#D7B98E]">{lead.source || 'direct'} / {lead.campaign || 'no campaign'}</span></div>
            <p className="mt-3 text-xs leading-6 text-[#A7AEBB]">Interest: <span className="text-[#F5F1EA]">{lead.interestProductName || lead.interestProductId || lead.notes || 'Private list / WhatsApp'}</span></p>
          </div>
          <div className="flex flex-wrap gap-2"><a href={whatsappLink} target="_blank" rel="noreferrer" className="nexora-button-primary min-h-10 px-4"><MessageCircle className="h-4 w-4" />WhatsApp</a>{lead.id && <button onClick={() => setStatus(lead, 'contacted')} className="nexora-button min-h-10 px-4"><CheckCircle2 className="h-4 w-4" />Contacted</button>}<button onClick={() => setSelectedLead(lead)} className="nexora-button min-h-10 px-4"><Plus className="h-4 w-4" />Task</button></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[#2E3442] pt-4 text-[10px] uppercase tracking-[0.16em]"><span className="rounded-full border border-[#2E3442] px-3 py-1 text-[#A7AEBB]">{lead.status}</span><span className="rounded-full border border-[#2E3442] px-3 py-1 text-[#A7AEBB]">{lead.medium || 'unknown medium'}</span><span className="rounded-full border border-[#2E3442] px-3 py-1 text-[#A7AEBB]">{lead.createdAt ? formatTimestamp(lead.createdAt) : 'No date'}</span></div>
        <div className="mt-4 flex flex-wrap gap-2">{pipeline.map((status) => <button key={status} onClick={() => setStatus(lead, status)} className="rounded-full border border-[#2E3442] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#A7AEBB] hover:border-[#D7B98E] hover:text-[#D7B98E]">{status.replace('_', ' ')}</button>)}</div>
      </article>
    );
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Leads CRM pipeline" description="Private-list, WhatsApp, notify-me and abandoned-checkout leads organized as a follow-up pipeline. Every action either works or shows a clear reason." actions={<div className="flex gap-2"><button onClick={exportCsv} className="nexora-button"><Download className="h-4 w-4" />Export</button><button onClick={load} className="nexora-button"><RefreshCw className="h-4 w-4" />Refresh</button></div>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><AdminStatCard label="Leads" value={leads.length} helper="Captured without account login." /><AdminStatCard label="Ready" value={ready} helper="New/interested/abandoned leads to contact." tone={ready ? 'warn' : 'good'} /><AdminStatCard label="Sources" value={sources} helper="Distinct sources producing leads." /><AdminStatCard label="Last 24h" value={recent} helper="Fresh leads from the last day." /></div>
      <AdminTabBar tabs={tabs} active={active} onChange={setActive} />
      <div className="studio-card p-4"><label className="flex items-center gap-3 rounded-2xl border border-[#2E3442] bg-[#0D1016] px-4 py-3"><Search className="h-4 w-4 text-[#D7B98E]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, campaign, product, status" className="w-full bg-transparent text-sm text-[#F5F1EA] outline-none placeholder:text-[#697286]" /></label></div>

      {selectedLead && <div className="studio-card p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Create follow-up task</h2><p className="mt-1 text-xs text-[#A7AEBB]">Lead: {selectedLead.name || selectedLead.phone || 'Unnamed'}</p></div><button onClick={() => setSelectedLead(null)} className="nexora-button">Close</button></div><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="studio-input" placeholder="Call tomorrow, ask size, send new drop..." /><button onClick={createTask} disabled={!taskTitle.trim()} className="nexora-button-primary"><CalendarClock className="h-4 w-4" />Create task</button></div></div>}

      {active === 'Pipeline' && <div className="grid gap-4 xl:grid-cols-3">{pipeline.map((status) => <section key={status} className="studio-card p-4"><h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-[#D7B98E]">{status.replace('_', ' ')}</h2><div className="space-y-3">{filtered.filter((lead) => String(lead.status || 'new') === status).slice(0, 20).map((lead) => <LeadCard key={lead.id || `${lead.phone}-${lead.createdAt}`} lead={lead} />)}{filtered.filter((lead) => String(lead.status || 'new') === status).length === 0 && <p className="rounded-2xl border border-[#2E3442] p-4 text-xs leading-6 text-[#A7AEBB]">No leads in this stage.</p>}</div></section>)}</div>}
      {active === 'All leads' && <div className="grid gap-4">{isLoading ? <div className="studio-card p-8 text-center text-sm text-[#A7AEBB]">Loading leads...</div> : filtered.length ? filtered.map((lead) => <LeadCard key={lead.id || `${lead.phone}-${lead.createdAt}`} lead={lead} />) : <div className="studio-card p-8 text-center text-sm text-[#A7AEBB]">No leads yet. Private list, WhatsApp clicks and checkout contact capture will populate this view.</div>}</div>}
      {active === 'Follow ups' && <div className="studio-card p-8 text-sm leading-7 text-[#A7AEBB]"><Clock className="mb-3 h-5 w-5 text-[#D7B98E]" />Follow-up tasks are stored in Supabase through the Task button. stable admin keeps it honest: tasks save only after the Edge Function confirms success.</div>}
    </div>
  );
}
