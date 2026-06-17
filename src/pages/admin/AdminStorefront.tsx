import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ImageUp, RefreshCw, RotateCcw, Save, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { DEFAULT_HOME_COLLECTION_TILES, type HomeCollectionTile } from '@/content/homeTiles';

function Field({ label, help, example, children }: { label: string; help: string; example?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#D2B48C]">{label}</span>
      <span className="mb-2 block text-xs leading-5 text-[#BCAEA0]">{help}{example ? <><br /><b className="text-[#FFF0E1]">Example:</b> {example}</> : null}</span>
      {children}
    </label>
  );
}

export default function AdminStorefront() {
  const [tiles, setTiles] = useState<HomeCollectionTile[]>(DEFAULT_HOME_COLLECTION_TILES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingTile, setUploadingTile] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const { getHomeCollectionTiles } = await import('@/lib/supabase/db');
      setTiles(await getHomeCollectionTiles());
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

  const save = async () => {
    setIsSaving(true);
    try {
      const { updateHomeCollectionTiles } = await import('@/lib/supabase/db');
      await updateHomeCollectionTiles(tiles);
      toast.success('Homepage collection tiles updated');
    } catch {
      toast.error('Could not save homepage tiles');
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
    ['What this controls', 'These are the four image cards on the home page: Oversized Tees, Core Essentials, Limited Drop, and Last Pieces.'],
    ['Best image size', 'Use wide lifestyle/product images. Recommended ratio: 16:9 or 2:1. Keep the subject centered or slightly right.'],
    ['How to publish', 'Upload/paste the image URL, adjust title/link, press Save, then refresh the storefront. No Vercel redeploy is needed after Supabase is updated.'],
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#FFF0E1]">Storefront</h1>
          <p className="mt-1 text-sm leading-6 text-[#BCAEA0]">Control the premium home collection cards without editing code.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={load} className="nexora-button" disabled={isLoading}><RefreshCw className="h-4 w-4" />Refresh</button>
          <button onClick={reset} className="nexora-button"><RotateCcw className="h-4 w-4" />Reset default</button>
          <button onClick={save} className="nexora-button-primary" disabled={isSaving}><Save className="h-4 w-4" />{isSaving ? 'Saving...' : 'Save storefront'}</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {helpCards.map(([title, body]) => (
          <div key={title} className="studio-card p-5">
            <p className="text-sm font-semibold text-[#FFF0E1]">{title}</p>
            <p className="mt-2 text-xs leading-6 text-[#BCAEA0]">{body}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {tiles.map((tile, index) => (
          <div key={`${tile.id}-${index}`} className="studio-card overflow-hidden">
            <div className="relative aspect-[2.15/1] overflow-hidden bg-[#0E0B0A]">
              <img src={tile.image} alt={tile.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#F4E8DA]/80 via-[#F4E8DA]/45 to-transparent" />
              <div className="absolute bottom-5 left-5">
                <h3 className="text-xl font-bold tracking-[-0.04em] text-[#050505]">{tile.title}</h3>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#C77D55]">{tile.eyebrow || 'Explore'} <ArrowRight className="h-3 w-3" /></span>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#FFF0E1]">Tile {index + 1}</p>
                  <p className="mt-1 text-xs text-[#BCAEA0]">Appears on the home page collection strip.</p>
                </div>
                <span className="rounded-full border border-[#D2B48C]/30 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#D2B48C]">{tile.id}</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="English title" help="Main title displayed on the card." example="Oversized Tees">
                  <input className="studio-input" value={tile.title} onChange={(e) => updateTile(index, { title: e.target.value })} />
                </Field>
                <Field label="Arabic title" help="Used when Arabic storefront is active." example="تيشيرتات واسعة">
                  <input className="studio-input" value={tile.titleAr || ''} onChange={(e) => updateTile(index, { titleAr: e.target.value })} />
                </Field>
                <Field label="Link" help="Where the card opens when customer clicks it." example="/shop?availability=last-pieces">
                  <input className="studio-input" value={tile.href} onChange={(e) => updateTile(index, { href: e.target.value })} />
                </Field>
                <Field label="Small CTA" help="Tiny label under the title." example="Explore">
                  <input className="studio-input" value={tile.eyebrow || ''} onChange={(e) => updateTile(index, { eyebrow: e.target.value })} />
                </Field>
              </div>

              <Field label="Image URL" help="Paste an existing image URL or upload a new one below. This is the image you asked to control from admin." example="/assets/products/men-black-tee.jpg">
                <input className="studio-input" value={tile.image} onChange={(e) => updateTile(index, { image: e.target.value })} />
              </Field>
              <label className="nexora-button inline-flex cursor-pointer">
                {uploadingTile === tile.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploadingTile === tile.id ? 'Uploading...' : 'Upload tile image'}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(index, e.target.files?.[0])} disabled={Boolean(uploadingTile)} />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="studio-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#FFF0E1]"><ImageUp className="h-4 w-4 text-[#D2B48C]" />Important notes</h2>
        <ul className="space-y-2 text-xs leading-6 text-[#BCAEA0]">
          <li>• Upload uses the existing Supabase Storage bucket <b className="text-[#FFF0E1]">products</b>.</li>
          <li>• After upload, press <b className="text-[#FFF0E1]">Save storefront</b>; otherwise the image only appears in the preview.</li>
          <li>• Keep text short. Luxury cards should feel quiet, not crowded.</li>
        </ul>
      </div>
    </div>
  );
}
