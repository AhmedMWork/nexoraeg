/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Copy, ShieldCheck, KeyRound, Truck, Database, PlugZap, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminPageHeader, AdminStatCard, AdminTabBar } from '@/components/admin/AdminPageHeader';
import { clearStudioToken, supabaseUrl } from '@/lib/supabase/client';

const tabs = ['Launch Checklist', 'Integrations', 'Environment', 'Privacy', 'Recovery'];

function CheckRow({ check }: { check: any }) {
  const Icon = check.status === 'ok' ? CheckCircle2 : check.status === 'warn' ? AlertTriangle : XCircle;
  const cls = check.status === 'ok' ? 'text-emerald-300' : check.status === 'warn' ? 'text-amber-300' : 'text-red-300';
  return (
    <div className="rounded-[22px] border border-[#2E3442] bg-[#11141A] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <Icon className={`mt-0.5 h-5 w-5 ${cls}`} />
          <div>
            <h3 className="text-sm font-semibold text-[#F5F1EA]">{check.label}</h3>
            <p className="mt-1 text-xs leading-6 text-[#A7AEBB]">{check.message}</p>
            {check.fix && <p className="mt-2 rounded-2xl border border-[#D7B98E]/20 bg-[#D7B98E]/8 p-3 text-xs leading-6 text-[#E8D1B6]">Fix: {check.fix}</p>}
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${check.status === 'ok' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : check.status === 'warn' ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>{check.status}</span>
      </div>
    </div>
  );
}

export default function AdminControls() {
  const [active, setActive] = useState(tabs[0]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { getStudioHealthCheck } = await import('@/lib/supabase/db');
      setHealth(await getStudioHealthCheck());
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

  const clearSession = () => {
    clearStudioToken();
    toast.success('Studio session cleared. Reloading...');
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Controls & launch checklist"
        description="The owner-friendly place for setup status, integrations, environment checks, privacy controls, and recovery actions. This page exists to stop vague Edge Function errors."
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
            <div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#D7B98E]" /><h2 className="text-base font-semibold text-[#F5F1EA]">Exact setup checks</h2></div>
            <div className="space-y-3">
              {(health?.checks || []).map((check: any) => <CheckRow key={check.key} check={check} />)}
            </div>
          </div>
        </div>
      )}

      {active === 'Integrations' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="studio-card p-5">
            <div className="mb-3 flex items-center gap-2"><Truck className="h-5 w-5 text-[#D7B98E]" /><h2 className="font-semibold">ShipBlu</h2></div>
            <p className="text-sm leading-7 text-[#A7AEBB]">ShipBlu is real only when the API key exists in Supabase Secrets and every active zone has a ShipBlu zone ID. Buttons stay disabled or show clear reasons when setup is incomplete.</p>
            <button onClick={() => copyCommand('supabase secrets set SHIPBLU_API_KEY="YOUR_SHIPBLU_API_KEY"')} className="nexora-button mt-4 flex items-center gap-2"><Copy className="h-4 w-4" /> Copy ShipBlu secret command</button>
          </div>
          <div className="studio-card p-5">
            <div className="mb-3 flex items-center gap-2"><PlugZap className="h-5 w-5 text-[#D7B98E]" /><h2 className="font-semibold">Edge Functions</h2></div>
            <p className="text-sm leading-7 text-[#A7AEBB]">V5.5 adds diagnostics instead of hiding failures behind non-2xx. After any secret change, redeploy functions.</p>
            <button onClick={() => copyCommand('powershell -ExecutionPolicy Bypass -File .\\scripts\\deploy-supabase-functions.ps1 -ProjectRef ccmuazjkgzjqzybxwrfd')} className="nexora-button mt-4 flex items-center gap-2"><Copy className="h-4 w-4" /> Copy deploy command</button>
          </div>
        </div>
      )}

      {active === 'Environment' && (
        <div className="studio-card p-5">
          <div className="mb-3 flex items-center gap-2"><KeyRound className="h-5 w-5 text-[#D7B98E]" /><h2 className="font-semibold">Vercel public env</h2></div>
          <div className="space-y-3 text-sm text-[#A7AEBB]">
            <p>Current browser Supabase URL: <span className="text-[#F5F1EA]">{supabaseUrl}</span></p>
            <p>Correct format: <span className="text-[#F5F1EA]">https://ccmuazjkgzjqzybxwrfd.supabase.co</span></p>
            <p>Must not include <span className="text-red-300">/rest/v1</span> or <span className="text-red-300">/functions/v1</span>.</p>
          </div>
          <button onClick={() => copyCommand('VITE_SUPABASE_URL=https://ccmuazjkgzjqzybxwrfd.supabase.co')} className="nexora-button mt-4 flex items-center gap-2"><Copy className="h-4 w-4" /> Copy correct env</button>
        </div>
      )}

      {active === 'Privacy' && (
        <div className="studio-card p-5">
          <h2 className="font-semibold">Privacy and tracking controls</h2>
          <p className="mt-2 text-sm leading-7 text-[#A7AEBB]">V5.5 keeps tracking transparent: visitors are actions and sessions, not guaranteed unique people. Add privacy retention rules and only enable advanced ad integrations when consent and policy are ready.</p>
        </div>
      )}

      {active === 'Recovery' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="studio-card p-5">
            <div className="mb-3 flex items-center gap-2"><Trash2 className="h-5 w-5 text-amber-300" /><h2 className="font-semibold">Clear local Studio session</h2></div>
            <p className="text-sm leading-7 text-[#A7AEBB]">Use this if Studio token is expired after changing STUDIO_SESSION_SECRET or redeploying functions.</p>
            <button onClick={clearSession} className="nexora-button mt-4">Clear session and reload</button>
          </div>
          <div className="studio-card p-5">
            <div className="mb-3 flex items-center gap-2"><Database className="h-5 w-5 text-[#D7B98E]" /><h2 className="font-semibold">Database recovery</h2></div>
            <p className="text-sm leading-7 text-[#A7AEBB]">If checks say tables/RPC are missing, push migrations again.</p>
            <button onClick={() => copyCommand('supabase db push')} className="nexora-button mt-4 flex items-center gap-2"><Copy className="h-4 w-4" /> Copy db push</button>
          </div>
        </div>
      )}
    </div>
  );
}
