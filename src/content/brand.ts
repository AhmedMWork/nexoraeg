// ============================================================
// NEXORA — Central Brand Copy System
// Keep all premium brand language here to avoid drift between
// storefront, SEO, footer, Studio defaults, and launch screens.
// ============================================================

export const BRAND = {
  name: 'NEXORA',
  entryTop: 'Tap to enter',
  entryBottom: 'Not for everyone.',
  shortTagline: 'Defined by intention. Not for everyone.',
  heroLine: 'Defined silhouettes. Precise fabrics. A quiet edge for daily presence.',
  heroSubline: 'We don’t chase attention. We command presence. Not for everyone.',
  seoDescription: 'NEXORA exists in silence. Defined by intention. Crafted with precision. Limited by design. Not for everyone.',
  manifesto: [
    'NEXORA exists in silence.',
    'Defined by intention.',
    'Crafted with precision.',
    'We don’t chase attention.',
    'We command presence.',
    'Limited by design.',
    'Not for everyone.',
  ],
  trust: [
    'Cash on delivery across Egypt',
    'Limited pieces, controlled releases',
    'WhatsApp support before and after order',
  ],
} as const;

export const BRAND_MANIFESTO_TEXT = BRAND.manifesto.join('\n');
