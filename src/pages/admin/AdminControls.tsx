/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, CreditCard, Database, PlugZap, RefreshCw, ShieldCheck, Trash2, Truck, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminPageHeader, AdminStatCard, AdminTabBar } from '@/components/admin/AdminPageHeader';
import { clearStudioToken } from '@/lib/supabase/client';
import { DEFAULT_PAYMENT_SETTINGS, normalizePaymentSettings, type PaymentSettings } from '@/lib/payments';

const tabs = ['جاهزية المتجر', 'الدفع', 'الربط', 'الخصوصية', 'استعادة'];

function statusLabel(status?: string) {
  if (status === 'ok') return 'جاهز';
  if (status === 'warn') return 'تنبيه';
  return 'يحتاج إصلاح';
}

function friendlyCheckLabel(label?: string) {
  const raw = String(label || 'فحص النظام');
  const map: Record<string, string> = {
    'Health check function': 'فحص حالة النظام',
    'Supabase URL': 'اتصال قاعدة البيانات',
    'Database tables': 'جداول قاعدة البيانات',
    'Shipping settings': 'إعدادات الشحن',
    'Studio token': 'جلسة لوحة التحكم',
    'Edge Functions': 'دوال التشغيل',
  };
  return map[raw] || raw.replace(/environment|env/gi, 'إعدادات الربط');
}

function CheckRow({ check }: { check: any }) {
  const Icon = check.status === 'ok' ? CheckCircle2 : check.status === 'warn' ? AlertTriangle : XCircle;
  const cls = check.status === 'ok' ? 'text-emerald-600' : check.status === 'warn' ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="rounded-[22px] border border-[#e6ded1] bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <Icon className={`mt-0.5 h-5 w-5 ${cls}`} />
          <div>
            <h3 className="text-sm font-semibold text-[#2b211d]">{friendlyCheckLabel(check.label)}</h3>
            <p className="mt-1 text-xs leading-6 text-[#8a8175]">{String(check.message || '').replace(/environment|env/gi, 'إعدادات الربط')}</p>
            {check.fix && <p className="mt-2 rounded-2xl border border-[#d7b98e]/30 bg-[#fbf7ef] p-3 text-xs leading-6 text-[#8a6c3d]">الإجراء المقترح: {String(check.fix).replace(/environment|env/gi, 'إعدادات الربط')}</p>}
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${check.status === 'ok' ? 'border-emerald-400/40 bg-emerald-50 text-emerald-700' : check.status === 'warn' ? 'border-amber-400/40 bg-amber-50 text-amber-700' : 'border-red-400/40 bg-red-50 text-red-700'}`}>{statusLabel(check.status)}</span>
      </div>
    </div>
  );
}

export default function AdminControls() {
  const [active, setActive] = useState(tabs[0]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [metaPixelId, setMetaPixelId] = useState('');
  const [metaPixelEnabled, setMetaPixelEnabled] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);

  const load = async () => {
    setLoading(true);
    try {
      const { getStudioHealthCheck, getSiteSettings } = await import('@/lib/supabase/db');
      setHealth(await getStudioHealthCheck());
      const settings = await getSiteSettings().catch(() => null);
      setMetaPixelId(settings?.metaPixelId || settings?.paymentSettings?.metaPixelId || '');
      setMetaPixelEnabled(Boolean(settings?.metaPixelEnabled || settings?.paymentSettings?.metaPixelEnabled));
      setPaymentSettings(normalizePaymentSettings(settings?.paymentSettings as Record<string, unknown> | undefined));
    } catch (error) {
      setHealth({ score: 0, failed: 1, warnings: 0, checks: [{ key: 'health', label: 'فحص حالة النظام', status: 'fail', message: error instanceof Error ? error.message : 'تعذر تشغيل فحص الجاهزية.', fix: 'أعد نشر دوال لوحة التحكم ثم سجّل الدخول مرة أخرى.' }] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const summary = useMemo(() => ({
    score: Number(health?.score || 0),
    failed: Number(health?.failed || 0),
    warnings: Number(health?.warnings || 0),
    ok: (health?.checks || []).filter((check: any) => check.status === 'ok').length,
  }), [health]);

  const copyCommand = async (command: string) => {
    await navigator.clipboard.writeText(command);
    toast.success('تم نسخ الأمر');
  };

  const saveMetaPixel = async () => {
    try {
      const { updateSiteSettings } = await import('@/lib/supabase/db');
      await updateSiteSettings({
        metaPixelEnabled,
        metaPixelId: metaPixelId.trim(),
        paymentSettings: { metaPixelEnabled, metaPixelId: metaPixelId.trim() },
      } as any);
      toast.success('تم حفظ إعدادات Meta Pixel');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر حفظ إعدادات Meta Pixel');
    }
  };

  const updatePaymentField = <K extends keyof PaymentSettings>(field: K, value: PaymentSettings[K]) => {
    setPaymentSettings((current) => ({ ...current, [field]: value }));
  };

  const savePaymentSettings = async () => {
    try {
      const { updateSiteSettings } = await import('@/lib/supabase/db');
      await updateSiteSettings({ paymentSettings } as any);
      toast.success('تم حفظ إعدادات الدفع');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر حفظ إعدادات الدفع');
    }
  };

  const clearSession = () => {
    clearStudioToken();
    toast.success('تم مسح جلسة لوحة التحكم. سيتم إعادة التحميل...');
    window.location.reload();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <AdminPageHeader
        title="جاهزية المتجر والتحكم"
        description="مركز مبسط لمراجعة حالة المتجر، طرق الدفع، الربط، الخصوصية، واستعادة الجلسة بدون عرض مفاتيح أو تفاصيل تقنية حساسة."
        actions={<button onClick={load} className="nexora-button flex items-center gap-2" disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> فحص الآن</button>}
      />

      <AdminTabBar tabs={tabs} active={active} onChange={setActive} />

      {active === 'جاهزية المتجر' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <AdminStatCard label="نسبة الجاهزية" value={`${summary.score}%`} helper="تقييم عام لحالة المتجر والطلبات والشحن." tone={summary.failed ? 'danger' : summary.warnings ? 'warn' : 'good'} />
            <AdminStatCard label="جاهز" value={summary.ok} helper="بنود تعمل بشكل صحيح." tone="good" />
            <AdminStatCard label="تنبيهات" value={summary.warnings} helper="ليست مانعة لكن الأفضل مراجعتها." tone={summary.warnings ? 'warn' : 'good'} />
            <AdminStatCard label="مشاكل" value={summary.failed} helper="تحتاج تدخل قبل الاعتماد على التشغيل." tone={summary.failed ? 'danger' : 'good'} />
          </div>
          <div className="studio-card p-5">
            <div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#9a8461]" /><h2 className="text-base font-semibold text-[#2b211d]">فحوصات جاهزية المتجر</h2></div>
            <div className="space-y-3">{(health?.checks || []).map((check: any) => <CheckRow key={check.key} check={check} />)}</div>
          </div>
        </div>
      )}

      {active === 'الدفع' && (
        <div className="space-y-4">
          <div className="studio-card p-5">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2"><CreditCard className="h-5 w-5 text-[#9a8461]" /><h2 className="font-semibold text-[#2b211d]">طرق الدفع</h2></div>
                <p className="text-sm leading-7 text-[#8a8175]">تحكم في طرق الدفع التي تظهر للعميل وتعليمات التحويل اليدوي داخل صفحة الدفع.</p>
              </div>
              <button onClick={savePaymentSettings} className="nexora-button">حفظ إعدادات الدفع</button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {[
                ['codEnabled', 'الدفع عند الاستلام'],
                ['instapayEnabled', 'Instapay'],
                ['vodafoneCashEnabled', 'Vodafone Cash'],
                ['valuEnabled', 'ValU'],
              ].map(([field, label]) => (
                <label key={field} className="flex items-center justify-between rounded-2xl border border-[#e6ded1] bg-white p-3 text-sm text-[#2b211d]">
                  <span>{label}</span>
                  <input type="checkbox" checked={Boolean(paymentSettings[field as keyof PaymentSettings])} onChange={(event) => updatePaymentField(field as keyof PaymentSettings, event.target.checked as never)} />
                </label>
              ))}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="text-xs font-semibold text-[#5f584f]">رقم التحويل<input value={paymentSettings.transferNumber} onChange={(event) => updatePaymentField('transferNumber', event.target.value)} className="studio-input mt-2" dir="ltr" /></label>
              <label className="text-xs font-semibold text-[#5f584f]">رقم تأكيد الدفع<input value={paymentSettings.confirmationPhone} onChange={(event) => updatePaymentField('confirmationPhone', event.target.value)} className="studio-input mt-2" dir="ltr" /></label>
              <label className="text-xs font-semibold text-[#5f584f]">رقم واتساب التأكيد<input value={paymentSettings.whatsappConfirmationNumber} onChange={(event) => updatePaymentField('whatsappConfirmationNumber', event.target.value)} className="studio-input mt-2" dir="ltr" /></label>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="flex items-center gap-2 rounded-2xl border border-[#e6ded1] bg-white p-3 text-xs text-[#5f584f]"><input type="checkbox" checked={paymentSettings.codFeeEnabled} onChange={(event) => updatePaymentField('codFeeEnabled', event.target.checked)} /> إضافة رسوم COD فقط لطلبات الدفع عند الاستلام</label>
              <label className="flex items-center gap-2 rounded-2xl border border-[#e6ded1] bg-white p-3 text-xs text-[#5f584f]"><input type="checkbox" checked={paymentSettings.requireScreenshotInstapay} onChange={(event) => updatePaymentField('requireScreenshotInstapay', event.target.checked)} /> Instapay يحتاج Screenshot</label>
              <label className="flex items-center gap-2 rounded-2xl border border-[#e6ded1] bg-white p-3 text-xs text-[#5f584f]"><input type="checkbox" checked={paymentSettings.requireScreenshotVodafone} onChange={(event) => updatePaymentField('requireScreenshotVodafone', event.target.checked)} /> Vodafone Cash يحتاج Screenshot</label>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="studio-card p-5 text-xs font-semibold text-[#5f584f]">تعليمات الدفع عند الاستلام<textarea value={paymentSettings.codInstructionsAr} onChange={(event) => updatePaymentField('codInstructionsAr', event.target.value)} className="studio-input mt-2 min-h-28" /></label>
            <label className="studio-card p-5 text-xs font-semibold text-[#5f584f]">تعليمات Instapay<textarea value={paymentSettings.instapayInstructionsAr} onChange={(event) => updatePaymentField('instapayInstructionsAr', event.target.value)} className="studio-input mt-2 min-h-28" /></label>
            <label className="studio-card p-5 text-xs font-semibold text-[#5f584f]">تعليمات Vodafone Cash<textarea value={paymentSettings.vodafoneInstructionsAr} onChange={(event) => updatePaymentField('vodafoneInstructionsAr', event.target.value)} className="studio-input mt-2 min-h-28" /></label>
            <label className="studio-card p-5 text-xs font-semibold text-[#5f584f]">تعليمات ValU<textarea value={paymentSettings.valuInstructionsAr} onChange={(event) => updatePaymentField('valuInstructionsAr', event.target.value)} className="studio-input mt-2 min-h-28" /></label>
          </div>
        </div>
      )}

      {active === 'الربط' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="studio-card p-5">
            <div className="mb-3 flex items-center gap-2"><Truck className="h-5 w-5 text-[#9a8461]" /><h2 className="font-semibold text-[#2b211d]">ShipBlu</h2></div>
            <p className="text-sm leading-7 text-[#8a8175]">يتم إنشاء الشحنات فقط بعد تفعيل الربط وإضافة المناطق المناسبة. لا تظهر هنا أي مفاتيح سرية.</p>
            <button onClick={() => copyCommand('supabase functions deploy')} className="nexora-button mt-4 flex items-center gap-2"><Copy className="h-4 w-4" /> نسخ أمر نشر الدوال</button>
          </div>
          <div className="studio-card p-5">
            <div className="mb-3 flex items-center gap-2"><PlugZap className="h-5 w-5 text-[#9a8461]" /><h2 className="font-semibold text-[#2b211d]">Meta Pixel</h2></div>
            <p className="text-sm leading-7 text-[#8a8175]">فعّل التتبع فقط بعد مراجعة سياسة الخصوصية وتجهيز الحملات الإعلانية.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
              <input value={metaPixelId} onChange={(event) => setMetaPixelId(event.target.value)} placeholder="Meta Pixel ID" className="studio-input" dir="ltr" />
              <label className="flex items-center gap-2 text-sm text-[#2b211d]"><input type="checkbox" checked={metaPixelEnabled} onChange={(event) => setMetaPixelEnabled(event.target.checked)} /> مفعل</label>
              <button onClick={saveMetaPixel} className="nexora-button">حفظ Pixel</button>
            </div>
          </div>
        </div>
      )}

      {active === 'الخصوصية' && (
        <div className="studio-card p-5">
          <h2 className="font-semibold text-[#2b211d]">الخصوصية والتتبع</h2>
          <p className="mt-2 text-sm leading-7 text-[#8a8175]">حافظ على شفافية التتبع ولا تفعّل أي أدوات إعلانية إلا بعد تجهيز نصوص الخصوصية المناسبة.</p>
        </div>
      )}

      {active === 'استعادة' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="studio-card p-5">
            <div className="mb-3 flex items-center gap-2"><Trash2 className="h-5 w-5 text-amber-600" /><h2 className="font-semibold text-[#2b211d]">مسح جلسة لوحة التحكم</h2></div>
            <p className="text-sm leading-7 text-[#8a8175]">استخدم هذا الإجراء لو انتهت الجلسة أو ظهرت مشكلة بعد إعادة النشر.</p>
            <button onClick={clearSession} className="nexora-button mt-4">مسح الجلسة وإعادة التحميل</button>
          </div>
          <div className="studio-card p-5">
            <div className="mb-3 flex items-center gap-2"><Database className="h-5 w-5 text-[#9a8461]" /><h2 className="font-semibold text-[#2b211d]">استعادة قاعدة البيانات</h2></div>
            <p className="text-sm leading-7 text-[#8a8175]">إذا أظهر الفحص نقصًا في الجداول أو الدوال، ادفع التحديثات مرة أخرى من جهاز التطوير.</p>
            <button onClick={() => copyCommand('supabase db push')} className="nexora-button mt-4 flex items-center gap-2"><Copy className="h-4 w-4" /> نسخ أمر تحديث القاعدة</button>
          </div>
        </div>
      )}
    </div>
  );
}
