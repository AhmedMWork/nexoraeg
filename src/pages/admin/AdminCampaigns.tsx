/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { Copy, HelpCircle, Link2, Plus, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { SITE_URL } from '@/lib/constants';

const platforms = [
  { value: 'facebook', label: 'Facebook Ad', source: 'facebook', medium: 'paid_social', example: 'Feed / Reels paid campaign' },
  { value: 'instagram', label: 'Instagram Ad', source: 'instagram', medium: 'paid_social', example: 'Story / Reels paid campaign' },
  { value: 'tiktok', label: 'TikTok Ad', source: 'tiktok', medium: 'paid_social', example: 'TikTok paid video' },
  { value: 'google', label: 'Google Search', source: 'google', medium: 'paid_search', example: 'Google paid search ad' },
  { value: 'organic_instagram', label: 'Instagram Organic', source: 'instagram', medium: 'organic_social', example: 'Bio link / organic story' },
  { value: 'direct_whatsapp', label: 'WhatsApp Share', source: 'whatsapp', medium: 'direct_message', example: 'Manual WhatsApp broadcast' },
];

const quickExamples = [
  { name: 'June Drop — Facebook Reel', platform: 'facebook', campaign: 'june_drop', content: 'black_tee_reel_01', landingPage: '/shop?collection=limited' },
  { name: 'Instagram Bio — Essentials', platform: 'organic_instagram', campaign: 'ig_bio', content: 'essentials_link', landingPage: '/shop' },
  { name: 'Last Pieces — Story', platform: 'instagram', campaign: 'last_pieces', content: 'story_last_pieces', landingPage: '/shop?availability=last-pieces' },
];

function slug(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }
function pct(part: number, total: number) { return total ? `${Math.round((part / total) * 100)}%` : '0%'; }

function Field({ label, help, example, children }: { label: string; help: string; example?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#D2B48C]">{label}</span><span className="mb-2 block text-xs leading-5 text-[#BCAEA0]">{help}{example ? <><br /><b className="text-[#FFF0E1]">Example:</b> {example}</> : null}</span>{children}</label>;
}

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
    toast.success('Campaign link saved. Copy it and use it in your ad/bio/story.');
    await load();
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success('Copied. Paste it into the ad destination URL.');
  };

  const applyExample = (example: typeof quickExamples[number]) => {
    setForm(example);
    toast.success('Example loaded. Edit if needed, then copy/save.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#FFF0E1]">Campaign Links</h1>
          <p className="mt-1 text-sm leading-6 text-[#BCAEA0]">Build tracking links so NEXORA can tell you if traffic came from Facebook, Instagram, TikTok, Google, WhatsApp, or another source.</p>
        </div>
        <button onClick={load} className="nexora-button"><RefreshCw className="h-4 w-4" />Refresh</button>
      </div>

      <div className="studio-card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#FFF0E1]"><HelpCircle className="h-4 w-4 text-[#D2B48C]" />How to use this page</h2>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ['1. Choose platform', 'Select Facebook, Instagram, TikTok, Google, or organic/social share.'],
            ['2. Name the campaign', 'Use a clean name like june_drop or last_pieces. This groups traffic in Reports.'],
            ['3. Add creative/content', 'Use this to compare different ads: black_tee_story vs black_tee_reel.'],
            ['4. Copy link', 'Paste the final URL into the ad destination URL, bio, story sticker, or WhatsApp broadcast.'],
          ].map(([title, body]) => <div key={title} className="rounded-2xl border border-[#332923] bg-[#17110F] p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#D2B48C]">{title}</p><p className="mt-2 text-xs leading-6 text-[#BCAEA0]">{body}</p></div>)}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="studio-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#FFF0E1]"><Plus className="h-4 w-4 text-[#D2B48C]" />Builder</h2>
          <div className="space-y-4">
            <Field label="Name" help="Internal friendly name. This helps you remember what the link is for." example="June Drop — Facebook Reel">
              <input className="studio-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Platform" help="This controls utm_source and utm_medium automatically." example="Facebook Ad = source facebook + medium paid_social">
              <select className="studio-input" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>{platforms.map((p) => <option key={p.value} value={p.value}>{p.label} — {p.example}</option>)}</select>
            </Field>
            <Field label="Campaign" help="Main campaign group. Keep it lowercase and consistent across ads." example="june_drop">
              <input className="studio-input" value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} />
            </Field>
            <Field label="Content / Creative" help="The exact ad/creative/story. This lets you compare creatives inside the same campaign." example="black_tee_story_01">
              <input className="studio-input" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </Field>
            <Field label="Landing page" help="Where customers should land after opening the ad." example="/product/black-oversized-tee or /shop?availability=last-pieces">
              <input className="studio-input" value={form.landingPage} onChange={(e) => setForm({ ...form, landingPage: e.target.value })} />
            </Field>
            <div className="rounded-2xl border border-[#332923] bg-[#0E0B0A] p-4 text-xs leading-6 text-[#BCAEA0] break-all">
              <p className="mb-2 font-semibold uppercase tracking-[0.14em] text-[#D2B48C]">Generated URL</p>
              {generated}
            </div>
            <div className="flex flex-wrap gap-2"><button onClick={() => copy(generated)} className="nexora-button"><Copy className="h-4 w-4" />Copy URL</button><button onClick={create} className="nexora-button-primary"><Plus className="h-4 w-4" />Save link</button></div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="studio-card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#FFF0E1]"><Sparkles className="h-4 w-4 text-[#D2B48C]" />Ready examples</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {quickExamples.map((example) => <button key={example.name} onClick={() => applyExample(example)} className="rounded-2xl border border-[#332923] bg-[#17110F] p-4 text-left hover:border-[#D2B48C]/50"><p className="text-xs font-semibold text-[#FFF0E1]">{example.name}</p><p className="mt-2 text-[11px] leading-5 text-[#BCAEA0]">{example.landingPage}<br />{example.content}</p></button>)}
            </div>
          </div>

          <div className="studio-card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#FFF0E1]"><TrendingUp className="h-4 w-4 text-[#D2B48C]" />Campaign Performance</h2>
            <div className="space-y-2">
              {reports.length ? reports.slice(0, 8).map((row) => {
                const visitors = Number(row.visitors || 0);
                const orders = Number(row.orders || 0);
                return <div key={`${row.campaign}-${row.source}-${row.content}`} className="grid gap-2 rounded-2xl border border-[#332923] bg-[#17110F] p-4 text-xs md:grid-cols-6"><span className="font-semibold text-[#FFF0E1]">{row.campaign || 'no campaign'}</span><span className="text-[#D2B48C]">{row.source || 'direct'}</span><span className="text-[#BCAEA0]">Visitors: <b className="text-[#D2B48C]">{visitors}</b></span><span className="text-[#BCAEA0]">Leads: <b className="text-[#D2B48C]">{row.leads || 0}</b></span><span className="text-[#BCAEA0]">Orders: <b className="text-[#D2B48C]">{orders}</b></span><span className="text-[#BCAEA0]">Conv: <b className="text-[#D2B48C]">{pct(orders, visitors)}</b></span></div>;
              }) : <p className="text-sm leading-7 text-[#BCAEA0]">No campaign report yet. Use generated links in ads/stories, then check Reports.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="studio-card overflow-hidden">
        <div className="border-b border-[#332923] p-5"><h2 className="flex items-center gap-2 text-sm font-semibold text-[#FFF0E1]"><Link2 className="h-4 w-4 text-[#D2B48C]" />Saved Links</h2><p className="mt-1 text-xs text-[#BCAEA0]">Click the final URL to copy it again.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead className="bg-[#17110F]"><tr>{['Name','Source / Medium','Campaign','Content','Landing','Final URL'].map((h) => <th key={h} className="p-4 text-[10px] uppercase tracking-[0.18em] text-[#BCAEA0]">{h}</th>)}</tr></thead><tbody>{isLoading ? <tr><td colSpan={6} className="p-8 text-center text-sm text-[#BCAEA0]">Loading links...</td></tr> : links.length ? links.map((link) => <tr key={link.id || link.finalUrl} className="border-t border-[#332923]/70"><td className="p-4 text-xs font-semibold text-[#FFF0E1]">{link.name}</td><td className="p-4 text-xs text-[#D2B48C]">{link.source}<br /><span className="text-[#BCAEA0]">{link.medium}</span></td><td className="p-4 text-xs text-[#BCAEA0]">{link.campaign}</td><td className="p-4 text-xs text-[#BCAEA0]">{link.content || '—'}</td><td className="p-4 text-xs text-[#BCAEA0]">{link.landingPage}</td><td className="p-4 text-xs"><button onClick={() => copy(link.finalUrl)} className="max-w-[360px] truncate text-left text-[#D2B48C]">{link.finalUrl}</button></td></tr>) : <tr><td colSpan={6} className="p-8 text-center text-sm text-[#BCAEA0]">No saved campaign links yet.</td></tr>}</tbody></table></div>
      </div>
    </div>
  );
}
