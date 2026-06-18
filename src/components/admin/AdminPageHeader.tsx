import { type ReactNode } from 'react';

export function AdminPageHeader({
  eyebrow = 'NEXORA HQ',
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-[#D7C5B2] bg-[#FFFDF7] p-5 shadow-[0_24px_70px_rgba(43,33,29,.08)] lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-3xl">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#D6B58F]">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#231916] lg:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-7 text-[#735B4F]">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function AdminStatCard({
  label,
  value,
  helper,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  helper: string;
  tone?: 'default' | 'good' | 'warn' | 'danger';
}) {
  const toneClasses = {
    default: 'border-[#D7C5B2] text-[#D6B58F]',
    good: 'border-emerald-400/30 text-emerald-300',
    warn: 'border-amber-400/30 text-amber-300',
    danger: 'border-red-400/30 text-red-300',
  }[tone];
  return (
    <div className={`rounded-[24px] border bg-[#FFFDF7] p-5 ${toneClasses}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#735B4F]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[#231916]">{value}</p>
      <p className="mt-2 text-xs leading-6 text-[#735B4F]">{helper}</p>
    </div>
  );
}

export function AdminInsight({
  title,
  description,
  status = 'neutral',
  action,
}: {
  title: string;
  description: string;
  status?: 'neutral' | 'good' | 'warn' | 'danger';
  action?: ReactNode;
}) {
  const statusClass = {
    neutral: 'border-[#D7C5B2] bg-[#FAF7F2]',
    good: 'border-emerald-400/25 bg-emerald-400/8',
    warn: 'border-amber-400/25 bg-amber-400/8',
    danger: 'border-red-400/25 bg-red-400/8',
  }[status];
  return (
    <div className={`rounded-[22px] border p-4 ${statusClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#231916]">{title}</h3>
          <p className="mt-1 text-xs leading-6 text-[#735B4F]">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

export function AdminTabBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (tab: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-[22px] border border-[#D7C5B2] bg-[#FAF7F2] p-2">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`whitespace-nowrap rounded-2xl px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] transition ${active === tab ? 'bg-[#231916] text-[#FFFDF7]' : 'text-[#735B4F] hover:bg-[#F1E6D7] hover:text-[#231916]'}`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

export function SetupBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${ok ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>{label}</span>
  );
}
