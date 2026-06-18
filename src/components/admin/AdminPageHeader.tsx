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
    <div className="flex flex-col gap-4 rounded-[28px] border border-[#2E3442] bg-[#171A21] p-5 shadow-[0_24px_70px_rgba(0,0,0,.26)] lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-3xl">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#D7B98E]">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#F5F1EA] lg:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-7 text-[#A7AEBB]">{description}</p>
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
    default: 'border-[#2E3442] text-[#D7B98E]',
    good: 'border-emerald-400/30 text-emerald-300',
    warn: 'border-amber-400/30 text-amber-300',
    danger: 'border-red-400/30 text-red-300',
  }[tone];
  return (
    <div className={`rounded-[24px] border bg-[#171A21] p-5 ${toneClasses}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A7AEBB]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[#F5F1EA]">{value}</p>
      <p className="mt-2 text-xs leading-6 text-[#A7AEBB]">{helper}</p>
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
    neutral: 'border-[#2E3442] bg-[#11141A]',
    good: 'border-emerald-400/25 bg-emerald-400/8',
    warn: 'border-amber-400/25 bg-amber-400/8',
    danger: 'border-red-400/25 bg-red-400/8',
  }[status];
  return (
    <div className={`rounded-[22px] border p-4 ${statusClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#F5F1EA]">{title}</h3>
          <p className="mt-1 text-xs leading-6 text-[#A7AEBB]">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

export function AdminTabBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (tab: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-[22px] border border-[#2E3442] bg-[#11141A] p-2">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`whitespace-nowrap rounded-2xl px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] transition ${active === tab ? 'bg-[#D7B98E] text-[#11141A]' : 'text-[#A7AEBB] hover:bg-[#1F2430] hover:text-[#F5F1EA]'}`}
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
