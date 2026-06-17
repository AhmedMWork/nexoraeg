/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { Copy, Link2, Plus, RefreshCw, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { SITE_URL } from '@/lib/constants';

const platforms = [
  { value: 'facebook', source: 'facebook', medium: 'paid_social' },
  { value: 'instagram', source: 'instagram', medium: 'paid_social' },
  { value: 'tiktok', source: 'tiktok', medium: 'paid_social' },
  { value: 'google', source: 'google', medium: 'paid_search' },
  { value: 'organic_instagram', source: 'instagram', medium: 'organic_social' },
];

function slug(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }

export default function AdminCampaigns() {
  const [links, setLinks] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [form, setForm] = useState({ name: 'June Drop', platform: 'facebook', campaign: 'june_drop', content: 'black_tee_story', landingPage: '/shop' });
  const [isLoading, setIsLoading] = useState(true);

  const selected = platforms.find((p) => p.value === form.platform) || platforms[0];
  const generated = useMemo(() => {
    const url = new URL(form.landingPage || '/', SITE_URL);
    url.searchParams.set('utm_source', selected.source);
    url.searchParams.set('utm_medium', selected.medium);
    url.searchParams.set('utm_campaign', slug(form.campaign || form.name));
    if (form.content) url.searchParams.set('utm_content', slug(form.content));
    return url.toString();
  }, [form, selected]);

  const load = async () => {
    setIsLoading(true);
    try {
      const db = await import('@/lib/supabase/db');
      const [items, report] = await Promise.all([db.getCampaignLinks().catch(() => []), db.getCampaignReports().catch(() => ({ campaigns: [] }))]);
      setLinks(items);
      setReports(report.campaigns || []);
    } finally { setIsLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const create = async () => {
    const { createCampaignLink } = await import('@/lib/supabase/db');
    await createCampaignLink({ name: form.name, platform: selected.source, source: selected.source, medium: selected.medium, campaign: slug(form.campaign || form.name), content: slug(form.content), landingPage: form.landingPage || '/', finalUrl: generated });
    toast.success('Campaign link saved.');
    await load();
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success('Copied.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-xl font-bold tracking-tight text-[#FFF0E1]">Campaign Links</h1><p className="mt-1 text-sm text-[#BCAEA0]">Build Facebook, Instagram, TikTok, and Google links with consistent attribution.</p></div><button onClick={load} className="nexora-button"><RefreshCw className="h-4 w-4" />Refresh</button></div>
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="studio-card p-5"><h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#FFF0E1]"><Plus className="h-4 w-4 text-[#D2B48C]" />Builder</h2><div className="space-y-3"><input className="nexora-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Campaign name" /><select className="nexora-input" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>{platforms.map((p) => <option key={p.value} value={p.value}>{p.value}</option>)}</select><input className="nexora-input" value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} placeholder="utm_campaign" /><input className="nexora-input" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="utm_content / creative" /><input className="nexora-input" value={form.landingPage} onChange={(e) => setForm({ ...form, landingPage: e.target.value })} placeholder="/product/slug or /shop" /><div className="rounded-2xl border border-[#332923] bg-[#0E0B0A] p-3 text-xs leading-6 text-[#BCAEA0] break-all">{generated}</div><div className="flex gap-2"><button onClick={() => copy(generated)} className="nexora-button"><Copy className="h-4 w-4" />Copy</button><button onClick={create} className="nexora-button-primary"><Plus className="h-4 w-4" />Save</button></div></div></div>
        <div className="studio-card p-5"><h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#FFF0E1]"><TrendingUp className="h-4 w-4 text-[#D2B48C]" />Campaign Performance</h2><div className="space-y-2">{reports.length ? reports.map((row) => <div key={`${row.campaign}-${row.source}`} className="grid gap-2 rounded-2xl border border-[#332923] bg-[#17110F] p-4 text-xs md:grid-cols-5"><span className="font-semibold text-[#FFF0E1]">{row.campaign || 'no campaign'}</span><span className="text-[#BCAEA0]">{row.source || 'direct'}</span><span className="text-[#BCAEA0]">Visitors: <b className="text-[#D2B48C]">{row.visitors || 0}</b></span><span className="text-[#BCAEA0]">Leads: <b className="text-[#D2B48C]">{row.leads || 0}</b></span><span className="text-[#BCAEA0]">Orders: <b className="text-[#D2B48C]">{row.orders || 0}</b></span></div>) : <p className="text-sm text-[#BCAEA0]">No campaign report yet. Use generated links in ads and stories.</p>}</div></div>
      </div>
      <div className="studio-card overflow-hidden"><div className="border-b border-[#332923] p-5"><h2 className="flex items-center gap-2 text-sm font-semibold text-[#FFF0E1]"><Link2 className="h-4 w-4 text-[#D2B48C]" />Saved Links</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left"><thead className="bg-[#17110F]"><tr>{['Name','Source','Campaign','Content','Landing','Final URL'].map((h) => <th key={h} className="p-4 text-[10px] uppercase tracking-[0.18em] text-[#BCAEA0]">{h}</th>)}</tr></thead><tbody>{isLoading ? <tr><td colSpan={6} className="p-8 text-center text-sm text-[#BCAEA0]">Loading links...</td></tr> : links.length ? links.map((link) => <tr key={link.id || link.finalUrl} className="border-t border-[#332923]/70"><td className="p-4 text-xs font-semibold text-[#FFF0E1]">{link.name}</td><td className="p-4 text-xs text-[#D2B48C]">{link.source}<br /><span className="text-[#BCAEA0]">{link.medium}</span></td><td className="p-4 text-xs text-[#BCAEA0]">{link.campaign}</td><td className="p-4 text-xs text-[#BCAEA0]">{link.content || '—'}</td><td className="p-4 text-xs text-[#BCAEA0]">{link.landingPage}</td><td className="p-4 text-xs"><button onClick={() => copy(link.finalUrl)} className="max-w-[280px] truncate text-[#D2B48C]">{link.finalUrl}</button></td></tr>) : <tr><td colSpan={6} className="p-8 text-center text-sm text-[#BCAEA0]">No saved campaign links yet.</td></tr>}</tbody></table></div></div>
    </div>
  );
}
