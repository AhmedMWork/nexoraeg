/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================
// NEXORA — Product Detail Page (premium PDP)
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  ShoppingBag,
  ChevronRight,
  Minus,
  Plus,
  Star,
  MessageSquare,
  X,
  ZoomIn,
  Send,
} from 'lucide-react';
import { useWishlistStore } from '@/stores/wishlistStore';
import { useCartStore } from '@/stores/cartStore';
import { useRecentlyViewedStore } from '@/stores/recentlyViewedStore';
import { loadProductBySlug, loadProducts } from '@/services/productService';
import type { Product, ProductVariant, Review } from '@/types';
import { formatPrice, calculateDiscount } from '@/lib/utils';
import { SITE_URL } from '@/lib/constants';
import { absoluteUrl } from '@/lib/env';
import { normalizeColors, getColorDisplayName } from '@/lib/productOptions';
import ProductCard from '@/components/ui/ProductCard';
import SizeGuideModal from '@/components/ui/SizeGuideModal';
import TrustStrip from '@/components/ui/TrustStrip';
import ColorSwatch from '@/components/ui/ColorSwatch';
import OptimizedImage from '@/components/ui/OptimizedImage';
import { buildWhatsAppUrl, normalizeEgyptPhoneForWhatsApp } from '@/lib/whatsapp';
import SectionReveal from '@/components/ui/SectionReveal';
import toast from 'react-hot-toast';
import { trackEvent } from '@/services/analytics.service';
import { trackWhatsAppClick } from '@/lib/analytics/tracker';
import { getSizeDisplayLabel, getWeightRangeForSize, RETURN_EXCHANGE_POLICY_AR, SHIPPING_ESTIMATE_TEXT, SHIPPING_ESTIMATE_TEXT_AR } from '@/lib/sizeLabels';

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColorId, setSelectedColorId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'shipping' | 'reviews'>('description');
  const [reviewDraft, setReviewDraft] = useState({ customerName: '', customerPhone: '', rating: 5, title: '', body: '' });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const { isInWishlist, toggleItem } = useWishlistStore();
  const addItem = useCartStore((s) => s.addItem);
  const addRecentlyViewed = useRecentlyViewedStore((s) => s.addProduct);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    if (!slug) return;
    setIsLoading(true);
    loadProductBySlug(slug)
      .then(async (loadedProduct) => {
        if (!mounted) return;
        setProduct(loadedProduct);
        if (loadedProduct) {
          const products = await loadProducts({ category: loadedProduct.category });
          if (mounted) {
            setRelatedProducts(products.filter((p) => p.slug !== loadedProduct.slug).slice(0, 4));
          }
          try {
            const { getReviews, getPublicProductVariants } = await import('@/lib/supabase/db');
            const [loadedReviews, loadedVariants] = await Promise.all([
              getReviews({ productId: loadedProduct.id, isApproved: true }).catch(() => []),
              getPublicProductVariants(loadedProduct.id).catch(() => []),
            ]);
            if (mounted) {
              setReviews(loadedReviews);
              setVariants(loadedVariants);
            }
          } catch {
            if (mounted) {
              setReviews([]);
              setVariants([]);
            }
          }
          void trackEvent('product_view', { productId: loadedProduct.id, productName: loadedProduct.name, slug: loadedProduct.slug });
        } else {
          setRelatedProducts([]);
          setReviews([]);
          setVariants([]);
        }
      })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [slug]);

  useEffect(() => {
    if (slug) addRecentlyViewed(slug);
  }, [slug, addRecentlyViewed]);

  useEffect(() => {
    setSelectedSize('');
    setSelectedColorId('');
    setQuantity(1);
    setActiveImage(0);
    setIsZoomOpen(false);
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    setSelectedColorId('');
    setQuantity(1);
  }, [selectedSize]);

  if (isLoading) {
    return (
      <div className="pt-32 pb-20 bg-[#050505] min-h-screen">
        <div className="w-full px-4 sm:px-6 lg:px-10">
          <div className="grid lg:grid-cols-7 gap-8 lg:gap-12">
            <div className="lg:col-span-4 aspect-[3/4] bg-[#0b0b0d] skeleton-pulse" />
            <div className="lg:col-span-3 space-y-4">
              <div className="h-4 w-32 bg-[#0b0b0d] skeleton-pulse" />
              <div className="h-10 w-3/4 bg-[#0b0b0d] skeleton-pulse" />
              <div className="h-8 w-40 bg-[#0b0b0d] skeleton-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="pt-32 pb-20 text-center bg-[#050505] min-h-screen">
        <h1 className="text-2xl font-bold mb-4 text-[#f4f0e8]">Product Not Found</h1>
        <Link to="/shop" className="nexora-button">Back to Shop</Link>
      </div>
    );
  }

  const discount = calculateDiscount(product.price, product.compareAtPrice);
  const inWishlist = isInWishlist(product.id);
  const productImages = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const productColors = normalizeColors(product.colors);
  const activeVariants = variants.filter((variant) => variant.status !== 'disabled' && variant.status !== 'sold_out' && variant.status !== 'archived');
  const variantsBySize = new Map<string, ProductVariant[]>();
  activeVariants.forEach((variant) => {
    const sizeKey = String(variant.size || '').toUpperCase();
    if (!sizeKey) return;
    variantsBySize.set(sizeKey, [...(variantsBySize.get(sizeKey) || []), variant]);
  });
  const displaySizes = activeVariants.length
    ? Array.from(variantsBySize.entries()).map(([size, rows]) => {
      const first = rows[0] as ProductVariant | undefined;
      const weightRange = getWeightRangeForSize(size, first?.weightRange);
      return {
        size,
        sizeLabel: getSizeDisplayLabel(size, weightRange, first?.sizeLabel),
        weightRange,
        stock: rows.reduce((sum, row) => sum + Math.max(0, Number(row.stock || 0) - Number(row.reservedStock || 0)), 0),
        lowStockThreshold: Math.min(...rows.map((row) => Number(row.lowStockThreshold || 3))),
      };
    })
    : product.sizes.map((size) => {
      const weightRange = getWeightRangeForSize(size.size);
      return { ...size, sizeLabel: getSizeDisplayLabel(size.size, weightRange), weightRange };
    });
  const selectedColor = productColors.find((color) => color.id === selectedColorId) || null;
  const selectedVariant = activeVariants.find((variant) => {
    const sizeMatch = String(variant.size || '').toUpperCase() === selectedSize;
    if (!sizeMatch) return false;
    if (!selectedColor) return true;
    return String(variant.color || '').toLowerCase() === getColorDisplayName(selectedColor).toLowerCase()
      || String(variant.color || '').toLowerCase() === String(selectedColor.id || '').toLowerCase();
  }) || null;
  const selectedSizeData = activeVariants.length
    ? displaySizes.find((s) => s.size === selectedSize)
    : product.sizes.find((s) => s.size === selectedSize);
  const liveSelectedStock = selectedVariant
    ? Math.max(0, Number(selectedVariant.stock || 0) - Number(selectedVariant.reservedStock || 0))
    : Number(selectedSizeData?.stock || 0);
  const maxQuantity = Math.max(1, liveSelectedStock || 1);
  const visibleReviews = reviews.filter((review) => review.isApproved !== false);
  const averageRating = visibleReviews.length
    ? Math.round((visibleReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / visibleReviews.length) * 10) / 10
    : Number(product.rating || 0);
  const reviewCount = visibleReviews.length || Number(product.reviewCount || 0);
  const canonicalUrl = `${SITE_URL}/product/${product.slug}`;
  const primaryImage = absoluteUrl(productImages[activeImage] || productImages[0] || '/assets/nexora-logo-bg.jpg', SITE_URL);
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: productImages.map((image) => absoluteUrl(image, SITE_URL)),
    description: product.description,
    sku: product.sku,
    brand: { '@type': 'Brand', name: 'NEXORA' },
    aggregateRating: reviewCount > 0 ? { '@type': 'AggregateRating', ratingValue: averageRating, reviewCount } : undefined,
    offers: {
      '@type': 'Offer',
      url: canonicalUrl,
      priceCurrency: 'EGP',
      price: product.price,
      availability: product.status === 'sold_out' || displaySizes.every((s) => Number(s.stock) <= 0)
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE_URL}/shop` },
      { '@type': 'ListItem', position: 3, name: product.category, item: `${SITE_URL}/shop/${product.category}` },
      { '@type': 'ListItem', position: 4, name: product.name, item: canonicalUrl },
    ],
  };

  const selectedSizeLabel = selectedSizeData ? getSizeDisplayLabel(selectedSizeData.size, (selectedSizeData as any).weightRange, (selectedSizeData as any).sizeLabel) : selectedSize;
  const selectedWeightRange = selectedSizeData ? getWeightRangeForSize(selectedSizeData.size, (selectedSizeData as any).weightRange) : '';
  const stockMessage = selectedSizeData
    ? liveSelectedStock <= selectedSizeData.lowStockThreshold
      ? `Only ${liveSelectedStock} left in ${selectedSizeLabel}. Limited by design.`
      : `${liveSelectedStock} pieces available in ${selectedSizeLabel}.`
    : 'Select your size to check live stock.';

  const addSelectedToCart = () => {
    if (!selectedSize) {
      toast.error('Please select a size first');
      return false;
    }
    if (productColors.length > 0 && !selectedColor) {
      toast.error('Please select a color');
      return false;
    }
    if (!selectedSizeData || liveSelectedStock < quantity) {
      toast.error('Not enough stock');
      return false;
    }

    const image = selectedVariant?.imageUrl || productImages[activeImage] || productImages[0] || '/assets/nexora-logo-bg.jpg';
    const colorName = selectedColor ? getColorDisplayName(selectedColor) : undefined;
    addItem({
      productId: product.id,
      variantId: selectedVariant?.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      size: selectedSize,
      sizeLabel: selectedSizeLabel,
      weightRange: selectedWeightRange,
      color: colorName,
      colorHex: selectedColor?.hex,
      colorPattern: selectedColor?.pattern,
      quantity,
      image,
      productSnapshot: {
        productId: product.id,
        variantId: selectedVariant?.id,
        name: product.name,
        slug: product.slug,
        size: selectedSize,
        sizeLabel: selectedSizeLabel,
        weightRange: selectedWeightRange,
        color: colorName,
        image,
        unitPrice: product.price,
        quantity,
      },
    });
    void trackEvent('add_to_cart', { productId: product.id, variantId: selectedVariant?.id, productName: product.name, size: selectedSizeLabel, color: selectedColor?.name, quantity, price: product.price });
    return true;
  };

  const handleAddToCart = () => {
    if (!addSelectedToCart()) return;
    toast.success(`${product.name} added to cart`);
  };


  const submitProductReview = async () => {
    if (!product) return;
    if (!reviewDraft.customerName.trim() || reviewDraft.body.trim().length < 8) {
      toast.error('Please add your name and a clear review before submitting.');
      return;
    }
    setIsSubmittingReview(true);
    try {
      const { submitCustomerReview } = await import('@/lib/supabase/db');
      await submitCustomerReview({
        reviewType: 'product',
        productId: product.id,
        productName: product.name,
        customerName: reviewDraft.customerName,
        customerPhone: reviewDraft.customerPhone,
        rating: reviewDraft.rating,
        title: reviewDraft.title,
        body: reviewDraft.body,
      });
      toast.success('Thanks. Your review will appear after admin approval.');
      setReviewDraft({ customerName: '', customerPhone: '', rating: 5, title: '', body: '' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleBuyNow = () => {
    if (!addSelectedToCart()) return;
    void trackEvent('checkout_start', { itemsCount: quantity, subtotal: product.price * quantity, productId: product.id });
    navigate('/checkout');
  };

  const handleWishlist = () => {
    toggleItem(product.id);
    toast(inWishlist ? 'Removed from wishlist' : 'Added to wishlist', { icon: inWishlist ? '💔' : '❤️' });
  };

  const handleAskWhatsApp = async () => {
    const number = normalizeEgyptPhoneForWhatsApp(import.meta.env.VITE_STORE_WHATSAPP || '201037141322');
    const message = `Hello NEXORA. I need help with ${product.name}${selectedSize ? ` — size ${selectedSize}` : ''}${selectedColor ? ` / ${getColorDisplayName(selectedColor)}` : ''}.`;
    await trackWhatsAppClick({ phone: number, message, productId: product.id, productName: product.name, sourceType: 'product_detail' });
    window.open(buildWhatsAppUrl(number, message), '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <Helmet>
        <title>{product.seoTitle || `${product.name} | NEXORA`}</title>
        <meta name="description" content={product.seoDescription || product.description.slice(0, 160)} />
        <meta property="og:title" content={product.name} />
        <meta property="og:description" content={product.description.slice(0, 160)} />
        <meta property="og:type" content="product" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={primaryImage} />
        <meta property="product:price:amount" content={String(product.price)} />
        <meta property="product:price:currency" content="EGP" />
        <meta name="twitter:image" content={primaryImage} />
        <link rel="canonical" href={canonicalUrl} />
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      <div className="pt-24 pb-28 md:pb-20 bg-[#050505] min-h-screen">
        <div className="w-full px-4 sm:px-6 lg:px-10 mb-8">
          <div className="flex items-center gap-2 text-[10px] text-[#8a8175] uppercase tracking-wider overflow-x-auto">
            <Link to="/" className="hover:text-[#b8b0a3] transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to="/shop" className="hover:text-[#b8b0a3] transition-colors">Shop</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to={`/shop/${product.category}`} className="hover:text-[#b8b0a3] transition-colors capitalize">{product.category}</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-[#b8b0a3] whitespace-nowrap">{product.name}</span>
          </div>
        </div>

        <div className="w-full px-4 sm:px-6 lg:px-10">
          <div className="grid lg:grid-cols-7 gap-8 lg:gap-12">
            <div className="lg:col-span-4">
              <div className="grid gap-4 lg:grid-cols-[86px_minmax(0,1fr)]">
                {productImages.length > 1 && (
                  <div className="order-2 grid grid-cols-4 gap-3 lg:order-1 lg:grid-cols-1 lg:self-start">
                    {productImages.map((image, index) => (
                      <button key={`${image}-${index}`} onClick={() => setActiveImage(index)} className={`aspect-square overflow-hidden rounded-2xl border ${activeImage === index ? 'border-[#c8a96a]' : 'border-[#17171a]'} bg-[#0b0b0d]`}>
                        <OptimizedImage src={image} alt={`${product.name} ${index + 1}`} className="h-full w-full" />
                      </button>
                    ))}
                  </div>
                )}
                <motion.button
                  type="button"
                  onClick={() => setIsZoomOpen(true)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative order-1 aspect-[3/4] overflow-hidden rounded-[28px] bg-[#0b0b0d] lg:order-2 text-left"
                  aria-label="Open product image zoom"
                >
                  <OptimizedImage src={productImages[activeImage] || productImages[0]} alt={product.name} className="h-full w-full" eager />
                  <span className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-[#f4f0e8] backdrop-blur">
                    <ZoomIn className="h-3.5 w-3.5" /> Zoom
                  </span>
                  {discount > 0 && <span className="absolute top-4 left-4 bg-[#c8a96a] text-[#050505] text-[10px] font-bold px-3 py-1.5 tracking-wider uppercase">Save {discount}%</span>}
                </motion.button>
              </div>
            </div>

            <div className="lg:col-span-3">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <p className="text-[10px] tracking-[0.2em] uppercase text-[#c8a96a] mb-2">{product.category} — {product.collection}</p>
                <h1 className="text-2xl lg:text-3xl font-bold text-[#f4f0e8] mb-3">{product.name}</h1>

                <div className="flex items-center gap-2 mb-5">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-3.5 h-3.5 ${i < Math.floor(averageRating) ? 'text-[#c8a96a] fill-[#c8a96a]' : 'text-[#2a2a2d]'}`} />)}
                  </div>
                  <span className="text-xs text-[#b8b0a3]">{averageRating} ({reviewCount} reviews)</span>
                </div>

                <div className="flex items-center gap-3 mb-8 pb-8 border-b border-[#17171a]">
                  <span className="text-3xl font-bold text-[#f4f0e8]">{formatPrice(product.price)}</span>
                  {product.compareAtPrice && <span className="text-lg text-[#8a8175] line-through">{formatPrice(product.compareAtPrice)}</span>}
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium tracking-wider uppercase text-[#b8b0a3]">Size</span>
                    <button type="button" onClick={() => setIsSizeGuideOpen(true)} className="text-[10px] uppercase tracking-[0.16em] text-[#c8a96a] hover:text-[#f4f0e8]">Size guide</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {displaySizes.map((size) => {
                      const isAvailable = Number(size.stock || 0) > 0;
                      const isSelected = selectedSize === size.size;
                      const isLowStock = size.stock <= size.lowStockThreshold && isAvailable;
                      return (
                        <button key={size.size} type="button" onClick={() => { if (isAvailable) { setSelectedSize(size.size); void trackEvent('size_select', { productId: product.id, productName: product.name, size: size.size }); } }} disabled={!isAvailable} className={`relative min-h-12 min-w-[132px] rounded-2xl px-4 py-3 flex items-center justify-center text-xs font-bold border transition-all ${isSelected ? 'border-[#c8a96a] text-[#c8a96a] bg-[#c8a96a]/5' : isAvailable ? 'border-[#202024] text-[#b8b0a3] hover:border-[#6f675d] hover:text-[#f4f0e8]' : 'border-[#1a1a1a] text-[#2a2a2d] cursor-not-allowed'}`}>
                          {(size as any).sizeLabel || getSizeDisplayLabel(size.size)}
                          {isLowStock && <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#c8a96a] rounded-full" />}
                          {!isAvailable && <span className="absolute inset-0 flex items-center justify-center"><span className="w-6 h-px bg-[#202024] rotate-45" /></span>}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 rounded-2xl border border-[#17171a] bg-[#0b0b0d]/60 px-3 py-2 text-[10px] leading-5 text-[#8a8175]">{stockMessage}</p>
                </div>

                {productColors.length > 0 && (
                  <div className="mb-6">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-medium tracking-wider uppercase text-[#b8b0a3]">Color</span>
                      <span className="text-[10px] text-[#8a8175]">{selectedSize ? 'Choose available color' : 'Select size first'}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {productColors.map((color) => {
                        const isSelected = selectedColorId === color.id;
                        const colorName = getColorDisplayName(color).toLowerCase();
                        const isAvailable = !!selectedSize && color.available !== false && (!activeVariants.length || activeVariants.some((variant) => String(variant.size || '').toUpperCase() === selectedSize && Math.max(0, Number(variant.stock || 0) - Number(variant.reservedStock || 0)) > 0 && (String(variant.color || '').toLowerCase() === colorName || String(variant.color || '').toLowerCase() === String(color.id || '').toLowerCase())));
                        return (
                          <button key={color.id} type="button" disabled={!isAvailable} onClick={() => { if (!isAvailable) return; setSelectedColorId(color.id); void trackEvent('color_select', { productId: product.id, productName: product.name, color: color.name }); }} className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs transition-all ${isSelected ? 'border-[#c8a96a] bg-[#c8a96a]/10 text-[#f4f0e8]' : 'border-[#202024] text-[#b8b0a3] hover:border-[#6f675d] hover:text-[#f4f0e8]'} ${!isAvailable ? 'cursor-not-allowed opacity-40' : ''}`}>
                            <ColorSwatch color={color.hex} pattern={color.pattern} label={getColorDisplayName(color)} size="md" />
                            {getColorDisplayName(color)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mb-8">
                  <span className="text-xs font-medium tracking-wider uppercase text-[#b8b0a3] block mb-3">Quantity</span>
                  <div className="flex items-center gap-0">
                    <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-11 h-11 flex items-center justify-center border border-[#202024] text-[#b8b0a3] hover:border-[#6f675d] transition-colors"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="w-14 h-11 flex items-center justify-center border-t border-b border-[#202024] text-sm font-medium">{quantity}</span>
                    <button type="button" disabled={!selectedSizeData || quantity >= maxQuantity} onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))} className="w-11 h-11 flex items-center justify-center border border-[#202024] text-[#b8b0a3] hover:border-[#6f675d] transition-colors disabled:opacity-40"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                <div className="flex gap-3 mb-3">
                  <button onClick={handleAddToCart} className="flex-1 nexora-button-primary flex items-center justify-center gap-2 py-4"><ShoppingBag className="w-4 h-4" />Add to Cart</button>
                  <button onClick={handleWishlist} className={`w-14 h-14 flex items-center justify-center border transition-all ${inWishlist ? 'border-[#c8a96a] bg-[#c8a96a]/5 text-[#c8a96a]' : 'border-[#202024] text-[#b8b0a3] hover:border-[#6f675d]'}`} aria-label="Toggle wishlist"><Heart className={`w-5 h-5 ${inWishlist ? 'fill-current' : ''}`} /></button>
                </div>
                <button onClick={handleBuyNow} className="mb-3 w-full rounded-full bg-[#ef4d52] px-6 py-4 text-sm font-black uppercase tracking-[0.22em] text-white transition-transform hover:scale-[1.01]">Buy It Now</button>
                <button onClick={handleAskWhatsApp} className="mb-8 w-full nexora-button flex items-center justify-center gap-2 py-3"><MessageSquare className="h-4 w-4" />Ask about this piece</button>

                <div className="mb-8 border-b border-[#17171a] pb-8">
                  <TrustStrip compact />
                </div>

                <div className="flex flex-wrap gap-2">
                  {(product.tags || []).map((tag) => <Link key={tag} to={`/shop?tag=${tag}`} className="text-[10px] px-2.5 py-1 bg-[#0b0b0d] text-[#8a8175] border border-[#17171a] hover:border-[#2a2a2d] hover:text-[#b8b0a3] transition-colors uppercase tracking-wider">{tag}</Link>)}
                </div>
              </motion.div>
            </div>
          </div>

          <div className="mt-16 lg:mt-24">
            <div className="flex gap-0 border-b border-[#17171a] mb-8 overflow-x-auto">
              {(['description', 'shipping', 'reviews'] as const).map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 text-xs tracking-[0.15em] uppercase transition-colors border-b-2 ${activeTab === tab ? 'text-[#c8a96a] border-[#c8a96a]' : 'text-[#8a8175] border-transparent hover:text-[#b8b0a3]'}`}>{tab}</button>)}
            </div>

            {activeTab === 'description' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p className="text-sm text-[#b8b0a3] leading-relaxed max-w-2xl mb-6">{product.description}</p>
                <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
                  <div><h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#b8b0a3] mb-2">Materials</h4><ul className="space-y-1">{(product.materials || []).map((m) => <li key={m} className="text-xs text-[#8a8175]">{m}</li>)}</ul></div>
                  <div><h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#b8b0a3] mb-2">Colors</h4><div className="flex flex-wrap gap-2">{productColors.map((c) => <span key={c.id} className="inline-flex items-center gap-2 rounded-full border border-[#202024] px-3 py-1 text-xs text-[#8a8175]"><ColorSwatch color={c.hex} pattern={c.pattern} label={getColorDisplayName(c)} size="sm" />{getColorDisplayName(c)}</span>)}</div></div>
                  <div><h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#b8b0a3] mb-2">Fit</h4><p className="text-xs leading-6 text-[#8a8175]">{product.fit || 'Structured relaxed fit with quiet presence.'}</p></div>
                  <div><h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#b8b0a3] mb-2">Care</h4><p className="text-xs leading-6 text-[#8a8175]">{product.careInstructions || 'Wash inside out with similar colors. Air dry for lasting shape.'}</p></div>
                </div>
              </motion.div>
            )}

            {activeTab === 'shipping' && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl"><div className="space-y-4">{[
              ['Delivery', `Shipping duration: ${SHIPPING_ESTIMATE_TEXT}`],
              ['Payment', `Cash on Delivery, Instapay, Vodafone Cash and ValU installments are available. Manual transfers are confirmed by screenshot on WhatsApp, while ValU is confirmed by the NEXORA team before preparation.`],
              ['Returns & Exchange', RETURN_EXCHANGE_POLICY_AR.join(' ')]
            ].map(([title, body]) => <div key={title} className="p-4 bg-[#0b0b0d] border border-[#17171a]"><h4 className="text-xs font-bold tracking-wider uppercase text-[#f4f0e8] mb-2">{title}</h4><p className="text-xs text-[#b8b0a3] leading-relaxed">{body}</p></div>)}<div className="rounded-3xl border border-[#202024] bg-[#0b0b0d] p-5"><h4 className="text-xs font-bold tracking-wider uppercase text-[#f4f0e8] mb-3">سياسة الاسترجاع والاستبدال</h4><ul className="space-y-2 text-sm leading-6 text-[#b8b0a3] rtl:text-right">{RETURN_EXCHANGE_POLICY_AR.map((item) => <li key={item}>• {item}</li>)}</ul><p className="mt-4 text-xs font-semibold text-[#c8a96a]">مدة الشحن: {SHIPPING_ESTIMATE_TEXT_AR}</p></div></div></motion.div>}

            {activeTab === 'reviews' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
                <div>
                  {visibleReviews.length > 0 ? <div className="space-y-4 max-w-2xl">{visibleReviews.map((review) => <div key={review.id} className="p-5 bg-[#0b0b0d] border border-[#17171a] rounded-3xl"><div className="flex items-center gap-2 mb-2"><div className="flex">{Array.from({ length: 5 }).map((_, j) => <Star key={j} className={`w-3 h-3 ${j < review.rating ? 'text-[#c8a96a] fill-[#c8a96a]' : 'text-[#2a2a2d]'}`} />)}</div><span className="text-xs text-[#b8b0a3]">{review.customerName}</span></div><h4 className="text-sm font-semibold text-[#f4f0e8] mb-1">{review.title}</h4><p className="text-xs text-[#b8b0a3] leading-relaxed">{review.body}</p>{review.images && review.images.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3">{review.images.map((image) => <img key={image} src={image} alt={`${review.customerName} review`} loading="lazy" decoding="async" className="h-28 w-full rounded-2xl object-cover" />)}</div>}</div>)}</div> : <div className="text-center py-10"><MessageSquare className="w-8 h-8 text-[#2a2a2d] mx-auto mb-3" /><p className="text-sm text-[#8a8175]">No product reviews have been published yet.</p></div>}
                </div>
                <div className="rounded-[28px] border border-[#202024] bg-[#0b0b0d] p-5">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#c8a96a]">Write a review</p>
                  <h3 className="mb-4 text-lg font-bold text-[#f4f0e8]">Share your product experience</h3>
                  <div className="grid gap-3">
                    <input value={reviewDraft.customerName} onChange={(e) => setReviewDraft({ ...reviewDraft, customerName: e.target.value })} placeholder="Your name" className="rounded-2xl border border-[#202024] bg-[#050505] px-4 py-3 text-sm text-[#f4f0e8] outline-none focus:border-[#c8a96a]" />
                    <input value={reviewDraft.customerPhone} onChange={(e) => setReviewDraft({ ...reviewDraft, customerPhone: e.target.value })} placeholder="Phone optional" className="rounded-2xl border border-[#202024] bg-[#050505] px-4 py-3 text-sm text-[#f4f0e8] outline-none focus:border-[#c8a96a]" dir="ltr" />
                    <select value={reviewDraft.rating} onChange={(e) => setReviewDraft({ ...reviewDraft, rating: Number(e.target.value) })} className="rounded-2xl border border-[#202024] bg-[#050505] px-4 py-3 text-sm text-[#f4f0e8] outline-none focus:border-[#c8a96a]">{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} stars</option>)}</select>
                    <input value={reviewDraft.title} onChange={(e) => setReviewDraft({ ...reviewDraft, title: e.target.value })} placeholder="Review title optional" className="rounded-2xl border border-[#202024] bg-[#050505] px-4 py-3 text-sm text-[#f4f0e8] outline-none focus:border-[#c8a96a]" />
                    <textarea value={reviewDraft.body} onChange={(e) => setReviewDraft({ ...reviewDraft, body: e.target.value })} rows={5} placeholder="Write your review. Customers cannot upload images; admins can attach images later if needed." className="rounded-2xl border border-[#202024] bg-[#050505] px-4 py-3 text-sm text-[#f4f0e8] outline-none focus:border-[#c8a96a]" />
                  </div>
                  <button onClick={submitProductReview} disabled={isSubmittingReview} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#c8a96a] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-[#050505] disabled:opacity-60"><Send className="h-4 w-4" />{isSubmittingReview ? 'Submitting...' : 'Submit review'}</button>
                </div>
              </motion.div>
            )}
          </div>

          {relatedProducts.length > 0 && <div className="mt-20"><SectionReveal><h2 className="text-xl font-bold tracking-wider uppercase text-[#f4f0e8] mb-8">You May Also Like</h2></SectionReveal><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{relatedProducts.map((p, i) => <ProductCard key={p.slug} product={p} index={i} />)}</div></div>}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#202024] bg-[#050505]/95 p-3 backdrop-blur md:hidden">
        <div className="grid grid-cols-2 gap-2"><button onClick={handleAddToCart} className="nexora-button flex items-center justify-center gap-2 py-3"><ShoppingBag className="w-4 h-4" />Cart</button><button onClick={handleBuyNow} className="rounded-full bg-[#ef4d52] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white">Buy Now</button></div>
      </div>

      <SizeGuideModal open={isSizeGuideOpen} onClose={() => setIsSizeGuideOpen(false)} />

      <AnimatePresence>
        {isZoomOpen && (
          <motion.div className="fixed inset-0 z-[9998] bg-black/90 p-4 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsZoomOpen(false)}>
            <button type="button" className="absolute right-5 top-5 rounded-full border border-white/20 p-3 text-white" onClick={() => setIsZoomOpen(false)} aria-label="Close image zoom"><X className="h-5 w-5" /></button>
            <motion.img src={productImages[activeImage] || productImages[0] || '/assets/nexora-logo-bg.jpg'} alt={product.name} className="max-h-[90vh] max-w-[94vw] object-contain" initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }} onClick={(e) => e.stopPropagation()} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
