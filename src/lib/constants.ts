import { requiredPublicEnv } from './env';
import { BRAND } from '@/content/brand';
// ============================================================
// NEXORA — Constants & Configuration
// ============================================================

export const SITE_NAME = 'NEXORA';
export const SITE_TAGLINE = BRAND.shortTagline;
export const SITE_DESCRIPTION = BRAND.seoDescription;
export const SITE_URL = requiredPublicEnv('VITE_SITE_URL').replace(/\/$/, '');

export const NAV_LINKS = [
  { label: 'Shop', href: '/shop' },
  { label: 'Men', href: '/shop/men' },
  { label: 'Women', href: '/shop/women' },
  { label: 'Unisex', href: '/shop/unisex' },
  { label: 'Limited', href: '/limited' },
  { label: 'Reviews', href: '/reviews' },
  { label: 'Contact', href: '/contact' },
];

export const PRODUCT_CATEGORIES = [
  { value: 'men', label: 'Men', labelAr: 'رجالي' },
  { value: 'women', label: 'Women', labelAr: 'نسائي' },
  { value: 'unisex', label: 'Unisex', labelAr: 'يونيسكس' },
  { value: 'custom', label: 'Custom', labelAr: 'مخصص' },
];

export const PRODUCT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Custom'];

export const PRODUCT_COLORS = [
  { value: 'black', label: 'Black', labelAr: 'أسود', hex: '#0E0B0A' },
  { value: 'ivory', label: 'Ivory', labelAr: 'عاجي', hex: '#F7F1E8' },
  { value: 'white', label: 'White', labelAr: 'أبيض', hex: '#FFFFFF' },
  { value: 'mocha', label: 'Mocha', labelAr: 'موكا', hex: '#6F5B51' },
  { value: 'sand', label: 'Sand', labelAr: 'رملي', hex: '#D8C9B8' },
  { value: 'dust-rose', label: 'Dust Rose', labelAr: 'وردي ترابي', hex: '#B88A78' },
  { value: 'navy', label: 'Navy', labelAr: 'كحلي', hex: '#1E2A3A' },
  { value: 'olive', label: 'Olive', labelAr: 'زيتوني', hex: '#73715F' },
  { value: 'grey', label: 'Grey', labelAr: 'رمادي', hex: '#8C8983' },
  { value: 'custom', label: 'Custom', labelAr: 'لون مخصص', hex: '#D2B48C' },
];

export const MATERIALS = [
  'Premium Cotton Blend',
  '100% Cotton',
  'Egyptian Cotton',
  'Heavyweight Cotton',
  'Soft Jersey Cotton',
  'French Terry',
  'Linen Blend',
  'Custom Material',
];

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'best-selling', label: 'Best Selling' },
  { value: 'rating', label: 'Highest Rated' },
];

export const PRICE_RANGES = [
  { label: 'Under 500 EGP', min: 0, max: 500 },
  { label: '500 - 800 EGP', min: 500, max: 800 },
  { label: '800 - 1200 EGP', min: 800, max: 1200 },
  { label: '1200 - 1500 EGP', min: 1200, max: 1500 },
  { label: 'Over 1500 EGP', min: 1500, max: 10000 },
];

export const SHIPPING_FEE = 60;
export const FREE_SHIPPING_THRESHOLD = 1500;

export const ORDER_STATUS_FLOW = [
  'pending',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
] as const;

export type AdminNavLink = { label: string; href: string; icon: string; description: string };
export type AdminNavGroup = { label: string; links: AdminNavLink[] };

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: 'اليومي',
    links: [
      { label: 'لوحة اليوم', href: '/nexora-admin/dashboard', icon: 'LayoutDashboard', description: 'طلبات اليوم، المخزون، الشحن، والمتابعات المهمة' },
      { label: 'الطلبات', href: '/nexora-admin/orders', icon: 'ShoppingBag', description: 'تأكيد الطلبات، تعديل الطلب، الشحن، وملاحظات العملاء' },
    ],
  },
  {
    label: 'التشغيل',
    links: [
      { label: 'المنتجات', href: '/nexora-admin/products', icon: 'Package', description: 'إدارة المنتجات والصور والمقاسات والألوان' },
      { label: 'المخزون', href: '/nexora-admin/inventory', icon: 'Warehouse', description: 'مخزون المقاسات والألوان والتنبيهات' },
      { label: 'الشحن', href: '/nexora-admin/shipping', icon: 'Truck', description: 'تكلفة الشحن، مناطق التوصيل، ورسوم COD' },
    ],
  },
  {
    label: 'العملاء',
    links: [
      { label: 'العملاء', href: '/nexora-admin/customers', icon: 'UserRound', description: 'بيانات العملاء، الطلبات، والملاحظات' },
      { label: 'التقارير', href: '/nexora-admin/reports', icon: 'FileBarChart', description: 'تقارير المبيعات والحملات والزوار' },
    ],
  },
  {
    label: 'المتجر',
    links: [
      { label: 'واجهة المتجر', href: '/nexora-admin/storefront', icon: 'MonitorSmartphone', description: 'أقسام الصفحة الرئيسية والبنرات والمحتوى' },
      { label: 'جاهزية المتجر', href: '/nexora-admin/controls', icon: 'Settings', description: 'الدفع والربط والجاهزية والاستعادة' },
    ],
  },
];

export const ADMIN_SECONDARY_NAV_LINKS: AdminNavLink[] = [
  { label: 'التقييمات', href: '/nexora-admin/reviews', icon: 'Star', description: 'تقييمات العملاء والنشر' },
  { label: 'المتابعات', href: '/nexora-admin/leads', icon: 'UserPlus', description: 'العملاء المحتملون والمتابعة' },
  { label: 'الزوار', href: '/nexora-admin/visitors', icon: 'MousePointerClick', description: 'رحلة الزائر وتحليل السلوك' },
  { label: 'الحملات', href: '/nexora-admin/campaigns', icon: 'Target', description: 'روابط الحملات وتتبع المصدر' },
  { label: 'التحليلات', href: '/nexora-admin/analytics', icon: 'BarChart3', description: 'السلة والدفع وتفاعل المنتجات' },
  { label: 'العروض', href: '/nexora-admin/promotions', icon: 'BadgePercent', description: 'رسائل العروض والشريط الترويجي' },
  { label: 'الكوبونات', href: '/nexora-admin/coupons', icon: 'Tag', description: 'أكواد الخصم وحملات التخفيض' },
  { label: 'الإصدارات', href: '/nexora-admin/drops', icon: 'CalendarClock', description: 'الإصدارات المحدودة' },
  { label: 'SEO', href: '/nexora-admin/seo', icon: 'SearchCheck', description: 'ظهور البحث والسitemap والفهرسة' },
];

export const ADMIN_NAV_LINKS: AdminNavLink[] = [...ADMIN_NAV_GROUPS.flatMap((group) => group.links), ...ADMIN_SECONDARY_NAV_LINKS];

export const BRAND_VALUES = [
  {
    title: 'Defined by intention',
    description: 'Every release is deliberate: controlled lines, precise materials, and a clear reason to exist.',
    icon: 'Sparkles',
  },
  {
    title: 'Crafted with precision',
    description: 'Defined silhouettes, precise fabrics, and finishing made to hold presence without noise.',
    icon: 'ShieldCheck',
  },
  {
    title: 'We command presence',
    description: 'We don’t chase attention; we command it through restraint, proportion, and clarity.',
    icon: 'Crown',
  },
  {
    title: 'Not for everyone',
    description: 'Limited by design for those who understand quiet confidence. Not for everyone.',
    icon: 'Lock',
  },
];

export const FOOTER_LINKS = {
  shop: [
    { label: 'All Products', href: '/shop' },
    { label: 'New Arrivals', href: '/shop?sort=newest' },
    { label: 'Limited Drops', href: '/limited' },
    { label: 'Best Sellers', href: '/shop?sort=best-selling' },
    { label: 'Men\'s T-Shirts', href: '/shop/men' },
    { label: 'Women\'s T-Shirts', href: '/shop/women' },
    { label: 'Unisex Essentials', href: '/shop/unisex' },
  ],
  support: [
    { label: 'Shipping & Returns', href: '/info/shipping-returns' },
    { label: 'FAQ', href: '/info/faq' },
    { label: 'WhatsApp Support', href: '/contact' },
  ],
  company: [
    { label: 'About NEXORA', href: '/info/about' },
    { label: 'Contact Us', href: '/contact' },
    { label: 'Privacy Policy', href: '/info/privacy' },
  ],
};
