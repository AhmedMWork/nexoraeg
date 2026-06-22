/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Plus, RefreshCw, Save, Ship, Trash2, Truck, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatPrice } from '@/lib/utils';

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-[#2b211d]">{label}</span>
      {help && <span className="mb-2 block text-[11px] leading-5 text-[#8a8175]">{help}</span>}
      {children}
    </label>
  );
}

function SummaryCard({ title, value, helper, icon: Icon, tone = 'neutral' }: { title: string; value: string; helper: string; icon: React.ElementType; tone?: 'neutral' | 'good' | 'warn' }) {
  const toneClass = tone === 'good' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : tone === 'warn' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-[#9a8461] bg-[#fbf7ef] border-[#e6ded1]';
  return (
    <div className="rounded-[26px] border border-[#e6ded1] bg-white p-5 shadow-[0_14px_38px_rgba(43,33,29,0.05)]">
      <div className="mb-3 flex items-center justify-between">
        <span className={`grid h-10 w-10 place-items-center rounded-2xl border ${toneClass}`}><Icon className="h-5 w-5" /></span>
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9a8461]">{title}</span>
      </div>
      <p className="text-2xl font-black text-[#2b211d]">{value}</p>
      <p className="mt-2 text-xs leading-6 text-[#8a8175]">{helper}</p>
    </div>
  );
}

const emptyZone = { governorate: '', city: '*', shippingFee: 80, codFee: 0, deliveryEstimate: '4-7 أيام عمل', enabled: true, remoteArea: false, shipbluGovernorateId: '', shipbluCityId: '', shipbluZoneId: '', notes: '' };

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
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const enabledZones = zones.filter((zone) => zone.enabled).length;
  const avgFee = useMemo(() => zones.length ? zones.reduce((sum, zone) => sum + Number(zone.shippingFee || 0), 0) / zones.length : 0, [zones]);

  const saveSettings = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      const { saveShippingSettings } = await import('@/lib/supabase/db');
      setSettings(await saveShippingSettings(settings));
      toast.success('تم حفظ إعدادات الشحن. صفحة الدفع ستستخدم القواعد الجديدة فورًا.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر حفظ إعدادات الشحن.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveZone = async () => {
    if (!zoneForm.governorate.trim()) {
      toast.error('اكتب اسم المحافظة أولًا.');
      return;
    }
    try {
      const { upsertShippingZone } = await import('@/lib/supabase/db');
      await upsertShippingZone(zoneForm);
      toast.success('تم حفظ منطقة الشحن.');
      setZoneForm(emptyZone);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر حفظ منطقة الشحن.');
    }
  };

  const removeZone = async (id: string) => {
    if (!window.confirm('هل تريد حذف منطقة الشحن؟')) return;
    const { deleteShippingZone } = await import('@/lib/supabase/db');
    await deleteShippingZone(id);
    toast.success('تم حذف منطقة الشحن.');
    await load();
  };

  const testProvider = async () => {
    try {
      const { testShippingProvider } = await import('@/lib/supabase/db');
      const result = await testShippingProvider();
      if (result.ok) toast.success(`تم الاتصال بـ ShipBlu بنجاح (${result.status}).`);
      else toast.error(result.error || `فشل اختبار ShipBlu (${result.status || 'بدون حالة'}).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر اختبار شركة الشحن.');
    }
  };

  if (isLoading && !settings) return <div className="studio-card p-6 text-sm text-[#8a8175]">جاري تحميل إعدادات الشحن...</div>;

  return (
    <div className="space-y-6 text-[#2b211d]" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a8461]">NEXORA SHIPPING</p>
          <h1 className="mt-2 text-2xl font-black text-[#2b211d]">إدارة الشحن</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[#8a8175]">صفحة مبسطة للتحكم في تكلفة الشحن، رسوم الدفع عند الاستلام، الشحن المجاني، والمناطق المتاحة داخل صفحة الدفع.</p>
        </div>
        <button onClick={load} className="nexora-button"><RefreshCw className="h-4 w-4" />تحديث</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="حالة الشحن" value={settings?.shippingEnabled ? 'مفعل' : 'متوقف'} helper="عند الإيقاف لن يستطيع العميل إتمام طلب توصيل." icon={Truck} tone={settings?.shippingEnabled ? 'good' : 'warn'} />
        <SummaryCard title="متوسط التكلفة" value={formatPrice(avgFee || settings?.defaultShippingFee || 0)} helper="متوسط أسعار المناطق أو السعر الافتراضي." icon={Ship} />
        <SummaryCard title="المناطق" value={`${enabledZones}/${zones.length}`} helper="عدد المناطق المفعلة من إجمالي مناطق الشحن." icon={CheckCircle2} tone={enabledZones ? 'good' : 'warn'} />
        <SummaryCard title="ShipBlu" value={providerConnected && settings?.providerEnabled ? 'جاهز' : 'يدوي'} helper="يمكنك إنشاء الشحنات يدويًا أو تفعيل الربط لاحقًا." icon={providerConnected ? CheckCircle2 : XCircle} tone={providerConnected && settings?.providerEnabled ? 'good' : 'neutral'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[28px] border border-[#e6ded1] bg-white p-5 shadow-[0_18px_50px_rgba(43,33,29,0.06)]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#2b211d]">إعدادات عامة</h2>
              <p className="mt-1 text-xs leading-6 text-[#8a8175]">هذه القيم تطبق عندما لا توجد قاعدة مخصصة للمدينة.</p>
            </div>
            <button onClick={saveSettings} disabled={isSaving} className="nexora-button-primary"><Save className="h-4 w-4" />{isSaving ? 'جاري الحفظ...' : 'حفظ'}</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="تشغيل الشحن"><select className="studio-input" value={String(settings?.shippingEnabled)} onChange={(event) => setSettings({ ...settings, shippingEnabled: event.target.value === 'true' })}><option value="true">مفعل</option><option value="false">متوقف</option></select></Field>
            <Field label="تكلفة الشحن الافتراضية"><input className="studio-input" type="number" min="0" value={settings?.defaultShippingFee || 0} onChange={(event) => setSettings({ ...settings, defaultShippingFee: Number(event.target.value) })} /></Field>
            <Field label="رسوم الدفع عند الاستلام" help="تظهر فقط مع طلبات COD."><input className="studio-input" type="number" min="0" value={settings?.codFee || 0} onChange={(event) => setSettings({ ...settings, codFee: Number(event.target.value) })} /></Field>
            <Field label="مدة التوصيل الافتراضية"><input className="studio-input" value={settings?.fallbackDeliveryEstimate || ''} onChange={(event) => setSettings({ ...settings, fallbackDeliveryEstimate: event.target.value })} /></Field>
            <Field label="الشحن المجاني"><select className="studio-input" value={String(settings?.freeShippingEnabled)} onChange={(event) => setSettings({ ...settings, freeShippingEnabled: event.target.value === 'true' })}><option value="false">متوقف</option><option value="true">مفعل</option></select></Field>
            <Field label="حد الشحن المجاني"><input className="studio-input" type="number" min="0" value={settings?.freeShippingThreshold || 0} onChange={(event) => setSettings({ ...settings, freeShippingThreshold: Number(event.target.value) })} /></Field>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#e6ded1] bg-white p-5 shadow-[0_18px_50px_rgba(43,33,29,0.06)]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#2b211d]">إضافة أو تعديل منطقة</h2>
              <p className="mt-1 text-xs leading-6 text-[#8a8175]">استخدم * في المدينة لتطبيق القاعدة على محافظة كاملة.</p>
            </div>
            <button onClick={saveZone} className="nexora-button-primary"><Plus className="h-4 w-4" />حفظ المنطقة</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="المحافظة"><input className="studio-input" value={zoneForm.governorate} onChange={(event) => setZoneForm({ ...zoneForm, governorate: event.target.value })} /></Field>
            <Field label="المدينة / المنطقة"><input className="studio-input" value={zoneForm.city} onChange={(event) => setZoneForm({ ...zoneForm, city: event.target.value })} /></Field>
            <Field label="تكلفة الشحن"><input className="studio-input" type="number" min="0" value={zoneForm.shippingFee} onChange={(event) => setZoneForm({ ...zoneForm, shippingFee: Number(event.target.value) })} /></Field>
            <Field label="رسوم COD"><input className="studio-input" type="number" min="0" value={zoneForm.codFee} onChange={(event) => setZoneForm({ ...zoneForm, codFee: Number(event.target.value) })} /></Field>
            <Field label="مدة التوصيل"><input className="studio-input" value={zoneForm.deliveryEstimate} onChange={(event) => setZoneForm({ ...zoneForm, deliveryEstimate: event.target.value })} /></Field>
            <Field label="الحالة"><select className="studio-input" value={String(zoneForm.enabled)} onChange={(event) => setZoneForm({ ...zoneForm, enabled: event.target.value === 'true' })}><option value="true">مفعلة</option><option value="false">متوقفة</option></select></Field>
            <Field label="ShipBlu Zone ID" help="اختياري، يستخدم فقط عند إنشاء شحنة من ShipBlu."><input className="studio-input" value={zoneForm.shipbluZoneId} onChange={(event) => setZoneForm({ ...zoneForm, shipbluZoneId: event.target.value })} dir="ltr" /></Field>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-[28px] border border-[#e6ded1] bg-white shadow-[0_18px_50px_rgba(43,33,29,0.06)]">
        <div className="flex flex-col gap-3 border-b border-[#efe8dc] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-[#2b211d]">مناطق الشحن</h2>
            <p className="mt-1 text-xs text-[#8a8175]">المدينة المحددة لها أولوية، ثم قاعدة المحافظة بعلامة *، ثم السعر الافتراضي.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={saveSettings} className="nexora-button"><Save className="h-4 w-4" />حفظ الإعدادات</button>
            <button onClick={testProvider} className="nexora-button"><Ship className="h-4 w-4" />اختبار ShipBlu</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-right">
            <thead className="bg-[#faf7f1]">
              <tr>{['المحافظة', 'المدينة', 'تكلفة الشحن', 'رسوم COD', 'المدة', 'الحالة', 'إجراءات'].map((heading) => <th key={heading} className="p-4 text-[10px] font-black uppercase tracking-[0.18em] text-[#9a8461]">{heading}</th>)}</tr>
            </thead>
            <tbody>
              {zones.length ? zones.map((zone) => (
                <tr key={zone.id} className="border-t border-[#efe8dc]/80 hover:bg-[#faf7f1]">
                  <td className="p-4 text-xs font-bold text-[#2b211d]">{zone.governorate}</td>
                  <td className="p-4 text-xs text-[#5f584f]">{zone.city || '*'}</td>
                  <td className="p-4 text-xs font-bold text-[#b99a62]">{formatPrice(zone.shippingFee)}</td>
                  <td className="p-4 text-xs text-[#5f584f]">{formatPrice(zone.codFee)}</td>
                  <td className="p-4 text-xs text-[#5f584f]">{zone.deliveryEstimate || '—'}</td>
                  <td className="p-4 text-xs"><span className={`rounded-full border px-2 py-1 text-[9px] font-bold ${zone.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{zone.enabled ? 'مفعلة' : 'متوقفة'}</span></td>
                  <td className="p-4"><div className="flex gap-2"><button onClick={() => setZoneForm(zone)} className="text-xs font-bold text-[#b99a62]">تعديل</button><button onClick={() => removeZone(zone.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></button></div></td>
                </tr>
              )) : <tr><td colSpan={7} className="p-8 text-center text-sm text-[#8a8175]">لا توجد مناطق شحن حتى الآن.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#e6ded1] bg-white p-5 shadow-[0_18px_50px_rgba(43,33,29,0.06)]">
        <h2 className="mb-4 text-base font-bold text-[#2b211d]">آخر الشحنات</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shipments.length ? shipments.map((shipment) => <div key={shipment.id} className="rounded-2xl border border-[#efe8dc] bg-[#faf7f1] p-4"><p className="text-xs font-semibold text-[#2b211d]">{shipment.trackingNumber || shipment.providerOrderId || shipment.id}</p><p className="mt-1 text-xs text-[#8a8175]">{shipment.provider} · {shipment.status}</p><p className="mt-1 text-xs font-bold text-[#b99a62]">COD {formatPrice(shipment.codAmount || 0)}</p></div>) : <p className="text-sm text-[#8a8175]">لا توجد شحنات حتى الآن. يتم إنشاء الشحنة من صفحة الطلبات بعد تأكيد الطلب.</p>}
        </div>
      </section>
    </div>
  );
}
