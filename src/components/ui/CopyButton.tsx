import { Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

export default function CopyButton({ value, label = 'نسخ', success = 'تم النسخ', className }: { value: string; label?: string; success?: string; className?: string }) {
  const onCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    await navigator.clipboard.writeText(value);
    toast.success(success);
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn('inline-flex items-center gap-1 rounded-full border border-[#D6B58F]/35 bg-[#D6B58F]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#D6B58F] transition hover:bg-[#D6B58F]/18', className)}
    >
      <Copy className="h-3 w-3" /> {label}
    </button>
  );
}
