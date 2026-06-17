export type HomeCollectionTile = {
  id: string;
  title: string;
  titleAr?: string;
  href: string;
  image: string;
  eyebrow?: string;
};

export const DEFAULT_HOME_COLLECTION_TILES: HomeCollectionTile[] = [
  {
    id: 'oversized-tees',
    title: 'Oversized Tees',
    titleAr: 'تيشيرتات واسعة',
    href: '/shop/unisex',
    image: '/assets/products/women-sand-tee.jpg',
    eyebrow: 'Explore',
  },
  {
    id: 'core-essentials',
    title: 'Core Essentials',
    titleAr: 'أساسيات يومية',
    href: '/shop',
    image: '/assets/products/men-cream-tee.jpg',
    eyebrow: 'Explore',
  },
  {
    id: 'limited-drop',
    title: 'Limited Drop',
    titleAr: 'الإصدارات المحدودة',
    href: '/limited',
    image: '/assets/nexora-logo-bg.jpg',
    eyebrow: 'Explore',
  },
  {
    id: 'last-pieces',
    title: 'Last Pieces',
    titleAr: 'آخر القطع',
    href: '/shop?availability=last-pieces',
    image: '/assets/products/men-black-tee.jpg',
    eyebrow: 'Explore',
  },
];

export function normalizeHomeTiles(value: unknown): HomeCollectionTile[] {
  if (!Array.isArray(value)) return DEFAULT_HOME_COLLECTION_TILES;
  const normalized: HomeCollectionTile[] = value
    .map((tile, index): HomeCollectionTile => {
      const item = tile as Partial<HomeCollectionTile>;
      return {
        id: String(item.id || DEFAULT_HOME_COLLECTION_TILES[index]?.id || `tile-${index + 1}`),
        title: String(item.title || DEFAULT_HOME_COLLECTION_TILES[index]?.title || `Collection ${index + 1}`),
        titleAr: String(item.titleAr || DEFAULT_HOME_COLLECTION_TILES[index]?.titleAr || ''),
        href: String(item.href || DEFAULT_HOME_COLLECTION_TILES[index]?.href || '/shop'),
        image: String(item.image || DEFAULT_HOME_COLLECTION_TILES[index]?.image || '/assets/nexora-logo-bg.jpg'),
        eyebrow: String(item.eyebrow || DEFAULT_HOME_COLLECTION_TILES[index]?.eyebrow || 'Explore'),
      };
    })
    .slice(0, 4);

  while (normalized.length < 4) normalized.push({ ...DEFAULT_HOME_COLLECTION_TILES[normalized.length] });
  return normalized;
}
