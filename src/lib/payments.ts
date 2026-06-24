// ============================================================
// NEXORA Premium — Payment configuration and copy helpers
// Centralizes storefront/admin payment logic so Checkout, Orders
// and Settings stay consistent without changing the brand design.
// ============================================================

import type { Order } from '@/types';

export type PaymentMethod = Order['paymentMethod'];
export type PaymentStatus = Order['paymentStatus'];

export type PaymentSettings = {
  codEnabled: boolean;
  instapayEnabled: boolean;
  vodafoneCashEnabled: boolean;
  valuEnabled: boolean;
  transferNumber: string;
  confirmationPhone: string;
  whatsappConfirmationNumber: string;
  codFeeEnabled: boolean;
  codFeeAmount?: number;
  requireScreenshotInstapay: boolean;
  requireScreenshotVodafone: boolean;
  instapayInstructionsAr: string;
  vodafoneInstructionsAr: string;
  valuInstructionsAr: string;
  codInstructionsAr: string;
};

export const DEFAULT_TRANSFER_NUMBER = '01037141322';

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  codEnabled: true,
  instapayEnabled: true,
  vodafoneCashEnabled: true,
  valuEnabled: true,
  transferNumber: DEFAULT_TRANSFER_NUMBER,
  confirmationPhone: DEFAULT_TRANSFER_NUMBER,
  whatsappConfirmationNumber: '201037141322',
  codFeeEnabled: true,
  codFeeAmount: undefined,
  requireScreenshotInstapay: true,
  requireScreenshotVodafone: true,
  codInstructionsAr: 'سيتم تأكيد الطلب معك على واتساب قبل التجهيز. برجاء التأكد من أن رقم الهاتف صحيح ومتاح للتواصل.',
  instapayInstructionsAr: 'بعد تسجيل الطلب، اضغط على زر واتساب وأرسل Screenshot التحويل مع رقم الطلب. لا يتم تجهيز الطلب إلا بعد تأكيد الدفع.',
  vodafoneInstructionsAr: 'بعد تسجيل الطلب، أرسل Screenshot التحويل على واتساب ويجب أن يكون رقم العملية والمبلغ واضحين.',
  valuInstructionsAr: 'لا تقم بأي تحويل قبل التواصل معك وتأكيد تفاصيل التقسيط. فريق NEXORA سيؤكد الخطوات على واتساب.',
};

function boolFromUnknown(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (['true', '1', 'yes', 'on'].includes(value.toLowerCase())) return true;
    if (['false', '0', 'no', 'off'].includes(value.toLowerCase())) return false;
  }
  return fallback;
}

function cleanPhone(value: unknown, fallback: string): string {
  const cleaned = String(value || '').trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

export function normalizePaymentSettings(raw?: Record<string, unknown> | null): PaymentSettings {
  const source = raw || {};
  const transferNumber = cleanPhone(
    source.transferNumber ?? source.transfer_number ?? source.instapayContact ?? source.vodafoneCashNumber,
    DEFAULT_PAYMENT_SETTINGS.transferNumber,
  );
  const confirmationPhone = cleanPhone(
    source.confirmationPhone ?? source.confirmation_phone ?? source.whatsappConfirmationNumber ?? source.whatsapp_confirmation_number ?? transferNumber,
    DEFAULT_PAYMENT_SETTINGS.confirmationPhone,
  );

  return {
    codEnabled: boolFromUnknown(source.codEnabled ?? source.enable_cod, DEFAULT_PAYMENT_SETTINGS.codEnabled),
    instapayEnabled: boolFromUnknown(source.instapayEnabled ?? source.enable_instapay, DEFAULT_PAYMENT_SETTINGS.instapayEnabled),
    vodafoneCashEnabled: boolFromUnknown(source.vodafoneCashEnabled ?? source.enable_vodafone_cash, DEFAULT_PAYMENT_SETTINGS.vodafoneCashEnabled),
    valuEnabled: boolFromUnknown(source.valuEnabled ?? source.enable_valu, DEFAULT_PAYMENT_SETTINGS.valuEnabled),
    transferNumber,
    confirmationPhone,
    whatsappConfirmationNumber: cleanPhone(source.whatsappConfirmationNumber ?? source.whatsapp_confirmation_number ?? confirmationPhone, confirmationPhone),
    codFeeEnabled: boolFromUnknown(source.codFeeEnabled ?? source.cod_fee_enabled, DEFAULT_PAYMENT_SETTINGS.codFeeEnabled),
    codFeeAmount: source.codFeeAmount === undefined && source.cod_fee_amount === undefined ? undefined : Number(source.codFeeAmount ?? source.cod_fee_amount),
    requireScreenshotInstapay: boolFromUnknown(source.requireScreenshotInstapay ?? source.require_screenshot_instapay ?? source.screenshotRequired, DEFAULT_PAYMENT_SETTINGS.requireScreenshotInstapay),
    requireScreenshotVodafone: boolFromUnknown(source.requireScreenshotVodafone ?? source.require_screenshot_vodafone ?? source.screenshotRequired, DEFAULT_PAYMENT_SETTINGS.requireScreenshotVodafone),
    codInstructionsAr: String(source.codInstructionsAr ?? source.cod_instructions_ar ?? DEFAULT_PAYMENT_SETTINGS.codInstructionsAr),
    instapayInstructionsAr: String(source.instapayInstructionsAr ?? source.instapayInstructions ?? source.instapay_instructions_ar ?? source.instructions ?? DEFAULT_PAYMENT_SETTINGS.instapayInstructionsAr),
    vodafoneInstructionsAr: String(source.vodafoneInstructionsAr ?? source.vodafoneCashInstructions ?? source.vodafone_instructions_ar ?? DEFAULT_PAYMENT_SETTINGS.vodafoneInstructionsAr),
    valuInstructionsAr: String(source.valuInstructionsAr ?? source.valuInstructions ?? source.valu_instructions_ar ?? DEFAULT_PAYMENT_SETTINGS.valuInstructionsAr),
  };
}

export function isPaymentMethodEnabled(method: PaymentMethod, settings: PaymentSettings): boolean {
  if (method === 'cod') return settings.codEnabled;
  if (method === 'instapay') return settings.instapayEnabled;
  if (method === 'vodafone_cash') return settings.vodafoneCashEnabled;
  if (method === 'valu') return settings.valuEnabled;
  return false;
}

export function getEnabledPaymentMethods(settings: PaymentSettings): PaymentMethod[] {
  return (['cod', 'instapay', 'vodafone_cash', 'valu'] as PaymentMethod[]).filter((method) => isPaymentMethodEnabled(method, settings));
}

export function getPaymentMethodLabel(method?: string, locale: 'ar' | 'en' = 'ar'): string {
  const ar: Record<string, string> = {
    cod: 'الدفع عند الاستلام',
    instapay: 'Instapay / تحويل بنكي',
    vodafone_cash: 'Vodafone Cash',
    valu: 'ValU Installments',
  };
  const en: Record<string, string> = {
    cod: 'Cash on Delivery',
    instapay: 'Instapay / Bank Transfer',
    vodafone_cash: 'Vodafone Cash',
    valu: 'ValU Installments',
  };
  return (locale === 'ar' ? ar : en)[String(method || 'cod')] || String(method || 'COD');
}

export function getPaymentStatusLabel(status?: string, locale: 'ar' | 'en' = 'ar'): string {
  const ar: Record<string, string> = {
    pending: 'في انتظار التأكيد',
    pending_confirmation: 'في انتظار تأكيد يدوي',
    waiting_transfer: 'في انتظار إثبات التحويل',
    paid: 'تم الدفع',
    collected: 'تم التحصيل',
    failed: 'فشل الدفع',
    refunded: 'تم الاسترداد',
  };
  const en: Record<string, string> = {
    pending: 'Pending',
    pending_confirmation: 'Pending confirmation',
    waiting_transfer: 'Waiting transfer proof',
    paid: 'Paid',
    collected: 'Collected',
    failed: 'Failed',
    refunded: 'Refunded',
  };
  return (locale === 'ar' ? ar : en)[String(status || 'pending')] || String(status || 'pending');
}

export function getInitialPaymentStatus(method: PaymentMethod): PaymentStatus {
  if (method === 'valu') return 'pending_confirmation';
  if (method === 'instapay' || method === 'vodafone_cash') return 'waiting_transfer';
  return 'pending';
}

export function requiresPaymentScreenshot(method: PaymentMethod, settings: PaymentSettings): boolean {
  if (method === 'instapay') return settings.requireScreenshotInstapay;
  if (method === 'vodafone_cash') return settings.requireScreenshotVodafone;
  return false;
}

export function paymentSuccessCopy(method: PaymentMethod): string {
  if (method === 'instapay') return 'تم تسجيل طلبك. لإكمال التأكيد، أرسل Screenshot تحويل Instapay على واتساب مع رقم الطلب.';
  if (method === 'vodafone_cash') return 'تم تسجيل طلبك. أرسل Screenshot تحويل Vodafone Cash ويجب أن يظهر رقم العملية والمبلغ بوضوح.';
  if (method === 'valu') return 'تم تسجيل طلبك بنظام ValU. سنتواصل معك لتأكيد تفاصيل التقسيط قبل التجهيز.';
  return 'تم استلام طلبك بنظام الدفع عند الاستلام. سنؤكد معك التفاصيل على واتساب قبل التجهيز.';
}
