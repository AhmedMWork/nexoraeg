/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, MapPin, Phone, Mail, Clock, Tag, MessageCircle, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminPageHeader, AdminStatCard, AdminTabBar } from '@/components/admin/AdminPageHeader';
import { formatPrice, formatTimestamp } from '@/lib/utils';

const tabs = ['Profiles', 'Segments', 'Notes'];

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(tabs[0]);
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

  const filtered = useMemo(() => customers.filter((customer) => `${customer.full_name || ''} ${customer.phone || ''} ${customer.email || ''} ${customer.governorate || ''} ${customer.city || ''} ${(customer.tags || []).join(' ')}`.toLowerCase().includes(query.toLowerCase())), [customers, query]);
  const totalRevenue = customers.reduce((sum, c) => sum + Number(c.total_revenue || 0), 0);
  const repeat = customers.filter((c) => Number(c.total_orders || 0) > 1).length;
  const vip = customers.filter((c) => Number(c.total_revenue || 0) >= 3000 || Number(c.total_orders || 0) >= 3).length;
  const topCity = Object.entries(customers.reduce<Record<string, number>>((acc, c) => { const key = [c.governorate, c.city].filter(Boolean).join(' / '); if (key) acc[key] = (acc[key] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No data';

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

  const updateTags = async (customer: any, tag: string) => {
    const current = Array.isArray(customer.tags) ? customer.tags : [];
    const next = current.includes(tag) ? current.filter((t: string) => t !== tag) : [...current, tag];
    try {
      const { updateCustomerProfile } = await import('@/lib/supabase/db');
      await updateCustomerProfile(customer.id, { tags: next });
      setCustomers((rows) => rows.map((row) => row.id === customer.id ? { ...row, tags: next } : row));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update tags');
    }
  };

  const tagOptions = ['VIP', 'High intent', 'Needs follow-up', 'Returned customer', 'Asked for size'];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Customer profiles"
        description="A real customer layer: phone, location, order value, source/campaign, tags, notes, and follow-up signals. Built from orders and updated by Studio."
        actions={<button onClick={load} className="nexora-button"><RefreshCw className="h-4 w-4" />Refresh</button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Customers" value={customers.length} helper="Unique customer profiles, primarily matched by phone." />
        <AdminStatCard label="Revenue" value={formatPrice(totalRevenue)} helper="Total non-cancelled order value in profiles." tone="good" />
        <AdminStatCard label="Repeat buyers" value={repeat} helper="Customers with more than one order." tone={repeat ? 'good' : 'default'} />
        <AdminStatCard label="Top location" value={topCity} helper={`${vip} VIP/high-value customers detected.`} />
      </div>

      <AdminTabBar tabs={tabs} active={active} onChange={setActive} />

      <div className="studio-card p-4">
        <label className="flex items-center gap-3 rounded-2xl border border-[#2E3442] bg-[#0D1016] px-4 py-3">
          <Search className="h-4 w-4 text-[#D7B98E]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer, phone, city, source, tag..." className="w-full bg-transparent text-sm text-[#F5F1EA] outline-none placeholder:text-[#697286]" />
        </label>
      </div>

      {active === 'Profiles' && (
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="grid gap-4">
            {isLoading ? <div className="studio-card p-8 text-center text-sm text-[#A7AEBB]">Loading customer profiles...</div> : filtered.length ? filtered.map((customer) => (
              <article key={customer.id || customer.phone} onClick={() => setSelected(customer)} className={`studio-card cursor-pointer p-5 transition hover:border-[#D7B98E] ${selected?.id === customer.id ? 'border-[#D7B98E] ring-2 ring-[#D7B98E]/10' : ''}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-[#F5F1EA]">{customer.full_name || 'Unnamed customer'}</h2>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#A7AEBB]">
                      {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{customer.phone}</span>}
                      {customer.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{customer.email}</span>}
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[customer.governorate, customer.city].filter(Boolean).join(' / ') || 'No location'}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(customer.tags || []).map((tag: string) => <span key={tag} className="rounded-full border border-[#D7B98E]/30 bg-[#D7B98E]/10 px-3 py-1 text-[10px] font-bold text-[#D7B98E]">{tag}</span>)}
                    </div>
                  </div>
                  <div className="grid min-w-[260px] grid-cols-2 gap-2 text-xs">
                    <div className="rounded-2xl border border-[#2E3442] bg-[#11141A] p-3"><p className="text-[#A7AEBB]">Orders</p><p className="mt-1 text-lg font-bold text-[#F5F1EA]">{customer.total_orders || 0}</p></div>
                    <div className="rounded-2xl border border-[#2E3442] bg-[#11141A] p-3"><p className="text-[#A7AEBB]">Revenue</p><p className="mt-1 text-lg font-bold text-[#D7B98E]">{formatPrice(customer.total_revenue || 0)}</p></div>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 border-t border-[#2E3442] pt-4 text-xs text-[#A7AEBB] sm:grid-cols-3">
                  <p><span className="text-[#F5F1EA]">First source:</span> {customer.first_source || '—'}</p>
                  <p><span className="text-[#F5F1EA]">Last campaign:</span> {customer.last_campaign || '—'}</p>
                  <p><span className="text-[#F5F1EA]">Last order:</span> {customer.last_order_at ? formatTimestamp(new Date(customer.last_order_at)) : '—'}</p>
                </div>
              </article>
            )) : <div className="studio-card p-8 text-center text-sm text-[#A7AEBB]">No customers found yet. Create orders, then refresh profiles.</div>}
          </div>

          <aside className="studio-card h-fit p-5">
            <h2 className="text-base font-semibold text-[#F5F1EA]">Customer drawer</h2>
            {selected ? (
              <div className="mt-4 space-y-4">
                <div><p className="text-sm font-semibold text-[#F5F1EA]">{selected.full_name || 'Unnamed customer'}</p><p className="mt-1 text-xs text-[#A7AEBB]">{selected.phone || selected.email || 'No contact data'}</p></div>
                <div className="flex flex-wrap gap-2">
                  {tagOptions.map((tag) => <button key={tag} onClick={() => updateTags(selected, tag)} className="studio-chip" data-active={(selected.tags || []).includes(tag)}><Tag className="h-3 w-3" />{tag}</button>)}
                </div>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} className="studio-input min-h-28" placeholder="Internal note: asked for size, prefers WhatsApp, needs follow-up..." />
                <button onClick={saveNote} disabled={!note.trim()} className="nexora-button-primary w-full"><Save className="h-4 w-4" />Save note</button>
                {selected.phone && <a href={`https://wa.me/${String(selected.phone).replace(/\D/g, '').replace(/^0/, '20')}`} target="_blank" rel="noreferrer" className="nexora-button flex justify-center"><MessageCircle className="h-4 w-4" />Open WhatsApp</a>}
              </div>
            ) : <p className="mt-4 text-sm leading-7 text-[#A7AEBB]">Select a customer to tag, note, and follow up.</p>}
          </aside>
        </div>
      )}

      {active === 'Segments' && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{tagOptions.map((tag) => <div key={tag} className="studio-card p-5"><h3 className="font-semibold text-[#F5F1EA]">{tag}</h3><p className="mt-2 text-3xl font-semibold text-[#D7B98E]">{customers.filter((c) => (c.tags || []).includes(tag)).length}</p><p className="mt-2 text-xs text-[#A7AEBB]">Customers manually tagged for follow-up and segmentation.</p></div>)}</div>}
      {active === 'Notes' && <div className="studio-card p-8 text-sm leading-7 text-[#A7AEBB]"><Clock className="mb-3 h-5 w-5 text-[#D7B98E]" />Notes are stored per customer in Supabase. Use Profiles → Customer drawer to add notes. A future export can include note history when needed.</div>}
    </div>
  );
}
