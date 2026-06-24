/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Copy, CreditCard, Database, Eye, PlugZap, RefreshCw, Rocket, ShieldCheck, Trash2, Truck, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminPageHeader, AdminStatCard, AdminTabBar } from '@/components/admin/AdminPageHeader';
import { clearStudioToken } from '@/lib/supabase/client';
import { DEFAULT_PAYMENT_SETTINGS, normalizePaymentSettings, type PaymentSettings } from '@/lib/payments';
import type { SiteSettings } from '@/types';

const tabs = ['Store Readiness', 'Payments', 'Integrations', 'Privacy', 'Recovery'];


const DEFAULT_LAUNCH_SETTINGS: NonNullable<SiteSettings['launchSettings']> = {
  enabled: false,
  launchAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 16),
  timezone: 'Africa/Cairo',
  autoOpen: true,
  title: 'NEXORA is Opening Soon',
  subtitle: 'A new premium shopping experience is almost here.',
  eyebrow: 'Premium launch experience',
  announcement: 'We are preparing new drops, smoother checkout, and a better shopping journey.',
  buttonText: 'Contact us on WhatsApp',
  whatsappMessage: 'Hello NEXORA, I would like to know more about the launch.',
  backgroundImage: '',
  showCountdown: true,
  showNotifyForm: true,
  showSocialLinks: true,
  allowAdminBypass: true,
  notifySuccessMessage: 'You are on the launch list. We will contact you when NEXORA opens.',
};

function toInputDateTime(value?: string) {
  if (!value) return DEFAULT_LAUNCH_SETTINGS.launchAt || '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DEFAULT_LAUNCH_SETTINGS.launchAt || '';
  return date.toISOString().slice(0, 16);
}

function statusLabel(status?: string) {
  if (status === 'ok') return 'Ready';
  if (status === 'warn') return 'Warning';
  return 'Needs Fix';
}

function cleanTechnicalText(value: unknown) {
  return String(value || '')
    .replace(/environment|env/gi, 'connection settings')
    .replace(/VITE_[A-Z0-9_]+/g, 'connection setting')
    .replace(/SUPABASE_[A-Z0-9_]+/g, 'Supabase setting');
}

function friendlyCheckLabel(label?: string) {
  const raw = String(label || 'System check');
  const map: Record<string, string> = {
    'Health check function': 'System health check',
    'Supabase URL': 'Database connection',
    'Database tables': 'Database tables',
    'Shipping settings': 'Shipping settings',
    'Studio token': 'Admin session',
    'Edge Functions': 'Edge functions',
  };
  return map[raw] || cleanTechnicalText(raw);
}

function CheckRow({ check }: { check: any }) {
  const Icon = check.status === 'ok' ? CheckCircle2 : check.status === 'warn' ? AlertTriangle : XCircle;
  const cls = check.status === 'ok' ? 'text-emerald-600' : check.status === 'warn' ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="rounded-[22px] border border-[#e6ded1] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(43,33,29,.07)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <Icon className={`mt-0.5 h-5 w-5 ${cls}`} />
          <div>
            <h3 className="text-sm font-semibold text-[#2b211d]">{friendlyCheckLabel(check.label)}</h3>
            <p className="mt-1 text-xs leading-6 text-[#8a8175]">{cleanTechnicalText(check.message)}</p>
            {check.fix && <p className="mt-2 rounded-2xl border border-[#d7b98e]/30 bg-[#fbf7ef] p-3 text-xs leading-6 text-[#8a6c3d]">Suggested action: {cleanTechnicalText(check.fix)}</p>}
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${check.status === 'ok' ? 'border-emerald-400/40 bg-emerald-50 text-emerald-700' : check.status === 'warn' ? 'border-amber-400/40 bg-amber-50 text-amber-700' : 'border-red-400/40 bg-red-50 text-red-700'}`}>{statusLabel(check.status)}</span>
      </div>
    </div>
  );
}

export default function AdminControls() {
  const [active, setActive] = useState(tabs[0]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [metaPixelId, setMetaPixelId] = useState('');
  const [metaPixelEnabled, setMetaPixelEnabled] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [launchSettings, setLaunchSettings] = useState<NonNullable<SiteSettings['launchSettings']>>(DEFAULT_LAUNCH_SETTINGS);

  const load = async () => {
    setLoading(true);
    try {
      const { getStudioHealthCheck, getSiteSettings } = await import('@/lib/supabase/db');
      setHealth(await getStudioHealthCheck());
      const settings = await getSiteSettings().catch(() => null);
      setMetaPixelId(settings?.metaPixelId || settings?.paymentSettings?.metaPixelId || '');
      setMetaPixelEnabled(Boolean(settings?.metaPixelEnabled || settings?.paymentSettings?.metaPixelEnabled));
      setPaymentSettings(normalizePaymentSettings(settings?.paymentSettings as Record<string, unknown> | undefined));
      setLaunchSettings({ ...DEFAULT_LAUNCH_SETTINGS, ...(settings?.launchSettings || {}), launchAt: toInputDateTime(settings?.launchSettings?.launchAt) });
    } catch (error) {
      setHealth({ score: 0, failed: 1, warnings: 0, checks: [{ key: 'health', label: 'System health check', status: 'fail', message: error instanceof Error ? error.message : 'Could not run readiness check.', fix: 'Redeploy admin functions, then sign in again.' }] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const summary = useMemo(() => ({
    score: Number(health?.score || 0),
    failed: Number(health?.failed || 0),
    warnings: Number(health?.warnings || 0),
    ok: (health?.checks || []).filter((check: any) => check.status === 'ok').length,
  }), [health]);

  const copyCommand = async (command: string) => {
    await navigator.clipboard.writeText(command);
    toast.success('Command copied');
  };

  const saveMetaPixel = async () => {
    try {
      const { updateSiteSettings } = await import('@/lib/supabase/db');
      await updateSiteSettings({
        metaPixelEnabled,
        metaPixelId: metaPixelId.trim(),
        paymentSettings: { metaPixelEnabled, metaPixelId: metaPixelId.trim() },
      } as any);
      toast.success('Meta Pixel settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save Meta Pixel settings');
    }
  };

  const updatePaymentField = <K extends keyof PaymentSettings>(field: K, value: PaymentSettings[K]) => {
    setPaymentSettings((current) => ({ ...current, [field]: value }));
  };

  const savePaymentSettings = async () => {
    try {
      const { updateSiteSettings } = await import('@/lib/supabase/db');
      await updateSiteSettings({ paymentSettings } as any);
      toast.success('Payment settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save payment settings');
    }
  };


  const updateLaunchField = <K extends keyof NonNullable<SiteSettings['launchSettings']>>(field: K, value: NonNullable<SiteSettings['launchSettings']>[K]) => {
    setLaunchSettings((current) => ({ ...current, [field]: value }));
  };

  const saveLaunchSettings = async () => {
    try {
      const { updateSiteSettings } = await import('@/lib/supabase/db');
      const launchAt = launchSettings.launchAt ? new Date(launchSettings.launchAt).toISOString() : DEFAULT_LAUNCH_SETTINGS.launchAt;
      await updateSiteSettings({ launchSettings: { ...launchSettings, launchAt } } as any);
      toast.success('Launch mode settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save launch mode settings');
    }
  };

  const clearSession = () => {
    clearStudioToken();
    toast.success('Admin session cleared. The page will reload.');
    window.location.reload();
  };

  return (
    <div className="space-y-6" dir="ltr">
      <AdminPageHeader
        title="Store Readiness & Controls"
        description="A simplified command center for store readiness, payments, integrations, privacy, and session recovery without exposing technical environment keys."
        actions={<button onClick={load} className="nexora-button flex items-center gap-2" disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Run Check</button>}
      />

      <AdminTabBar tabs={tabs} active={active} onChange={setActive} />

      {active === 'Store Readiness' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <AdminStatCard label="Readiness Score" value={`${summary.score}%`} helper="Overall store, orders, payments, and shipping readiness." tone={summary.failed ? 'danger' : summary.warnings ? 'warn' : 'good'} />
            <AdminStatCard label="Ready" value={summary.ok} helper="Checks working correctly." tone="good" />
            <AdminStatCard label="Warnings" value={summary.warnings} helper="Not blocking, but worth reviewing." tone={summary.warnings ? 'warn' : 'good'} />
            <AdminStatCard label="Issues" value={summary.failed} helper="Needs attention before relying on operations." tone={summary.failed ? 'danger' : 'good'} />
          </div>
          <div className="rounded-[28px] border border-[#e6ded1] bg-white p-5 shadow-[0_18px_45px_rgba(43,33,29,.04)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f2e7d8] text-[#9a8461]"><Rocket className="h-5 w-5" /></span>
                <div>
                  <h2 className="text-base font-black tracking-[-0.03em] text-[#2b211d]">Launch Mode is now managed separately</h2>
                  <p className="mt-1 text-sm leading-6 text-[#8a8175]">Example: use Launch Mode to lock the storefront, edit the Opening Soon countdown, export subscribers, and verify that settings persist after refresh.</p>
                </div>
              </div>
              <a href="/nexora-admin/launch" className="nexora-button inline-flex items-center justify-center">Open Launch Mode</a>
            </div>
          </div>

          <div className="studio-card p-5">
            <div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#9a8461]" /><h2 className="text-base font-semibold text-[#2b211d]">Store readiness checks</h2></div>
            <div className="space-y-3">{(health?.checks || []).map((check: any) => <CheckRow key={check.key} check={check} />)}</div>
          </div>
        </div>
      )}


      {active === 'Launch Mode' && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[34px] border border-[#d9c9ad] bg-[#171210] text-[#fff8ec] shadow-[0_30px_90px_rgba(43,33,29,.18)]">
            <div className="relative p-6 md:p-8">
              <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#d6b58f]/25 blur-3xl" />
              <div className="absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-[#d09a82]/20 blur-3xl" />
              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#d6b58f]/30 bg-white/[.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#d6b58f]"><Rocket className="h-4 w-4" /> Opening Soon Control</div>
                  <h2 className="max-w-2xl text-3xl font-black tracking-[-0.05em] md:text-5xl">Lock the storefront with a premium countdown.</h2>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-[#d8c7b0]">Admins stay fully active. Customers see the launch page until the countdown ends or you disable Launch Mode.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
                  <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.06] p-4 text-sm text-[#fff8ec]"><span>Launch Mode</span><input type="checkbox" checked={Boolean(launchSettings.enabled)} onChange={(event) => updateLaunchField('enabled', event.target.checked)} /></label>
                  <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.06] p-4 text-sm text-[#fff8ec]"><span>Auto-open</span><input type="checkbox" checked={Boolean(launchSettings.autoOpen)} onChange={(event) => updateLaunchField('autoOpen', event.target.checked)} /></label>
                  <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.06] p-4 text-sm text-[#fff8ec]"><span>Countdown</span><input type="checkbox" checked={Boolean(launchSettings.showCountdown)} onChange={(event) => updateLaunchField('showCountdown', event.target.checked)} /></label>
                  <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.06] p-4 text-sm text-[#fff8ec]"><span>Notify form</span><input type="checkbox" checked={Boolean(launchSettings.showNotifyForm)} onChange={(event) => updateLaunchField('showNotifyForm', event.target.checked)} /></label>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
            <div className="studio-card p-5">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2"><CalendarClock className="h-5 w-5 text-[#9a8461]" /><h2 className="font-semibold text-[#2b211d]">Launch schedule & copy</h2></div>
                  <p className="text-sm leading-7 text-[#8a8175]">Control the countdown, headline, message, and the customer call-to-action.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href="/opening-soon" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[#d6c5a8] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#2b211d] transition hover:-translate-y-0.5 hover:border-[#b89b6d]"><Eye className="h-4 w-4" /> Preview</a>
                  <button onClick={saveLaunchSettings} className="nexora-button">Save Launch Mode</button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs font-semibold text-[#5f584f]">Launch date & time<input type="datetime-local" value={launchSettings.launchAt || ''} onChange={(event) => updateLaunchField('launchAt', event.target.value)} className="studio-input mt-2" /></label>
                <label className="text-xs font-semibold text-[#5f584f]">Timezone<input value={launchSettings.timezone || ''} onChange={(event) => updateLaunchField('timezone', event.target.value)} className="studio-input mt-2" placeholder="Africa/Cairo" /></label>
                <label className="text-xs font-semibold text-[#5f584f]">Eyebrow<input value={launchSettings.eyebrow || ''} onChange={(event) => updateLaunchField('eyebrow', event.target.value)} className="studio-input mt-2" /></label>
                <label className="text-xs font-semibold text-[#5f584f]">Button text<input value={launchSettings.buttonText || ''} onChange={(event) => updateLaunchField('buttonText', event.target.value)} className="studio-input mt-2" /></label>
              </div>
              <label className="mt-4 block text-xs font-semibold text-[#5f584f]">Title<input value={launchSettings.title || ''} onChange={(event) => updateLaunchField('title', event.target.value)} className="studio-input mt-2" /></label>
              <label className="mt-4 block text-xs font-semibold text-[#5f584f]">Subtitle<textarea value={launchSettings.subtitle || ''} onChange={(event) => updateLaunchField('subtitle', event.target.value)} className="studio-input mt-2 min-h-24" /></label>
              <label className="mt-4 block text-xs font-semibold text-[#5f584f]">Announcement<textarea value={launchSettings.announcement || ''} onChange={(event) => updateLaunchField('announcement', event.target.value)} className="studio-input mt-2 min-h-24" /></label>
            </div>

            <div className="space-y-4">
              <div className="studio-card p-5">
                <h2 className="font-semibold text-[#2b211d]">Customer actions</h2>
                <p className="mt-2 text-sm leading-7 text-[#8a8175]">Keep customers connected while the store is closed.</p>
                <label className="mt-4 block text-xs font-semibold text-[#5f584f]">WhatsApp message<textarea value={launchSettings.whatsappMessage || ''} onChange={(event) => updateLaunchField('whatsappMessage', event.target.value)} className="studio-input mt-2 min-h-24" /></label>
                <label className="mt-4 block text-xs font-semibold text-[#5f584f]">Notify success message<textarea value={launchSettings.notifySuccessMessage || ''} onChange={(event) => updateLaunchField('notifySuccessMessage', event.target.value)} className="studio-input mt-2 min-h-24" /></label>
                <label className="mt-4 block text-xs font-semibold text-[#5f584f]">Background image URL<input value={launchSettings.backgroundImage || ''} onChange={(event) => updateLaunchField('backgroundImage', event.target.value)} className="studio-input mt-2" placeholder="Optional" /></label>
              </div>
              <div className="studio-card p-5">
                <h2 className="font-semibold text-[#2b211d]">Access rules</h2>
                <div className="mt-4 grid gap-3">
                  <label className="flex items-center justify-between rounded-2xl border border-[#e6ded1] bg-white p-3 text-sm text-[#2b211d]"><span>Show social links</span><input type="checkbox" checked={Boolean(launchSettings.showSocialLinks)} onChange={(event) => updateLaunchField('showSocialLinks', event.target.checked)} /></label>
                  <label className="flex items-center justify-between rounded-2xl border border-[#e6ded1] bg-white p-3 text-sm text-[#2b211d]"><span>Admin bypass</span><input type="checkbox" checked={Boolean(launchSettings.allowAdminBypass)} onChange={(event) => updateLaunchField('allowAdminBypass', event.target.checked)} /></label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {active === 'Payments' && (
        <div className="space-y-4">
          <div className="studio-card p-5">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2"><CreditCard className="h-5 w-5 text-[#9a8461]" /><h2 className="font-semibold text-[#2b211d]">Payment methods</h2></div>
                <p className="text-sm leading-7 text-[#8a8175]">Control which payment methods appear at checkout and keep manual transfer instructions clear for customers.</p>
              </div>
              <button onClick={savePaymentSettings} className="nexora-button">Save Payment Settings</button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {[
                ['codEnabled', 'Cash on Delivery'],
                ['instapayEnabled', 'Instapay'],
                ['vodafoneCashEnabled', 'Vodafone Cash'],
                ['valuEnabled', 'ValU'],
              ].map(([field, label]) => (
                <label key={field} className="flex items-center justify-between rounded-2xl border border-[#e6ded1] bg-white p-3 text-sm text-[#2b211d]">
                  <span>{label}</span>
                  <input type="checkbox" checked={Boolean(paymentSettings[field as keyof PaymentSettings])} onChange={(event) => updatePaymentField(field as keyof PaymentSettings, event.target.checked as never)} />
                </label>
              ))}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="text-xs font-semibold text-[#5f584f]">Transfer number<input value={paymentSettings.transferNumber} onChange={(event) => updatePaymentField('transferNumber', event.target.value)} className="studio-input mt-2" dir="ltr" /></label>
              <label className="text-xs font-semibold text-[#5f584f]">Payment confirmation phone<input value={paymentSettings.confirmationPhone} onChange={(event) => updatePaymentField('confirmationPhone', event.target.value)} className="studio-input mt-2" dir="ltr" /></label>
              <label className="text-xs font-semibold text-[#5f584f]">WhatsApp confirmation number<input value={paymentSettings.whatsappConfirmationNumber} onChange={(event) => updatePaymentField('whatsappConfirmationNumber', event.target.value)} className="studio-input mt-2" dir="ltr" /></label>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="flex items-center gap-2 rounded-2xl border border-[#e6ded1] bg-white p-3 text-xs text-[#5f584f]"><input type="checkbox" checked={paymentSettings.codFeeEnabled} onChange={(event) => updatePaymentField('codFeeEnabled', event.target.checked)} /> Add COD fee only to COD orders</label>
              <label className="flex items-center gap-2 rounded-2xl border border-[#e6ded1] bg-white p-3 text-xs text-[#5f584f]"><input type="checkbox" checked={paymentSettings.requireScreenshotInstapay} onChange={(event) => updatePaymentField('requireScreenshotInstapay', event.target.checked)} /> Instapay requires screenshot</label>
              <label className="flex items-center gap-2 rounded-2xl border border-[#e6ded1] bg-white p-3 text-xs text-[#5f584f]"><input type="checkbox" checked={paymentSettings.requireScreenshotVodafone} onChange={(event) => updatePaymentField('requireScreenshotVodafone', event.target.checked)} /> Vodafone Cash requires screenshot</label>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="studio-card p-5 text-xs font-semibold text-[#5f584f]">COD instructions<textarea value={paymentSettings.codInstructionsAr} onChange={(event) => updatePaymentField('codInstructionsAr', event.target.value)} className="studio-input mt-2 min-h-28" /></label>
            <label className="studio-card p-5 text-xs font-semibold text-[#5f584f]">Instapay instructions<textarea value={paymentSettings.instapayInstructionsAr} onChange={(event) => updatePaymentField('instapayInstructionsAr', event.target.value)} className="studio-input mt-2 min-h-28" /></label>
            <label className="studio-card p-5 text-xs font-semibold text-[#5f584f]">Vodafone Cash instructions<textarea value={paymentSettings.vodafoneInstructionsAr} onChange={(event) => updatePaymentField('vodafoneInstructionsAr', event.target.value)} className="studio-input mt-2 min-h-28" /></label>
            <label className="studio-card p-5 text-xs font-semibold text-[#5f584f]">ValU instructions<textarea value={paymentSettings.valuInstructionsAr} onChange={(event) => updatePaymentField('valuInstructionsAr', event.target.value)} className="studio-input mt-2 min-h-28" /></label>
          </div>
        </div>
      )}

      {active === 'Integrations' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="studio-card p-5">
            <div className="mb-3 flex items-center gap-2"><Truck className="h-5 w-5 text-[#9a8461]" /><h2 className="font-semibold text-[#2b211d]">ShipBlu</h2></div>
            <p className="text-sm leading-7 text-[#8a8175]">Create shipments only after the courier connection and shipping zones are ready. Secret keys are not displayed here.</p>
            <button onClick={() => copyCommand('supabase functions deploy')} className="nexora-button mt-4 flex items-center gap-2"><Copy className="h-4 w-4" /> Copy functions deploy command</button>
          </div>
          <div className="studio-card p-5">
            <div className="mb-3 flex items-center gap-2"><PlugZap className="h-5 w-5 text-[#9a8461]" /><h2 className="font-semibold text-[#2b211d]">Meta Pixel</h2></div>
            <p className="text-sm leading-7 text-[#8a8175]">Enable tracking only after privacy copy is ready and campaigns are prepared.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
              <input value={metaPixelId} onChange={(event) => setMetaPixelId(event.target.value)} placeholder="Meta Pixel ID" className="studio-input" dir="ltr" />
              <label className="flex items-center gap-2 text-sm text-[#2b211d]"><input type="checkbox" checked={metaPixelEnabled} onChange={(event) => setMetaPixelEnabled(event.target.checked)} /> Enabled</label>
              <button onClick={saveMetaPixel} className="nexora-button">Save Pixel</button>
            </div>
          </div>
        </div>
      )}

      {active === 'Privacy' && (
        <div className="studio-card p-5">
          <h2 className="font-semibold text-[#2b211d]">Privacy & tracking</h2>
          <p className="mt-2 text-sm leading-7 text-[#8a8175]">Keep tracking transparent and only enable advertising tools after the privacy copy is ready.</p>
        </div>
      )}

      {active === 'Recovery' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="studio-card p-5">
            <div className="mb-3 flex items-center gap-2"><Trash2 className="h-5 w-5 text-amber-600" /><h2 className="font-semibold text-[#2b211d]">Clear admin session</h2></div>
            <p className="text-sm leading-7 text-[#8a8175]">Use this if the session expires or the admin panel behaves unexpectedly after a redeploy.</p>
            <button onClick={clearSession} className="nexora-button mt-4">Clear session and reload</button>
          </div>
          <div className="studio-card p-5">
            <div className="mb-3 flex items-center gap-2"><Database className="h-5 w-5 text-[#9a8461]" /><h2 className="font-semibold text-[#2b211d]">Database update</h2></div>
            <p className="text-sm leading-7 text-[#8a8175]">If readiness checks show missing tables or functions, push the latest database updates from your development machine.</p>
            <button onClick={() => copyCommand('supabase db push')} className="nexora-button mt-4 flex items-center gap-2"><Copy className="h-4 w-4" /> Copy database update command</button>
          </div>
        </div>
      )}
    </div>
  );
}
