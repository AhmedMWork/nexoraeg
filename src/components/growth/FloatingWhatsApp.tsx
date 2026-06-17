import { MessageCircle } from 'lucide-react';
import { trackWhatsAppClick } from '@/lib/analytics/tracker';

const number = import.meta.env.VITE_STORE_WHATSAPP || '201037141322';

export default function FloatingWhatsApp() {
  const open = async () => {
    const message = 'Hello NEXORA. I need help choosing a piece.';
    await trackWhatsAppClick({ phone: number, message, sourceType: 'floating_whatsapp' });
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <button onClick={open} className="fixed bottom-5 right-5 z-[90] hidden items-center gap-3 rounded-full border border-[var(--v33-accent)] bg-[#101010]/92 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[#f4f0e8] shadow-2xl backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-[#171210] md:flex" aria-label="WhatsApp NEXORA">
      <MessageCircle className="h-4 w-4 text-[var(--v33-accent)]" />
      WhatsApp
    </button>
  );
}
