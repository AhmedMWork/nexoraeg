/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, RefreshCw, Search, Tag, UserRound, UsersRound, WalletCards, MapPin, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminEmptyBlock, AdminFilterChip, AdminHero, AdminMetricCard, AdminPageShell, AdminPanel, AdminStatusPill } from '@/components/admin/AdminCommandCenter';
import { formatPrice, formatTimestamp } from '@/lib/utils';

const tags = ['VIP', 'High intent', 'Needs follow-up', 'Returning customer', 'Asked for size', 'ValU lead'];
const segments = ['all', 'vip', 'repeat', 'needs-follow-up', 'inactive'] as const;

type Segment = typeof segments[number];

function waUrl(phone?: string) {
  const normalized = String(phone || '').replace(/\D/g, '').replace(/^0/, '20');
  return normalized ? `https://wa.me/${normalized}` : '#';
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<Segment>('all');
  const [selected, setSelected] = useState<any | null>(null);
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      const { getCustomerProfiles } = await import('@/lib/supabase/db');
      setCustomers(await getCustomerProfiles());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load customer profiles');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => {
    const totalRevenue = customers.reduce((sum, c) => sum + Number(c.total_revenue || 0), 0);
    const repeat = customers.filter((c) => Number(c.total_orders || 0) > 1).length;
    const vip = customers.filter((c) => Number(c.total_revenue || 0) >= 3000 || Number(c.total_orders || 0) >= 3).length;
    const withNotes = customers.filter((c) => Array.isArray(c.notes) && c.notes.length).length;
    const topLocation = Object.entries(customers.reduce<Record<string, number>>((acc, c) => { const key = [c.governorate, c.city].filter(Boolean).join(' / '); if (key) acc[key] = (acc[key] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No data';
    return { totalRevenue, repeat, vip, withNotes, topLocation };
  }, [customers]);

  const filtered = useMemo(() => customers.filter((customer) => {
    const text = `${customer.full_name || ''} ${customer.phone || ''} ${customer.email || ''} ${customer.governorate || ''} ${customer.city || ''} ${(customer.tags || []).join(' ')}`.toLowerCase();
    const matchesQuery = text.includes(query.toLowerCase().trim());
    const orders = Number(customer.total_orders || 0);
    const revenue = Number(customer.total_revenue || 0);
    const customerTags: string[] = Array.isArray(customer.tags) ? customer.tags : [];
    const matchesSegment = segment === 'all'
      || (segment === 'vip' && (revenue >= 3000 || orders >= 3 || customerTags.includes('VIP')))
      || (segment === 'repeat' && orders > 1)
      || (segment === 'needs-follow-up' && customerTags.includes('Needs follow-up'))
      || (segment === 'inactive' && orders === 0);
    return matchesQuery && matchesSegment;
  }), [customers, query, segment]);

  const updateTags = async (customer: any, tag: string) => {
    const current = Array.isArray(customer.tags) ? customer.tags : [];
    const next = current.includes(tag) ? current.filter((item: string) => item !== tag) : [...current, tag];
    try {
      const { updateCustomerProfile } = await import('@/lib/supabase/db');
      await updateCustomerProfile(customer.id, { tags: next });
      setCustomers((rows) => rows.map((row) => row.id === customer.id ? { ...row, tags: next } : row));
      setSelected((row: any) => row?.id === customer.id ? { ...row, tags: next } : row);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update tags');
    }
  };

  const saveNote = async () => {
    if (!selected || !note.trim()) return;
    try {
      const { addCustomerNote } = await import('@/lib/supabase/db');
      await addCustomerNote(selected.id, note.trim());
      toast.success('Customer note saved');
      setNote('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save note');
    }
  };

  return (
    <AdminPageShell>
      <AdminHero
        eyebrow="Customers"
        title="Customer Hub"
        description="A practical CRM layer for orders, value, tags, notes, WhatsApp follow-ups and location insights. No capability was removed; this organizes customer control in one place."
        actions={<button onClick={load} className="nexora-button-primary"><RefreshCw className="h-4 w-4" /> Refresh customers</button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard label="Customers" value={customers.length} helper="Unique customer profiles." icon={<UsersRound className="h-4 w-4" />} />
        <AdminMetricCard label="Revenue" value={formatPrice(stats.totalRevenue)} helper="Customer lifetime revenue." icon={<WalletCards className="h-4 w-4" />} tone="good" />
        <AdminMetricCard label="Repeat buyers" value={stats.repeat} helper="More than one order." icon={<RefreshCw className="h-4 w-4" />} tone={stats.repeat ? 'good' : 'neutral'} />
        <AdminMetricCard label="VIP" value={stats.vip} helper="High value or frequent buyers." icon={<UserRound className="h-4 w-4" />} tone="accent" />
        <AdminMetricCard label="Top location" value={stats.topLocation} helper={`${stats.withNotes} profiles have notes.`} icon={<MapPin className="h-4 w-4" />} />
      </div>

      <AdminPanel title="Customer filters" description="Search by name, phone, city, email or tag. Segments keep daily follow-up fast.">
        <div className="flex flex-wrap gap-2">
          {segments.map((item) => <AdminFilterChip key={item} active={segment === item} onClick={() => setSegment(item)}>{item.replace(/-/g, ' ')}</AdminFilterChip>)}
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9D7159]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, phone, city, email, or tag..." className="studio-input pl-11" />
        </div>
      </AdminPanel>

      <div className="grid gap-4 xl:grid-cols-[1fr_390px]">
        <AdminPanel title="Customer profiles" description={`${filtered.length} profile(s) match your current view.`}>
          <div className="space-y-3">
            {isLoading ? <p className="p-6 text-center text-sm text-[#6F5D50]">Loading customers...</p> : filtered.length ? filtered.map((customer) => {
              const customerTags: string[] = Array.isArray(customer.tags) ? customer.tags : [];
              const isVip = customerTags.includes('VIP') || Number(customer.total_revenue || 0) >= 3000 || Number(customer.total_orders || 0) >= 3;
              return (
                <button key={customer.id || customer.phone} type="button" onClick={() => setSelected(customer)} className={`w-full rounded-[24px] border p-4 text-left transition hover:border-[#D6B58F] ${selected?.id === customer.id ? 'border-[#D6B58F] bg-[#F2E7D8]' : 'border-[#E4D6C5] bg-[#FAF5EE]'}`}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black text-[#231916]">{customer.full_name || 'Unnamed customer'}</h3>{isVip && <AdminStatusPill tone="accent">VIP</AdminStatusPill>}</div>
                      <p className="mt-1 text-xs text-[#6F5D50]" dir="ltr">{customer.phone || customer.email || 'No contact data'}</p>
                      <p className="mt-1 text-xs text-[#8E7664]">{[customer.governorate, customer.city].filter(Boolean).join(' / ') || 'No location'}</p>
                      <div className="mt-3 flex flex-wrap gap-2">{customerTags.map((tag) => <span key={tag} className="rounded-full border border-[#D7C5B2] bg-[#FFFDF8] px-3 py-1 text-[10px] font-bold text-[#6F5D50]">{tag}</span>)}</div>
                    </div>
                    <div className="grid min-w-[230px] grid-cols-2 gap-2 text-xs">
                      <div className="rounded-2xl border border-[#E4D6C5] bg-[#FFFDF8] p-3"><span className="text-[#8E7664]">Orders</span><strong className="mt-1 block text-lg text-[#231916]">{customer.total_orders || 0}</strong></div>
                      <div className="rounded-2xl border border-[#E4D6C5] bg-[#FFFDF8] p-3"><span className="text-[#8E7664]">Spent</span><strong className="mt-1 block text-lg text-[#9D7159]">{formatPrice(customer.total_revenue || 0)}</strong></div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 border-t border-[#E4D6C5] pt-3 text-[10px] text-[#8E7664] sm:grid-cols-3"><span>First source: {customer.first_source || '—'}</span><span>Campaign: {customer.last_campaign || '—'}</span><span>Last order: {customer.last_order_at ? formatTimestamp(new Date(customer.last_order_at), 'en-EG') : '—'}</span></div>
                </button>
              );
            }) : <AdminEmptyBlock title="No customers found" description="Create orders or clear filters to show customer profiles." />}
          </div>
        </AdminPanel>

        <aside className="space-y-4">
          <AdminPanel title="Customer drawer" description="Select a profile to add tags, notes and WhatsApp actions.">
            {selected ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#E4D6C5] bg-[#FAF5EE] p-4"><p className="text-base font-black text-[#231916]">{selected.full_name || 'Unnamed customer'}</p><p className="mt-1 text-xs text-[#6F5D50]" dir="ltr">{selected.phone || selected.email || 'No contact data'}</p></div>
                <div className="flex flex-wrap gap-2">{tags.map((tag) => <button key={tag} type="button" onClick={() => updateTags(selected, tag)} className={`inline-flex items-center gap-1 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] ${Array.isArray(selected.tags) && selected.tags.includes(tag) ? 'border-[#231916] bg-[#231916] text-[#FFFDF8]' : 'border-[#E4D6C5] bg-[#FFFDF8] text-[#6F5D50]'}`}><Tag className="h-3 w-3" />{tag}</button>)}</div>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} className="studio-input min-h-28" placeholder="Internal note: asked for size, needs follow-up, prefers WhatsApp..." />
                <button onClick={saveNote} disabled={!note.trim()} className="nexora-button-primary w-full"><Save className="h-4 w-4" /> Save note</button>
                {selected.phone && <a href={waUrl(selected.phone)} target="_blank" rel="noreferrer" className="nexora-button flex w-full justify-center"><MessageCircle className="h-4 w-4" /> Open WhatsApp</a>}
              </div>
            ) : <AdminEmptyBlock title="No profile selected" description="Choose a customer from the list to manage tags, notes and follow-up actions." />}
          </AdminPanel>

          <AdminPanel title="Segments" description="Quick view of operational customer groups.">
            <div className="space-y-2">{tags.map((tag) => <div key={tag} className="flex items-center justify-between rounded-2xl border border-[#E4D6C5] bg-[#FAF5EE] px-3 py-2 text-xs"><span>{tag}</span><strong>{customers.filter((customer) => Array.isArray(customer.tags) && customer.tags.includes(tag)).length}</strong></div>)}</div>
          </AdminPanel>
        </aside>
      </div>
    </AdminPageShell>
  );
}
