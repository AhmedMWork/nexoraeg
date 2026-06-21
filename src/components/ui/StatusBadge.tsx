import { cn } from '@/lib/utils';

const tones = {
  neutral: 'border-[#D7C5B2] bg-[#FAF7F2] text-[#735B4F]',
  good: 'border-emerald-400/35 bg-emerald-50 text-emerald-700',
  warn: 'border-amber-400/35 bg-amber-50 text-amber-700',
  danger: 'border-red-400/35 bg-red-50 text-red-700',
  dark: 'border-[#D6B58F]/35 bg-[#D6B58F]/10 text-[#D6B58F]',
};

export default function StatusBadge({ children, tone = 'neutral', className }: { children: React.ReactNode; tone?: keyof typeof tones; className?: string }) {
  return <span className={cn('inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]', tones[tone], className)}>{children}</span>;
}
