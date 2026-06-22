// ============================================================
// NEXORA — Admin Settings Page
// Light HQ polish + dedicated payment settings.
// ============================================================

import { useEffect, useState, type ReactNode } from 'react';
import { BadgeCheck, CreditCard, Palette, Save, Settings, Smartphone, Truck } from 'lucide-react';
import { SHIPPING_FEE, FREE_SHIPPING_THRESHOLD } from '@/lib/constants';
import toast from 'react-hot-toast';

interface StoreSettings {
  storeName: string;
  currency: string;
  shippingFee: number;
  freeShippingThreshold: number;
  whatsappNumber: string;
  instagram: string;
  facebook: string;
  paymentConfirmationPhone: string;
  instapayEnabled: boolean;
  vodafoneCashEnabled: boolean;
  valuEnabled: boolean;
  paymentInstructions: string;
  instapayInstructions: string;
  vodafoneCashInstructions: string;
  valuInstructions: string;
  primaryColor: string;
  accentColor: string;
}

const initialSettings: StoreSettings = {
  storeName: 'NEXORA',
  currency: 'EGP',
  shippingFee: SHIPPING_FEE,
  freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
  whatsappNumber: '01037141322',
  instagram: 'https://www.instagram.com/nexora.eg_wear?igsh=Zm9zN2ZjZ3Q3Zmlw&utm_source=qr',
  facebook: 'https://www.facebook.com/share/18k2uTBtYu/?mibextid=wwXIfr',
  paymentConfirmationPhone: '01037141322',
  instapayEnabled: true,
  vodafoneCashEnabled: true,
  valuEnabled: true,
  paymentInstructions: 'Manual transfer orders require WhatsApp confirmation. Instapay and Vodafone Cash require a clear screenshot before preparation.',
  instapayInstructions: 'Transfer the order total to NEXORA, then send the screenshot on WhatsApp with the order number.',
  vodafoneCashInstructions: 'Transfer via Vodafone Cash, then send a clear screenshot showing transaction number and amount.',
  valuInstructions: 'ValU installment requests are confirmed manually on WhatsApp before order preparation.',
  primaryColor: '#050505',
  accentColor: '#c8a96a',
};

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-[#9a8461]">{children}</span>;
}

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="max-w-4xl rounded-[30px] border border-[#e6ded1] bg-white/95 p-6 shadow-[0_18px_50px_rgba(43,33,29,0.06)]">
      <div className="mb-6">
        <h2 className="text-base font-black text-[#2b211d]">{title}</h2>
        <p className="mt-1 text-xs leading-6 text-[#8a8175]">{description}</p>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<StoreSettings>(initialSettings);
  const [activeTab, setActiveTab] = useState<'general' | 'payments' | 'shipping' | 'appearance'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      try {
        const { getSiteSettings } = await import('@/lib/supabase/db');
        const currentSettings = await getSiteSettings();
        if (!mounted || !currentSettings) return;
        setSettings({
          storeName: currentSettings.storeName || initialSettings.storeName,
          currency: currentSettings.currency || initialSettings.currency,
          shippingFee: currentSettings.shippingFee ?? initialSettings.shippingFee,
          freeShippingThreshold: currentSettings.freeShippingThreshold ?? initialSettings.freeShippingThreshold,
          whatsappNumber: currentSettings.whatsappNumber || currentSettings.paymentSettings?.confirmationPhone || initialSettings.whatsappNumber,
          instagram: currentSettings.socialLinks?.instagram || initialSettings.instagram,
          facebook: currentSettings.socialLinks?.facebook || initialSettings.facebook,
          paymentConfirmationPhone: currentSettings.paymentSettings?.confirmationPhone || currentSettings.paymentSettings?.instapayContact || initialSettings.paymentConfirmationPhone,
          instapayEnabled: currentSettings.paymentSettings?.instapayEnabled ?? true,
          vodafoneCashEnabled: currentSettings.paymentSettings?.vodafoneCashEnabled ?? true,
          valuEnabled: currentSettings.paymentSettings?.valuEnabled ?? true,
          paymentInstructions: currentSettings.paymentSettings?.instructions || initialSettings.paymentInstructions,
          instapayInstructions: currentSettings.paymentSettings?.instapayInstructions || initialSettings.instapayInstructions,
          vodafoneCashInstructions: currentSettings.paymentSettings?.vodafoneCashInstructions || initialSettings.vodafoneCashInstructions,
          valuInstructions: currentSettings.paymentSettings?.valuInstructions || initialSettings.valuInstructions,
          primaryColor: currentSettings.primaryColor || initialSettings.primaryColor,
          accentColor: currentSettings.accentColor || initialSettings.accentColor,
        });
      } catch {
        toast.error('Could not load store settings');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    void loadSettings();
    return () => { mounted = false; };
  }, []);

  const cleanPhone = settings.paymentConfirmationPhone.replace(/\D/g, '');
  const waPhone = cleanPhone.startsWith('20') ? cleanPhone : `2${cleanPhone}`;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { updateSiteSettings } = await import('@/lib/supabase/db');
      await updateSiteSettings({
        storeName: settings.storeName,
        logo: '/assets/nexora-logo.png',
        favicon: '/favicon.ico',
        primaryColor: settings.primaryColor,
        accentColor: settings.accentColor,
        currency: settings.currency,
        shippingFee: settings.shippingFee,
        freeShippingThreshold: settings.freeShippingThreshold,
        taxRate: 0,
        whatsappNumber: settings.whatsappNumber,
        socialLinks: {
          instagram: settings.instagram,
          facebook: settings.facebook,
          whatsapp: `https://wa.me/${waPhone}`,
        },
        paymentSettings: {
          codEnabled: true,
          instapayEnabled: settings.instapayEnabled,
          vodafoneCashEnabled: settings.vodafoneCashEnabled,
          valuEnabled: settings.valuEnabled,
          confirmationPhone: settings.paymentConfirmationPhone,
          instapayContact: settings.paymentConfirmationPhone,
          vodafoneCashNumber: settings.paymentConfirmationPhone,
          screenshotRequired: true,
          instructions: settings.paymentInstructions,
          instapayInstructions: settings.instapayInstructions,
          vodafoneCashInstructions: settings.vodafoneCashInstructions,
          valuInstructions: settings.valuInstructions,
        },
        seo: {
          title: 'NEXORA | Defined by intention',
          description: 'NEXORA exists in silence. Crafted with precision. Limited by design. Not for everyone.',
          keywords: 'nexora, fashion, t-shirts, egypt, premium streetwear',
        },
        announcements: [],
      });
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Settings },
    { id: 'payments' as const, label: 'Payments', icon: CreditCard },
    { id: 'shipping' as const, label: 'Shipping', icon: Truck },
    { id: 'appearance' as const, label: 'Appearance', icon: Palette },
  ];

  const inputClass = 'w-full rounded-2xl border border-[#e6ded1] bg-white px-4 py-3 text-sm text-[#2b211d] outline-none transition-colors placeholder:text-[#b7a899] focus:border-[#b99a62]';

  return (
    <div className="space-y-6 text-[#2b211d]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a8461]">NEXORA settings</p>
          <h1 className="mt-2 text-2xl font-black tracking-[0.08em] text-[#2b211d]">Store control center</h1>
          <p className="mt-1 text-xs leading-6 text-[#8a8175]">{isLoading ? 'Loading settings...' : 'Configure store, payments, WhatsApp, shipping and appearance from one clean panel.'}</p>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2b211d] px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-[0_14px_32px_rgba(43,33,29,0.14)] disabled:opacity-50">
          <Save className="h-3.5 w-3.5" />{isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 rounded-[26px] border border-[#e6ded1] bg-white/85 p-2 shadow-[0_14px_38px_rgba(43,33,29,0.05)]">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold transition-colors ${activeTab === tab.id ? 'bg-[#2b211d] text-white' : 'text-[#6f5d50] hover:bg-[#faf7f1]'}`}>
            <tab.icon className="h-3.5 w-3.5" />{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <Panel title="General store details" description="Main identity and customer contact links shown across the storefront.">
          <label className="block"><FieldLabel>Store Name</FieldLabel><input value={settings.storeName} onChange={(e) => setSettings({ ...settings, storeName: e.target.value })} className={inputClass} /></label>
          <label className="block"><FieldLabel>Currency</FieldLabel><select value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className={inputClass}><option value="EGP">EGP</option><option value="USD">USD</option></select></label>
          <label className="block"><FieldLabel>Store WhatsApp Number</FieldLabel><input value={settings.whatsappNumber} onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })} className={inputClass} placeholder="01037141322" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><FieldLabel>Instagram</FieldLabel><input value={settings.instagram} onChange={(e) => setSettings({ ...settings, instagram: e.target.value })} className={inputClass} /></label>
            <label className="block"><FieldLabel>Facebook</FieldLabel><input value={settings.facebook} onChange={(e) => setSettings({ ...settings, facebook: e.target.value })} className={inputClass} /></label>
          </div>
        </Panel>
      )}

      {activeTab === 'payments' && (
        <Panel title="Payment Settings" description="Control the customer-facing manual payment flow, transfer number and ValU follow-up copy.">
          <div className="rounded-[24px] border border-[#e6ded1] bg-[#faf7f1] p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-[#9a8461]"><Smartphone className="h-4 w-4" /></span>
              <div>
                <p className="text-sm font-black text-[#2b211d]">Transfer + WhatsApp confirmation number</p>
                <p className="mt-1 text-xs leading-6 text-[#8a8175]">This number appears to customers for Instapay, Vodafone Cash and ValU follow-up.</p>
              </div>
            </div>
            <input value={settings.paymentConfirmationPhone} onChange={(e) => setSettings({ ...settings, paymentConfirmationPhone: e.target.value })} className={`${inputClass} mt-4`} placeholder="01037141322" />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex items-center justify-between rounded-2xl border border-[#e6ded1] bg-white p-4 text-sm font-semibold text-[#2b211d]"><span>Instapay / Bank transfer</span><input type="checkbox" checked={settings.instapayEnabled} onChange={(e) => setSettings({ ...settings, instapayEnabled: e.target.checked })} /></label>
            <label className="flex items-center justify-between rounded-2xl border border-[#e6ded1] bg-white p-4 text-sm font-semibold text-[#2b211d]"><span>Vodafone Cash</span><input type="checkbox" checked={settings.vodafoneCashEnabled} onChange={(e) => setSettings({ ...settings, vodafoneCashEnabled: e.target.checked })} /></label>
            <label className="flex items-center justify-between rounded-2xl border border-[#e6ded1] bg-white p-4 text-sm font-semibold text-[#2b211d]"><span>ValU Installments</span><input type="checkbox" checked={settings.valuEnabled} onChange={(e) => setSettings({ ...settings, valuEnabled: e.target.checked })} /></label>
          </div>

          <label className="block"><FieldLabel>General manual payment instructions</FieldLabel><textarea rows={3} value={settings.paymentInstructions} onChange={(e) => setSettings({ ...settings, paymentInstructions: e.target.value })} className={inputClass} /></label>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block"><FieldLabel>Instapay instructions</FieldLabel><textarea rows={4} value={settings.instapayInstructions} onChange={(e) => setSettings({ ...settings, instapayInstructions: e.target.value })} className={inputClass} /></label>
            <label className="block"><FieldLabel>Vodafone Cash instructions</FieldLabel><textarea rows={4} value={settings.vodafoneCashInstructions} onChange={(e) => setSettings({ ...settings, vodafoneCashInstructions: e.target.value })} className={inputClass} /></label>
          </div>
          <label className="block"><FieldLabel>ValU instructions</FieldLabel><textarea rows={3} value={settings.valuInstructions} onChange={(e) => setSettings({ ...settings, valuInstructions: e.target.value })} className={inputClass} /></label>

          <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs font-semibold text-green-700">
            <BadgeCheck className="h-4 w-4" /> Screenshot is required for Instapay and Vodafone Cash. ValU stays manual confirmation only.
          </div>
        </Panel>
      )}

      {activeTab === 'shipping' && (
        <Panel title="Shipping defaults" description="Fallback shipping values. Detailed city/zone rules stay in the Shipping page.">
          <label className="block"><FieldLabel>Shipping Fee (EGP)</FieldLabel><input type="number" value={settings.shippingFee} onChange={(e) => setSettings({ ...settings, shippingFee: Number(e.target.value) })} className={inputClass} /></label>
          <label className="block"><FieldLabel>Free Shipping Threshold (EGP)</FieldLabel><input type="number" value={settings.freeShippingThreshold} onChange={(e) => setSettings({ ...settings, freeShippingThreshold: Number(e.target.value) })} className={inputClass} /></label>
        </Panel>
      )}

      {activeTab === 'appearance' && (
        <Panel title="Appearance" description="Brand color controls used by the storefront and HQ surfaces.">
          <label className="block"><FieldLabel>Primary Color</FieldLabel><input type="color" value={settings.primaryColor} onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })} className="h-12 w-20 rounded-2xl border border-[#e6ded1] bg-white p-1" /></label>
          <label className="block"><FieldLabel>Accent Color</FieldLabel><input type="color" value={settings.accentColor} onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })} className="h-12 w-20 rounded-2xl border border-[#e6ded1] bg-white p-1" /></label>
        </Panel>
      )}
    </div>
  );
}
