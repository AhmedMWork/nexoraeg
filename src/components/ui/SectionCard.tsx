import { cn } from '@/lib/utils';

export default function SectionCard({ title, helper, children, className, dark = false }: { title?: string; helper?: string; children: React.ReactNode; className?: string; dark?: boolean }) {
  return (
    <section className={cn(dark ? 'rounded-[30px] border border-[#17171a] bg-[#0b0b0d] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.16)]' : 'rounded-[28px] border border-[#D7C5B2] bg-[#FFFDF7] p-5 shadow-[0_24px_70px_rgba(43,33,29,.08)]', className)}>
      {(title || helper) && (
        <div className="mb-5">
          {title && <h2 className={cn('text-sm font-black uppercase tracking-[0.18em]', dark ? 'text-[#f4f0e8]' : 'text-[#231916]')}>{title}</h2>}
          {helper && <p className={cn('mt-2 text-xs leading-6', dark ? 'text-[#8a8175]' : 'text-[#735B4F]')}>{helper}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
