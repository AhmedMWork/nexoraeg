import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

export function AdminDataErrorCard({ title = 'Could not load this admin section.', message, onRetry, action }: { title?: string; message?: string; onRetry?: () => void; action?: ReactNode }) {
  return (
    <div className="rounded-[28px] border border-red-200 bg-red-50/80 p-6 text-[#231916] shadow-[0_18px_45px_rgba(127,29,29,.06)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-red-600 shadow-sm"><AlertTriangle className="h-5 w-5" /></span>
          <div>
            <h2 className="text-base font-black tracking-[-0.03em]">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-red-800/75">{message || 'Retry the request. If this keeps happening, open Store Readiness and check Supabase functions and migrations.'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {onRetry && <button onClick={onRetry} className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-red-700 hover:border-red-300"><RefreshCw className="h-4 w-4" /> Retry</button>}
          {action}
        </div>
      </div>
    </div>
  );
}

export function AdminSkeletonPanel({ label = 'Loading admin data...' }: { label?: string }) {
  return (
    <div className="rounded-[30px] border border-[#E4D6C5] bg-[#FFFDF8] p-6 shadow-[0_18px_55px_rgba(43,33,29,.05)]">
      <div className="mb-5 h-4 w-48 animate-pulse rounded-full bg-[#E8DCCB]" />
      <div className="grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-[24px] bg-[#F2E7D8]" />)}
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#8E7664]">{label}</p>
    </div>
  );
}
