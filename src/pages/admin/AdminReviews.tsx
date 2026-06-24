import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, ImagePlus, Plus, RefreshCw, Star, Trash2, X, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadProductImage } from '@/services/upload.service';
import type { Product, Review } from '@/types';

interface ReviewDraft {
  productId: string;
  productName: string;
  customerName: string;
  customerPhone?: string;
  rating: number;
  title: string;
  body: string;
  images: string[];
  isApproved: boolean;
  isFeatured: boolean;
  helpfulCount: number;
  adminReply?: string;
}

const emptyDraft: ReviewDraft = {
  productId: 'brand',
  productName: 'NEXORA Experience',
  customerName: '',
  customerPhone: '',
  rating: 5,
  title: '',
  body: '',
  images: [],
  isApproved: true,
  isFeatured: true,
  helpfulCount: 0,
  adminReply: '',
};

const ratingOptions = Array.from({ length: 10 }, (_, index) => (index + 1) / 2);

type ReviewFilter = 'all' | 'pending' | 'published' | 'hidden' | 'featured';

function Field({ label, help, children }: { label: string; help: string; children: React.ReactNode }) {
  return <div className="studio-field"><label>{label}</label>{children}<p className="studio-help">{help}</p></div>;
}

function reviewStatus(review: Review) {
  if (review.status) return review.status;
  return review.isApproved ? 'published' : 'pending';
}

function statusClass(status: string) {
  if (status === 'published') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'pending') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'rejected') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-[#e6ded1] bg-[#faf7f1] text-[#5f584f]';
}

export default function AdminReviews() {
  const [searchParams] = useSearchParams();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [draft, setDraft] = useState<ReviewDraft>(emptyDraft);

  const loadReviews = async () => {
    setIsLoading(true);
    try {
      const { getReviews } = await import('@/lib/supabase/db');
      setReviews(await getReviews());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load reviews');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadReviews(); }, []);
  useEffect(() => {
    let mounted = true;
    import('@/lib/supabase/db')
      .then(({ getAdminProducts }) => getAdminProducts())
      .then((rows) => { if (mounted) setProducts(rows); })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const productId = searchParams.get('productId');
    if (!productId) return;
    const product = products.find((p) => p.id === productId);
    setDraft((current) => ({ ...current, productId, productName: product?.name || productId, isFeatured: false }));
    setIsCreating(true);
  }, [products, searchParams]);

  const stats = useMemo(() => ({
    pending: reviews.filter((r) => reviewStatus(r) === 'pending').length,
    published: reviews.filter((r) => reviewStatus(r) === 'published').length,
    featured: reviews.filter((r) => r.isFeatured).length,
    hidden: reviews.filter((r) => !r.isApproved && reviewStatus(r) !== 'pending').length,
  }), [reviews]);

  const filteredReviews = useMemo(() => {
    if (filter === 'pending') return reviews.filter((r) => reviewStatus(r) === 'pending');
    if (filter === 'published') return reviews.filter((r) => reviewStatus(r) === 'published');
    if (filter === 'hidden') return reviews.filter((r) => !r.isApproved && reviewStatus(r) !== 'pending');
    if (filter === 'featured') return reviews.filter((r) => r.isFeatured);
    return reviews;
  }, [reviews, filter]);

  const updateDraft = <K extends keyof ReviewDraft>(key: K, value: ReviewDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const uploadReviewImage = async (file?: File | null) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadProductImage(file, 'reviews');
      updateDraft('images', [...draft.images, url]);
      toast.success('Review image uploaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not upload review image');
    } finally {
      setIsUploading(false);
    }
  };

  const createStudioReview = async () => {
    if (!draft.customerName.trim() || !draft.body.trim()) { toast.error('Customer name and review body are required'); return; }
    try {
      const { createReview } = await import('@/lib/supabase/db');
      await createReview(draft as unknown as Omit<Review, 'id' | 'createdAt'>);
      toast.success('Review saved');
      setDraft(emptyDraft);
      setIsCreating(false);
      void loadReviews();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create review');
    }
  };

  const patchReview = async (review: Review, patch: Partial<Review>, message: string) => {
    try {
      const { updateReview } = await import('@/lib/supabase/db');
      await updateReview(review.id, patch);
      setReviews((current) => current.map((r) => r.id === review.id ? { ...r, ...patch } : r));
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update review');
    }
  };

  const deleteReviewById = async (id: string) => {
    if (!window.confirm('Archive this review?')) return;
    try {
      const { deleteReview } = await import('@/lib/supabase/db');
      await deleteReview(id);
      setReviews((current) => current.filter((r) => r.id !== id));
      toast.success('Review archived');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not archive review');
    }
  };

  return (
    <div className="space-y-6 text-[#2b211d]" dir="ltr">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a8461]">CUSTOMER VOICE</p>
          <h1 className="mt-2 text-2xl font-black text-[#2b211d]">Reviews Management</h1>
          <p className="mt-1 text-sm text-[#8a8175]">Moderate customer reviews, feature the best stories, and attach images from admin only.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'pending', 'published', 'hidden', 'featured'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} data-active={filter === f} className="studio-chip capitalize">{f}</button>)}
          <button onClick={loadReviews} className="nexora-button"><RefreshCw className="h-4 w-4" />Refresh</button>
          <button onClick={() => setIsCreating((v) => !v)} className="nexora-button-primary"><Plus className="h-4 w-4" />Add Review</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[['Pending', stats.pending], ['Published', stats.published], ['Featured', stats.featured], ['Hidden', stats.hidden]].map(([label, value]) => <div key={label} className="rounded-[26px] border border-[#e6ded1] bg-white p-4"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a8461]">{label}</p><p className="mt-3 text-3xl font-black">{value}</p></div>)}
      </div>

      {isCreating && (
        <div className="rounded-[30px] border border-[#e6ded1] bg-white p-5 shadow-[0_18px_50px_rgba(43,33,29,0.06)] sm:p-7 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Customer display name" help="Shown on the public reviews page. Example: Yasmine S."><input className="studio-input" value={draft.customerName} onChange={(e) => updateDraft('customerName', e.target.value)} /></Field>
            <Field label="Product review belongs to" help="Choose a product. Use Brand Experience for general site reviews."><select className="studio-input" value={draft.productId} onChange={(e) => { const value = e.target.value; const product = products.find((p) => p.id === value); updateDraft('productId', value); updateDraft('productName', product?.name || 'NEXORA Experience'); }}><option value="brand">Brand Experience / General Review</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} — {product.sku}</option>)}</select></Field>
            <Field label="Title" help="Short headline. Optional but useful for scanning."><input className="studio-input" value={draft.title} onChange={(e) => updateDraft('title', e.target.value)} /></Field>
            <Field label="Rating" help="Supports 0.5 increments from 0.5 to 5."><select className="studio-input" value={draft.rating} onChange={(e) => updateDraft('rating', Number(e.target.value))}>{ratingOptions.map((rating) => <option key={rating} value={rating}>{rating} stars</option>)}</select></Field>
            <Field label="Review text" help="Write a real, clear customer note. Avoid fake or exaggerated wording."><textarea className="studio-input" rows={5} value={draft.body} onChange={(e) => updateDraft('body', e.target.value)} /></Field>
            <Field label="Admin-only review image" help="Customers cannot upload images. Only admins can attach images to a review.">
              <label className="nexora-button cursor-pointer"><ImagePlus className="h-4 w-4" />{isUploading ? 'Uploading...' : 'Upload image'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => uploadReviewImage(e.target.files?.[0])} /></label>
              <div className="mt-3 grid grid-cols-2 gap-2">{draft.images.map((url) => <div key={url} className="relative"><img src={url} alt="review" className="h-24 w-full rounded-2xl object-cover" /><button onClick={() => updateDraft('images', draft.images.filter((img) => img !== url))} className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white"><X className="h-3 w-3" /></button></div>)}</div>
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-[#5f584f]"><label className="flex items-center gap-2"><input type="checkbox" checked={draft.isApproved} onChange={(e) => updateDraft('isApproved', e.target.checked)} /> Published</label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.isFeatured} onChange={(e) => updateDraft('isFeatured', e.target.checked)} /> Featured on Home</label></div>
          <div className="flex gap-3"><button onClick={() => setIsCreating(false)} className="nexora-button">Cancel</button><button onClick={createStudioReview} className="nexora-button-primary">Save Review</button></div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {isLoading ? <div className="rounded-[28px] border border-[#e6ded1] bg-white p-8 text-center text-sm text-[#8a8175]">Loading reviews...</div> : filteredReviews.length ? filteredReviews.map((review) => {
          const status = reviewStatus(review);
          return (
            <article key={review.id} className="rounded-[30px] border border-[#e6ded1] bg-white p-5 shadow-[0_18px_50px_rgba(43,33,29,0.06)]">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div><div className="mb-1 flex items-center gap-2"><div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i + 1 <= Math.ceil(review.rating) ? 'fill-[#D2B48C] text-[#D2B48C]' : 'text-[#d7cec2]'}`} />)}</div><span className="text-xs font-medium text-[#2b211d]">{review.rating.toFixed(1)}</span></div><h2 className="text-sm font-semibold text-[#2b211d]">{review.title || review.customerName}</h2><p className="text-[10px] text-[#8a8175]">by {review.customerName} — {review.productName || 'NEXORA Experience'}</p></div>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusClass(status)}`}>{status}</span>
              </div>
              {review.images?.[0] && <img src={review.images[0]} alt={review.customerName} className="mb-4 h-36 w-full rounded-2xl object-cover" />}
              <p className="text-sm leading-7 text-[#5f584f]">{review.body}</p>
              {review.adminReply && <p className="mt-3 rounded-2xl border border-[#efe8dc] bg-[#faf7f1] p-3 text-xs leading-6 text-[#5f584f]"><strong>NEXORA reply:</strong> {review.adminReply}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => patchReview(review, { isApproved: true, status: 'published' }, 'Review published')} className="nexora-button"><CheckCircle2 className="h-4 w-4" />Approve</button>
                <button onClick={() => patchReview(review, { isApproved: false, status: 'rejected' }, 'Review rejected')} className="nexora-button"><XCircle className="h-4 w-4" />Reject</button>
                <button onClick={() => patchReview(review, { isApproved: !review.isApproved, status: review.isApproved ? 'hidden' : 'published' }, review.isApproved ? 'Review hidden' : 'Review published')} className="nexora-button">{review.isApproved ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{review.isApproved ? 'Hide' : 'Show'}</button>
                <button onClick={() => patchReview(review, { isFeatured: !review.isFeatured }, review.isFeatured ? 'Removed from featured' : 'Featured review')} className="nexora-button"><Star className="h-4 w-4" />{review.isFeatured ? 'Unfeature' : 'Feature'}</button>
                <button onClick={() => deleteReviewById(review.id)} className="nexora-button text-red-700"><Trash2 className="h-4 w-4" />Archive</button>
              </div>
            </article>
          );
        }) : <div className="rounded-[28px] border border-[#e6ded1] bg-white p-8 text-center text-sm text-[#8a8175]">No reviews found.</div>}
      </div>
    </div>
  );
}
