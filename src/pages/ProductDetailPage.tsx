// ============================================================
// NEXORA V5 — Product Detail Page (premium PDP)
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  ShoppingBag,
  Truck,
  RotateCcw,
  Shield,
  ChevronRight,
  Minus,
  Plus,
  Star,
  MessageSquare,
  X,
  ZoomIn,
} from 'lucide-react';
import { useWishlistStore } from '@/stores/wishlistStore';
import { useCartStore } from '@/stores/cartStore';
import { useRecentlyViewedStore } from '@/stores/recentlyViewedStore';
import { loadProductBySlug, loadProducts } from '@/services/productService';
import type { Product, Review } from '@/types';
import { formatPrice, calculateDiscount } from '@/lib/utils';
import { SITE_URL } from '@/lib/constants';
import { absoluteUrl } from '@/lib/env';
import { normalizeColors, getColorDisplayName, getColorStyle } from '@/lib/productOptions';
import ProductCard from '@/components/ui/ProductCard';
import SectionReveal from '@/components/ui/SectionReveal';
import toast from 'react-hot-toast';
import { trackEvent } from '@/services/analytics.service';

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColorId, setSelectedColorId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'shipping' | 'reviews'>('description');

  const { isInWishlist, toggleItem } = useWishlistStore();
  const addItem = useCartStore((s) => s.addItem);
  const addRecentlyViewed = useRecentlyViewedStore((s) => s.addProduct);

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
            const { getReviews } = await import('@/lib/supabase/db');
            const loadedReviews = await getReviews({ productId: loadedProduct.id, isApproved: true });
            if (mounted) setReviews(loadedReviews);
          } catch {
            if (mounted) setReviews([]);
          }
          void trackEvent('product_view', { productId: loadedProduct.id, productName: loadedProduct.name, slug: loadedProduct.slug });
        } else {
          setRelatedProducts([]);
          setReviews([]);
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
  const selectedColor = productColors.find((color) => color.id === selectedColorId) || null;
  const selectedSizeData = product.sizes.find((s) => s.size === selectedSize);
  const maxQuantity = Math.max(1, Number(selectedSizeData?.stock || 1));
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
      availability: product.status === 'sold_out' || product.sizes.every((s) => Number(s.stock) <= 0)
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };

  const handleAddToCart = () => {
    if (!selectedSize) {
      toast.error('Please select a size first');
      return;
    }
    if (productColors.length > 0 && !selectedColor) {
      toast.error('Please select a color');
      return;
    }
    if (!selectedSizeData || selectedSizeData.stock < quantity) {
      toast.error('Not enough stock');
      return;
    }
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      size: selectedSize,
      color: selectedColor ? getColorDisplayName(selectedColor) : undefined,
      colorHex: selectedColor?.hex,
      colorPattern: selectedColor?.pattern,
      quantity,
      image: productImages[activeImage] || productImages[0] || '/assets/nexora-logo-bg.jpg',
    });
    void trackEvent('add_to_cart', { productId: product.id, productName: product.name, size: selectedSize, color: selectedColor?.name, quantity });
    toast.success(`${product.name} added to cart`);
  };

  const handleWishlist = () => {
    toggleItem(product.id);
    toast(inWishlist ? 'Removed from wishlist' : 'Added to wishlist', { icon: inWishlist ? '💔' : '❤️' });
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
                        <img src={image} alt={`${product.name} ${index + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
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
                  <img src={productImages[activeImage] || productImages[0] || '/assets/nexora-logo-bg.jpg'} alt={product.name} className="w-full h-full object-cover" decoding="async" />
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
                    <span className="text-[10px] text-[#8a8175]">Choose size first</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((size) => {
                      const isAvailable = size.stock > 0;
                      const isSelected = selectedSize === size.size;
                      const isLowStock = size.stock <= size.lowStockThreshold && isAvailable;
                      return (
                        <button key={size.size} type="button" onClick={() => { if (isAvailable) { setSelectedSize(size.size); void trackEvent('size_select', { productId: product.id, productName: product.name, size: size.size }); } }} disabled={!isAvailable} className={`relative w-11 h-11 flex items-center justify-center text-xs font-medium border transition-all ${isSelected ? 'border-[#c8a96a] text-[#c8a96a] bg-[#c8a96a]/5' : isAvailable ? 'border-[#202024] text-[#b8b0a3] hover:border-[#6f675d] hover:text-[#f4f0e8]' : 'border-[#1a1a1a] text-[#2a2a2d] cursor-not-allowed'}`}>
                          {size.size}
                          {isLowStock && <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#c8a96a] rounded-full" />}
                          {!isAvailable && <span className="absolute inset-0 flex items-center justify-center"><span className="w-6 h-px bg-[#202024] rotate-45" /></span>}
                        </button>
                      );
                    })}
                  </div>
                  {selectedSizeData && <p className="text-[10px] text-[#8a8175] mt-2">{selectedSizeData.stock} units available{selectedSizeData.stock <= selectedSizeData.lowStockThreshold ? ' — low stock' : ''}</p>}
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
                        const isAvailable = !!selectedSize && color.available !== false;
                        return (
                          <button key={color.id} type="button" disabled={!isAvailable} onClick={() => { if (!isAvailable) return; setSelectedColorId(color.id); void trackEvent('color_select', { productId: product.id, productName: product.name, color: color.name }); }} className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs transition-all ${isSelected ? 'border-[#c8a96a] bg-[#c8a96a]/10 text-[#f4f0e8]' : 'border-[#202024] text-[#b8b0a3] hover:border-[#6f675d] hover:text-[#f4f0e8]'} ${!isAvailable ? 'cursor-not-allowed opacity-40' : ''}`}>
                            <span className="h-5 w-5 rounded-full border border-white/25 shadow-inner" style={getColorStyle(color)} />
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

                <div className="flex gap-3 mb-8">
                  <button onClick={handleAddToCart} className="flex-1 nexora-button-primary flex items-center justify-center gap-2 py-4"><ShoppingBag className="w-4 h-4" />Add to Cart</button>
                  <button onClick={handleWishlist} className={`w-14 h-14 flex items-center justify-center border transition-all ${inWishlist ? 'border-[#c8a96a] bg-[#c8a96a]/5 text-[#c8a96a]' : 'border-[#202024] text-[#b8b0a3] hover:border-[#6f675d]'}`} aria-label="Toggle wishlist"><Heart className={`w-5 h-5 ${inWishlist ? 'fill-current' : ''}`} /></button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-8 pb-8 border-b border-[#17171a]">
                  {[
                    { icon: Truck, label: 'Egypt Delivery' },
                    { icon: RotateCcw, label: '14 Day Returns' },
                    { icon: Shield, label: 'COD Checkout' },
                  ].map(({ icon: Icon, label }) => <div key={label} className="flex flex-col items-center gap-2 py-3"><Icon className="w-4 h-4 text-[#8a8175]" /><span className="text-[9px] text-[#8a8175] text-center uppercase tracking-wider">{label}</span></div>)}
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
                  <div><h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#b8b0a3] mb-2">Colors</h4><div className="flex flex-wrap gap-2">{productColors.map((c) => <span key={c.id} className="inline-flex items-center gap-2 rounded-full border border-[#202024] px-3 py-1 text-xs text-[#8a8175]"><span className="h-3 w-3 rounded-full border border-white/20" style={getColorStyle(c)} />{getColorDisplayName(c)}</span>)}</div></div>
                </div>
              </motion.div>
            )}

            {activeTab === 'shipping' && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl"><div className="space-y-4">{[
              ['Delivery', 'We deliver across all Egyptian governorates. Orders typically arrive within 3–7 business days depending on your governorate.'],
              ['Payment', 'Cash on Delivery is currently available for all orders in Egypt. You pay only when the order arrives.'],
              ['Returns', 'Returns can be requested within 14 days when the item is unused and kept in its original condition.']
            ].map(([title, body]) => <div key={title} className="p-4 bg-[#0b0b0d] border border-[#17171a]"><h4 className="text-xs font-bold tracking-wider uppercase text-[#f4f0e8] mb-2">{title}</h4><p className="text-xs text-[#b8b0a3] leading-relaxed">{body}</p></div>)}</div></motion.div>}

            {activeTab === 'reviews' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {visibleReviews.length > 0 ? <div className="space-y-4 max-w-2xl">{visibleReviews.map((review) => <div key={review.id} className="p-5 bg-[#0b0b0d] border border-[#17171a]"><div className="flex items-center gap-2 mb-2"><div className="flex">{Array.from({ length: 5 }).map((_, j) => <Star key={j} className={`w-3 h-3 ${j < review.rating ? 'text-[#c8a96a] fill-[#c8a96a]' : 'text-[#2a2a2d]'}`} />)}</div><span className="text-xs text-[#b8b0a3]">{review.customerName}</span></div><h4 className="text-sm font-semibold text-[#f4f0e8] mb-1">{review.title}</h4><p className="text-xs text-[#b8b0a3] leading-relaxed">{review.body}</p>{review.images && review.images.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3">{review.images.map((image) => <img key={image} src={image} alt={`${review.customerName} review`} loading="lazy" decoding="async" className="h-28 w-full rounded-2xl object-cover" />)}</div>}</div>)}</div> : <div className="text-center py-10"><MessageSquare className="w-8 h-8 text-[#2a2a2d] mx-auto mb-3" /><p className="text-sm text-[#8a8175]">No product reviews have been published yet.</p></div>}
              </motion.div>
            )}
          </div>

          {relatedProducts.length > 0 && <div className="mt-20"><SectionReveal><h2 className="text-xl font-bold tracking-wider uppercase text-[#f4f0e8] mb-8">You May Also Like</h2></SectionReveal><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{relatedProducts.map((p, i) => <ProductCard key={p.slug} product={p} index={i} />)}</div></div>}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#202024] bg-[#050505]/95 p-3 backdrop-blur md:hidden">
        <button onClick={handleAddToCart} className="w-full nexora-button-primary flex items-center justify-center gap-2 py-3"><ShoppingBag className="w-4 h-4" />Add to Cart — {formatPrice(product.price * quantity)}</button>
      </div>

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
