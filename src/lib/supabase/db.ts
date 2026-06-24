/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================
// NEXORA V4 — Supabase Data Layer
// Supabase compatibility API for the existing storefront/admin.
// Public reads use RLS-protected tables. Sensitive writes use Edge
// Functions with a Studio token.
// ============================================================

import { supabase, invokeStudioFunction, getStudioToken } from './client';
import { DEFAULT_HOME_COLLECTION_TILES, normalizeHomeTiles, type HomeCollectionTile } from '@/content/homeTiles';
import { DEFAULT_FOLLOWUP_TYPES, DEFAULT_ORDER_WORKFLOW_STATUSES, normalizeFollowupTypes, normalizeOrderWorkflow, type FollowupTypeConfig, type WorkflowStatus } from '@/lib/workflow';
import type {
  Product,
  ProductVariant,
  Order,
  Review,
  Coupon,
  Promotion,
  Drop,
  InventoryLog,
  AuditLog,
  NewsletterSubscriber,
  ContactMessage,
  SiteSettings,
  OrderStatus,
} from '@/types';

function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  return new Date(String(value));
}

function normalizeImages(row: Record<string, any>): string[] {
  const images = row.images ?? [];
  if (Array.isArray(images)) {
    return images.map((img) => typeof img === 'string' ? img : (img.public_url || img.url)).filter(Boolean);
  }
  return [];
}

function rowToProduct(row: Record<string, any>): Product {
  const sizesRaw = row.sizes ?? [];
  const stockBySize = row.stock_by_size ?? {};
  const sizes = Array.isArray(sizesRaw) && sizesRaw.length > 0
    ? sizesRaw.map((size: any) => typeof size === 'string'
      ? { size, stock: Number(stockBySize[size] ?? 0), lowStockThreshold: 3 }
      : { size: String(size.size || size.label || 'M'), stock: Number(size.stock ?? stockBySize[size.size] ?? 0), lowStockThreshold: Number(size.lowStockThreshold ?? size.low_stock_threshold ?? 3) })
    : Object.entries(stockBySize).map(([size, stock]) => ({ size, stock: Number(stock), lowStockThreshold: 3 }));

  return {
    id: row.id,
    name: row.name || row.name_en || 'NEXORA Product',
    slug: row.slug,
    description: row.description || row.description_en || '',
    shortDescription: row.shortDescription || row.short_description || row.short_description_en || '',
    price: Number(row.price || 0),
    compareAtPrice: row.compare_at_price ? Number(row.compare_at_price) : row.compareAtPrice,
    costPrice: row.cost_price ? Number(row.cost_price) : row.costPrice,
    category: (row.gender || row.category || 'unisex') as Product['category'],
    gender: (row.gender || row.category || 'unisex') as Product['gender'],
    collection: row.collection || row.collection_id || 'Essentials',
    dropId: row.drop_id || row.dropId,
    images: normalizeImages(row),
    thumbnail: row.thumbnail || normalizeImages(row)[0],
    sizes,
    colors: Array.isArray(row.colors) ? row.colors : [],
    materials: Array.isArray(row.materials) ? row.materials : [row.material_en || row.material || 'Premium fabric'].filter(Boolean),
    fit: row.fit || row.fit_en,
    careInstructions: row.care || row.care_en || row.care_instructions,
    sku: row.sku || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    status: row.status || 'active',
    visibility: row.visibility || 'public',
    badges: Array.isArray(row.badges) ? row.badges : [],
    isFeatured: Boolean(row.featured ?? row.is_featured ?? row.isFeatured),
    isNewArrival: Boolean(row.new_arrival ?? row.is_new_arrival ?? row.isNewArrival),
    isBestSeller: Boolean(row.best_seller ?? row.is_best_seller ?? row.isBestSeller),
    isLimitedDrop: Boolean(row.is_limited ?? row.isLimitedDrop),
    rating: Number(row.rating || 0),
    reviewCount: Number(row.review_count || row.reviewCount || 0),
    seoTitle: row.seo_title || row.seoTitle || row.name_en || row.name || 'NEXORA',
    seoDescription: row.seo_description || row.seoDescription || row.description_en || row.description || '',
    createdAt: toDate(row.created_at || row.createdAt),
    updatedAt: toDate(row.updated_at || row.updatedAt),
  };
}

function productToRow(product: Partial<Product>): Record<string, any> {
  return {
    name_en: product.name,
    slug: product.slug,
    sku: product.sku,
    description_en: product.description,
    short_description_en: product.shortDescription,
    gender: product.gender || product.category,
    category: product.category,
    price: product.price,
    compare_at_price: product.compareAtPrice,
    stock_total: product.sizes?.reduce((sum, s) => sum + Number(s.stock || 0), 0),
    stock_by_size: product.sizes?.reduce((acc, s) => ({ ...acc, [s.size]: Number(s.stock || 0) }), {}),
    sizes: product.sizes?.map((s) => s.size),
    colors: product.colors,
    images: product.images?.map((url) => ({ url, public_url: url, source: 'supabase_storage' })),
    status: product.status,
    is_limited: product.isLimitedDrop,
    drop_id: product.dropId,
    featured: product.isFeatured,
    best_seller: product.isBestSeller,
    new_arrival: product.isNewArrival,
    material_en: product.materials?.join(', '),
    fit_en: product.fit,
    care_en: product.careInstructions,
    seo_title: product.seoTitle,
    seo_description: product.seoDescription,
    updated_at: new Date().toISOString(),
  };
}


function rowToVariant(row: Record<string, any>): ProductVariant {
  return {
    id: row.id,
    productId: row.product_id || row.productId,
    size: row.size || '',
    color: row.color || '',
    sku: row.sku || undefined,
    stock: Number(row.stock || 0),
    reservedStock: Number(row.reserved_stock || row.reservedStock || 0),
    lowStockThreshold: Number(row.low_stock_threshold || row.lowStockThreshold || 3),
    imageUrl: row.image_url || row.imageUrl || undefined,
    sizeLabel: row.size_label || row.sizeLabel || undefined,
    weightRange: row.weight_range || row.weightRange || undefined,
    barcode: row.barcode || undefined,
    status: row.status || 'active',
    sortOrder: Number(row.sort_order || row.sortOrder || 0),
    createdAt: row.created_at ? toDate(row.created_at) : undefined,
    updatedAt: row.updated_at ? toDate(row.updated_at) : undefined,
  };
}


async function edgeErrorMessage(functionName: string, error: unknown, fallback: string): Promise<string> {
  const anyError = error as any;
  const response = anyError?.context;
  try {
    if (response && typeof response.clone === 'function') {
      const payload = await response.clone().json().catch(() => null);
      if (payload?.error) return String(payload.error);
      if (payload?.message) return String(payload.message);
      if (payload?.reason) return String(payload.reason);
    }
  } catch {
    // keep fallback
  }
  const raw = String(anyError?.message || fallback || '');
  if (/non-2xx/i.test(raw)) return `${functionName} failed. Check product stock, shipping rules, and Supabase migrations from NEXORA HQ → Controls.`;
  if (/failed to fetch|network|timeout/i.test(raw)) return 'Connection failed while placing the order. Please check your connection and try again once.';
  return raw || fallback;
}

function variantToRow(variant: Partial<ProductVariant>): Record<string, any> {
  const row: Record<string, any> = {
    id: variant.id,
    product_id: variant.productId,
    size: variant.size,
    color: variant.color,
    sku: variant.sku,
    stock: variant.stock,
    reserved_stock: variant.reservedStock,
    low_stock_threshold: variant.lowStockThreshold,
    image_url: variant.imageUrl,
    size_label: variant.sizeLabel,
    weight_range: variant.weightRange,
    barcode: variant.barcode,
    status: variant.status,
    sort_order: variant.sortOrder,
    updated_at: new Date().toISOString(),
  };
  Object.keys(row).forEach((key) => row[key] === undefined && delete row[key]);
  return row;
}

function rowToDrop(row: Record<string, any>): Drop {
  return {
    id: row.id,
    name: row.name || row.name_en || '',
    slug: row.slug,
    description: row.description || row.description_en || '',
    heroImage: row.hero_image || row.heroImage || '',
    status: row.status || 'draft',
    launchDate: toDate(row.starts_at || row.launchDate || row.launch_date),
    endDate: row.ends_at || row.endDate || row.end_date ? toDate(row.ends_at || row.endDate || row.end_date) : undefined,
    productIds: Array.isArray(row.product_ids) ? row.product_ids : (Array.isArray(row.productIds) ? row.productIds : []),
    isLimited: true,
    showCountdown: Boolean(row.show_countdown ?? row.showCountdown),
    seoTitle: row.seo_title || row.seoTitle,
    seoDescription: row.seo_description || row.seoDescription,
    createdAt: toDate(row.created_at || row.createdAt),
    updatedAt: row.updated_at ? toDate(row.updated_at) : undefined,
  };
}

function rowToOrder(row: Record<string, any>, items: any[] = []): Order {
  return {
    id: row.id,
    orderNumber: row.order_number || row.orderNumber,
    customer: {
      fullName: row.customer_name || row.customer?.fullName || '',
      phone: row.customer_phone || row.customer?.phone || '',
      email: row.customer_email || row.customer?.email,
      governorate: row.governorate || row.customer?.governorate || '',
      city: row.city || row.customer?.city || '',
      address: row.address || row.customer?.address || '',
      notes: row.notes || row.customer?.notes,
    },
    items: items.map((item) => ({
      productId: item.product_id || item.productId,
      variantId: item.variant_id || item.variantId,
      name: item.product_name || item.name,
      slug: item.slug || '',
      price: Number(item.unit_price || item.price || 0),
      size: item.size || '',
      color: item.color || item.selected_color_name || '',
      colorHex: item.color_hex || item.selected_color_hex || undefined,
      quantity: Number(item.quantity || 1),
      image: item.product_image_url || item.image || '',
      sizeLabel: item.size_label || item.sizeLabel || item.product_snapshot?.sizeLabel || undefined,
      weightRange: item.weight_range || item.weightRange || item.product_snapshot?.weightRange || undefined,
      lineTotal: Number(item.total || item.line_total || (Number(item.unit_price || item.price || 0) * Number(item.quantity || 1))),
      productSnapshot: item.product_snapshot || {},
    })),
    subtotal: Number(row.subtotal || 0),
    shippingFee: Number(row.shipping_fee || row.shippingFee || 0),
    discount: Number(row.discount_total || row.discount || 0),
    couponCode: row.coupon_code || row.couponCode,
    total: Number(row.total || 0),
    paymentMethod: row.payment_method || 'cod',
    paymentStatus: row.payment_status || 'pending',
    status: row.order_status || row.status || 'pending',
    trackingUpdates: Array.isArray(row.status_history) ? row.status_history : [],
    adminNotes: row.admin_notes || row.adminNotes,
    customerNotes: row.notes || row.customerNotes,
    source: row.source || 'web',
    shippingStatus: row.shipping_status || row.shippingStatus || 'not_created',
    shippingProvider: row.shipping_provider || row.shippingProvider,
    trackingNumber: row.tracking_number || row.trackingNumber,
    deliveryEstimate: row.delivery_estimate || row.deliveryEstimate,
    codFee: Number(row.cod_fee || row.codFee || 0),
    paymentReference: row.payment_reference || row.paymentReference,
    paymentNotes: row.payment_notes || row.paymentNotes,
    paymentConfirmationPhone: row.payment_confirmation_phone || row.paymentConfirmationPhone || '01037141322',
    followupStatus: row.followup_status || row.followupStatus || 'not_contacted',
    followups: Array.isArray(row.followups) ? row.followups.map((entry: any) => ({ id: entry.id, orderId: entry.order_id || entry.orderId, type: entry.type || 'note', note: entry.note || '', createdBy: entry.created_by || entry.createdBy || 'studio', createdAt: toDate(entry.created_at || entry.createdAt) })) : [],
    invoiceSnapshot: row.invoice_snapshot || row.invoiceSnapshot || {},
    shipmentId: row.shipment_id || row.shipmentId,
    createdAt: toDate(row.created_at || row.createdAt),
    updatedAt: toDate(row.updated_at || row.updatedAt),
  };
}

function rowToReview(row: Record<string, any>): Review {
  const images = Array.isArray(row.images)
    ? row.images.map((image: any) => typeof image === 'string' ? image : (image.public_url || image.url)).filter(Boolean)
    : [row.review_image_url, row.avatar_url].filter(Boolean);
  const status = row.status || (row.isApproved || row.is_approved ? 'published' : 'pending');
  return {
    id: row.id,
    reviewType: row.review_type || row.reviewType || (row.product_id || row.productId ? 'product' : 'site'),
    productId: row.product_id || row.productId || '',
    productName: row.product_name || row.productName || (row.review_type === 'site' ? 'NEXORA Experience' : ''),
    customerName: row.customer_name || row.customerName || '',
    customerPhone: row.customer_phone || row.customerPhone || '',
    rating: Number(row.rating || 5),
    title: row.title || '',
    body: row.body || row.body_en || row.body_ar || '',
    images,
    adminReply: row.admin_reply || row.adminReply || '',
    status,
    isApproved: status === 'published',
    isFeatured: Boolean(row.featured ?? row.isFeatured ?? row.is_featured),
    helpfulCount: Number(row.helpful_count || row.helpfulCount || 0),
    createdAt: toDate(row.created_at || row.createdAt),
    updatedAt: row.updated_at || row.updatedAt ? toDate(row.updated_at || row.updatedAt) : undefined,
    approvedAt: row.approved_at || row.approvedAt ? toDate(row.approved_at || row.approvedAt) : undefined,
  };
}

function rowToCoupon(row: Record<string, any>): Coupon {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    type: row.type || 'percentage',
    value: Number(row.value || 0),
    minOrderAmount: Number(row.min_order_amount || row.minOrderAmount || 0),
    maxDiscountAmount: row.max_discount_amount ? Number(row.max_discount_amount) : undefined,
    usageLimit: Number(row.usage_limit || row.usageLimit || 0),
    usedCount: Number(row.used_count || row.usedCount || 0),
    perCustomerLimit: row.per_customer_limit || row.perCustomerLimit,
    startDate: toDate(row.start_date || row.startDate),
    endDate: toDate(row.end_date || row.endDate),
    isActive: Boolean(row.is_active ?? row.isActive ?? row.status === 'active'),
    status: row.status,
    allowedProductIds: row.allowed_product_ids || row.allowedProductIds,
    excludedProductIds: row.excluded_product_ids || row.excludedProductIds,
    allowedCategories: row.allowed_categories || row.allowedCategories,
    excludedCategories: row.excluded_categories || row.excludedCategories,
    allowedCollections: row.allowed_collections || row.allowedCollections,
    excludedCollections: row.excluded_collections || row.excludedCollections,
    firstOrderOnly: Boolean(row.first_order_only ?? row.firstOrderOnly),
    createdAt: toDate(row.created_at || row.createdAt),
    updatedAt: row.updated_at ? toDate(row.updated_at) : undefined,
  };
}


function listToJson(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
}

function toIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function couponToRow(coupon: Partial<Coupon>): Record<string, any> {
  const row: Record<string, any> = {
    code: coupon.code ? String(coupon.code).trim().toUpperCase() : undefined,
    title: coupon.title,
    description: coupon.description,
    type: coupon.type,
    value: coupon.value,
    min_order_amount: coupon.minOrderAmount,
    max_discount_amount: coupon.maxDiscountAmount,
    usage_limit: coupon.usageLimit,
    used_count: coupon.usedCount,
    per_customer_limit: coupon.perCustomerLimit,
    start_date: toIso(coupon.startDate),
    end_date: toIso(coupon.endDate),
    status: coupon.status || (coupon.isActive === false ? 'paused' : coupon.isActive === true ? 'active' : undefined),
    allowed_product_ids: coupon.allowedProductIds,
    excluded_product_ids: coupon.excludedProductIds,
    allowed_categories: coupon.allowedCategories,
    excluded_categories: coupon.excludedCategories,
    first_order_only: coupon.firstOrderOnly,
  };
  Object.keys(row).forEach((key) => row[key] === undefined && delete row[key]);
  return row;
}

function rowToPromotion(row: Record<string, any>): Promotion {
  return {
    id: row.id,
    title: row.title || '',
    subtitle: row.subtitle || '',
    type: row.type || 'storewide',
    discountType: row.discount_type || row.discountType || 'percentage',
    discountValue: Number(row.discount_value || row.discountValue || 0),
    targetIds: listToJson(row.target_ids || row.targetIds),
    status: row.status || 'draft',
    startDate: toDate(row.start_date || row.startDate),
    endDate: toDate(row.end_date || row.endDate),
    bannerText: row.banner_text || row.bannerText || '',
    showOnHome: Boolean(row.show_on_home ?? row.showOnHome),
    showOnProduct: Boolean(row.show_on_product ?? row.showOnProduct),
    showOnCart: Boolean(row.show_on_cart ?? row.showOnCart),
    showCountdown: Boolean(row.show_countdown ?? row.showCountdown),
    createdAt: toDate(row.created_at || row.createdAt),
    updatedAt: row.updated_at ? toDate(row.updated_at) : undefined,
  };
}

function promotionToRow(promotion: Partial<Promotion>): Record<string, any> {
  const row: Record<string, any> = {
    title: promotion.title,
    subtitle: promotion.subtitle,
    type: promotion.type,
    discount_type: promotion.discountType,
    discount_value: promotion.discountValue,
    target_ids: promotion.targetIds,
    status: promotion.status,
    start_date: toIso(promotion.startDate),
    end_date: toIso(promotion.endDate),
    banner_text: promotion.bannerText,
    show_on_home: promotion.showOnHome,
    show_on_product: promotion.showOnProduct,
    show_on_cart: promotion.showOnCart,
    show_countdown: promotion.showCountdown,
  };
  Object.keys(row).forEach((key) => row[key] === undefined && delete row[key]);
  return row;
}

function studioHeadersPayload<T extends Record<string, unknown>>(action: string, payload: T): T & { action: string } {
  return { action, ...payload };
}

// Products
export async function getProducts(filters?: { category?: string; isFeatured?: boolean; isNewArrival?: boolean; isBestSeller?: boolean; isLimitedDrop?: boolean; includeHidden?: boolean }): Promise<Product[]> {
  let q = supabase.from('products').select('*').order('created_at', { ascending: false });
  if (!filters?.includeHidden) q = q.in('status', ['active', 'sold_out']);
  if (filters?.category) q = q.eq('gender', filters.category);
  if (filters?.isFeatured) q = q.eq('featured', true);
  if (filters?.isNewArrival) q = q.eq('new_arrival', true);
  if (filters?.isBestSeller) q = q.eq('best_seller', true);
  if (filters?.isLimitedDrop) q = q.eq('is_limited', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(rowToProduct);
}

export async function getAdminProducts(): Promise<Product[]> {
  const data = await invokeStudioFunction<Record<string, unknown>, { products: any[] }>('studio-products', { action: 'list' });
  return (data.products || []).map(rowToProduct);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await supabase.from('products').select('*').eq('slug', slug).in('status', ['active', 'sold_out']).maybeSingle();
  if (error) throw error;
  return data ? rowToProduct(data) : null;
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToProduct(data) : null;
}

export async function createProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const data = await invokeStudioFunction('studio-products', studioHeadersPayload('create', { product: productToRow(product) }));
  return (data as any).id;
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<void> {
  await invokeStudioFunction('studio-products', studioHeadersPayload('update', { id, product: productToRow(data) }));
}

export async function deleteProduct(id: string): Promise<void> {
  await invokeStudioFunction('studio-products', studioHeadersPayload('archive', { id }));
}


export async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  const data = await invokeStudioFunction<Record<string, unknown>, { variants: any[] }>('studio-products', { action: 'variants-list', productId });
  return (data.variants || []).map(rowToVariant);
}

export async function upsertProductVariants(productId: string, variants: Partial<ProductVariant>[]): Promise<void> {
  await invokeStudioFunction('studio-products', studioHeadersPayload('variants-upsert', { productId, variants: variants.map((variant) => variantToRow({ ...variant, productId })) }));
}

export async function deleteProductVariant(id: string): Promise<void> {
  await invokeStudioFunction('studio-products', studioHeadersPayload('variants-delete', { id }));
}



export async function getPublicProductVariants(productId: string): Promise<ProductVariant[]> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .in('status', ['active', 'sold_out'])
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToVariant);
}

export async function getAdminInventory(): Promise<{ products: Product[]; variants: ProductVariant[] }> {
  const data = await invokeStudioFunction<Record<string, unknown>, { products: any[]; variants: any[] }>('studio-products', { action: 'inventory-list' });
  return {
    products: (data.products || []).map(rowToProduct),
    variants: (data.variants || []).map(rowToVariant),
  };
}


// Orders
export async function createOrder(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const data = await invokeStudioFunction('studio-orders', studioHeadersPayload('create-manual', { order }));
  return (data as any).id;
}

export async function createOrderWithStockTransaction(payload: { customer: Order['customer']; items: Order['items']; couponCode?: string; notes?: string; paymentMethod?: Order['paymentMethod']; [key: string]: unknown }): Promise<{ orderId: string; orderNumber: string; total: number; paymentMethod?: string; paymentStatus?: string }> {
  const { data, error } = await supabase.functions.invoke<{ orderId: string; orderNumber: string; total: number; paymentMethod?: string; paymentStatus?: string }>('create-order', { body: payload });
  if (error) throw new Error(await edgeErrorMessage('create-order', error, 'Could not create order.'));
  if (!data?.orderNumber) throw new Error('Order was not created. Please try again once, or contact NEXORA with your cart screenshot.');
  return data as { orderId: string; orderNumber: string; total: number; paymentMethod?: string; paymentStatus?: string };
}

export async function getOrders(): Promise<Order[]> {
  const data = await invokeStudioFunction<Record<string, unknown>, { orders: any[]; items?: any[]; followups?: any[] }>('studio-orders', { action: 'list' });
  const itemsByOrder = new Map<string, any[]>();
  (data.items || []).forEach((item) => {
    const key = item.order_id;
    itemsByOrder.set(key, [...(itemsByOrder.get(key) || []), item]);
  });
  const followupsByOrder = new Map<string, any[]>();
  (data.followups || []).forEach((entry) => {
    const key = entry.order_id;
    followupsByOrder.set(key, [...(followupsByOrder.get(key) || []), entry]);
  });
  return (data.orders || []).map((row) => rowToOrder({ ...row, followups: followupsByOrder.get(row.id) || [] }, itemsByOrder.get(row.id) || []));
}

export async function markOrderPaymentCollected(orderId: string): Promise<void> {
  await invokeStudioFunction('studio-orders', studioHeadersPayload('mark-payment-collected', { orderId }));
}

export async function updateOrderPaymentStatus(orderId: string, paymentStatus: Order['paymentStatus'], paymentReference?: string, paymentNotes?: string): Promise<void> {
  await invokeStudioFunction('studio-orders', studioHeadersPayload('update-payment-status', { orderId, paymentStatus, paymentReference, paymentNotes }));
}

export async function addOrderFollowup(orderId: string, type: string, note: string): Promise<void> {
  await invokeStudioFunction('studio-orders', studioHeadersPayload('add-followup', { orderId, type, note }));
}

export async function updateOrderStatus(orderId: string, status: OrderStatus, message?: string, updatedBy = 'studio'): Promise<void> {
  await invokeStudioFunction('studio-orders', studioHeadersPayload('update-status', { orderId, status, message, updatedBy }));
}


export type AdminOrderUpdatePayload = {
  orderId: string;
  customer?: Partial<Order['customer']>;
  items?: Order['items'];
  paymentMethod?: Order['paymentMethod'];
  paymentStatus?: Order['paymentStatus'];
  shippingFee?: number;
  codFee?: number;
  discount?: number;
  couponCode?: string;
  notes?: string;
  reason?: string;
};

export async function updateOrderAdmin(payload: AdminOrderUpdatePayload): Promise<void> {
  await invokeStudioFunction('studio-orders', studioHeadersPayload('update-order-admin', payload));
}

// Coupons
export async function getCoupons(): Promise<Coupon[]> {
  const data = await invokeStudioFunction<Record<string, unknown>, { coupons: any[] }>('studio-coupons', { action: 'list' });
  return (data.coupons || []).map(rowToCoupon);
}

export async function validateCouponForCart(payload: { code: string; items: Array<{ productId: string; variantId?: string; size: string; color?: string; quantity: number }>; subtotal: number }): Promise<{ valid: boolean; code?: string; discount: number; freeShipping?: boolean; message: string }> {
  const { data, error } = await supabase.functions.invoke('validate-coupon', { body: payload });
  if (error) {
    void supabase.from('analytics_events').insert({ event_name: 'edge_function_error', metadata: { function: 'validate-coupon', message: error.message } });
    return { valid: false, discount: 0, message: 'Coupon could not be validated.' };
  }
  return data as { valid: boolean; code?: string; discount: number; freeShipping?: boolean; message: string };
}

export interface PublicOrderTrackingResult {
  found: boolean;
  message?: string;
  order?: {
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: Order['paymentStatus'];
    total: number;
    createdAt: string;
    governorate: string;
    city: string;
    items: Array<{ name: string; quantity: number; size: string; color?: string; image?: string }>;
    trackingUpdates: Array<{ status: OrderStatus; message: string; timestamp: string }>;
  };
}

export async function trackOrderForCustomer(payload: { orderNumber: string; phone: string }): Promise<PublicOrderTrackingResult> {
  const { data, error } = await supabase.functions.invoke('track-order', { body: payload });
  if (error) return { found: false, message: error.message || 'Could not check this order.' };
  return data as PublicOrderTrackingResult;
}

export async function createCoupon(coupon: Omit<Coupon, 'id' | 'createdAt'>): Promise<string> {
  const data = await invokeStudioFunction('studio-coupons', studioHeadersPayload('create', { coupon: couponToRow(coupon) }));
  return (data as any).id;
}
export async function updateCoupon(id: string, data: Partial<Coupon>): Promise<void> { await invokeStudioFunction('studio-coupons', studioHeadersPayload('update', { id, coupon: couponToRow(data) })); }
export async function deleteCoupon(id: string): Promise<void> { await invokeStudioFunction('studio-coupons', studioHeadersPayload('delete', { id })); }

// Promotions
export async function getPromotions(): Promise<Promotion[]> { const data = await invokeStudioFunction<Record<string, unknown>, { promotions: any[] }>('studio-promotions', { action: 'list' }); return (data.promotions || []).map(rowToPromotion); }
export async function getActivePromotions(): Promise<Promotion[]> { return (await getPromotions()).filter((promotion) => promotion.status === 'active'); }
export async function createPromotion(promotion: Omit<Promotion, 'id' | 'createdAt'>): Promise<string> { const data = await invokeStudioFunction('studio-promotions', studioHeadersPayload('create', { promotion: promotionToRow(promotion) })); return (data as any).id; }
export async function updatePromotion(id: string, data: Partial<Promotion>): Promise<void> { await invokeStudioFunction('studio-promotions', studioHeadersPayload('update', { id, promotion: promotionToRow(data) })); }
export async function deletePromotion(id: string): Promise<void> { await invokeStudioFunction('studio-promotions', studioHeadersPayload('delete', { id })); }

// Drops
export async function getDrops(includeArchived = true): Promise<Drop[]> {
  if (getStudioToken()) {
    const data = await invokeStudioFunction<Record<string, unknown>, { drops: any[] }>('studio-drops', { action: 'list' });
    return (data.drops || []).filter((d) => includeArchived || d.status !== 'archived').map(rowToDrop);
  }
  let q = supabase.from('drops').select('*').order('created_at', { ascending: false });
  if (!includeArchived) q = q.neq('status', 'archived');
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(rowToDrop);
}
export async function createDrop(drop: Omit<Drop, 'id' | 'createdAt'>): Promise<string> { const data = await invokeStudioFunction('studio-drops', studioHeadersPayload('create', { drop })); return (data as any).id; }
export async function updateDrop(id: string, data: Partial<Drop>): Promise<void> { await invokeStudioFunction('studio-drops', studioHeadersPayload('update', { id, drop: data })); }
export async function deleteDrop(id: string): Promise<void> { await invokeStudioFunction('studio-drops', studioHeadersPayload('delete', { id })); }

// Reviews
export async function submitCustomerReview(review: { reviewType?: 'product' | 'site'; productId?: string; productName?: string; customerName: string; customerPhone?: string; rating: number; title?: string; body: string; experienceType?: string; orderNumber?: string }): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ id: string }>('submit-review', { body: review });
  if (error) throw error;
  return data?.id || '';
}

export async function getReviews(filters?: { productId?: string; isApproved?: boolean; isFeatured?: boolean }): Promise<Review[]> {
  if (getStudioToken() && !filters?.isApproved) {
    const data = await invokeStudioFunction<Record<string, unknown>, { reviews: any[] }>('studio-reviews', { action: 'list' });
    return (data.reviews || []).map(rowToReview);
  }
  let q = supabase.from('reviews').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false });
  if (filters?.productId) q = q.eq('product_id', filters.productId);
  if (filters?.isApproved !== undefined) {
    if (filters.isApproved) q = q.eq('status', 'published');
    else q = q.in('status', ['pending', 'hidden', 'rejected', 'draft']);
  }
  else q = q.eq('status', 'published');
  if (filters?.isFeatured) q = q.eq('featured', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(rowToReview);
}
export async function createReview(review: Omit<Review, 'id' | 'createdAt'>): Promise<string> { const data = await invokeStudioFunction('studio-reviews', studioHeadersPayload('create', { review })); return (data as any).id; }
export async function updateReview(id: string, data: Partial<Review>): Promise<void> { await invokeStudioFunction('studio-reviews', studioHeadersPayload('update', { id, review: data })); }
export async function approveReview(id: string): Promise<void> { await updateReview(id, { isApproved: true, status: 'published', approvedAt: new Date() as any }); }
export async function rejectReview(id: string): Promise<void> { await updateReview(id, { isApproved: false, status: 'rejected' }); }
export async function hideReview(id: string): Promise<void> { await updateReview(id, { isApproved: false, status: 'hidden' }); }
export async function featureReview(id: string, isFeatured: boolean): Promise<void> { await updateReview(id, { isFeatured }); }
export async function deleteReview(id: string): Promise<void> { await invokeStudioFunction('studio-reviews', studioHeadersPayload('delete', { id })); }

// Newsletter/contact
export async function subscribeNewsletter(email: string): Promise<void> { await supabase.from('newsletter').insert({ email }); }
export async function getNewsletterSubscribers(): Promise<NewsletterSubscriber[]> { const data = await invokeStudioFunction<Record<string, unknown>, { subscribers: NewsletterSubscriber[] }>('studio-settings', { action: 'newsletter' }); return data.subscribers || []; }
export async function createContactMessage(message: Omit<ContactMessage, 'id' | 'createdAt' | 'isRead'>): Promise<void> { await supabase.from('contact_messages').insert({ name: message.name, email: message.email, subject: message.subject, message: message.message }); }
export async function getContactMessages(): Promise<ContactMessage[]> { const data = await invokeStudioFunction<Record<string, unknown>, { messages: ContactMessage[] }>('studio-settings', { action: 'contact-messages' }); return data.messages || []; }



// Storefront / homepage controls
export async function getHomeCollectionTiles(): Promise<HomeCollectionTile[]> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('home_collection_tiles')
      .eq('id', 'main')
      .maybeSingle();
    if (error) throw error;
    return normalizeHomeTiles((data as any)?.home_collection_tiles);
  } catch {
    return DEFAULT_HOME_COLLECTION_TILES;
  }
}

export async function updateHomeCollectionTiles(tiles: HomeCollectionTile[]): Promise<void> {
  await invokeStudioFunction('studio-settings', {
    action: 'storefront-update',
    homeCollectionTiles: normalizeHomeTiles(tiles).slice(0, 5),
  });
}

export async function resetHomeCollectionTiles(): Promise<void> {
  await updateHomeCollectionTiles(DEFAULT_HOME_COLLECTION_TILES);
}

// Settings
function defaultLaunchSettings(): NonNullable<SiteSettings['launchSettings']> {
  const soon = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  return {
    enabled: false,
    launchAt: soon,
    timezone: 'Africa/Cairo',
    autoOpen: true,
    title: 'NEXORA is Opening Soon',
    subtitle: 'A new premium shopping experience is almost here.',
    eyebrow: 'Premium launch experience',
    announcement: 'We are preparing new drops, smoother checkout, and a better shopping journey.',
    buttonText: 'Contact us on WhatsApp',
    whatsappMessage: 'Hello NEXORA, I would like to know more about the launch.',
    backgroundImage: '',
    showCountdown: true,
    showNotifyForm: true,
    showSocialLinks: true,
    allowAdminBypass: true,
    notifySuccessMessage: 'You are on the launch list. We will contact you when NEXORA opens.',
  };
}

function normalizeLaunchSettings(value: unknown): NonNullable<SiteSettings['launchSettings']> {
  const base = defaultLaunchSettings();
  const raw = (value && typeof value === 'object') ? value as Record<string, unknown> : {};
  return {
    ...base,
    ...raw,
    enabled: Boolean(raw.enabled ?? base.enabled),
    autoOpen: Boolean(raw.autoOpen ?? base.autoOpen),
    showCountdown: Boolean(raw.showCountdown ?? base.showCountdown),
    showNotifyForm: Boolean(raw.showNotifyForm ?? base.showNotifyForm),
    showSocialLinks: Boolean(raw.showSocialLinks ?? base.showSocialLinks),
    allowAdminBypass: Boolean(raw.allowAdminBypass ?? base.allowAdminBypass),
  };
}


export async function submitLaunchSubscriber(payload: { name?: string; contact: string; source?: string }): Promise<void> {
  const contact = String(payload.contact || '').trim();
  if (!contact) throw new Error('Please enter a phone number or email.');
  const { error } = await supabase.functions.invoke('launch-subscribe', {
    body: {
      name: String(payload.name || '').trim(),
      contact,
      source: payload.source || 'opening_soon',
    },
  });
  if (error) throw new Error(await edgeErrorMessage('launch-subscribe', error, 'Could not save your launch notification request.'));
}

export async function getSiteSettings(): Promise<SiteSettings | null> {
  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 'main').maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: 'main',
    storeName: data.brand_name || 'NEXORA',
    logo: data.logo || '/assets/nexora-logo.png',
    favicon: data.favicon || '/assets/nexora-logo.png',
    primaryColor: '#2B211D',
    accentColor: '#D2B48C',
    currency: data.currency || 'EGP',
    shippingFee: Number(data.shipping_fee || 0),
    freeShippingThreshold: Number(data.free_shipping_threshold || 0),
    taxRate: 0,
    whatsappNumber: data.whatsapp_number || import.meta.env.VITE_STORE_WHATSAPP || '01037141322',
    supportEmail: data.support_email || import.meta.env.VITE_SUPPORT_EMAIL || 'supportnexorastoree@gmail.com',
    codEnabled: data.cod_enabled ?? true,
    maintenanceMode: data.maintenance_mode ?? false,
    launchSettings: normalizeLaunchSettings(data.launch_settings),
    defaultLanguage: data.default_language || 'en',
    defaultTheme: data.default_theme || 'light',
    socialLinks: data.social_links || {},
    paymentSettings: data.payment_settings || {},
    metaPixelEnabled: Boolean(data.meta_pixel_enabled ?? data.payment_settings?.metaPixelEnabled ?? false),
    metaPixelId: data.meta_pixel_id || data.payment_settings?.metaPixelId || undefined,
    returnPolicyText: data.return_policy_text || undefined,
    shippingPolicyText: data.shipping_policy_text || undefined,
    seo: data.seo || { title: 'NEXORA', description: 'Limited fashion essentials.', keywords: 'fashion, essentials, limited' },
    announcements: [],
    updatedAt: toDate(data.updated_at),
  };
}
export async function updateSiteSettings(data: Partial<SiteSettings>): Promise<void> { await invokeStudioFunction('studio-settings', studioHeadersPayload('update', { settings: data })); }

// Inventory/Audit/Dashboard
export async function updateProductStock(productId: string, size: string, quantity: number, reason: InventoryLog['reason'] = 'manual_adjustment', note?: string): Promise<void> { await invokeStudioFunction('studio-products', studioHeadersPayload('adjust-stock', { productId, size, quantity, reason, note })); }
export async function updateVariantStock(variantId: string, quantity: number, reason: InventoryLog['reason'] = 'manual_adjustment', note?: string): Promise<void> { await invokeStudioFunction('studio-products', studioHeadersPayload('adjust-variant-stock', { variantId, quantity, reason, note })); }
export async function createInventoryLog(log: Omit<InventoryLog, 'id' | 'createdAt'>): Promise<string> { const data = await invokeStudioFunction('studio-products', studioHeadersPayload('inventory-log', { log })); return (data as any).id; }
export async function getInventoryLogs(productId?: string): Promise<InventoryLog[]> {
  const data = await invokeStudioFunction<Record<string, unknown>, { logs: any[] }>('studio-products', { action: 'inventory-logs', productId });
  return (data.logs || []).map((row) => ({
    id: row.id,
    productId: row.product_id || row.productId,
    sku: row.sku,
    size: row.size || '',
    change: Number(row.change || 0),
    reason: row.reason || 'manual_adjustment',
    previousStock: Number(row.previous_stock ?? row.previousStock ?? 0),
    newStock: Number(row.new_stock ?? row.newStock ?? 0),
    orderId: row.order_id || row.orderId,
    adminId: row.admin_id || row.adminId,
    note: row.note,
    createdAt: toDate(row.created_at || row.createdAt),
  }));
}
export async function createAuditLog(log: Omit<AuditLog, 'id' | 'createdAt'>): Promise<string> { const data = await invokeStudioFunction('studio-settings', studioHeadersPayload('audit-log', { log })); return (data as any).id; }
export async function getAuditLogs(): Promise<AuditLog[]> { const data = await invokeStudioFunction<Record<string, unknown>, { logs: AuditLog[] }>('studio-audit-logs', { action: 'list' }); return data.logs || []; }
export async function getDashboardStats(): Promise<{ totalOrders: number; totalRevenue: number; totalProducts: number; pendingOrders: number; lowStockProducts: number; activeCoupons: number; liveDrops: number; activePromotions: number }> { const data = await invokeStudioFunction<Record<string, unknown>, any>('studio-dashboard', { action: 'stats' }); return { totalOrders: data.totalOrders || 0, totalRevenue: data.totalRevenue || 0, totalProducts: data.totalProducts || 0, pendingOrders: data.pendingOrders || 0, lowStockProducts: data.lowStockProducts || 0, activeCoupons: data.activeCoupons || 0, liveDrops: data.liveDrops || 0, activePromotions: data.activePromotions || 0 }; }


export async function getAnalyticsSummary(): Promise<{ events: any[]; orders: any[] }> {
  const data = await invokeStudioFunction<Record<string, unknown>, { events: any[]; orders: any[] }>('studio-dashboard', { action: 'analytics' });
  return { events: data.events || [], orders: data.orders || [] };
}

export async function seedDatabase(products: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> { await invokeStudioFunction('studio-products', studioHeadersPayload('seed', { products: products.map(productToRow) })); }

// Growth Intelligence / Visitors / Leads / Campaigns
function rowToVisitor(row: Record<string, any>) {
  return {
    id: row.id,
    anonymousId: row.anonymous_id || row.anonymousId || '',
    firstSeenAt: toDate(row.first_seen_at || row.created_at),
    lastSeenAt: toDate(row.last_seen_at || row.updated_at || row.created_at),
    firstSource: row.first_source || row.source,
    firstMedium: row.first_medium || row.medium,
    firstCampaign: row.first_campaign || row.campaign,
    lastSource: row.last_source,
    lastMedium: row.last_medium,
    lastCampaign: row.last_campaign,
    firstLandingPage: row.first_landing_page,
    lastPage: row.last_page,
    deviceType: row.device_type,
    browser: row.browser,
    os: row.os,
    country: row.country,
    city: row.city,
    isKnown: Boolean(row.is_known),
    leadId: row.lead_id,
    customerId: row.customer_id,
    eventCount: Number(row.event_count || 0),
  };
}

function rowToLead(row: Record<string, any>) {
  return {
    id: row.id,
    visitorId: row.visitor_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    source: row.source,
    medium: row.medium,
    campaign: row.campaign,
    interestProductId: row.interest_product_id,
    interestProductName: row.interest_product_name,
    status: row.status || 'new',
    notes: row.notes,
    lastContactedAt: row.last_contacted_at ? toDate(row.last_contacted_at) : undefined,
    createdAt: toDate(row.created_at),
    updatedAt: row.updated_at ? toDate(row.updated_at) : undefined,
  };
}

function rowToCampaignLink(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name || '',
    platform: row.platform || 'facebook',
    source: row.source || 'facebook',
    medium: row.medium || 'paid_social',
    campaign: row.campaign || '',
    content: row.content || '',
    landingPage: row.landing_page || '/',
    finalUrl: row.final_url || '',
    createdAt: toDate(row.created_at),
  };
}

export async function getGrowthDashboard(): Promise<any> {
  const data = await invokeStudioFunction<Record<string, unknown>, any>('studio-reports', { action: 'growth-dashboard' });
  return {
    ...data,
    recentLeads: (data.recentLeads || []).map(rowToLead),
    recentVisitors: (data.recentVisitors || []).map(rowToVisitor),
  };
}

export async function getVisitors(): Promise<any[]> {
  const data = await invokeStudioFunction<Record<string, unknown>, { visitors: any[] }>('studio-visitors', { action: 'list' });
  return (data.visitors || []).map(rowToVisitor);
}

export async function getVisitorJourney(visitorId: string): Promise<any[]> {
  const data = await invokeStudioFunction<Record<string, unknown>, { events: any[] }>('studio-visitors', { action: 'journey', visitorId });
  return (data.events || []).map((row) => ({
    id: row.id,
    visitorId: row.visitor_id,
    anonymousId: row.anonymous_id,
    sessionId: row.session_id,
    eventName: row.event_name,
    pageUrl: row.page_url,
    productId: row.product_id,
    cartValue: Number(row.cart_value || 0),
    source: row.source,
    medium: row.medium,
    campaign: row.campaign,
    content: row.content,
    metadata: row.metadata || {},
    createdAt: toDate(row.created_at),
  }));
}

export async function getLeads(): Promise<any[]> {
  const data = await invokeStudioFunction<Record<string, unknown>, { leads: any[] }>('studio-leads', { action: 'list' });
  return (data.leads || []).map(rowToLead);
}

export async function updateLeadStatus(id: string, status: string, notes?: string): Promise<void> {
  await invokeStudioFunction('studio-leads', { action: 'update-status', id, status, notes });
}

export async function getCampaignLinks(): Promise<any[]> {
  const data = await invokeStudioFunction<Record<string, unknown>, { links: any[] }>('studio-campaigns', { action: 'list' });
  return (data.links || []).map(rowToCampaignLink);
}

export async function createCampaignLink(payload: { name: string; platform: string; source: string; medium: string; campaign: string; content?: string; landingPage: string; finalUrl: string }): Promise<string> {
  const data = await invokeStudioFunction<Record<string, unknown>, { id: string }>('studio-campaigns', { action: 'create', link: payload });
  return data.id;
}

export async function getCampaignReports(filters: { days?: number } = {}): Promise<any> {
  return invokeStudioFunction<Record<string, unknown>, any>('studio-reports', { action: 'campaigns', ...filters });
}
// Shipping / Delivery Operations V5.4
export type ShippingQuote = {
  available: boolean;
  reason?: string;
  shippingFee: number;
  codFee: number;
  totalDeliveryFee: number;
  freeShippingApplied?: boolean;
  freeShippingEnabled?: boolean;
  freeShippingThreshold?: number;
  showFreeShippingProgress?: boolean;
  freeShippingProgressMessage?: string;
  deliveryEstimate?: string;
  zoneId?: string;
  shipbluZoneId?: number;
  remoteArea?: boolean;
  provider?: string;
  providerEnabled?: boolean;
};

function rowToShippingSettings(row: Record<string, any> = {}) {
  return {
    id: row.id || 'main',
    shippingEnabled: Boolean(row.shipping_enabled ?? true),
    defaultShippingFee: Number(row.default_shipping_fee ?? 80),
    codFee: Number(row.cod_fee ?? 0),
    freeShippingEnabled: Boolean(row.free_shipping_enabled ?? false),
    freeShippingThreshold: Number(row.free_shipping_threshold ?? 0),
    showFreeShippingProgress: Boolean(row.show_free_shipping_progress ?? false),
    freeShippingProgressMessage: row.free_shipping_progress_message || 'Add {amount} more for free shipping.',
    fallbackDeliveryEstimate: row.fallback_delivery_estimate || '4-7 business days',
    provider: row.provider || 'shipblu',
    providerEnabled: Boolean(row.provider_enabled ?? false),
    providerEnvironment: row.provider_environment || 'production',
    autoCreateShipments: Boolean(row.auto_create_shipments ?? false),
    defaultPackageSize: Number(row.default_package_size || 1),
    defaultPickupZoneId: row.default_pickup_zone_id || undefined,
    notes: row.notes || '',
    updatedAt: row.updated_at ? toDate(row.updated_at) : undefined,
  };
}

function rowToShippingZone(row: Record<string, any>) {
  return {
    id: row.id,
    governorate: row.governorate || '',
    city: row.city || '*',
    shippingFee: Number(row.shipping_fee || 0),
    codFee: Number(row.cod_fee || 0),
    deliveryEstimate: row.delivery_estimate || '4-7 business days',
    enabled: Boolean(row.enabled ?? true),
    remoteArea: Boolean(row.remote_area ?? false),
    shipbluGovernorateId: row.shipblu_governorate_id || undefined,
    shipbluCityId: row.shipblu_city_id || undefined,
    shipbluZoneId: row.shipblu_zone_id || undefined,
    notes: row.notes || '',
    createdAt: row.created_at ? toDate(row.created_at) : undefined,
    updatedAt: row.updated_at ? toDate(row.updated_at) : undefined,
  };
}

function rowToShipment(row: Record<string, any>) {
  return {
    id: row.id,
    orderId: row.order_id,
    provider: row.provider || 'shipblu',
    providerOrderId: row.provider_order_id || undefined,
    trackingNumber: row.tracking_number || undefined,
    status: row.status || 'not_created',
    labelUrl: row.label_url || undefined,
    shippingFee: Number(row.shipping_fee || 0),
    codAmount: Number(row.cod_amount || 0),
    deliveryEstimate: row.delivery_estimate || undefined,
    rawResponse: row.raw_response || {},
    createdAt: row.created_at ? toDate(row.created_at) : undefined,
    updatedAt: row.updated_at ? toDate(row.updated_at) : undefined,
  };
}

export async function calculateShippingQuote(payload: { governorate: string; city: string; subtotal: number; couponFreeShipping?: boolean }): Promise<ShippingQuote> {
  const { data, error } = await supabase.functions.invoke<ShippingQuote>('calculate-shipping', { body: payload });
  if (error) return { available: false, reason: await edgeErrorMessage('calculate-shipping', error, 'Could not calculate delivery.'), shippingFee: 0, codFee: 0, totalDeliveryFee: 0 };
  return data as ShippingQuote;
}

export async function getShippingAdmin(): Promise<any> {
  const data = await invokeStudioFunction<Record<string, unknown>, any>('studio-shipping', { action: 'get' });
  return {
    settings: rowToShippingSettings(data.settings || {}),
    zones: (data.zones || []).map(rowToShippingZone),
    shipments: (data.shipments || []).map(rowToShipment),
    providerConnected: Boolean(data.providerConnected),
  };
}

export async function saveShippingSettings(settings: Record<string, unknown>): Promise<any> {
  const data = await invokeStudioFunction<Record<string, unknown>, any>('studio-shipping', { action: 'save-settings', settings });
  return rowToShippingSettings(data.settings || {});
}

export async function upsertShippingZone(zone: Record<string, unknown>): Promise<any> {
  const data = await invokeStudioFunction<Record<string, unknown>, any>('studio-shipping', { action: 'upsert-zone', zone });
  return rowToShippingZone(data.zone || {});
}

export async function deleteShippingZone(id: string): Promise<void> {
  await invokeStudioFunction('studio-shipping', { action: 'delete-zone', id });
}

export async function testShippingProvider(): Promise<any> {
  return invokeStudioFunction<Record<string, unknown>, any>('studio-shipping', { action: 'test-provider' });
}

export async function createOrderShipment(orderId: string): Promise<any> {
  const data = await invokeStudioFunction<Record<string, unknown>, any>('create-shipment', { orderId });
  return data.shipment ? rowToShipment(data.shipment) : data;
}

export async function refreshOrderShipment(orderId: string): Promise<any> {
  const data = await invokeStudioFunction<Record<string, unknown>, any>('track-shipment', { orderId });
  return data.shipment ? { ...data, shipment: rowToShipment(data.shipment) } : data;
}

export async function getProductAnalyticsReport(filters: { days?: number; source?: string; campaign?: string; product?: string } = {}): Promise<any> {
  return invokeStudioFunction<Record<string, unknown>, any>('studio-reports', { action: 'product-analytics', ...filters });
}


// Admin OS / CRM V5.5
export async function getStudioHealthCheck(): Promise<any> {
  return invokeStudioFunction<Record<string, unknown>, any>('studio-health-check', { action: 'check' });
}

export async function getCustomerProfiles(): Promise<any[]> {
  const data = await invokeStudioFunction<Record<string, unknown>, { customers: any[] }>('studio-customers', { action: 'list' });
  return data.customers || [];
}

export async function updateCustomerProfile(id: string, updates: Record<string, unknown>): Promise<void> {
  await invokeStudioFunction('studio-customers', { action: 'update', id, updates });
}

export async function addCustomerNote(customerId: string, note: string): Promise<void> {
  await invokeStudioFunction('studio-customers', { action: 'add-note', customerId, note });
}

export async function createLeadTask(leadId: string, title: string, dueAt?: string): Promise<string> {
  const data = await invokeStudioFunction<Record<string, unknown>, { id: string }>('studio-leads', { action: 'create-task', leadId, title, dueAt });
  return data.id;
}

export async function completeLeadTask(taskId: string): Promise<void> {
  await invokeStudioFunction('studio-leads', { action: 'complete-task', taskId });
}


// Admin workflow controls
export async function getAdminWorkflow(): Promise<{ statuses: WorkflowStatus[]; followupTypes: FollowupTypeConfig[] }> {
  try {
    const data = await invokeStudioFunction<Record<string, unknown>, { statuses?: any[]; followupTypes?: any[] }>('studio-workflow', { action: 'get' });
    return {
      statuses: normalizeOrderWorkflow(data.statuses || DEFAULT_ORDER_WORKFLOW_STATUSES),
      followupTypes: normalizeFollowupTypes(data.followupTypes || DEFAULT_FOLLOWUP_TYPES),
    };
  } catch {
    return { statuses: DEFAULT_ORDER_WORKFLOW_STATUSES, followupTypes: DEFAULT_FOLLOWUP_TYPES };
  }
}

export async function saveAdminWorkflow(payload: { statuses: WorkflowStatus[]; followupTypes: FollowupTypeConfig[] }): Promise<void> {
  await invokeStudioFunction('studio-workflow', { action: 'save', statuses: payload.statuses, followupTypes: payload.followupTypes });
}

export async function saveOrderStatuses(statuses: WorkflowStatus[]): Promise<void> {
  const current = await getAdminWorkflow();
  await saveAdminWorkflow({ statuses, followupTypes: current.followupTypes });
}

export async function saveFollowupTypes(followupTypes: FollowupTypeConfig[]): Promise<void> {
  const current = await getAdminWorkflow();
  await saveAdminWorkflow({ statuses: current.statuses, followupTypes });
}

export async function createManualShipment(orderId: string, details: { courier?: string; trackingNumber?: string; status?: string; notes?: string }): Promise<any> {
  const data = await invokeStudioFunction<Record<string, unknown>, any>('studio-shipping', { action: 'manual-shipment', orderId, details });
  return data.shipment ? rowToShipment(data.shipment) : data;
}
