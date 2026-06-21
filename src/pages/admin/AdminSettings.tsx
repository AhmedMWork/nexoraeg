// ============================================================
// NEXORA — Admin Settings Page
// ============================================================

import { useEffect, useState } from 'react';
import { Settings, Truck, Palette, Save, CreditCard } from 'lucide-react';
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
  paymentInstructions: 'Manual payments are confirmed on WhatsApp. Send a screenshot after transfer.',
  valuInstructions: 'ValU installment requests are confirmed manually on WhatsApp before processing.',
  primaryColor: '#050505',
  accentColor: '#c8a96a',
};

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

  const inputClass = 'w-full bg-[#050505] border border-[#202024] px-4 py-3 text-sm text-[#f4f0e8] focus:outline-none focus:border-[#c8a96a]';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold tracking-wider uppercase text-[#f4f0e8]">Settings</h1>
        <p className="text-xs text-[#8a8175] mt-1">{isLoading ? 'Loading settings...' : 'Configure store, payments and social links'}</p>
      </div>

      <div className="flex flex-wrap gap-0 border-b border-[#17171a]">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-5 py-3 text-xs tracking-wider uppercase transition-colors border-b-2 ${activeTab === tab.id ? 'text-[#c8a96a] border-[#c8a96a]' : 'text-[#8a8175] border-transparent hover:text-[#b8b0a3]'}`}>
            <tab.icon className="w-3.5 h-3.5" />{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <div className="p-6 bg-[#0b0b0d] border border-[#17171a] space-y-5 max-w-2xl">
          <label className="block"><span className="text-[10px] text-[#8a8175] uppercase tracking-wider mb-1.5 block">Store Name</span><input value={settings.storeName} onChange={(e) => setSettings({ ...settings, storeName: e.target.value })} className={inputClass} /></label>
          <label className="block"><span className="text-[10px] text-[#8a8175] uppercase tracking-wider mb-1.5 block">Currency</span><select value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className={inputClass}><option value="EGP">EGP</option><option value="USD">USD</option></select></label>
          <label className="block"><span className="text-[10px] text-[#8a8175] uppercase tracking-wider mb-1.5 block">WhatsApp Number</span><input value={settings.whatsappNumber} onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })} className={inputClass} placeholder="01037141322" /></label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block"><span className="text-[10px] text-[#8a8175] uppercase tracking-wider mb-1.5 block">Instagram</span><input value={settings.instagram} onChange={(e) => setSettings({ ...settings, instagram: e.target.value })} className={inputClass} /></label>
            <label className="block"><span className="text-[10px] text-[#8a8175] uppercase tracking-wider mb-1.5 block">Facebook</span><input value={settings.facebook} onChange={(e) => setSettings({ ...settings, facebook: e.target.value })} className={inputClass} /></label>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="p-6 bg-[#0b0b0d] border border-[#17171a] space-y-5 max-w-2xl">
          <label className="block"><span className="text-[10px] text-[#8a8175] uppercase tracking-wider mb-1.5 block">Transfer + WhatsApp confirmation number</span><input value={settings.paymentConfirmationPhone} onChange={(e) => setSettings({ ...settings, paymentConfirmationPhone: e.target.value })} className={inputClass} placeholder="01037141322" /><span className="mt-1 block text-[10px] leading-5 text-[#8a8175]">Used for Instapay, Vodafone Cash, ValU follow-up and screenshot confirmation.</span></label>
          <div className="grid gap-3">
            <label className="flex items-center justify-between rounded-2xl border border-[#202024] bg-[#050505] p-4 text-sm text-[#f4f0e8]"><span>Instapay / Bank transfer</span><input type="checkbox" checked={settings.instapayEnabled} onChange={(e) => setSettings({ ...settings, instapayEnabled: e.target.checked })} /></label>
            <label className="flex items-center justify-between rounded-2xl border border-[#202024] bg-[#050505] p-4 text-sm text-[#f4f0e8]"><span>Vodafone Cash</span><input type="checkbox" checked={settings.vodafoneCashEnabled} onChange={(e) => setSettings({ ...settings, vodafoneCashEnabled: e.target.checked })} /></label>
            <label className="flex items-center justify-between rounded-2xl border border-[#202024] bg-[#050505] p-4 text-sm text-[#f4f0e8]"><span>ValU Installments</span><input type="checkbox" checked={settings.valuEnabled} onChange={(e) => setSettings({ ...settings, valuEnabled: e.target.checked })} /></label>
          </div>
          <label className="block"><span className="text-[10px] text-[#8a8175] uppercase tracking-wider mb-1.5 block">Manual payment instructions</span><textarea rows={3} value={settings.paymentInstructions} onChange={(e) => setSettings({ ...settings, paymentInstructions: e.target.value })} className={inputClass} /></label>
          <label className="block"><span className="text-[10px] text-[#8a8175] uppercase tracking-wider mb-1.5 block">ValU instructions</span><textarea rows={3} value={settings.valuInstructions} onChange={(e) => setSettings({ ...settings, valuInstructions: e.target.value })} className={inputClass} /></label>
        </div>
      )}

      {activeTab === 'shipping' && (
        <div className="p-6 bg-[#0b0b0d] border border-[#17171a] space-y-5 max-w-2xl">
          <label className="block"><span className="text-[10px] text-[#8a8175] uppercase tracking-wider mb-1.5 block">Shipping Fee (EGP)</span><input type="number" value={settings.shippingFee} onChange={(e) => setSettings({ ...settings, shippingFee: Number(e.target.value) })} className={inputClass} /></label>
          <label className="block"><span className="text-[10px] text-[#8a8175] uppercase tracking-wider mb-1.5 block">Free Shipping Threshold (EGP)</span><input type="number" value={settings.freeShippingThreshold} onChange={(e) => setSettings({ ...settings, freeShippingThreshold: Number(e.target.value) })} className={inputClass} /></label>
        </div>
      )}

      {activeTab === 'appearance' && (
        <div className="p-6 bg-[#0b0b0d] border border-[#17171a] space-y-5 max-w-2xl">
          <label className="block"><span className="text-[10px] text-[#8a8175] uppercase tracking-wider mb-1.5 block">Primary Color</span><input type="color" value={settings.primaryColor} onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })} className="h-10 w-16 border border-[#202024] bg-transparent" /></label>
          <label className="block"><span className="text-[10px] text-[#8a8175] uppercase tracking-wider mb-1.5 block">Accent Color</span><input type="color" value={settings.accentColor} onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })} className="h-10 w-16 border border-[#202024] bg-transparent" /></label>
        </div>
      )}

      <button onClick={handleSave} disabled={isSaving} className="nexora-button-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
        <Save className="w-3.5 h-3.5" />{isSaving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
