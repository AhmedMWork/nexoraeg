/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, CreditCard, Database, KeyRound, PlugZap, RefreshCw, ShieldCheck, Trash2, Truck, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminPageHeader, AdminStatCard, AdminTabBar } from '@/components/admin/AdminPageHeader';
import { clearStudioToken, supabaseUrl } from '@/lib/supabase/client';
import { DEFAULT_PAYMENT_SETTINGS, normalizePaymentSettings, type PaymentSettings } from '@/lib/payments';

const tabs = ['Launch Checklist', 'Payments', 'Integrations', 'Environment', 'Privacy', 'Recovery'];

function CheckRow({ check }: { check: any }) {
  const Icon = check.status === 'ok' ? CheckCircle2 : check.status === 'warn' ? AlertTriangle : XCircle;
  const cls = check.status === 'ok' ? 'text-emerald-600' : check.status === 'warn' ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="rounded-[22px] border border-[#e6ded1] bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <Icon className={`mt-0.5 h-5 w-5 ${cls}`} />
          <div>
            <h3 className="text-sm font-semibold text-[#2b211d]">{check.label}</h3>
            <p className="mt-1 text-xs leading-6 text-[#8a8175]">{check.message}</p>
            {check.fix && <p className="mt-2 rounded-2xl border border-[#d7b98e]/30 bg-[#fbf7ef] p-3 text-xs leading-6 text-[#8a6c3d]">Fix: {check.fix}</p>}
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${check.status === 'ok' ? 'border-emerald-400/40 bg-emerald-50 text-emerald-700' : check.status === 'warn' ? 'border-amber-400/40 bg-amber-50 text-amber-700' : 'border-red-400/40 bg-red-50 text-red-700'}`}>{check.status}</span>
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

  const load = async () => {
    setLoading(true);
    try {
      const { getStudioHealthCheck, getSiteSettings } = await import('@/lib/supabase/db');
      setHealth(await getStudioHealthCheck());
      const settings = await getSiteSettings().catch(() => null);
      setMetaPixelId(settings?.metaPixelId || settings?.paymentSettings?.metaPixelId || '');
      setMetaPixelEnabled(Boolean(settings?.metaPixelEnabled || settings?.paymentSettings?.metaPixelEnabled));
      setPaymentSettings(normalizePaymentSettings(settings?.paymentSettings as Record<string, unknown> | undefined));
    } catch (error) {
      setHealth({ score: 0, failed: 1, warnings: 0, checks: [{ key: 'health', label: 'Health check function', status: 'fail', message: error instanceof Error ? error.message : 'Could not run health check.', fix: 'Deploy studio-health-check function and clear Studio session.' }] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const summary = useMemo(() => ({
    score: Number(health?.score || 0),
    failed: Number(health?.failed || 0),
    warnings: Number(health?.warnings || 0),
    ok: (health?.checks || []).filter((c: any) => c.status === 'ok').length,
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

  const clearSession = () => {
    clearStudioToken();
    toast.success('Studio session cleared. Reloading...');
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Controls & launch checklist"
        description="Setup status, integrations, environment checks, privacy controls, and recovery actions."
        actions={<button onClick={load} className="nexora-button flex items-center gap-2" disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Run checks</button>}
      />

      <AdminTabBar tabs={tabs} active={active} onChange={setActive} />

      {active === 'Launch Checklist' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <AdminStatCard label="Setup score" value={`${summary.score}%`} helper="Weighted health across env, DB tables, secrets and shipping." tone={summary.failed ? 'danger' : summary.warnings ? 'warn' : 'good'} />
            <AdminStatCard label="Passed" value={summary.ok} helper="Checks ready for production use." tone="good" />
            <AdminStatCard label="Warnings" value={summary.warnings} helper="Not blocking, but should be completed before ads." tone={summary.warnings ? 'warn' : 'good'} />
            <AdminStatCard label="Failed" value={summary.failed} helper="Must be fixed before relying on admin operations." tone={summary.failed ? 'danger' : 'good'} />
          </div>
          <div className="studio-card p-5">
            <div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#9a8461]" /><h2 className="text-base font-semibold text-[#2b211d]">Exact setup checks</h2></div>
            <div className="space-y-3">{(health?.checks || []).map((check: any) => <CheckRow key={check.key} check={check} />)}</div>
          </div>
        </div>
      )}

      {active === 'Payments' && (
        <div className="space-y-4">
          <div className="studio-card p-5">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2"><CreditCard className="h-5 w-5 text-[#9a8461]" /><h2 className="font-semibold text-[#2b211d]">Payment methods</h2></div>
                <p className="text-sm leading-7 text-[#8a8175]">Control available checkout payment methods and the customer-facing manual payment instructions.</p>
              </div>
              <button onClick={savePaymentSettings} className="nexora-button">Save payment settings</button>
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
                  <input type="checkbox" checked={Boolean(paymentSettings[field as keyof PaymentSettings])} onChange={(e) => updatePaymentField(field as keyof PaymentSettings, e.target.checked as never)} />
                </label>
              ))}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="text-xs font-semibold text-[#5f584f]">Transfer number<input value={paymentSettings.transferNumber} onChange={(e) => updatePaymentField('transferNumber', e.target.value)} className="studio-input mt-2" /></label>
              <label className="text-xs font-semibold text-[#5f584f]">Confirmation phone<input value={paymentSettings.confirmationPhone} onChange={(e) => updatePaymentField('confirmationPhone', e.target.value)} className="studio-input mt-2" /></label>
              <label className="text-xs font-semibold text-[#5f584f]">WhatsApp number<input value={paymentSettings.whatsappConfirmationNumber} onChange={(e) => updatePaymentField('whatsappConfirmationNumber', e.target.value)} className="studio-input mt-2" /></label>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="flex items-center gap-2 rounded-2xl border border-[#e6ded1] bg-white p-3 text-xs text-[#5f584f]"><input type="checkbox" checked={paymentSettings.codFeeEnabled} onChange={(e) => updatePaymentField('codFeeEnabled', e.target.checked)} /> Add COD fee only to COD orders</label>
              <label className="flex items-center gap-2 rounded-2xl border border-[#e6ded1] bg-white p-3 text-xs text-[#5f584f]"><input type="checkbox" checked={paymentSettings.requireScreenshotInstapay} onChange={(e) => updatePaymentField('requireScreenshotInstapay', e.target.checked)} /> Instapay screenshot required</label>
              <label className="flex items-center gap-2 rounded-2xl border border-[#e6ded1] bg-white p-3 text-xs text-[#5f584f]"><input type="checkbox" checked={paymentSettings.requireScreenshotVodafone} onChange={(e) => updatePaymentField('requireScreenshotVodafone', e.target.checked)} /> Vodafone screenshot required</label>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="studio-card p-5 text-xs font-semibold text-[#5f584f]">COD instructions<textarea value={paymentSettings.codInstructionsAr} onChange={(e) => updatePaymentField('codInstructionsAr', e.target.value)} className="studio-input mt-2 min-h-28" /></label>
            <label className="studio-card p-5 text-xs font-semibold text-[#5f584f]">Instapay instructions<textarea value={paymentSettings.instapayInstructionsAr} onChange={(e) => updatePaymentField('instapayInstructionsAr', e.target.value)} className="studio-input mt-2 min-h-28" /></label>
            <label className="studio-card p-5 text-xs font-semibold text-[#5f584f]">Vodafone Cash instructions<textarea value={paymentSettings.vodafoneInstructionsAr} onChange={(e) => updatePaymentField('vodafoneInstructionsAr', e.target.value)} className="studio-input mt-2 min-h-28" /></label>
            <label className="studio-card p-5 text-xs font-semibold text-[#5f584f]">ValU instructions<textarea value={paymentSettings.valuInstructionsAr} onChange={(e) => updatePaymentField('valuInstructionsAr', e.target.value)} className="studio-input mt-2 min-h-28" /></label>
          </div>
        </div>
      )}

      {active === 'Integrations' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="studio-card p-5">
            <div className="mb-3 flex items-center gap-2"><Truck className="h-5 w-5 text-[#9a8461]" /><h2 className="font-semibold text-[#2b211d]">ShipBlu</h2></div>
            <p className="text-sm leading-7 text-[#8a8175]">ShipBlu is active only when the API key exists in Supabase Secrets and zones have provider IDs.</p>
            <button onClick={() => copyCommand('supabase secrets set SHIPBLU_API_KEY="YOUR_SHIPBLU_API_KEY"')} className="nexora-button mt-4 flex items-center gap-2"><Copy className="h-4 w-4" /> Copy ShipBlu secret command</button>
          </div>
          <div className="studio-card p-5">
            <div className="mb-3 flex items-center gap-2"><PlugZap className="h-5 w-5 text-[#9a8461]" /><h2 className="font-semibold text-[#2b211d]">Edge Functions</h2></div>
            <p className="text-sm leading-7 text-[#8a8175]">After migrations or secret changes, redeploy functions.</p>
            <button onClick={() => copyCommand('powershell -ExecutionPolicy Bypass -File .\\scripts\\deploy-supabase-functions.ps1 -ProjectRef ccmuazjkgzjqzybxwrfd')} className="nexora-button mt-4 flex items-center gap-2"><Copy className="h-4 w-4" /> Copy deploy command</button>
          </div>
          <div className="studio-card p-5 lg:col-span-2">
            <div className="mb-3 flex items-center gap-2"><PlugZap className="h-5 w-5 text-[#9a8461]" /><h2 className="font-semibold text-[#2b211d]">Meta Pixel</h2></div>
            <p className="text-sm leading-7 text-[#8a8175]">Track PageView, ViewContent, AddToCart, InitiateCheckout and Purchase for Facebook/Instagram ads.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
              <input value={metaPixelId} onChange={(e) => setMetaPixelId(e.target.value)} placeholder="Meta Pixel ID" className="studio-input" />
              <label className="flex items-center gap-2 text-sm text-[#2b211d]"><input type="checkbox" checked={metaPixelEnabled} onChange={(e) => setMetaPixelEnabled(e.target.checked)} /> Enabled</label>
              <button onClick={saveMetaPixel} className="nexora-button">Save Pixel</button>
            </div>
          </div>
        </div>
      )}

      {active === 'Environment' && (
        <div className="studio-card p-5">
          <div className="mb-3 flex items-center gap-2"><KeyRound className="h-5 w-5 text-[#9a8461]" /><h2 className="font-semibold text-[#2b211d]">Vercel public env</h2></div>
          <div className="space-y-3 text-sm text-[#8a8175]">
            <p>Current browser Supabase URL: <span className="text-[#2b211d]">{supabaseUrl}</span></p>
            <p>Correct format: <span className="text-[#2b211d]">https://ccmuazjkgzjqzybxwrfd.supabase.co</span></p>
            <p>Must not include <span className="text-red-600">/rest/v1</span> or <span className="text-red-600">/functions/v1</span>.</p>
          </div>
          <button onClick={() => copyCommand('VITE_SUPABASE_URL=https://ccmuazjkgzjqzybxwrfd.supabase.co')} className="nexora-button mt-4 flex items-center gap-2"><Copy className="h-4 w-4" /> Copy correct env</button>
        </div>
      )}

      {active === 'Privacy' && (
        <div className="studio-card p-5">
          <h2 className="font-semibold text-[#2b211d]">Privacy and tracking controls</h2>
          <p className="mt-2 text-sm leading-7 text-[#8a8175]">Keep tracking transparent and only enable ad integrations when privacy copy is ready.</p>
        </div>
      )}

      {active === 'Recovery' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="studio-card p-5">
            <div className="mb-3 flex items-center gap-2"><Trash2 className="h-5 w-5 text-amber-600" /><h2 className="font-semibold text-[#2b211d]">Clear local Studio session</h2></div>
            <p className="text-sm leading-7 text-[#8a8175]">Use this if Studio token is expired after changing secrets or redeploying functions.</p>
            <button onClick={clearSession} className="nexora-button mt-4">Clear session and reload</button>
          </div>
          <div className="studio-card p-5">
            <div className="mb-3 flex items-center gap-2"><Database className="h-5 w-5 text-[#9a8461]" /><h2 className="font-semibold text-[#2b211d]">Database recovery</h2></div>
            <p className="text-sm leading-7 text-[#8a8175]">If checks say tables/RPC are missing, push migrations again.</p>
            <button onClick={() => copyCommand('supabase db push')} className="nexora-button mt-4 flex items-center gap-2"><Copy className="h-4 w-4" /> Copy db push</button>
          </div>
        </div>
      )}
    </div>
  );
}
