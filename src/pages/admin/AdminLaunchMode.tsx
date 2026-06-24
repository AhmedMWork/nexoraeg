import { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarClock, Download, Eye, ExternalLink, Globe2, Lock, MessageCircle, RefreshCw, Rocket, Save, ShieldCheck, Smartphone, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminActionLink, AdminEmptyBlock, AdminHero, AdminMetricCard, AdminPageShell, AdminPanel, AdminStatusPill } from '@/components/admin/AdminCommandCenter';
import { AdminDataErrorCard, AdminSkeletonPanel } from '@/components/admin/AdminState';
import { defaultLaunchSettings, fromInputDateTime, isLaunchActive, normalizeLaunchSettings, toInputDateTime, type NormalizedLaunchSettings } from '@/lib/launchMode';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import type { LaunchSubscriber } from '@/types';

type PreviewMode = 'desktop' | 'mobile';

function ToggleRow({ label, example, checked, onChange }: { label: string; example: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-3xl border border-[#E4D6C5] bg-white p-4 transition hover:border-[#D6B58F] hover:shadow-[0_16px_38px_rgba(43,33,29,.06)]">
      <span>
        <span className="block text-sm font-black text-[#231916]">{label}</span>
        <span className="mt-1 block text-xs leading-6 text-[#6F5D50]">Example: {example}</span>
      </span>
      <input type="checkbox" className="mt-1 h-5 w-5 accent-[#9D7159]" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function Field({ label, example, children }: { label: string; example: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-black uppercase tracking-[0.16em] text-[#6F5D50]">
      {label}
      <span className="mt-1 block text-[11px] font-semibold normal-case leading-5 tracking-normal text-[#A48F7E]">Example: {example}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function PreviewCard({ launch, mode }: { launch: NormalizedLaunchSettings; mode: PreviewMode }) {
  return (
    <div className={`mx-auto overflow-hidden rounded-[34px] border border-[#D6B58F]/30 bg-[#0B0908] p-4 text-[#FFF8EC] shadow-[0_28px_80px_rgba(43,33,29,.22)] ${mode === 'mobile' ? 'max-w-[360px]' : 'max-w-full'}`}>
      <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(214,181,143,.28),transparent_42%),linear-gradient(135deg,#171210,#050403)] p-5">
        <div className="mb-8 flex items-center justify-between gap-3">
          <img src="/assets/nexora-logo-ivory.png" alt="NEXORA" className="h-8 w-auto" />
          <span className="rounded-full border border-[#D6B58F]/30 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#D6B58F]">Preview</span>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#D6B58F]">{launch.eyebrow}</p>
        <h2 className="mt-3 max-w-xl text-3xl font-black uppercase leading-none tracking-[-0.07em] sm:text-5xl">{launch.title}</h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-[#D8C7B0]">{launch.subtitle}</p>
        <div className="mt-6 grid grid-cols-4 gap-2">
          {['Days', 'Hours', 'Minutes', 'Seconds'].map((label, index) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[.06] p-3 text-center">
              <p className="text-2xl font-black tracking-[-0.06em]">{index === 0 ? '07' : '00'}</p>
              <p className="mt-1 text-[8px] font-black uppercase tracking-[0.16em] text-[#D6B58F]">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <span className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D6B58F] px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#171210]"><MessageCircle className="h-4 w-4" /> {launch.buttonText}</span>
          {launch.showNotifyForm && <span className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#FFF8EC]">Notify form</span>}
        </div>
      </div>
    </div>
  );
}

function toCsv(subscribers: LaunchSubscriber[]) {
  const headers = ['Name', 'Contact', 'Email', 'Phone', 'Source', 'Status', 'Created At'];
  const rows = subscribers.map((item) => [item.name || '', item.contact, item.email || '', item.phone || '', item.source, item.status, item.createdAt.toISOString()]);
  return [headers, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export default function AdminLaunchMode() {
  const [launch, setLaunch] = useState<NormalizedLaunchSettings>(defaultLaunchSettings());
  const [subscribers, setSubscribers] = useState<LaunchSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { getLaunchSettings, getLaunchSubscribers } = await import('@/lib/supabase/db');
      const [settings, people] = await Promise.all([
        getLaunchSettings(),
        getLaunchSubscribers().catch(() => []),
      ]);
      setLaunch({ ...normalizeLaunchSettings(settings), launchAt: toInputDateTime(settings.launchAt) });
      setSubscribers(people);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load Launch Mode.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const active = useMemo(() => isLaunchActive({ launchSettings: { ...launch, launchAt: fromInputDateTime(launch.launchAt) } }), [launch]);
  const launchDateLabel = useMemo(() => {
    const date = new Date(fromInputDateTime(launch.launchAt));
    return Number.isNaN(date.getTime()) ? 'Not scheduled' : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  }, [launch.launchAt]);

  const update = <K extends keyof NormalizedLaunchSettings>(field: K, value: NormalizedLaunchSettings[K]) => setLaunch((current) => ({ ...current, [field]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { saveLaunchSettings } = await import('@/lib/supabase/db');
      const stored = await saveLaunchSettings({ ...launch, launchAt: fromInputDateTime(launch.launchAt) });
      setLaunch({ ...normalizeLaunchSettings(stored), launchAt: toInputDateTime(stored.launchAt) });
      toast.success('Launch Mode settings saved and verified.');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Launch Mode settings could not be saved.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const disableLaunch = async () => {
    setLaunch((current) => ({ ...current, enabled: false }));
    setTimeout(() => void save(), 0);
  };

  const exportSubscribers = () => {
    const blob = new Blob([toCsv(subscribers)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'launch-subscribers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const markSubscriber = async (id: string, status: LaunchSubscriber['status']) => {
    try {
      const { updateLaunchSubscriberStatus } = await import('@/lib/supabase/db');
      await updateLaunchSubscriberStatus(id, status);
      setSubscribers((items) => items.map((item) => item.id === id ? { ...item, status } : item));
      toast.success('Subscriber updated');
    } catch (subscriberError) {
      toast.error(subscriberError instanceof Error ? subscriberError.message : 'Could not update subscriber.');
    }
  };

  if (loading) return <AdminPageShell><AdminSkeletonPanel label="Loading Launch Mode controls..." /></AdminPageShell>;

  return (
    <AdminPageShell>
      <AdminHero
        eyebrow="Storefront Control"
        title="Launch Mode"
        description="A dedicated premium control room for locking the storefront, managing the Opening Soon page, verifying persistence, and collecting launch subscribers. Admin routes stay open while customer routes are locked."
        actions={(
          <>
            <a href="/opening-soon" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[#D6B58F] bg-[#FFFDF8] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#8C634B] hover:bg-[#F2E7D8]"><Eye className="h-4 w-4" /> Public Preview</a>
            <button onClick={load} className="inline-flex items-center gap-2 rounded-full border border-[#E4D6C5] bg-[#FFFDF8] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#6F5D50] hover:border-[#D6B58F]"><RefreshCw className="h-4 w-4" /> Refresh</button>
            <button onClick={save} disabled={saving} className="nexora-button inline-flex items-center gap-2"><Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save & Verify'}</button>
          </>
        )}
        meta={(
          <>
            <AdminStatusPill tone={active ? 'warn' : 'good'}>{active ? 'Store locked' : 'Store open'}</AdminStatusPill>
            <AdminStatusPill tone={launch.enabled ? 'accent' : 'neutral'}>{launch.enabled ? 'Launch enabled' : 'Launch disabled'}</AdminStatusPill>
            <AdminStatusPill tone={launch.autoOpen ? 'good' : 'warn'}>{launch.autoOpen ? 'Auto-open on' : 'Manual open'}</AdminStatusPill>
          </>
        )}
      />

      {error && <AdminDataErrorCard message={error} onRetry={load} />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard label="Launch State" value={launch.enabled ? 'Enabled' : 'Disabled'} helper="Controls whether customer routes are locked." tone={launch.enabled ? 'warn' : 'good'} icon={<Rocket className="h-5 w-5" />} />
        <AdminMetricCard label="Store Access" value={active ? 'Locked' : 'Open'} helper="Admin remains available either way." tone={active ? 'danger' : 'good'} icon={<Lock className="h-5 w-5" />} />
        <AdminMetricCard label="Launch Date" value={launchDateLabel} helper={launch.timezone} tone="accent" icon={<CalendarClock className="h-5 w-5" />} />
        <AdminMetricCard label="Subscribers" value={subscribers.length} helper="People waiting for launch updates." tone="info" icon={<UsersRound className="h-5 w-5" />} />
        <AdminMetricCard label="Countdown" value={launch.showCountdown ? 'Visible' : 'Hidden'} helper="Displayed on Opening Soon page." tone={launch.showCountdown ? 'good' : 'neutral'} icon={<Bell className="h-5 w-5" />} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-5">
          <AdminPanel title="Launch Controls" description="Define when the customer-facing store should close, when it should reopen, and what bypass behavior is allowed.">
            <div className="grid gap-4 md:grid-cols-2">
              <ToggleRow label="Enable Launch Mode" example="Turn this on before a launch campaign or a major store update." checked={launch.enabled} onChange={(value) => update('enabled', value)} />
              <ToggleRow label="Auto-open when countdown ends" example="The store opens automatically after the launch time passes." checked={launch.autoOpen} onChange={(value) => update('autoOpen', value)} />
              <ToggleRow label="Allow admin bypass" example="Admins can keep using NEXORA HQ while the storefront is locked." checked={launch.allowAdminBypass} onChange={(value) => update('allowAdminBypass', value)} />
              <ToggleRow label="Show countdown" example="Show Days, Hours, Minutes, and Seconds on the public page." checked={launch.showCountdown} onChange={(value) => update('showCountdown', value)} />
              <Field label="Launch date and time" example="2026-07-01 20:00 Cairo time"><input type="datetime-local" value={launch.launchAt} onChange={(event) => update('launchAt', event.target.value)} className="studio-input" /></Field>
              <Field label="Timezone" example="Africa/Cairo"><input value={launch.timezone} onChange={(event) => update('timezone', event.target.value)} className="studio-input" /></Field>
            </div>
          </AdminPanel>

          <AdminPanel title="Opening Soon Page Content" description="Every text field is visible to customers, so keep it premium, short, and direct.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Eyebrow" example="Premium launch experience"><input value={launch.eyebrow} onChange={(event) => update('eyebrow', event.target.value)} className="studio-input" /></Field>
              <Field label="Button text" example="Contact us on WhatsApp"><input value={launch.buttonText} onChange={(event) => update('buttonText', event.target.value)} className="studio-input" /></Field>
            </div>
            <div className="mt-4 grid gap-4">
              <Field label="Main title" example="NEXORA is Opening Soon"><input value={launch.title} onChange={(event) => update('title', event.target.value)} className="studio-input" /></Field>
              <Field label="Subtitle" example="A new premium shopping experience is almost here."><textarea value={launch.subtitle} onChange={(event) => update('subtitle', event.target.value)} className="studio-input min-h-24" /></Field>
              <Field label="Announcement" example="New drops, smoother checkout, and a better shopping journey are coming soon."><textarea value={launch.announcement} onChange={(event) => update('announcement', event.target.value)} className="studio-input min-h-24" /></Field>
              <Field label="WhatsApp message" example="Hello NEXORA, I would like to know more about the launch."><textarea value={launch.whatsappMessage} onChange={(event) => update('whatsappMessage', event.target.value)} className="studio-input min-h-24" /></Field>
              <Field label="Notify success message" example="You are on the launch list. We will contact you when NEXORA opens."><textarea value={launch.notifySuccessMessage} onChange={(event) => update('notifySuccessMessage', event.target.value)} className="studio-input min-h-24" /></Field>
              <Field label="Background image URL" example="Optional campaign image URL"><input value={launch.backgroundImage} onChange={(event) => update('backgroundImage', event.target.value)} className="studio-input" /></Field>
            </div>
          </AdminPanel>
        </div>

        <div className="space-y-5">
          <AdminPanel title="Preview" description="Use the preview to understand the customer-facing page before locking the store." actions={(
            <div className="flex rounded-full border border-[#E4D6C5] bg-[#FAF5EE] p-1">
              <button onClick={() => setPreviewMode('desktop')} className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${previewMode === 'desktop' ? 'bg-[#231916] text-[#FFFDF8]' : 'text-[#6F5D50]'}`}><Globe2 className="mr-1 inline h-3.5 w-3.5" /> Desktop</button>
              <button onClick={() => setPreviewMode('mobile')} className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${previewMode === 'mobile' ? 'bg-[#231916] text-[#FFFDF8]' : 'text-[#6F5D50]'}`}><Smartphone className="mr-1 inline h-3.5 w-3.5" /> Mobile</button>
            </div>
          )}>
            <PreviewCard launch={launch} mode={previewMode} />
          </AdminPanel>

          <AdminPanel title="Display Options" description="Hide or show public page modules without deleting the content.">
            <div className="grid gap-3">
              <ToggleRow label="Show notify form" example="Collect phone or email from interested customers." checked={launch.showNotifyForm} onChange={(value) => update('showNotifyForm', value)} />
              <ToggleRow label="Show social links" example="Display WhatsApp and Instagram actions on the launch page." checked={launch.showSocialLinks} onChange={(value) => update('showSocialLinks', value)} />
            </div>
          </AdminPanel>

          <AdminPanel title="Quick Actions" description="Operational actions for the launch period.">
            <div className="grid gap-2">
              <a href="/opening-soon" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-[#E4D6C5] bg-white px-4 py-3 text-sm font-bold text-[#231916] hover:border-[#D6B58F]">Open public preview <ExternalLink className="h-4 w-4" /></a>
              <a href={buildWhatsAppUrl('201037141322', launch.whatsappMessage)} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-[#E4D6C5] bg-white px-4 py-3 text-sm font-bold text-[#231916] hover:border-[#D6B58F]">Test WhatsApp CTA <MessageCircle className="h-4 w-4" /></a>
              <button onClick={disableLaunch} className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 hover:border-red-300">Disable Launch Mode <ShieldCheck className="h-4 w-4" /></button>
            </div>
          </AdminPanel>
        </div>
      </div>

      <AdminPanel title="Launch Subscribers" description="People who submitted the Opening Soon notify form. They can be exported, contacted, or archived." actions={<button onClick={exportSubscribers} disabled={!subscribers.length} className="inline-flex items-center gap-2 rounded-full border border-[#E4D6C5] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#6F5D50] disabled:opacity-50"><Download className="h-4 w-4" /> Export CSV</button>}>
        {subscribers.length === 0 ? (
          <AdminEmptyBlock title="No subscribers yet" description="When customers submit the Opening Soon notify form, they will appear here with contact actions and status controls." />
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-[#E4D6C5]">
            <div className="grid grid-cols-[1.1fr_1fr_.8fr_.8fr_1fr] bg-[#FAF5EE] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#8E7664] max-lg:hidden">
              <span>Customer</span><span>Contact</span><span>Status</span><span>Source</span><span>Actions</span>
            </div>
            <div className="divide-y divide-[#EFE5D9]">
              {subscribers.map((subscriber) => (
                <div key={subscriber.id} className="grid gap-3 px-4 py-4 text-sm text-[#231916] lg:grid-cols-[1.1fr_1fr_.8fr_.8fr_1fr] lg:items-center">
                  <div><p className="font-black">{subscriber.name || 'Launch subscriber'}</p><p className="mt-1 text-xs text-[#8E7664]">{subscriber.createdAt.toLocaleString('en-GB')}</p></div>
                  <div className="break-all text-[#6F5D50]">{subscriber.contact}</div>
                  <div><AdminStatusPill tone={subscriber.status === 'active' ? 'good' : subscriber.status === 'contacted' ? 'info' : 'neutral'}>{subscriber.status}</AdminStatusPill></div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#8E7664]">{subscriber.source}</div>
                  <div className="flex flex-wrap gap-2">
                    <a href={buildWhatsAppUrl('201037141322', `Hello NEXORA, I joined the launch list with ${subscriber.contact}.`)} target="_blank" rel="noreferrer" className="rounded-full border border-[#D6B58F] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#8C634B]">WhatsApp</a>
                    <button onClick={() => markSubscriber(subscriber.id, 'contacted')} className="rounded-full border border-[#E4D6C5] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#6F5D50]">Contacted</button>
                    <button onClick={() => markSubscriber(subscriber.id, 'archived')} className="rounded-full border border-[#E4D6C5] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#6F5D50]">Archive</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </AdminPanel>

      <div className="flex flex-wrap gap-2">
        <AdminActionLink to="/nexora-admin/controls">Open Store Readiness</AdminActionLink>
        <AdminActionLink to="/nexora-admin/dashboard">Open Dashboard</AdminActionLink>
      </div>
    </AdminPageShell>
  );
}
