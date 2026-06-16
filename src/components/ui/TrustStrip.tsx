import { RotateCcw, ShieldCheck, Truck, MessageCircle } from 'lucide-react';
import { BRAND } from '@/content/brand';

const items = [
  { icon: Truck, title: 'Egypt delivery', text: BRAND.trust[0] },
  { icon: ShieldCheck, title: 'Controlled drops', text: BRAND.trust[1] },
  { icon: MessageCircle, title: 'Human support', text: BRAND.trust[2] },
  { icon: RotateCcw, title: 'After-sale clarity', text: 'Clear exchange and return guidance before checkout.' },
];

export default function TrustStrip({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
      {items.map(({ icon: Icon, title, text }) => (
        <div key={title} className="rounded-3xl border border-[#17171a] bg-[#0b0b0d]/80 p-4">
          <Icon className="mb-3 h-4 w-4 text-[#c8a96a]" />
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#f4f0e8]">{title}</p>
          <p className="mt-2 text-xs leading-5 text-[#8a8175]">{text}</p>
        </div>
      ))}
    </div>
  );
}
