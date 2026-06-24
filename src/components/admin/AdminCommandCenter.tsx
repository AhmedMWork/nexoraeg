import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ArrowUpRight, ChevronRight } from 'lucide-react';

export type AdminTone = 'neutral' | 'good' | 'warn' | 'danger' | 'info' | 'accent';

const toneStyles: Record<AdminTone, { card: string; dot: string; badge: string; text: string }> = {
  neutral: { card: 'border-[#E4D6C5] bg-[#FFFDF8]', dot: 'bg-[#B39D89]', badge: 'border-[#E4D6C5] bg-[#FAF5EE] text-[#6F5D50]', text: 'text-[#6F5D50]' },
  good: { card: 'border-emerald-200 bg-emerald-50/70', dot: 'bg-emerald-500', badge: 'border-emerald-200 bg-emerald-50 text-emerald-700', text: 'text-emerald-700' },
  warn: { card: 'border-amber-200 bg-amber-50/70', dot: 'bg-amber-500', badge: 'border-amber-200 bg-amber-50 text-amber-700', text: 'text-amber-700' },
  danger: { card: 'border-red-200 bg-red-50/70', dot: 'bg-red-500', badge: 'border-red-200 bg-red-50 text-red-700', text: 'text-red-700' },
  info: { card: 'border-blue-200 bg-blue-50/70', dot: 'bg-blue-500', badge: 'border-blue-200 bg-blue-50 text-blue-700', text: 'text-blue-700' },
  accent: { card: 'border-[#D6B58F]/60 bg-[#F2E7D8]', dot: 'bg-[#9D7159]', badge: 'border-[#D6B58F]/60 bg-[#F2E7D8] text-[#8C634B]', text: 'text-[#8C634B]' },
};

export function AdminPageShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-6 text-[#231916] ${className}`} dir="ltr">{children}</div>;
}

export function AdminHero({ eyebrow, title, description, actions, meta }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[32px] border border-[#D7C5B2] bg-[#FFFDF8] shadow-[0_24px_70px_rgba(43,33,29,.07)]">
      <div className="relative p-5 sm:p-7">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-[#D6B58F]/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            {eyebrow && <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9D7159]">{eyebrow}</p>}
            <h1 className="mt-2 text-2xl font-black tracking-[-0.055em] text-[#231916] sm:text-4xl">{title}</h1>
            {description && <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6F5D50]">{description}</p>}
            {meta && <div className="mt-4 flex flex-wrap gap-2">{meta}</div>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
    </section>
  );
}

export function AdminMetricCard({ label, value, helper, tone = 'neutral', icon, to, trend }: { label: string; value: string | number; helper?: string; tone?: AdminTone; icon?: ReactNode; to?: string; trend?: string }) {
  const content = (
    <div className={`group h-full rounded-[28px] border p-5 shadow-[0_18px_45px_rgba(43,33,29,.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(43,33,29,.08)] ${toneStyles[tone].card}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8E7664]">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-[-0.06em] text-[#231916]">{value}</p>
        </div>
        {icon && <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/70 bg-white/72 text-[#9D7159] shadow-sm">{icon}</span>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        {helper && <p className="text-xs leading-5 text-[#6F5D50]">{helper}</p>}
        {trend && <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${toneStyles[tone].badge}`}>{trend}</span>}
      </div>
      {to && <p className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#8C634B] opacity-0 transition group-hover:opacity-100">Open queue <ArrowUpRight className="h-3.5 w-3.5" /></p>}
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export function AdminPanel({ title, description, actions, children, className = '' }: { title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[30px] border border-[#E4D6C5] bg-[#FFFDF8] p-5 shadow-[0_18px_55px_rgba(43,33,29,.05)] ${className}`}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-black tracking-[-0.03em] text-[#231916]">{title}</h2>
          {description && <p className="mt-1 text-xs leading-6 text-[#6F5D50]">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function AdminStatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: AdminTone }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${toneStyles[tone].badge}`}><span className={`h-1.5 w-1.5 rounded-full ${toneStyles[tone].dot}`} />{children}</span>;
}

export function AdminFilterChip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition ${active ? 'border-[#231916] bg-[#231916] text-[#FFFDF8]' : 'border-[#E4D6C5] bg-[#FFFDF8] text-[#6F5D50] hover:border-[#D6B58F] hover:text-[#231916]'}`}>{children}</button>
  );
}

export function AdminActionLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="inline-flex items-center gap-1 rounded-full border border-[#E4D6C5] bg-[#FFFDF8] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#6F5D50] hover:border-[#D6B58F] hover:text-[#8C634B]">{children}<ChevronRight className="h-3.5 w-3.5" /></Link>;
}

export function AdminProgressBar({ value, max = 100, tone = 'accent' }: { value: number; max?: number; tone?: AdminTone }) {
  const percent = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  const fill = tone === 'good' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : tone === 'danger' ? 'bg-red-500' : 'bg-[#9D7159]';
  return <div className="h-2 overflow-hidden rounded-full bg-[#F1E6D7]"><div className={`h-full rounded-full ${fill}`} style={{ width: `${percent}%` }} /></div>;
}

export function AdminEmptyBlock({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[#D7C5B2] bg-[#FAF5EE] p-8 text-center">
      <p className="text-sm font-black text-[#231916]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-[#6F5D50]">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
