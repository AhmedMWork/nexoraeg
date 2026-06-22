import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Eye, EyeOff, ImageUp, Plus, RefreshCw, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { DEFAULT_HOME_COLLECTION_TILES, MAX_HOME_COLLECTION_TILES, type HomeCollectionTile, type HomeTileSeason, normalizeHomeTiles } from '@/content/homeTiles';

function Field({ label, help, example, children }: { label: string; help: string; example?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a8461]">{label}</span>
      <span className="mb-2 block text-xs leading-5 text-[#8a8175]">{help}{example ? <><br /><b className="text-[#2b211d]">Example:</b> {example}</> : null}</span>
      {children}
    </label>
  );
}

function createBlankTile(index: number): HomeCollectionTile {
  return {
    id: `seasonal-tile-${Date.now()}-${index + 1}`,
    title: `Collection ${index + 1}`,
    titleAr: '',
    href: '/shop',
    image: '/assets/nexora-logo-bg.jpg',
    eyebrow: 'Explore',
    isVisible: true,
    season: 'all',
    sortOrder: index + 1,
    deletedAt: null,
  };
}

export default function AdminStorefront() {
  const [tiles, setTiles] = useState<HomeCollectionTile[]>(DEFAULT_HOME_COLLECTION_TILES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingTile, setUploadingTile] = useState<string | null>(null);

  const activeTiles = useMemo(() => normalizeHomeTiles(tiles).filter((tile) => !tile.deletedAt), [tiles]);
  const visibleCount = activeTiles.filter((tile) => tile.isVisible !== false).length;

  const load = async () => {
    setIsLoading(true);
    try {
      const { getHomeCollectionTiles } = await import('@/lib/supabase/db');
      setTiles(normalizeHomeTiles(await getHomeCollectionTiles()));
    } catch {
      toast.error('Could not load storefront tiles');
      setTiles(DEFAULT_HOME_COLLECTION_TILES);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const updateTile = (index: number, patch: Partial<HomeCollectionTile>) => {
    setTiles((current) => current.map((tile, i) => i === index ? { ...tile, ...patch } : tile));
  };

  const addTile = () => {
    const current = normalizeHomeTiles(tiles).filter((tile) => !tile.deletedAt);
    if (current.length >= MAX_HOME_COLLECTION_TILES) {
      toast.error('Maximum 5 storefront tiles. Hide or delete one first.');
      return;
    }
    setTiles([...current, createBlankTile(current.length)]);
  };

  const deleteTile = (index: number) => {
    setTiles((current) => current.filter((_, i) => i !== index).map((tile, i) => ({ ...tile, sortOrder: i + 1 })));
    toast.success('Tile removed. Press Save to publish.');
  };

  const moveTile = (index: number, direction: -1 | 1) => {
    setTiles((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((tile, i) => ({ ...tile, sortOrder: i + 1 }));
    });
  };

  const save = async () => {
    setIsSaving(true);
    try {
      const { updateHomeCollectionTiles } = await import('@/lib/supabase/db');
      await updateHomeCollectionTiles(normalizeHomeTiles(tiles));
      toast.success('Homepage collection tiles updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save homepage tiles');
    } finally {
      setIsSaving(false);
    }
  };

  const reset = () => setTiles(DEFAULT_HOME_COLLECTION_TILES);

  const upload = async (index: number, file?: File | null) => {
    if (!file) return;
    setUploadingTile(tiles[index]?.id || String(index));
    try {
      const { uploadProductImage } = await import('@/services/upload.service');
      const publicUrl = await uploadProductImage(file, `storefront-${tiles[index]?.id || index}`);
      updateTile(index, { image: publicUrl });
      toast.success('Image uploaded. Press Save to publish it.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not upload image');
    } finally {
      setUploadingTile(null);
    }
  };

  const helpCards = useMemo(() => [
    ['Seasonal control', 'Show 2 or 3 summer tiles, or up to 5 winter tiles. Hidden tiles stay saved but do not appear on the storefront.'],
    ['Maximum 5', 'The homepage will never show more than five tiles. Delete or hide tiles when collections change.'],
    ['Best image size', 'Use wide lifestyle/product images. Recommended ratio: 16:9 or 2:1. Keep the subject centered.'],
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#2b211d]">Storefront</h1>
          <p className="mt-1 text-sm leading-6 text-[#8a8175]">Control the premium home collection cards. Visible now: {visibleCount}. Maximum: {MAX_HOME_COLLECTION_TILES}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={load} className="nexora-button" disabled={isLoading}><RefreshCw className="h-4 w-4" />Refresh</button>
          <button onClick={addTile} className="nexora-button" disabled={activeTiles.length >= MAX_HOME_COLLECTION_TILES}><Plus className="h-4 w-4" />Add tile</button>
          <button onClick={reset} className="nexora-button"><RotateCcw className="h-4 w-4" />Reset default</button>
          <button onClick={save} className="nexora-button-primary" disabled={isSaving}><Save className="h-4 w-4" />{isSaving ? 'Saving...' : 'Save storefront'}</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {helpCards.map(([title, body]) => (
          <div key={title} className="studio-card p-5">
            <p className="text-sm font-semibold text-[#2b211d]">{title}</p>
            <p className="mt-2 text-xs leading-6 text-[#8a8175]">{body}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {activeTiles.map((tile, index) => (
          <div key={`${tile.id}-${index}`} className={`studio-card overflow-hidden ${tile.isVisible === false ? 'opacity-70' : ''}`}>
            <div className="relative aspect-[2.15/1] overflow-hidden bg-[#f7f1e8]">
              <img src={tile.image} alt={tile.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#F4E8DA]/85 via-[#F4E8DA]/45 to-transparent" />
              <div className="absolute left-5 top-5 flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${tile.isVisible === false ? 'bg-[#2b211d]/80 text-white' : 'bg-white/85 text-[#2b211d]'}`}>{tile.isVisible === false ? 'Hidden' : 'Visible'}</span>
                <span className="rounded-full bg-white/85 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#9a8461]">{tile.season || 'all'}</span>
              </div>
              <div className="absolute bottom-5 left-5">
                <h3 className="text-xl font-bold tracking-[-0.04em] text-[#050505]">{tile.title}</h3>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#C77D55]">{tile.eyebrow || 'Explore'} <ArrowRight className="h-3 w-3" /></span>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#2b211d]">Tile {index + 1}</p>
                  <p className="mt-1 text-xs text-[#8a8175]">Shown only when Visible is enabled.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => moveTile(index, -1)} disabled={index === 0} className="rounded-full border border-[#e6ded1] bg-white p-2 disabled:opacity-40"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveTile(index, 1)} disabled={index === activeTiles.length - 1} className="rounded-full border border-[#e6ded1] bg-white p-2 disabled:opacity-40"><ArrowDown className="h-3.5 w-3.5" /></button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="English title" help="Main title displayed on the card." example="Oversized Tees">
                  <input className="studio-input" value={tile.title} onChange={(e) => updateTile(index, { title: e.target.value })} />
                </Field>
                <Field label="Arabic title" help="Used when Arabic storefront is active." example="Oversized tees">
                  <input className="studio-input" value={tile.titleAr || ''} onChange={(e) => updateTile(index, { titleAr: e.target.value })} />
                </Field>
                <Field label="Link" help="Where the card opens when customer clicks it." example="/shop?availability=last-pieces">
                  <input className="studio-input" value={tile.href} onChange={(e) => updateTile(index, { href: e.target.value })} />
                </Field>
                <Field label="Small CTA" help="Tiny label under the title." example="Explore">
                  <input className="studio-input" value={tile.eyebrow || ''} onChange={(e) => updateTile(index, { eyebrow: e.target.value })} />
                </Field>
                <Field label="Season" help="Internal organization for summer/winter collections.">
                  <select className="studio-input" value={tile.season || 'all'} onChange={(e) => updateTile(index, { season: e.target.value as HomeTileSeason })}>
                    <option value="all">All year</option>
                    <option value="summer">Summer</option>
                    <option value="winter">Winter</option>
                  </select>
                </Field>
                <Field label="Visibility" help="Hide a tile without deleting its content.">
                  <button type="button" onClick={() => updateTile(index, { isVisible: tile.isVisible === false })} className="nexora-button w-full justify-center">
                    {tile.isVisible === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {tile.isVisible === false ? 'Hidden — click to show' : 'Visible — click to hide'}
                  </button>
                </Field>
              </div>

              <Field label="Image URL" help="Paste an existing image URL or upload a new one below." example="/assets/products/men-black-tee.jpg">
                <input className="studio-input" value={tile.image} onChange={(e) => updateTile(index, { image: e.target.value })} />
              </Field>

              <div className="flex flex-wrap gap-2">
                <label className="nexora-button inline-flex cursor-pointer">
                  {uploadingTile === tile.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploadingTile === tile.id ? 'Uploading...' : 'Upload tile image'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(index, e.target.files?.[0])} disabled={Boolean(uploadingTile)} />
                </label>
                <button type="button" onClick={() => deleteTile(index)} className="nexora-button text-red-600"><Trash2 className="h-4 w-4" />Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="studio-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#2b211d]"><ImageUp className="h-4 w-4 text-[#9a8461]" />Important notes</h2>
        <ul className="space-y-2 text-xs leading-6 text-[#8a8175]">
          <li>• Maximum 5 cards. You can publish 2, 3, 4, or 5 depending on season.</li>
          <li>• Hidden cards stay saved in Studio but do not appear on the storefront.</li>
          <li>• After upload/edit, press <b className="text-[#2b211d]">Save storefront</b>.</li>
        </ul>
      </div>
    </div>
  );
}
