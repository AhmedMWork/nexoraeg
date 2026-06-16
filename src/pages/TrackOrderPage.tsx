// ============================================================
// NEXORA V5 — Customer Order Tracking
// Public lookup uses order number + phone via secure Edge Function.
// ============================================================

import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search, PackageCheck, AlertCircle, ShoppingBag } from 'lucide-react';
import { trackOrderForCustomer, type PublicOrderTrackingResult } from '@/lib/supabase/db';
import { formatPrice, getStatusLabel } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider';
import { trackEvent } from '@/services/analytics.service';
import { generateWhatsAppLink } from '@/lib/egyptData';

const FLOW = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
const DEFAULT_WHATSAPP = import.meta.env.VITE_STORE_WHATSAPP || import.meta.env.VITE_DEFAULT_WHATSAPP_NUMBER || '';

export default function TrackOrderPage() {
  const { t, lang } = useI18n();
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<PublicOrderTrackingResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { void trackEvent('track_order_opened'); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setResult(null);
    if (!orderNumber.trim() || !phone.trim()) {
      setError('Enter both order number and phone number.');
      return;
    }
    setIsChecking(true);
    try {
      const data = await trackOrderForCustomer({ orderNumber: orderNumber.trim(), phone: phone.trim() });
      if (!data.found) {
        void trackEvent('track_order_failed', { orderNumber: orderNumber.trim().toUpperCase() });
        setError(data.message || t('track.notFound'));
      } else {
        void trackEvent('track_order_success', { orderNumber: data.order?.orderNumber });
      }
      setResult(data);
    } catch (err) {
      void trackEvent('track_order_failed', { orderNumber: orderNumber.trim().toUpperCase(), message: err instanceof Error ? err.message : 'unknown' });
      setError(err instanceof Error ? err.message : t('track.notFound'));
    } finally {
      setIsChecking(false);
    }
  };

  const currentStatus = result?.order?.status || 'pending';
  const currentIndex = Math.max(0, FLOW.indexOf(currentStatus));

  return (
    <main className="pt-28 pb-20 min-h-screen bg-[#050505]">
      <Helmet>
        <title>Track Order | NEXORA</title>
        <meta name="description" content="Track your NEXORA order status using your order number and phone number." />
      </Helmet>
      <div className="w-full px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <p className="nexora-caption text-[#c8a96a] mb-3">{t('track.caption')}</p>
          <h1 className="nexora-heading-md mb-4">TRACK YOUR ORDER</h1>
          <p className="mb-8 max-w-2xl text-sm leading-7 text-[#b8b0a3]">
            Enter the order number shown after checkout and the same phone number used for the order. For privacy, only a limited order summary is shown.
          </p>

          <form onSubmit={submit} className="grid gap-3 rounded-[28px] border border-[#17171a] bg-[#0b0b0d] p-5 sm:grid-cols-[1fr_1fr_auto]">
            <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} className="nexora-input" placeholder={t('track.placeholderOrder')} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="nexora-input" placeholder={t('track.placeholderPhone')} dir="ltr" />
            <button type="submit" disabled={isChecking} className="nexora-button-primary justify-center disabled:opacity-50">
              <Search className="h-4 w-4" /> {isChecking ? 'Checking...' : t('track.action')}
            </button>
          </form>

          {error && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200"><AlertCircle className="h-5 w-5 flex-shrink-0" />{error}</div>}

          {result?.order && (
            <section className="mt-8 rounded-[30px] border border-[#17171a] bg-[#0b0b0d] p-5 sm:p-7">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[#8a8175]">{t('checkout.orderNumber')}</p>
                  <h2 className="text-2xl font-bold text-[#f4f0e8]">{result.order.orderNumber}</h2>
                </div>
                <span className="rounded-full border border-[#c8a96a]/30 bg-[#c8a96a]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#c8a96a]">
                  {getStatusLabel(result.order.status, lang)}
                </span>
              </div>

              <div className="mb-7 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#202024] p-4"><p className="text-[10px] uppercase tracking-wider text-[#8a8175]">{t('track.location')}</p><p className="mt-1 text-sm text-[#f4f0e8]">{result.order.city}, {result.order.governorate}</p></div>
                <div className="rounded-2xl border border-[#202024] p-4"><p className="text-[10px] uppercase tracking-wider text-[#8a8175]">{t('track.payment')}</p><p className="mt-1 text-sm text-[#f4f0e8]">COD · {result.order.paymentStatus}</p></div>
                <div className="rounded-2xl border border-[#202024] p-4"><p className="text-[10px] uppercase tracking-wider text-[#8a8175]">{t('checkout.total')}</p><p className="mt-1 text-sm font-bold text-[#c8a96a]">{formatPrice(result.order.total)}</p></div>
              </div>

              <div className="mb-7">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#f4f0e8]">{t('track.progress')}</h3>
                <div className="grid gap-3 sm:grid-cols-5">
                  {FLOW.map((status, index) => {
                    const done = index <= currentIndex;
                    return <div key={status} className={`rounded-2xl border p-3 text-center ${done ? 'border-[#c8a96a]/35 bg-[#c8a96a]/10 text-[#c8a96a]' : 'border-[#202024] text-[#6f675d]'}`}><PackageCheck className="mx-auto mb-2 h-4 w-4" /><p className="text-[10px] font-bold uppercase tracking-[0.14em]">{getStatusLabel(status, lang)}</p></div>;
                  })}
                </div>
              </div>

              <div className="space-y-3">
                {result.order.items.map((item, index) => <div key={`${item.name}-${index}`} className="flex items-center gap-3 rounded-2xl border border-[#202024] p-3"><img src={item.image || '/assets/nexora-logo-bg.jpg'} alt={item.name} className="h-14 w-14 rounded-xl object-cover" loading="lazy" decoding="async" /><div className="min-w-0 flex-1"><p className="truncate text-sm text-[#f4f0e8]">{item.name}</p><p className="text-[10px] text-[#8a8175]">Size: {item.size}{item.color ? ` · Color: ${item.color}` : ''} · x{item.quantity}</p></div></div>)}
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/shop" className="nexora-button inline-flex"><ShoppingBag className="h-4 w-4" /> Continue Shopping</Link>
                {DEFAULT_WHATSAPP && <a href={generateWhatsAppLink(DEFAULT_WHATSAPP, `Hello NEXORA, I want to ask about order ${result.order.orderNumber}.`)} target="_blank" rel="noopener noreferrer" className="nexora-button-primary inline-flex">Ask on WhatsApp</a>}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
