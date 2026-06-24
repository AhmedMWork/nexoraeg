import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Quote, Send, Star } from 'lucide-react';
import SectionReveal from '@/components/ui/SectionReveal';
import StarRating from '@/components/ui/StarRating';
import type { Review } from '@/types';
import { useI18n } from '@/i18n/I18nProvider';
import toast from 'react-hot-toast';

export default function ReviewsPage() {
  const { lang, t } = useI18n();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draft, setDraft] = useState({ customerName: '', customerPhone: '', rating: 5, title: '', body: '', experienceType: 'Website experience' });

  useEffect(() => {
    let mounted = true;
    import('@/lib/supabase/db')
      .then(({ getReviews }) => getReviews({ isApproved: true }))
      .then((loadedReviews) => { if (mounted) setReviews(loadedReviews); })
      .catch(() => { if (mounted) setReviews([]); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  const averageRating = useMemo(() => (
    reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0
  ), [reviews]);

  const ratingCounts = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((r) => Math.floor(r.rating) === rating).length,
  }));

  const submitReview = async () => {
    if (!draft.customerName.trim() || draft.body.trim().length < 8) {
      toast.error(lang === 'ar' ? 'اكتب اسمك وتقييم واضح قبل الإرسال.' : 'Please add your name and a clear review before submitting.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { submitCustomerReview } = await import('@/lib/supabase/db');
      await submitCustomerReview({ reviewType: 'site', customerName: draft.customerName, customerPhone: draft.customerPhone, rating: draft.rating, title: draft.title, body: draft.body, experienceType: draft.experienceType });
      toast.success(lang === 'ar' ? 'تم إرسال تقييمك وسيظهر بعد مراجعته.' : 'Thanks. Your review was submitted and will appear after approval.');
      setDraft({ customerName: '', customerPhone: '', rating: 5, title: '', body: '', experienceType: 'Website experience' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{lang === 'ar' ? 'التقييمات' : 'Reviews'} | NEXORA</title>
        <meta name="description" content={lang === 'ar' ? 'تقييمات منشورة من NEXORA Studio.' : 'Published NEXORA Studio customer reviews.'} />
      </Helmet>

      <main className="min-h-screen bg-[var(--v33-bg)] pt-24 pb-20 text-[var(--v33-text)]">
        <div className="w-full px-4 sm:px-6 lg:px-10">
          <SectionReveal>
            <p className="v3-kicker mb-3">NEXORA</p>
            <h1 className="nexora-heading-md mb-4">{lang === 'ar' ? 'تقييمات العملاء' : 'Customer Reviews'}</h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--v33-muted)]">
              {lang === 'ar' ? 'شارك تجربتك مع NEXORA. التقييمات تظهر بعد مراجعتها من الفريق.' : 'Share your NEXORA experience. Reviews are published after moderation by the team.'}
            </p>
          </SectionReveal>

          <SectionReveal delay={0.08}>
            <div className="my-10 grid gap-6 rounded-[28px] border border-[var(--v33-border)] bg-[var(--v33-card)] p-6 shadow-[0_24px_70px_var(--v33-shadow)] lg:grid-cols-[0.85fr_1.15fr]">
              <div className="flex flex-col items-center justify-center rounded-[24px] border border-[var(--v33-border)] bg-[var(--v33-bg-soft)] p-6">
                <p className="text-5xl font-bold text-[var(--v33-text)]">{averageRating ? averageRating.toFixed(1) : '—'}</p>
                <StarRating rating={averageRating} size={18} className="my-2" />
                <p className="text-xs text-[var(--v33-muted)]">{reviews.length} {lang === 'ar' ? 'تقييم منشور' : 'published reviews'}</p>
                <div className="mt-6 w-full space-y-2">
                  {ratingCounts.map(({ rating, count }) => (
                    <div key={rating} className="flex items-center gap-3">
                      <span className="w-3 text-xs text-[var(--v33-muted)]">{rating}</span>
                      <Star className="h-3 w-3 fill-[var(--v33-accent)] text-[var(--v33-accent)]" />
                      <div className="h-1.5 flex-1 rounded-full bg-[var(--v33-bg)]"><div className="h-full rounded-full bg-[var(--v33-accent)]" style={{ width: `${reviews.length ? (count / reviews.length) * 100 : 0}%` }} /></div>
                      <span className="w-6 text-right text-[10px] text-[var(--v33-muted)]">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-[var(--v33-border)] bg-[var(--v33-card)] p-5">
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--v33-accent)]">{lang === 'ar' ? 'اكتب تقييمًا' : 'Write a review'}</p>
                <h2 className="mb-4 text-xl font-bold text-[var(--v33-text)]">{lang === 'ar' ? 'شاركنا رأيك في NEXORA' : 'Tell us about your experience'}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={draft.customerName} onChange={(e) => setDraft({ ...draft, customerName: e.target.value })} placeholder={lang === 'ar' ? 'اسمك' : 'Your name'} className="rounded-2xl border border-[var(--v33-border)] bg-[var(--v33-bg)] px-4 py-3 text-sm outline-none focus:border-[var(--v33-accent)]" />
                  <input value={draft.customerPhone} onChange={(e) => setDraft({ ...draft, customerPhone: e.target.value })} placeholder={lang === 'ar' ? 'رقم الهاتف اختياري' : 'Phone optional'} className="rounded-2xl border border-[var(--v33-border)] bg-[var(--v33-bg)] px-4 py-3 text-sm outline-none focus:border-[var(--v33-accent)]" dir="ltr" />
                  <select value={draft.rating} onChange={(e) => setDraft({ ...draft, rating: Number(e.target.value) })} className="rounded-2xl border border-[var(--v33-border)] bg-[var(--v33-bg)] px-4 py-3 text-sm outline-none focus:border-[var(--v33-accent)]">{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} stars</option>)}</select>
                  <select value={draft.experienceType} onChange={(e) => setDraft({ ...draft, experienceType: e.target.value })} className="rounded-2xl border border-[var(--v33-border)] bg-[var(--v33-bg)] px-4 py-3 text-sm outline-none focus:border-[var(--v33-accent)]"><option>Website experience</option><option>Product quality</option><option>Delivery</option><option>Customer service</option></select>
                  <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={lang === 'ar' ? 'عنوان التقييم اختياري' : 'Review title optional'} className="rounded-2xl border border-[var(--v33-border)] bg-[var(--v33-bg)] px-4 py-3 text-sm outline-none focus:border-[var(--v33-accent)] sm:col-span-2" />
                  <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={5} placeholder={lang === 'ar' ? 'اكتب تقييمك هنا. العميل لا يستطيع رفع صور، والصور يضيفها الأدمن فقط إذا لزم.' : 'Write your review here. Customers cannot upload images; admins can attach images later if needed.'} className="rounded-2xl border border-[var(--v33-border)] bg-[var(--v33-bg)] px-4 py-3 text-sm outline-none focus:border-[var(--v33-accent)] sm:col-span-2" />
                </div>
                <button onClick={submitReview} disabled={isSubmitting} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--v33-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-[#2b211d] disabled:opacity-60"><Send className="h-4 w-4" />{isSubmitting ? (lang === 'ar' ? 'جاري الإرسال...' : 'Submitting...') : (lang === 'ar' ? 'إرسال التقييم' : 'Submit review')}</button>
              </div>
            </div>
          </SectionReveal>

          {isLoading ? (
            <div className="rounded-[24px] border border-[var(--v33-border)] bg-[var(--v33-card)] p-10 text-center text-sm text-[var(--v33-muted)]">{t('common.loading')}</div>
          ) : reviews.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {reviews.map((review, i) => (
                <SectionReveal key={review.id} delay={i * 0.04}>
                  <article className="h-full rounded-[28px] border border-[var(--v33-border)] bg-[var(--v33-card)] p-5 shadow-[0_24px_70px_var(--v33-shadow)]">
                    {review.images?.[0] && <img src={review.images[0]} alt={review.customerName} className="mb-5 h-48 w-full rounded-[22px] object-cover" />}
                    <Quote className="mb-3 h-5 w-5 text-[var(--v33-accent)]/40" />
                    <StarRating rating={review.rating} size={13} className="mb-3" />
                    {review.title && <h2 className="mb-2 text-sm font-semibold text-[var(--v33-text)]">{review.title}</h2>}
                    <p className="mb-5 text-sm leading-7 text-[var(--v33-muted)]">{review.body}</p>
                    {review.adminReply && <p className="mb-5 rounded-2xl border border-[var(--v33-border)] bg-[var(--v33-bg-soft)] p-3 text-xs leading-6 text-[var(--v33-muted)]"><strong>NEXORA:</strong> {review.adminReply}</p>}
                    <div className="border-t border-[var(--v33-border)] pt-4"><p className="text-sm font-semibold text-[var(--v33-text)]">{review.customerName}</p>{review.productName && <p className="text-xs text-[var(--v33-subtle)]">{review.productName}</p>}</div>
                  </article>
                </SectionReveal>
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] border border-[var(--v33-border)] bg-[var(--v33-card)] p-10 text-center text-sm leading-7 text-[var(--v33-muted)]">
              {lang === 'ar' ? 'لا توجد تقييمات منشورة حتى الآن. كن أول من يشارك تجربته.' : 'No reviews are published yet. Be the first to share your experience.'}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
