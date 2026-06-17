// ============================================================
// NEXORA — Admin Inventory Page V5.2.1
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Minus, PackageCheck, PackageX, Plus, RefreshCw, Search, Warehouse } from 'lucide-react';
import type { InventoryLog, Product } from '@/types';
import toast from 'react-hot-toast';

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function totalStock(product: Product) {
  return product.sizes.reduce((sum, size) => sum + Number(size.stock || 0), 0);
}

function stockStatus(product: Product) {
  const total = totalStock(product);
  if (!product.sizes.length) return { label: 'Missing stock setup', tone: 'warning' as const };
  if (total <= 0 || product.status === 'sold_out') return { label: 'Sold out', tone: 'danger' as const };
  if (product.sizes.some((size) => Number(size.stock || 0) <= Number(size.lowStockThreshold ?? 3))) return { label: 'Low stock', tone: 'warning' as const };
  return { label: 'In stock', tone: 'success' as const };
}

function Metric({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: React.ElementType }) {
  return (
    <div className="studio-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <Icon className="h-5 w-5 text-[#D2B48C]" />
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#BCAEA0]">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#FFF0E1]">{value}</p>
      <p className="mt-2 text-xs leading-6 text-[#BCAEA0]">{helper}</p>
    </div>
  );
}

export default function AdminInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'sold_out' | 'missing'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdjusting, setIsAdjusting] = useState<string | null>(null);

  const loadInventory = async () => {
    setIsLoading(true);
    try {
      const db = await import('@/lib/supabase/db');
      const [adminProducts, inventoryLogs] = await Promise.all([
        db.getAdminProducts(),
        db.getInventoryLogs().catch(() => []),
      ]);
      setProducts(adminProducts);
      setLogs(inventoryLogs);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load inventory');
      setProducts([]);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadInventory(); }, []);

  const filteredProducts = useMemo(() => products.filter((product) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || product.name.toLowerCase().includes(q) || product.sku.toLowerCase().includes(q) || product.slug.toLowerCase().includes(q);
    const status = stockStatus(product);
    const matchesFilter = stockFilter === 'all'
      || (stockFilter === 'low' && status.label === 'Low stock')
      || (stockFilter === 'sold_out' && status.label === 'Sold out')
      || (stockFilter === 'missing' && status.label === 'Missing stock setup');
    return matchesSearch && matchesFilter;
  }), [products, searchQuery, stockFilter]);

  const metrics = useMemo(() => {
    const totalUnits = products.reduce((sum, product) => sum + totalStock(product), 0);
    const low = products.filter((product) => stockStatus(product).label === 'Low stock').length;
    const soldOut = products.filter((product) => stockStatus(product).label === 'Sold out').length;
    const missing = products.filter((product) => stockStatus(product).label === 'Missing stock setup').length;
    return { totalUnits, low, soldOut, missing };
  }, [products]);

  const adjustStock = async (productId: string, size: string, delta: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product || !size) return;
    const key = `${productId}-${size}`;
    setIsAdjusting(key);

    const previous = products;
    const updatedSizes = product.sizes.map((item) => item.size === size ? { ...item, stock: Math.max(0, Number(item.stock || 0) + delta) } : item);
    setProducts((current) => current.map((item) => item.id === productId ? { ...item, sizes: updatedSizes } : item));

    try {
      const { updateProductStock } = await import('@/lib/supabase/db');
      await updateProductStock(productId, size, delta, 'manual_adjustment', `Studio inventory ${delta > 0 ? '+' : ''}${delta}`);
      toast.success('Stock updated');
      void loadInventory();
    } catch (error) {
      setProducts(previous);
      toast.error(error instanceof Error ? error.message : 'Could not save stock update');
    } finally {
      setIsAdjusting(null);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['product', 'slug', 'sku', 'status', 'size', 'stock', 'low_stock_threshold', 'total_stock'],
      ...products.flatMap((product) => product.sizes.length ? product.sizes.map((size) => [product.name, product.slug, product.sku, product.status, size.size, size.stock, size.lowStockThreshold, totalStock(product)]) : [[product.name, product.slug, product.sku, product.status, 'NO_SIZE_SETUP', 0, 0, 0]]),
    ];
    const blob = new Blob([rows.map((row) => row.map(csvEscape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexora-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#FFF0E1]">Inventory</h1>
          <p className="mt-1 text-sm leading-6 text-[#BCAEA0]">Manage live product stock. This page reads products through Studio access, so hidden/draft products also appear.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCsv} className="nexora-button" disabled={!products.length}><Download className="h-4 w-4" />Export CSV</button>
          <button onClick={loadInventory} className="nexora-button" disabled={isLoading}><RefreshCw className="h-4 w-4" />Refresh</button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total units" value={String(metrics.totalUnits)} helper="Total available stock across all products and sizes." icon={Warehouse} />
        <Metric label="Low stock" value={String(metrics.low)} helper="Products with one or more sizes below threshold." icon={AlertTriangle} />
        <Metric label="Sold out" value={String(metrics.soldOut)} helper="Products with zero total stock or sold_out status." icon={PackageX} />
        <Metric label="Missing setup" value={String(metrics.missing)} helper="Products with no size/stock rows yet. Fix from Products page." icon={PackageCheck} />
      </div>

      <div className="studio-card p-5">
        <h2 className="mb-2 text-sm font-semibold text-[#FFF0E1]">How Inventory works</h2>
        <div className="grid gap-3 text-xs leading-6 text-[#BCAEA0] md:grid-cols-3">
          <p><b className="text-[#D2B48C]">Stock source:</b> product size stock from Products → Sizes and stock.</p>
          <p><b className="text-[#D2B48C]">+ / - buttons:</b> quick manual adjustments. Every adjustment is saved through Supabase Edge Function and logged.</p>
          <p><b className="text-[#D2B48C]">If empty:</b> confirm products exist in Products page, run latest migrations, and deploy studio-products function.</p>
        </div>
      </div>

      {metrics.low > 0 && (
        <div className="rounded-[28px] border border-red-500/20 bg-red-500/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-300" />
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-red-300">Low Stock Alert</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {products.filter((p) => stockStatus(p).label === 'Low stock').slice(0, 8).map((product) => (
              <p key={product.id} className="rounded-2xl border border-red-400/10 bg-[#0E0B0A] px-4 py-3 text-xs text-[#BCAEA0]">
                <b className="text-[#FFF0E1]">{product.name}</b>: {product.sizes.filter((size) => Number(size.stock || 0) <= Number(size.lowStockThreshold ?? 3)).map((size) => `${size.size} (${size.stock})`).join(', ')}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#BCAEA0]" />
          <input type="text" placeholder="Search product, SKU, slug..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="studio-input pl-11" />
        </div>
        <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)} className="studio-input lg:max-w-[240px]">
          <option value="all">All stock</option>
          <option value="low">Low stock only</option>
          <option value="sold_out">Sold out only</option>
          <option value="missing">Missing stock setup</option>
        </select>
      </div>

      <div className="studio-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left">
            <thead className="bg-[#17110F]">
              <tr>
                {['Product', 'SKU', 'Status', 'Sizes & Stock', 'Total', 'Actions'].map((header) => <th key={header} className="p-4 text-[10px] uppercase tracking-[0.18em] text-[#BCAEA0]">{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="p-8 text-center text-sm text-[#BCAEA0]">Loading inventory...</td></tr>
              ) : filteredProducts.length ? filteredProducts.map((product) => {
                const total = totalStock(product);
                const status = stockStatus(product);
                return (
                  <tr key={product.id} className="border-t border-[#332923]/70">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img src={product.thumbnail || product.images[0] || '/assets/nexora-logo-bg.jpg'} alt={product.name} className="h-12 w-12 rounded-2xl bg-[#050505] object-cover" />
                        <div>
                          <p className="text-sm font-semibold text-[#FFF0E1]">{product.name}</p>
                          <p className="mt-1 text-xs text-[#BCAEA0]">{product.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-xs text-[#BCAEA0]">{product.sku || '—'}</td>
                    <td className="p-4"><span className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${status.tone === 'danger' ? 'bg-red-500/10 text-red-300' : status.tone === 'warning' ? 'bg-amber-500/10 text-amber-200' : 'bg-emerald-500/10 text-emerald-200'}`}>{status.label}</span></td>
                    <td className="p-4">
                      {product.sizes.length ? <div className="flex flex-wrap gap-2">
                        {product.sizes.map((size) => {
                          const isLow = Number(size.stock || 0) <= Number(size.lowStockThreshold ?? 3);
                          const key = `${product.id}-${size.size}`;
                          return (
                            <div key={size.size} className="flex items-center gap-1 rounded-2xl border border-[#332923] bg-[#0E0B0A] px-2 py-1">
                              <span className={`text-[11px] ${isLow ? 'text-amber-200' : 'text-[#D2C0B0]'}`}>{size.size}: <b>{size.stock}</b></span>
                              <button disabled={isAdjusting === key} onClick={() => adjustStock(product.id, size.size, -1)} className="rounded-full p-1 text-[#BCAEA0] hover:bg-red-500/10 hover:text-red-300"><Minus className="h-3 w-3" /></button>
                              <button disabled={isAdjusting === key} onClick={() => adjustStock(product.id, size.size, 1)} className="rounded-full p-1 text-[#BCAEA0] hover:bg-emerald-500/10 hover:text-emerald-300"><Plus className="h-3 w-3" /></button>
                            </div>
                          );
                        })}
                      </div> : <p className="text-xs leading-6 text-amber-200">No size stock rows. Open Products → Edit product → Sizes and stock, then set quantities.</p>}
                    </td>
                    <td className="p-4"><span className={`text-sm font-semibold ${total <= 0 ? 'text-red-300' : total <= 10 ? 'text-amber-200' : 'text-[#D2B48C]'}`}>{total}</span></td>
                    <td className="p-4 text-xs text-[#BCAEA0]">Quick edit stock here or full setup in Products.</td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={6} className="p-10 text-center text-sm leading-7 text-[#BCAEA0]">No inventory rows found. Create products first, set stock in Products → Sizes and stock, run <b className="text-[#FFF0E1]">supabase db push</b>, and deploy <b className="text-[#FFF0E1]">studio-products</b>.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="studio-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#FFF0E1]">Recent inventory logs</h2>
          <span className="text-[10px] uppercase tracking-[0.16em] text-[#BCAEA0]">Last {logs.slice(0, 10).length}</span>
        </div>
        <div className="space-y-2">
          {logs.slice(0, 10).length ? logs.slice(0, 10).map((log) => (
            <div key={log.id} className="grid gap-2 rounded-2xl border border-[#332923] bg-[#17110F] p-3 text-xs md:grid-cols-5">
              <span className="text-[#D2B48C]">{log.reason}</span>
              <span className="text-[#BCAEA0]">Size: {log.size || '—'}</span>
              <span className={Number(log.change || 0) >= 0 ? 'text-emerald-200' : 'text-red-300'}>Change: {Number(log.change || 0) > 0 ? '+' : ''}{log.change}</span>
              <span className="text-[#BCAEA0]">{log.previousStock} → {log.newStock}</span>
              <span className="text-[#BCAEA0]">{log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}</span>
            </div>
          )) : <p className="text-sm text-[#BCAEA0]">No stock adjustments logged yet.</p>}
        </div>
      </div>
    </div>
  );
}
