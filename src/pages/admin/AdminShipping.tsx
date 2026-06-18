/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, HelpCircle, Plus, RefreshCw, Save, Ship, Trash2, Truck, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatPrice } from '@/lib/utils';

function Field({ label, help, example, children }: { label: string; help: string; example?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#D2B48C]">{label}</span><span className="mb-2 block text-xs leading-5 text-[#BCAEA0]">{help}{example ? <><br /><b className="text-[#FFF0E1]">Example:</b> {example}</> : null}</span>{children}</label>;
}

function Card({ title, value, helper, icon: Icon }: { title: string; value: string; helper: string; icon: React.ElementType }) {
  return <div className="studio-card p-5"><div className="mb-3 flex items-center justify-between"><Icon className="h-5 w-5 text-[#D2B48C]" /><span className="text-[10px] uppercase tracking-[0.18em] text-[#BCAEA0]">{title}</span></div><p className="text-2xl font-bold text-[#FFF0E1]">{value}</p><p className="mt-2 text-xs leading-6 text-[#BCAEA0]">{helper}</p></div>;
}

const emptyZone = { governorate: '', city: '*', shippingFee: 80, codFee: 0, deliveryEstimate: '2-5 business days', enabled: true, remoteArea: false, shipbluGovernorateId: '', shipbluCityId: '', shipbluZoneId: '', notes: '' };

export default function AdminShipping() {
  const [settings, setSettings] = useState<any>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [providerConnected, setProviderConnected] = useState(false);
  const [zoneForm, setZoneForm] = useState<any>(emptyZone);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const { getShippingAdmin } = await import('@/lib/supabase/db');
      const data = await getShippingAdmin();
      setSettings(data.settings);
      setZones(data.zones || []);
      setShipments(data.shipments || []);
      setProviderConnected(Boolean(data.providerConnected));
    } finally { setIsLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const enabledZones = zones.filter((z) => z.enabled).length;
  const avgFee = useMemo(() => zones.length ? zones.reduce((s, z) => s + Number(z.shippingFee || 0), 0) / zones.length : 0, [zones]);

  const saveSettings = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      const { saveShippingSettings } = await import('@/lib/supabase/db');
      setSettings(await saveShippingSettings(settings));
      toast.success('Shipping settings saved. Checkout will use these rules immediately.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save settings.'); }
    finally { setIsSaving(false); }
  };

  const saveZone = async () => {
    if (!zoneForm.governorate.trim()) { toast.error('Governorate is required.'); return; }
    try {
      const { upsertShippingZone } = await import('@/lib/supabase/db');
      await upsertShippingZone(zoneForm);
      toast.success('Shipping zone saved.');
      setZoneForm(emptyZone);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save zone.'); }
  };

  const removeZone = async (id: string) => {
    if (!window.confirm('Delete this shipping zone? Checkout may fall back to the default rate.')) return;
    const { deleteShippingZone } = await import('@/lib/supabase/db');
    await deleteShippingZone(id);
    toast.success('Shipping zone deleted.');
    await load();
  };

  const testProvider = async () => {
    try {
      const { testShippingProvider } = await import('@/lib/supabase/db');
      const result = await testShippingProvider();
      if (result.ok) toast.success(`ShipBlu connected successfully (${result.status}).`);
      else toast.error(result.error || `ShipBlu test failed (${result.status || 'no status'}).`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not test provider.'); }
  };

  if (isLoading && !settings) return <div className="studio-card p-6 text-sm text-[#BCAEA0]">Loading shipping controls...</div>;

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#FFF0E1]">Shipping Control</h1>
        <p className="mt-1 text-sm leading-6 text-[#BCAEA0]">Control delivery prices, COD fees, free-shipping rules, ShipBlu connection, and shipment creation. Nothing here is fake: provider actions stay disabled until a real API key and zone IDs exist.</p>
      </div>
      <button onClick={load} className="nexora-button"><RefreshCw className="h-4 w-4" />Refresh</button>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card title="Shipping" value={settings?.shippingEnabled ? 'Enabled' : 'Disabled'} helper="If disabled, checkout will not allow delivery orders." icon={Truck} />
      <Card title="Default Fee" value={formatPrice(settings?.defaultShippingFee || 0)} helper="Used when no city-specific rule matches." icon={Ship} />
      <Card title="Zones" value={`${enabledZones}/${zones.length}`} helper="Enabled delivery areas in checkout." icon={CheckCircle2} />
      <Card title="ShipBlu" value={providerConnected && settings?.providerEnabled ? 'Ready' : 'Not connected'} helper="Requires SHIPBLU_API_KEY secret + enabled provider + zone ids." icon={providerConnected ? CheckCircle2 : XCircle} />
    </div>

    <div className="studio-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#FFF0E1]"><HelpCircle className="h-4 w-4 text-[#D2B48C]" />How shipping works</h2>
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ['1. Checkout asks for city', 'NEXORA calculates delivery using exact city, then governorate fallback, then default fallback.'],
          ['2. You control free shipping', 'Free shipping is OFF unless you enable it here. No automatic free delivery happens by default.'],
          ['3. ShipBlu is real integration', 'Create Shipment calls ShipBlu only when the API key and ShipBlu zone id exist.'],
          ['4. Orders keep shipping data', 'Order details show delivery fee, COD fee, provider status, tracking number, and shipment state.'],
        ].map(([title, body]) => <div key={title} className="rounded-2xl border border-[#332923] bg-[#17110F] p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#D2B48C]">{title}</p><p className="mt-2 text-xs leading-6 text-[#BCAEA0]">{body}</p></div>)}
      </div>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <div className="studio-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-[#FFF0E1]">General delivery settings</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Shipping enabled" help="Turn delivery on/off for the entire checkout.">
            <select className="studio-input" value={String(settings?.shippingEnabled)} onChange={(e) => setSettings({ ...settings, shippingEnabled: e.target.value === 'true' })}><option value="true">Enabled</option><option value="false">Disabled</option></select>
          </Field>
          <Field label="Default shipping fee" help="Fallback price when no area rule matches." example="120">
            <input className="studio-input" type="number" min="0" value={settings?.defaultShippingFee || 0} onChange={(e) => setSettings({ ...settings, defaultShippingFee: Number(e.target.value) })} />
          </Field>
          <Field label="COD fee" help="Extra cash-on-delivery fee. Leave 0 if included in shipping." example="0 or 15">
            <input className="studio-input" type="number" min="0" value={settings?.codFee || 0} onChange={(e) => setSettings({ ...settings, codFee: Number(e.target.value) })} />
          </Field>
          <Field label="Delivery estimate" help="Shown in checkout when no zone-specific estimate exists." example="2-5 business days">
            <input className="studio-input" value={settings?.fallbackDeliveryEstimate || ''} onChange={(e) => setSettings({ ...settings, fallbackDeliveryEstimate: e.target.value })} />
          </Field>
          <Field label="Free shipping" help="OFF means no free delivery regardless of order value.">
            <select className="studio-input" value={String(settings?.freeShippingEnabled)} onChange={(e) => setSettings({ ...settings, freeShippingEnabled: e.target.value === 'true' })}><option value="false">Disabled</option><option value="true">Enabled</option></select>
          </Field>
          <Field label="Free threshold" help="Only applies when Free Shipping is enabled." example="2500">
            <input className="studio-input" type="number" min="0" value={settings?.freeShippingThreshold || 0} onChange={(e) => setSettings({ ...settings, freeShippingThreshold: Number(e.target.value) })} />
          </Field>
          <Field label="Show free shipping message" help="Controls the storefront message like Add EGP more. OFF keeps checkout clean.">
            <select className="studio-input" value={String(settings?.showFreeShippingProgress || false)} onChange={(e) => setSettings({ ...settings, showFreeShippingProgress: e.target.value === 'true' })}><option value="false">Hidden</option><option value="true">Visible</option></select>
          </Field>
          <Field label="Progress message" help="Use {amount} where the remaining value should appear." example="Add {amount} more for free shipping.">
            <input className="studio-input" value={settings?.freeShippingProgressMessage || ''} onChange={(e) => setSettings({ ...settings, freeShippingProgressMessage: e.target.value })} />
          </Field>
        </div>
        <button onClick={saveSettings} disabled={isSaving} className="nexora-button-primary mt-5"><Save className="h-4 w-4" />{isSaving ? 'Saving...' : 'Save settings'}</button>
      </div>

      <div className="studio-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-[#FFF0E1]">ShipBlu provider</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provider enabled" help="Allows Studio to create ShipBlu shipments from confirmed orders.">
            <select className="studio-input" value={String(settings?.providerEnabled)} onChange={(e) => setSettings({ ...settings, providerEnabled: e.target.value === 'true' })}><option value="false">Disabled</option><option value="true">Enabled</option></select>
          </Field>
          <Field label="Environment" help="Use staging if ShipBlu gives you sandbox access; production for live pickup.">
            <select className="studio-input" value={settings?.providerEnvironment || 'production'} onChange={(e) => setSettings({ ...settings, providerEnvironment: e.target.value })}><option value="production">Production</option><option value="staging">Staging</option></select>
          </Field>
          <Field label="Default package size" help="ShipBlu requires package_size. Keep 1 unless ShipBlu tells you otherwise." example="1">
            <input className="studio-input" type="number" min="1" value={settings?.defaultPackageSize || 1} onChange={(e) => setSettings({ ...settings, defaultPackageSize: Number(e.target.value) })} />
          </Field>
          <Field label="Auto create shipments" help="Keep disabled until you trust the flow. Manual Create Shipment remains available in Orders.">
            <select className="studio-input" value={String(settings?.autoCreateShipments)} onChange={(e) => setSettings({ ...settings, autoCreateShipments: e.target.value === 'true' })}><option value="false">Manual only</option><option value="true">Auto after order</option></select>
          </Field>
        </div>
        <div className="mt-4 rounded-2xl border border-[#332923] bg-[#0E0B0A] p-4 text-xs leading-6 text-[#BCAEA0]">
          Set the real API key in Supabase secrets: <code className="text-[#D2B48C]">SHIPBLU_API_KEY</code>. The key is never stored in the frontend.
        </div>
        <div className="mt-4 flex flex-wrap gap-2"><button onClick={saveSettings} className="nexora-button"><Save className="h-4 w-4" />Save provider</button><button onClick={testProvider} className="nexora-button-primary"><Ship className="h-4 w-4" />Test ShipBlu</button></div>
      </div>
    </div>

    <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
      <div className="studio-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-[#FFF0E1]">Add / edit delivery area</h2>
        <div className="space-y-4">
          <Field label="Governorate" help="Use the same governorate name customers select in checkout." example="Cairo"><input className="studio-input" value={zoneForm.governorate} onChange={(e) => setZoneForm({ ...zoneForm, governorate: e.target.value })} /></Field>
          <Field label="City" help="Use * to apply to every city in the governorate." example="Nasr City or *"><input className="studio-input" value={zoneForm.city} onChange={(e) => setZoneForm({ ...zoneForm, city: e.target.value })} /></Field>
          <Field label="Shipping fee" help="Delivery price for this area." example="90"><input className="studio-input" type="number" min="0" value={zoneForm.shippingFee} onChange={(e) => setZoneForm({ ...zoneForm, shippingFee: Number(e.target.value) })} /></Field>
          <Field label="COD fee" help="Extra cash collection fee for this area, if any." example="0"><input className="studio-input" type="number" min="0" value={zoneForm.codFee} onChange={(e) => setZoneForm({ ...zoneForm, codFee: Number(e.target.value) })} /></Field>
          <Field label="ShipBlu Zone ID" help="Required for real Create Shipment. Get it from ShipBlu cities/zones API or support." example="123"><input className="studio-input" value={zoneForm.shipbluZoneId} onChange={(e) => setZoneForm({ ...zoneForm, shipbluZoneId: e.target.value })} /></Field>
          <Field label="Estimate" help="Shown to customers in checkout." example="2-4 business days"><input className="studio-input" value={zoneForm.deliveryEstimate} onChange={(e) => setZoneForm({ ...zoneForm, deliveryEstimate: e.target.value })} /></Field>
          <Field label="Enabled" help="Disabled areas will not match during checkout."><select className="studio-input" value={String(zoneForm.enabled)} onChange={(e) => setZoneForm({ ...zoneForm, enabled: e.target.value === 'true' })}><option value="true">Enabled</option><option value="false">Disabled</option></select></Field>
          <button onClick={saveZone} className="nexora-button-primary w-full"><Plus className="h-4 w-4" />Save area</button>
        </div>
      </div>

      <div className="studio-card overflow-hidden">
        <div className="border-b border-[#332923] p-5"><h2 className="text-sm font-semibold text-[#FFF0E1]">Delivery price rules</h2><p className="mt-1 text-xs text-[#BCAEA0]">Average fee: {formatPrice(avgFee)}. Exact city rules win over governorate wildcard rules.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead className="bg-[#17110F]"><tr>{['Area','Fee','COD','Estimate','ShipBlu zone','Status','Actions'].map((h) => <th key={h} className="p-4 text-[10px] uppercase tracking-[0.18em] text-[#BCAEA0]">{h}</th>)}</tr></thead><tbody>{zones.length ? zones.map((z) => <tr key={z.id} className="border-t border-[#332923]/70"><td className="p-4 text-xs text-[#FFF0E1]">{z.governorate}<br /><span className="text-[#BCAEA0]">{z.city || '*'}</span></td><td className="p-4 text-xs text-[#D2B48C]">{formatPrice(z.shippingFee)}</td><td className="p-4 text-xs text-[#BCAEA0]">{formatPrice(z.codFee)}</td><td className="p-4 text-xs text-[#BCAEA0]">{z.deliveryEstimate}</td><td className="p-4 text-xs text-[#BCAEA0]">{z.shipbluZoneId || '—'}</td><td className="p-4 text-xs"><span className={`rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.15em] ${z.enabled ? 'border-emerald-400/30 text-emerald-300' : 'border-red-400/30 text-red-300'}`}>{z.enabled ? 'enabled' : 'disabled'}</span></td><td className="p-4"><div className="flex gap-2"><button onClick={() => setZoneForm(z)} className="text-xs text-[#D2B48C]">Edit</button><button onClick={() => removeZone(z.id)} className="text-red-300"><Trash2 className="h-4 w-4" /></button></div></td></tr>) : <tr><td colSpan={7} className="p-8 text-center text-sm text-[#BCAEA0]">No shipping zones yet.</td></tr>}</tbody></table></div>
      </div>
    </div>

    <div className="studio-card p-5">
      <h2 className="mb-4 text-sm font-semibold text-[#FFF0E1]">Recent shipments</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shipments.length ? shipments.map((s) => <div key={s.id} className="rounded-2xl border border-[#332923] bg-[#17110F] p-4"><p className="text-xs font-semibold text-[#FFF0E1]">{s.trackingNumber || s.providerOrderId || s.id}</p><p className="mt-1 text-xs text-[#BCAEA0]">{s.provider} · {s.status}</p><p className="mt-1 text-xs text-[#D2B48C]">COD {formatPrice(s.codAmount || 0)}</p></div>) : <p className="text-sm text-[#BCAEA0]">No shipments created yet. Create them from Orders after connecting ShipBlu.</p>}
      </div>
    </div>
  </div>;
}
