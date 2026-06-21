export type HomeTileSeason = 'summer' | 'winter' | 'all';

export type HomeCollectionTile = {
  id: string;
  title: string;
  titleAr?: string;
  href: string;
  image: string;
  eyebrow?: string;
  isVisible?: boolean;
  season?: HomeTileSeason;
  sortOrder?: number;
  deletedAt?: string | null;
};

export const MAX_HOME_COLLECTION_TILES = 5;

export const DEFAULT_HOME_COLLECTION_TILES: HomeCollectionTile[] = [
  {
    id: 'oversized-tees',
    title: 'Oversized Tees',
    titleAr: 'تيشيرتات واسعة',
    href: '/shop/unisex',
    image: '/assets/products/women-sand-tee.jpg',
    eyebrow: 'Explore',
    isVisible: true,
    season: 'all',
    sortOrder: 1,
  },
  {
    id: 'core-essentials',
    title: 'Core Essentials',
    titleAr: 'أساسيات يومية',
    href: '/shop',
    image: '/assets/products/men-cream-tee.jpg',
    eyebrow: 'Explore',
    isVisible: true,
    season: 'all',
    sortOrder: 2,
  },
  {
    id: 'limited-drop',
    title: 'Limited Drop',
    titleAr: 'الإصدارات المحدودة',
    href: '/limited',
    image: '/assets/nexora-logo-bg.jpg',
    eyebrow: 'Explore',
    isVisible: true,
    season: 'all',
    sortOrder: 3,
  },
  {
    id: 'last-pieces',
    title: 'Last Pieces',
    titleAr: 'آخر القطع',
    href: '/shop?availability=last-pieces',
    image: '/assets/products/men-black-tee.jpg',
    eyebrow: 'Explore',
    isVisible: true,
    season: 'all',
    sortOrder: 4,
  },
];

function normalizeSeason(value: unknown): HomeTileSeason {
  return value === 'summer' || value === 'winter' || value === 'all' ? value : 'all';
}

export function normalizeHomeTiles(value: unknown): HomeCollectionTile[] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_HOME_COLLECTION_TILES;

  return value
    .map((tile, index): HomeCollectionTile => {
      const item = tile as Partial<HomeCollectionTile>;
      const fallback = DEFAULT_HOME_COLLECTION_TILES[index] || DEFAULT_HOME_COLLECTION_TILES[0];
      return {
        id: String(item.id || fallback.id || `tile-${index + 1}`),
        title: String(item.title || fallback.title || `Collection ${index + 1}`),
        titleAr: String(item.titleAr || fallback.titleAr || ''),
        href: String(item.href || fallback.href || '/shop'),
        image: String(item.image || fallback.image || '/assets/nexora-logo-bg.jpg'),
        eyebrow: String(item.eyebrow || fallback.eyebrow || 'Explore'),
        isVisible: item.isVisible !== false,
        season: normalizeSeason(item.season),
        sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index + 1,
        deletedAt: item.deletedAt || null,
      };
    })
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .slice(0, MAX_HOME_COLLECTION_TILES);
}

export function getVisibleHomeTiles(value: unknown): HomeCollectionTile[] {
  return normalizeHomeTiles(value)
    .filter((tile) => tile.isVisible !== false && !tile.deletedAt)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .slice(0, MAX_HOME_COLLECTION_TILES);
}
