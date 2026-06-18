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
    label: 'Daily',
    links: [
      { label: 'Today', href: '/nexora-admin/dashboard', icon: 'LayoutDashboard', description: 'Orders, stock, shipping and follow-ups for today' },
      { label: 'Orders', href: '/nexora-admin/orders', icon: 'ShoppingBag', description: 'Confirm orders, shipment actions and customer notes' },
    ],
  },
  {
    label: 'Run',
    links: [
      { label: 'Catalog', href: '/nexora-admin/products', icon: 'Package', description: 'Products, setup quality, media, variants and SEO' },
      { label: 'Inventory', href: '/nexora-admin/inventory', icon: 'Warehouse', description: 'Variant stock, low stock and stock logs' },
      { label: 'Shipping', href: '/nexora-admin/shipping', icon: 'Truck', description: 'Delivery fees, free shipping rules, ShipBlu zones' },
    ],
  },
  {
    label: 'People',
    links: [
      { label: 'Customers', href: '/nexora-admin/customers', icon: 'UserRound', description: 'Customer profiles, order value, notes and tags' },
      { label: 'Growth', href: '/nexora-admin/reports', icon: 'FileBarChart', description: 'Reports, campaigns, visitors, leads and analytics' },
    ],
  },
  {
    label: 'Store',
    links: [
      { label: 'Storefront', href: '/nexora-admin/storefront', icon: 'MonitorSmartphone', description: 'Home sections, tiles, promo surfaces and content' },
      { label: 'Setup', href: '/nexora-admin/controls', icon: 'Settings', description: 'Setup, recovery, integrations and diagnostics' },
    ],
  },
];

export const ADMIN_SECONDARY_NAV_LINKS: AdminNavLink[] = [
  { label: 'Reviews', href: '/nexora-admin/reviews', icon: 'Star', description: 'Social proof and publishing' },
  { label: 'Leads CRM', href: '/nexora-admin/leads', icon: 'UserPlus', description: 'Pipeline and follow-up actions' },
  { label: 'Visitors', href: '/nexora-admin/visitors', icon: 'MousePointerClick', description: 'Visitor journeys and action explanations' },
  { label: 'Campaigns', href: '/nexora-admin/campaigns', icon: 'Target', description: 'UTM links and campaign attribution' },
  { label: 'Analytics', href: '/nexora-admin/analytics', icon: 'BarChart3', description: 'Cart, checkout and product interaction analytics' },
  { label: 'Promotions', href: '/nexora-admin/promotions', icon: 'BadgePercent', description: 'Promo strip and merch messages' },
  { label: 'Coupons', href: '/nexora-admin/coupons', icon: 'Tag', description: 'Discount codes and campaign offers' },
  { label: 'Drops', href: '/nexora-admin/drops', icon: 'CalendarClock', description: 'Limited releases' },
  { label: 'SEO', href: '/nexora-admin/seo', icon: 'SearchCheck', description: 'Search appearance, sitemap and indexing notes' },
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
