import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Bell, Clock, Instagram, Mail, MessageCircle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Helmet } from 'react-helmet-async';
import { useI18n } from '@/i18n/I18nProvider';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import type { SiteSettings } from '@/types';

type Remaining = { days: number; hours: number; minutes: number; seconds: number; ended: boolean };

function getRemaining(target?: string): Remaining {
  const targetMs = target ? new Date(target).getTime() : Date.now();
  const diff = Math.max(0, targetMs - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
    ended: diff <= 0,
  };
}

function TimeBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[28px] border border-white/15 bg-white/[0.07] p-4 text-center shadow-[0_24px_80px_rgba(0,0,0,.32)] backdrop-blur-xl sm:p-5">
      <motion.div key={value} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-3xl font-black tracking-[-0.04em] text-[#fff8ec] sm:text-5xl">
        {String(value).padStart(2, '0')}
      </motion.div>
      <div className="mt-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#d9c2a3]">{label}</div>
    </div>
  );
}

export default function OpeningSoonPage({ settings }: { settings?: SiteSettings | null }) {
  const { lang } = useI18n();
  const launch = useMemo(() => settings?.launchSettings || {}, [settings?.launchSettings]);
  const [remaining, setRemaining] = useState(() => getRemaining(launch.launchAt));
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(getRemaining(launch.launchAt)), 1000);
    return () => window.clearInterval(timer);
  }, [launch.launchAt]);

  useEffect(() => {
    if (remaining.ended && launch.autoOpen) window.location.reload();
  }, [remaining.ended, launch.autoOpen]);

  const copy = useMemo(() => {
    const isAr = lang === 'ar';
    return {
      eyebrow: launch.eyebrow || (isAr ? 'تجربة NEXORA الجديدة' : 'Premium launch experience'),
      title: launch.title || (isAr ? 'NEXORA تفتح قريبًا' : 'NEXORA is Opening Soon'),
      subtitle: launch.subtitle || (isAr ? 'نجهز لك تجربة تسوق أكثر فخامة وسلاسة.' : 'A new premium shopping experience is almost here.'),
      announcement: launch.announcement || (isAr ? 'إطلاق جديد، منتجات جديدة، وتجربة أفضل قريبًا.' : 'New drops, smoother checkout, and a better shopping journey are coming soon.'),
      days: isAr ? 'يوم' : 'Days',
      hours: isAr ? 'ساعة' : 'Hours',
      minutes: isAr ? 'دقيقة' : 'Minutes',
      seconds: isAr ? 'ثانية' : 'Seconds',
      notifyTitle: isAr ? 'كن أول من يعرف' : 'Be first to know',
      notifyText: isAr ? 'اترك بياناتك وسنخبرك عند الافتتاح.' : 'Leave your details and we will notify you when NEXORA opens.',
      name: isAr ? 'الاسم' : 'Name',
      contact: isAr ? 'الهاتف أو البريد الإلكتروني' : 'Phone or email',
      submit: isAr ? 'أبلغني عند الافتتاح' : 'Notify me at launch',
      whatsapp: launch.buttonText || (isAr ? 'تواصل معنا على واتساب' : 'Contact us on WhatsApp'),
      success: launch.notifySuccessMessage || (isAr ? 'تم تسجيلك في قائمة الافتتاح.' : 'You are on the launch list.'),
    };
  }, [lang, launch]);

  const whatsappUrl = buildWhatsAppUrl(settings?.whatsappNumber || '201037141322', launch.whatsappMessage || (lang === 'ar' ? 'مرحبًا NEXORA، أريد معرفة المزيد عن الافتتاح.' : 'Hello NEXORA, I would like to know more about the launch.'));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!contact.trim()) return toast.error(lang === 'ar' ? 'اكتب رقم الهاتف أو البريد الإلكتروني.' : 'Enter your phone or email.');
    setSubmitting(true);
    try {
      const { submitLaunchSubscriber } = await import('@/lib/supabase/db');
      await submitLaunchSubscriber({ name: name.trim(), contact: contact.trim(), source: 'opening_soon' });
      toast.success(copy.success);
      setName('');
      setContact('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your request right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b0908] text-[#fff8ec]" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Helmet>
        <title>{copy.title} — NEXORA</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(214,181,143,.28),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(208,154,130,.20),transparent_36%),linear-gradient(135deg,#0b0908,#1b1410_48%,#050403)]" />
      {launch.backgroundImage && <img src={launch.backgroundImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-screen" />}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30" />
      <motion.div className="absolute -left-28 top-1/3 h-96 w-96 rounded-full bg-[#d6b58f]/20 blur-3xl" animate={{ scale: [1, 1.08, 1], opacity: [.45, .7, .45] }} transition={{ repeat: Infinity, duration: 6 }} />
      <motion.div className="absolute -right-32 bottom-0 h-[30rem] w-[30rem] rounded-full bg-[#d09a82]/20 blur-3xl" animate={{ scale: [1.08, 1, 1.08], opacity: [.55, .35, .55] }} transition={{ repeat: Infinity, duration: 7 }} />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-8 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/assets/nexora-logo-ivory.png" alt="NEXORA" className="h-10 w-auto" />
          </div>
          {launch.showSocialLinks !== false && (
            <div className="flex items-center gap-2">
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d6b58f]/25 bg-white/[.06] text-[#fff8ec] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#d6b58f] hover:bg-[#d6b58f] hover:text-[#171210]" aria-label="WhatsApp"><MessageCircle className="h-5 w-5" /></a>
              <a href="https://www.instagram.com/nexora.eg_wear" target="_blank" rel="noreferrer" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d6b58f]/25 bg-white/[.06] text-[#fff8ec] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#d6b58f] hover:bg-[#d6b58f] hover:text-[#171210]" aria-label="Instagram"><Instagram className="h-5 w-5" /></a>
            </div>
          )}
        </header>

        <div className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1.06fr_.94fr] lg:py-20">
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7 }}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d6b58f]/25 bg-white/[.06] px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#d6b58f] backdrop-blur-xl">
              <Sparkles className="h-4 w-4" /> {copy.eyebrow}
            </div>
            <h1 className="max-w-4xl text-5xl font-black uppercase leading-[0.88] tracking-[-0.08em] text-[#fff8ec] sm:text-7xl lg:text-8xl">
              {copy.title}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#d8c7b0] sm:text-xl">{copy.subtitle}</p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#a99a86]">{copy.announcement}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#d6b58f] px-7 py-4 text-sm font-black uppercase tracking-[0.16em] text-[#171210] shadow-[0_24px_70px_rgba(214,181,143,.30)] transition hover:-translate-y-0.5 hover:shadow-[0_30px_90px_rgba(214,181,143,.42)]">
                <MessageCircle className="h-5 w-5" /> {copy.whatsapp}
              </a>
              <a href="mailto:supportnexorastoree@gmail.com" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[.04] px-7 py-4 text-sm font-black uppercase tracking-[0.16em] text-[#fff8ec] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#d6b58f]/60">
                <Mail className="h-5 w-5" /> support
              </a>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .75, delay: .12 }} className="rounded-[42px] border border-white/12 bg-white/[.07] p-5 shadow-[0_40px_120px_rgba(0,0,0,.40)] backdrop-blur-2xl sm:p-7">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.26em] text-[#d6b58f]"><Clock className="h-4 w-4" /> Launch countdown</div>
                <p className="mt-2 text-sm text-[#b9a994]">{launch.timezone || 'Africa/Cairo'}</p>
              </div>
              <div className="rounded-full border border-[#d6b58f]/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#d6b58f]">Opening soon</div>
            </div>
            {launch.showCountdown !== false && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <TimeBox value={remaining.days} label={copy.days} />
                <TimeBox value={remaining.hours} label={copy.hours} />
                <TimeBox value={remaining.minutes} label={copy.minutes} />
                <TimeBox value={remaining.seconds} label={copy.seconds} />
              </div>
            )}
            {launch.showNotifyForm !== false && (
              <form onSubmit={submit} className="mt-6 rounded-[30px] border border-white/10 bg-[#0b0908]/35 p-4 sm:p-5">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#d6b58f] text-[#171210]"><Bell className="h-5 w-5" /></div>
                  <div>
                    <h2 className="text-lg font-black text-[#fff8ec]">{copy.notifyTitle}</h2>
                    <p className="mt-1 text-sm leading-6 text-[#b9a994]">{copy.notifyText}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={copy.name} className="rounded-2xl border border-white/12 bg-white/[.06] px-4 py-3 text-sm text-[#fff8ec] outline-none placeholder:text-[#a99679] focus:border-[#d6b58f]" />
                  <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={copy.contact} className="rounded-2xl border border-white/12 bg-white/[.06] px-4 py-3 text-sm text-[#fff8ec] outline-none placeholder:text-[#a99679] focus:border-[#d6b58f]" />
                </div>
                <button type="submit" disabled={submitting} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#fff8ec] px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-[#171210] transition hover:-translate-y-0.5 disabled:opacity-60">
                  {submitting ? 'Saving...' : copy.submit} <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </section>
    </main>
  );
}
