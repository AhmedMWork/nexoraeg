import { FREE_SHIPPING_THRESHOLD } from '@/lib/constants';
import { formatPrice } from '@/lib/utils';

export default function FreeShippingProgress({ subtotal, threshold = FREE_SHIPPING_THRESHOLD }: { subtotal: number; threshold?: number }) {
  if (!threshold || threshold <= 0) return null;
  const remaining = Math.max(0, threshold - subtotal);
  const progress = Math.max(0, Math.min(100, (subtotal / threshold) * 100));
  return (
    <div className="rounded-3xl border border-[#202024] bg-[#0b0b0d]/80 p-4">
      <div className="mb-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.16em]">
        <span className="text-[#b8b0a3]">Free shipping progress</span>
        <span className="text-[#c8a96a]">{Math.round(progress)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#050505]"><div className="h-full rounded-full bg-[#c8a96a] transition-all" style={{ width: `${progress}%` }} /></div>
      <p className="mt-3 text-xs leading-5 text-[#8a8175]">{remaining > 0 ? `Add ${formatPrice(remaining)} more for free shipping.` : 'Free shipping unlocked.'}</p>
    </div>
  );
}
