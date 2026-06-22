// ============================================================
// NEXORA — Checkout Page V5.1
// Fully bilingual customer checkout with payment-aware totals.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Banknote, CheckCircle, CreditCard, MessageCircle, Shield, Smartphone, Truck, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCartStore } from '@/stores/cartStore';
import { checkoutSchema, type CheckoutFormData } from '@/lib/validators';
import { getGovernorateNames, getCitiesForGovernorate } from '@/lib/egyptData';
import { formatPrice } from '@/lib/utils';
import SectionReveal from '@/components/ui/SectionReveal';
import EmptyState from '@/components/ui/EmptyState';
import { useI18n } from '@/i18n/I18nProvider';
import { trackEvent } from '@/services/analytics.service';
import { captureLead, getAttribution } from '@/lib/analytics/tracker';
import { classifyCheckoutError } from '@/lib/checkoutErrors';
import FreeShippingProgress from '@/components/ui/FreeShippingProgress';
import { getSizeDisplayLabel, SHIPPING_ESTIMATE_TEXT } from '@/lib/sizeLabels';
import CopyButton from '@/components/ui/CopyButton';
import ColorSwatch from '@/components/ui/ColorSwatch';
import { buildCheckoutWhatsAppMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { computeCheckoutTotals } from '@/lib/orderMath';
import { DEFAULT_PAYMENT_SETTINGS, getEnabledPaymentMethods, getInitialPaymentStatus, normalizePaymentSettings, requiresPaymentScreenshot, type PaymentSettings } from '@/lib/payments';
import { getCheckoutCopy, translateCheckoutError } from '@/content/checkoutCopy';

const DEFAULT_WHATSAPP = import.meta.env.VITE_STORE_WHATSAPP || import.meta.env.VITE_DEFAULT_WHATSAPP_NUMBER || '';
const DEFAULT_PAYMENT_PHONE = '01037141322';

type PaymentMethod = CheckoutFormData['paymentMethod'];

type PaymentOption = {
  id: PaymentMethod;
  label: string;
  badge: string;
  description: string;
  note: string;
  cta: string;
  icon: typeof Banknote;
  requiresTransfer?: boolean;
};

export default function CheckoutPage() {
  const { lang } = useI18n();
  const copy = getCheckoutCopy(lang);
  const { items, getTotalPrice, clearCart } = useCartStore();
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [completedPaymentMethod, setCompletedPaymentMethod] = useState<PaymentMethod>('cod');
  const [whatsAppNumber, setWhatsAppNumber] = useState(DEFAULT_WHATSAPP);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; freeShipping?: boolean } | null>(null);
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);
  const [shippingQuote, setShippingQuote] = useState<import('@/lib/supabase/db').ShippingQuote | null>(null);
  const [paymentConfirmationPhone, setPaymentConfirmationPhone] = useState(DEFAULT_PAYMENT_PHONE);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => {
    if (typeof window === 'undefined') return `nx-${Date.now()}`;
    const existing = window.sessionStorage.getItem('nexora-checkout-idempotency-key-v5-5-3');
    if (existing) return existing;
    const key = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? `nx-${crypto.randomUUID()}`
      : `nx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.sessionStorage.setItem('nexora-checkout-idempotency-key-v5-5-3', key);
    return key;
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { paymentMethod: 'cod' },
  });

  const subtotal = getTotalPrice();
  const watchedGovernorate = watch('governorate');
  const watchedName = watch('fullName');
  const watchedPhone = watch('phone');
  const watchedCity = watch('city');
  const watchedPaymentMethod = watch('paymentMethod') || 'cod';
  const cities = watchedGovernorate ? getCitiesForGovernorate(watchedGovernorate) : [];

  const rawDeliveryFee = shippingQuote?.available ? Number(shippingQuote.shippingFee || 0) : 0;
  const rawCodFee = paymentSettings.codFeeEnabled && shippingQuote?.available
    ? Number(paymentSettings.codFeeAmount ?? shippingQuote.codFee ?? 0)
    : 0;
  const discount = appliedCoupon?.discount || 0;
  const { deliveryFee, codFee, total } = computeCheckoutTotals({
    subtotal,
    discount,
    deliveryFee: rawDeliveryFee,
    codFee: rawCodFee,
    paymentMethod: watchedPaymentMethod,
  });
  const showFreeShippingProgress = Boolean(shippingQuote?.showFreeShippingProgress);
  const freeShippingThreshold = showFreeShippingProgress ? Number(shippingQuote?.freeShippingThreshold || 0) : 0;
  const freeShippingMessage = shippingQuote?.freeShippingProgressMessage || (lang === 'ar' ? 'أضف {amount} للشحن المجاني.' : 'Add {amount} more for free shipping.');

  const paymentOptions: PaymentOption[] = useMemo(() => {
    const totalLabel = formatPrice(total);
    const paymentCopy = copy.payments;
    const allOptions: PaymentOption[] = [
      {
        id: 'cod',
        label: paymentCopy.cod.label,
        badge: paymentCopy.cod.badge,
        description: paymentCopy.cod.description,
        note: lang === 'ar' ? paymentSettings.codInstructionsAr : paymentCopy.cod.note,
        cta: paymentCopy.cod.cta(totalLabel),
        icon: Banknote,
      },
      {
        id: 'instapay',
        label: paymentCopy.instapay.label,
        badge: paymentCopy.instapay.badge,
        description: paymentCopy.instapay.description,
        note: lang === 'ar' ? paymentSettings.instapayInstructionsAr : paymentCopy.instapay.note,
        cta: paymentCopy.instapay.cta(totalLabel),
        icon: Smartphone,
        requiresTransfer: requiresPaymentScreenshot('instapay', paymentSettings),
      },
      {
        id: 'vodafone_cash',
        label: paymentCopy.vodafone_cash.label,
        badge: paymentCopy.vodafone_cash.badge,
        description: paymentCopy.vodafone_cash.description,
        note: lang === 'ar' ? paymentSettings.vodafoneInstructionsAr : paymentCopy.vodafone_cash.note,
        cta: paymentCopy.vodafone_cash.cta(totalLabel),
        icon: Wallet,
        requiresTransfer: requiresPaymentScreenshot('vodafone_cash', paymentSettings),
      },
      {
        id: 'valu',
        label: paymentCopy.valu.label,
        badge: paymentCopy.valu.badge,
        description: paymentCopy.valu.description,
        note: lang === 'ar' ? paymentSettings.valuInstructionsAr : paymentCopy.valu.note,
        cta: paymentCopy.valu.cta(totalLabel),
        icon: CreditCard,
      },
    ];
    const enabled = getEnabledPaymentMethods(paymentSettings);
    return allOptions.filter((option) => enabled.includes(option.id));
  }, [copy, lang, paymentSettings, total]);

  const selectedPayment = paymentOptions.find((option) => option.id === watchedPaymentMethod) || paymentOptions[0] || {
    id: 'cod' as PaymentMethod,
    label: copy.payments.cod.label,
    badge: copy.payments.cod.badge,
    description: copy.payments.cod.description,
    note: copy.payments.cod.note,
    cta: copy.payments.cod.cta(formatPrice(total)),
    icon: Banknote,
  };

  useEffect(() => {
    if (paymentOptions.length > 0 && !paymentOptions.some((option) => option.id === watchedPaymentMethod)) {
      setValue('paymentMethod', paymentOptions[0].id, { shouldValidate: true });
    }
  }, [paymentOptions, watchedPaymentMethod, setValue]);

  useEffect(() => {
    void trackEvent('checkout_start', { itemsCount: items.length, subtotal });
    void trackEvent('checkout_started', { itemsCount: items.length, subtotal });
    let mounted = true;
    import('@/lib/supabase/db')
      .then(({ getSiteSettings }) => getSiteSettings())
      .then((settings) => {
        if (!mounted) return;
        const normalized = normalizePaymentSettings(settings?.paymentSettings as Record<string, unknown> | undefined);
        setPaymentSettings(normalized);
        setWhatsAppNumber(settings?.whatsappNumber || normalized.whatsappConfirmationNumber || DEFAULT_WHATSAPP);
        setPaymentConfirmationPhone(normalized.transferNumber || normalized.confirmationPhone || DEFAULT_PAYMENT_PHONE);
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, [items.length, subtotal]);

  useEffect(() => {
    if (!watchedGovernorate || !watchedCity) {
      setShippingQuote(null);
      return;
    }
    let cancelled = false;
    setIsCalculatingShipping(true);
    import('@/lib/supabase/db')
      .then(({ calculateShippingQuote }) => calculateShippingQuote({
        governorate: watchedGovernorate,
        city: watchedCity,
        subtotal,
        couponFreeShipping: Boolean(appliedCoupon?.freeShipping),
      }))
      .then((quote) => { if (!cancelled) setShippingQuote(quote); })
      .catch(() => { if (!cancelled) setShippingQuote({ available: false, reason: lang === 'ar' ? 'تعذر حساب التوصيل الآن.' : 'Could not calculate delivery right now.', shippingFee: 0, codFee: 0, totalDeliveryFee: 0 }); })
      .finally(() => { if (!cancelled) setIsCalculatingShipping(false); });
    return () => { cancelled = true; };
  }, [watchedGovernorate, watchedCity, subtotal, appliedCoupon?.freeShipping, lang]);

  useEffect(() => {
    const phone = String(watchedPhone || '').replace(/\s/g, '');
    if (!/^01[0-9]{9}$/.test(phone)) return;
    const timer = window.setTimeout(() => {
      void captureLead({
        name: watchedName,
        phone,
        sourceType: 'checkout_contact',
        status: 'checkout_abandoned',
        notes: 'Customer entered checkout contact details before order completion.',
        metadata: { itemsCount: items.length, subtotal },
      });
      void trackEvent('checkout_contact_entered', { phone });
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [watchedName, watchedPhone, items.length, subtotal]);

  const errorText = (message: unknown) => translateCheckoutError(message, lang);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsCheckingCoupon(true);
    void trackEvent('coupon_attempted', { code: couponCode.trim().toUpperCase(), subtotal });
    try {
      const { validateCouponForCart } = await import('@/lib/supabase/db');
      const result = await validateCouponForCart({
        code: couponCode,
        subtotal,
        items: items.map((item) => ({ productId: item.productId, variantId: item.variantId, size: item.size, color: item.color, quantity: item.quantity })),
      });
      if (!result.valid) {
        setAppliedCoupon(null);
        void trackEvent('coupon_fail', { code: couponCode, message: result.message });
        toast.error(result.message);
        return;
      }
      setAppliedCoupon({ code: result.code || couponCode.toUpperCase(), discount: result.discount, freeShipping: result.freeShipping });
      void trackEvent('coupon_apply', { code: result.code || couponCode.toUpperCase(), discount: result.discount });
      void trackEvent('coupon_applied', { code: result.code || couponCode.toUpperCase(), discount: result.discount });
      toast.success(result.message);
    } catch {
      toast.error(copy.couponError);
    } finally {
      setIsCheckingCoupon(false);
    }
  };

  const onSubmit = async (data: CheckoutFormData) => {
    if (items.length === 0) {
      toast.error(copy.emptyCart);
      return;
    }
    if (!shippingQuote?.available) {
      toast.error(shippingQuote?.reason || copy.unsupportedArea);
      return;
    }

    try {
      void trackEvent('order_submit', { itemsCount: items.length, subtotal, total, paymentMethod: data.paymentMethod });
      const { createOrderWithStockTransaction } = await import('@/lib/supabase/db');
      const attribution = getAttribution();
      const createdOrder = await createOrderWithStockTransaction({
        attribution,
        visitorId: attribution.visitorId,
        sessionId: attribution.sessionId,
        idempotencyKey,
        shippingQuote,
        customer: {
          fullName: data.fullName,
          phone: data.phone,
          governorate: data.governorate,
          city: data.city,
          address: data.address,
          notes: data.notes,
        },
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          name: item.name,
          slug: item.slug,
          price: item.price,
          size: item.size,
          sizeLabel: item.sizeLabel || getSizeDisplayLabel(item.size, item.weightRange),
          weightRange: item.weightRange,
          color: item.color,
          colorHex: item.colorHex,
          quantity: item.quantity,
          image: item.image,
        })),
        subtotal,
        shippingFee: deliveryFee,
        codFee,
        discount,
        couponCode: appliedCoupon?.code,
        total,
        paymentMethod: data.paymentMethod,
        paymentConfirmationPhone,
        paymentStatus: getInitialPaymentStatus(data.paymentMethod),
        status: 'pending',
        trackingUpdates: [
          {
            status: 'pending',
            message: 'Order received. Awaiting confirmation.',
            timestamp: new Date(),
            updatedBy: 'system',
          },
        ],
      });

      void trackEvent('order_success', { orderNumber: createdOrder.orderNumber, total: createdOrder.total || total, productIds: items.map((item) => item.productId), contents: items.map((item) => ({ id: item.productId, quantity: item.quantity, item_price: item.price })) });
      void trackEvent('order_created', { orderNumber: createdOrder.orderNumber, total: createdOrder.total || total, productIds: items.map((item) => item.productId), contents: items.map((item) => ({ id: item.productId, quantity: item.quantity, item_price: item.price })) });
      setOrderNumber(createdOrder.orderNumber);
      setCompletedPaymentMethod(data.paymentMethod);
      setOrderComplete(true);
      clearCart();
      if (typeof window !== 'undefined') window.sessionStorage.removeItem('nexora-checkout-idempotency-key-v5-5-3');
      setIdempotencyKey(`nx-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      toast.success(copy.orderSaved);
    } catch (error) {
      const checkoutError = classifyCheckoutError(error);
      void trackEvent('order_failed', { kind: checkoutError.kind, message: checkoutError.message });
      void trackEvent('checkout_error', { kind: checkoutError.kind, message: checkoutError.message });
      toast.error(checkoutError.message || copy.couponError);
    }
  };

  if (items.length === 0 && !orderComplete) {
    return (
      <>
        <Helmet><title>{copy.title} | NEXORA</title></Helmet>
        <div className="min-h-screen bg-[#050505] pb-20 pt-32">
          <EmptyState type="cart" />
        </div>
      </>
    );
  }

  if (orderComplete) {
    const whatsappTarget = completedPaymentMethod === 'cod' ? whatsAppNumber : paymentConfirmationPhone;
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] pb-20 pt-32" dir={copy.dir}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-lg px-6 text-center">
          <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-[28px] border border-[#c8a96a]/30 bg-[#c8a96a]/10">
            <CheckCircle className="h-10 w-10 text-[#c8a96a]" />
          </div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.26em] text-[#c8a96a]">{copy.successKicker}</p>
          <h1 className="mb-3 text-3xl font-bold text-[#f4f0e8]">{copy.successTitle}</h1>
          <p className="mx-auto mb-6 max-w-md text-sm leading-7 text-[#b8b0a3]">{copy.success[completedPaymentMethod]}</p>

          <div className="mb-6 rounded-[28px] border border-[#17171a] bg-[#0b0b0d] p-5">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-[#8a8175]">{copy.orderNumber}</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-xl font-black tracking-wider text-[#c8a96a]">{orderNumber}</span>
              <CopyButton value={orderNumber} label={copy.copy} success={copy.orderCopied} className="px-3 py-2" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {whatsappTarget && (
              <a href={buildWhatsAppUrl(whatsappTarget, buildCheckoutWhatsAppMessage(orderNumber, completedPaymentMethod, lang))} target="_blank" rel="noopener noreferrer" className="nexora-button-primary flex items-center justify-center gap-2">
                <MessageCircle className="h-4 w-4" />
                {copy.whatsappConfirm}
              </a>
            )}
            <Link to="/track" className="nexora-button flex items-center justify-center gap-2">{copy.trackOrder}</Link>
            <Link to="/shop" className="text-xs uppercase tracking-wider text-[#b8b0a3] transition-colors hover:text-[#c8a96a]">
              {copy.continueShopping}
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const BackIcon = lang === 'ar' ? ArrowRight : ArrowLeft;

  return (
    <>
      <Helmet><title>{copy.title} | NEXORA</title></Helmet>
      <div className="min-h-screen bg-[#050505] pb-20 pt-24" dir={copy.dir}>
        <div className="w-full px-4 sm:px-6 lg:px-10">
          <SectionReveal>
            <Link to="/cart" className="mb-6 flex items-center gap-2 text-xs uppercase tracking-wider text-[#b8b0a3] transition-colors hover:text-[#c8a96a]">
              <BackIcon className="h-3 w-3" />
              {copy.backToCart}
            </Link>
            <p className="nexora-caption mb-3 text-[#c8a96a]">{copy.kicker}</p>
            <h1 className="nexora-heading-md mb-3">{copy.title}</h1>
            <p className="mb-8 max-w-2xl text-sm leading-7 text-[#b8b0a3]">{copy.intro}</p>
            <div className="mb-10 grid grid-cols-2 gap-2 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a8175] sm:grid-cols-4">
              {copy.steps.map((step, index) => (
                <div key={step} className={`rounded-full border px-2 py-2 ${index < 3 ? 'border-[#c8a96a]/40 bg-[#c8a96a]/10 text-[#c8a96a]' : 'border-[#202024] bg-[#0b0b0d] text-[#8a8175]'}`}>
                  {step}
                </div>
              ))}
            </div>
          </SectionReveal>

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="rounded-[30px] border border-[#17171a] bg-[#0b0b0d] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.16)]">
                  <h3 className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-[#f4f0e8]">{copy.contactTitle}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[#8a8175]">{copy.fullName}</label>
                      <input {...register('fullName')} className="w-full rounded-2xl border border-[#202024] bg-[#050505] px-4 py-3 text-sm text-[#f4f0e8] placeholder:text-[#4c4640] outline-none transition-colors focus:border-[#c8a96a]" placeholder={copy.fullNamePlaceholder} />
                      {errors.fullName && <p className="mt-1 text-[10px] text-red-400">{errorText(errors.fullName.message)}</p>}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[#8a8175]">{copy.phone}</label>
                      <input {...register('phone')} className="w-full rounded-2xl border border-[#202024] bg-[#050505] px-4 py-3 text-sm text-[#f4f0e8] placeholder:text-[#4c4640] outline-none transition-colors focus:border-[#c8a96a]" placeholder="01XXXXXXXXX" dir="ltr" />
                      {errors.phone && <p className="mt-1 text-[10px] text-red-400">{errorText(errors.phone.message)}</p>}
                    </div>
                  </div>
                </div>

                <div className="rounded-[30px] border border-[#17171a] bg-[#0b0b0d] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.16)]">
                  <h3 className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-[#f4f0e8]">{copy.deliveryTitle}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[#8a8175]">{copy.governorate}</label>
                      <select
                        {...register('governorate')}
                        onChange={(event) => {
                          setValue('governorate', event.target.value, { shouldValidate: true });
                          setValue('city', '', { shouldValidate: true });
                        }}
                        className="w-full appearance-none rounded-2xl border border-[#202024] bg-[#050505] px-4 py-3 text-sm text-[#f4f0e8] outline-none transition-colors focus:border-[#c8a96a]"
                      >
                        <option value="">{copy.chooseGovernorate}</option>
                        {getGovernorateNames().map((governorate) => <option key={governorate} value={governorate}>{governorate}</option>)}
                      </select>
                      {errors.governorate && <p className="mt-1 text-[10px] text-red-400">{errorText(errors.governorate.message)}</p>}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[#8a8175]">{copy.city}</label>
                      <select {...register('city')} disabled={!watchedGovernorate} className="w-full appearance-none rounded-2xl border border-[#202024] bg-[#050505] px-4 py-3 text-sm text-[#f4f0e8] outline-none transition-colors focus:border-[#c8a96a] disabled:opacity-50">
                        <option value="">{copy.chooseCity}</option>
                        {cities.map((city) => <option key={city} value={city}>{city}</option>)}
                      </select>
                      {errors.city && <p className="mt-1 text-[10px] text-red-400">{errorText(errors.city.message)}</p>}
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[#8a8175]">{copy.address}</label>
                    <textarea {...register('address')} rows={2} className="w-full resize-none rounded-2xl border border-[#202024] bg-[#050505] px-4 py-3 text-sm text-[#f4f0e8] placeholder:text-[#4c4640] outline-none transition-colors focus:border-[#c8a96a]" placeholder={copy.addressPlaceholder} />
                    {errors.address && <p className="mt-1 text-[10px] text-red-400">{errorText(errors.address.message)}</p>}
                  </div>
                  <div className="mt-4">
                    <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[#8a8175]">{copy.notes}</label>
                    <textarea {...register('notes')} rows={2} className="w-full resize-none rounded-2xl border border-[#202024] bg-[#050505] px-4 py-3 text-sm text-[#f4f0e8] placeholder:text-[#4c4640] outline-none transition-colors focus:border-[#c8a96a]" placeholder={copy.notesPlaceholder} />
                    {errors.notes && <p className="mt-1 text-[10px] text-red-400">{errorText(errors.notes.message)}</p>}
                  </div>
                </div>

                <div className="rounded-[30px] border border-[#17171a] bg-[#0b0b0d] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.16)]">
                  <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#f4f0e8]">{copy.paymentTitle}</h3>
                      <p className="mt-2 text-xs leading-6 text-[#8a8175]">{copy.paymentIntro}</p>
                    </div>
                    <span className="w-fit rounded-full border border-[#c8a96a]/30 bg-[#c8a96a]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#c8a96a]">{copy.secureBadge}</span>
                  </div>

                  <div className="grid gap-3">
                    {paymentOptions.map((method) => {
                      const Icon = method.icon;
                      const active = watchedPaymentMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setValue('paymentMethod', method.id, { shouldValidate: true })}
                          className={`w-full rounded-[24px] border p-4 ${lang === 'ar' ? 'text-right' : 'text-left'} transition-all ${active ? 'border-[#c8a96a] bg-[#c8a96a]/10 shadow-[0_18px_45px_rgba(200,169,106,0.08)]' : 'border-[#202024] bg-[#050505] hover:border-[#6f675d]'}`}
                        >
                          <div className="flex items-start gap-4">
                            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${active ? 'bg-[#c8a96a] text-[#050505]' : 'bg-[#121214] text-[#c8a96a]'}`}>
                              <Icon className="h-5 w-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm font-semibold text-[#f4f0e8]">{method.label}</p>
                                <span className="w-fit rounded-full border border-[#c8a96a]/25 bg-[#c8a96a]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#c8a96a]">{method.badge}</span>
                              </div>
                              <p className="mt-2 text-xs leading-6 text-[#8a8175]">{method.description}</p>
                              {method.requiresTransfer && active && (
                                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[#202024] bg-[#0b0b0d] p-3 text-xs text-[#b8b0a3]">
                                  <span>{copy.transferNumber}</span>
                                  <span className="font-black text-[#c8a96a]" dir="ltr">{paymentConfirmationPhone}</span>
                                  <CopyButton value={paymentConfirmationPhone} label={copy.copy} success={copy.transferCopied} />
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-[24px] border border-[#c8a96a]/20 bg-[#c8a96a]/5 p-4 text-xs leading-6 text-[#b8b0a3]">
                    <p className="font-semibold text-[#f4f0e8]">{selectedPayment.label}</p>
                    <p className="mt-1">{selectedPayment.note}</p>
                    {watchedPaymentMethod === 'valu' && <p className="mt-2 text-[#c8a96a]">{copy.valuContact} <span dir="ltr">{paymentConfirmationPhone}</span></p>}
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full rounded-full bg-[#c8a96a] px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-[#050505] transition hover:bg-[#d8bb7b] disabled:opacity-50">
                  {isSubmitting ? copy.processing : selectedPayment.cta}
                </button>
              </form>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-24 rounded-[30px] border border-[#17171a] bg-[#0b0b0d] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.16)]">
                <h3 className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-[#f4f0e8]">{copy.summaryTitle}</h3>
                {freeShippingThreshold > 0 && <div className="mb-5"><FreeShippingProgress subtotal={subtotal} threshold={freeShippingThreshold} enabled={showFreeShippingProgress} messageTemplate={freeShippingMessage} /></div>}
                <div className="mb-5 rounded-2xl border border-[#202024] bg-[#050505] p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#c8a96a]"><Truck className="h-4 w-4" /> {copy.deliveryQuote}</div>
                  <p className="text-xs leading-6 text-[#8a8175]">{isCalculatingShipping ? copy.calculatingDelivery : shippingQuote?.available ? `${shippingQuote.deliveryEstimate || SHIPPING_ESTIMATE_TEXT}${shippingQuote.freeShippingApplied ? ` · ${copy.freeShippingApplied}` : ''}` : (shippingQuote?.reason || copy.chooseAreaForDelivery)}</p>
                </div>
                <div className="mb-5 max-h-64 space-y-3 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <div key={`${item.productId}-${item.variantId || 'base'}-${item.size}-${item.color || 'default'}`} className="flex gap-3 rounded-2xl border border-[#17171a] bg-[#050505] p-2.5">
                      <img src={item.image} alt={item.name} loading="lazy" decoding="async" className="h-14 w-14 rounded-xl bg-[#0b0b0d] object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-[#f4f0e8]">{item.name}</p>
                        <div className="mt-1 space-y-1 text-[10px] leading-5 text-[#8a8175]">
                          <p>{copy.size}: {item.sizeLabel || getSizeDisplayLabel(item.size, item.weightRange)}</p>
                          {item.color && <p className="flex items-center gap-1.5">{copy.color}: <ColorSwatch color={item.colorHex} pattern={item.colorPattern} label={item.color} size="xs" /> {item.color}</p>}
                          <p>{copy.quantity}: {item.quantity}</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-[#b8b0a3]">{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="mb-4 h-px bg-[#17171a]" />
                <div className="mb-4">
                  <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-[#8a8175]">{copy.coupon}</label>
                  <div className="flex gap-2">
                    <input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} className="min-w-0 flex-1 rounded-2xl border border-[#202024] bg-[#050505] px-3 py-2 text-xs text-[#f4f0e8] outline-none focus:border-[#c8a96a]" placeholder="NEXORA10" />
                    <button type="button" onClick={applyCoupon} disabled={isCheckingCoupon} className="rounded-2xl bg-[#c8a96a]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#c8a96a] disabled:opacity-50">{isCheckingCoupon ? '...' : copy.apply}</button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-[#b8b0a3]">{copy.subtotal}</span><span className="text-[#f4f0e8]">{formatPrice(subtotal)}</span></div>
                  {appliedCoupon && <div className="flex justify-between text-sm"><span className="text-[#b8b0a3]">{copy.discount} ({appliedCoupon.code})</span><span className="text-green-400">-{formatPrice(discount)}</span></div>}
                  <div className="flex justify-between text-sm"><span className="text-[#b8b0a3]">{copy.delivery}</span><span className={deliveryFee === 0 && shippingQuote?.available ? 'text-green-400' : 'text-[#f4f0e8]'}>{deliveryFee === 0 && shippingQuote?.available ? copy.free : formatPrice(deliveryFee)}</span></div>
                  {watchedPaymentMethod === 'cod' && codFee > 0 && <div className="flex justify-between text-sm"><span className="text-[#b8b0a3]">{copy.codFee}</span><span className="text-[#f4f0e8]">{formatPrice(codFee)}</span></div>}
                  <div className="my-2 h-px bg-[#17171a]" />
                  <div className="flex justify-between"><span className="text-sm font-bold text-[#f4f0e8]">{copy.total}</span><span className="text-lg font-black text-[#c8a96a]">{formatPrice(total)}</span></div>
                </div>
                <div className="mt-4 rounded-2xl border border-[#202024] bg-[#050505] p-3 text-[10px] leading-5 text-[#6f675d]">
                  <div className="mb-1 flex items-center gap-2 text-[#8a8175]"><Shield className="h-3 w-3" /><span>{copy.totalNote}</span></div>
                  {watchedPaymentMethod !== 'cod' && <p>{copy.noCodFeeNote}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
