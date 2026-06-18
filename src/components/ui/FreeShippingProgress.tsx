import { FREE_SHIPPING_THRESHOLD } from '@/lib/constants';
import { formatPrice } from '@/lib/utils';

export default function FreeShippingProgress({
  subtotal,
  threshold = FREE_SHIPPING_THRESHOLD,
  enabled = false,
  messageTemplate = 'Add {amount} more for free shipping.',
}: {
  subtotal: number;
  threshold?: number;
  enabled?: boolean;
  messageTemplate?: string;
}) {
  if (!enabled || !threshold || threshold <= 0) return null;
  const remaining = Math.max(0, threshold - subtotal);
  const progress = Math.max(0, Math.min(100, (subtotal / threshold) * 100));
  const message = remaining > 0
    ? messageTemplate.replace('{amount}', formatPrice(remaining))
    : 'Free shipping unlocked.';

  return (
    <div className="rounded-3xl border border-[#D7C5B2] bg-[#FFFDF7]/90 p-4 shadow-[0_18px_45px_rgba(43,33,29,.08)]">
      <div className="mb-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.16em]">
        <span className="text-[#735B4F]">Free shipping progress</span>
        <span className="text-[#9D7159]">{Math.round(progress)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#EFE0CD]">
        <div className="h-full rounded-full bg-[#D6B58F] transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-3 text-xs leading-5 text-[#735B4F]">{message}</p>
    </div>
  );
}
