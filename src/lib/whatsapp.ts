// ============================================================
// NEXORA Premium — WhatsApp helpers
// ============================================================

import type { Order } from '@/types';
import { getPaymentMethodLabel, type PaymentMethod } from '@/lib/payments';

export function normalizeEgyptPhoneForWhatsApp(phone: string, fallback = '201037141322'): string {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return fallback;
  if (digits.startsWith('20')) return digits;
  if (digits.startsWith('0')) return `2${digits}`;
  if (digits.startsWith('1') && digits.length === 10) return `20${digits}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string, message?: string): string {
  const normalized = normalizeEgyptPhoneForWhatsApp(phone);
  const encoded = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${normalized}${encoded}`;
}

export function buildCheckoutWhatsAppMessage(orderNumber: string, method: PaymentMethod, locale: 'ar' | 'en' = 'ar'): string {
  if (locale === 'en') {
    if (method === 'instapay') return `Hello NEXORA, my order ${orderNumber} has been placed. Payment method: Instapay. I will send the transfer screenshot to confirm payment.`;
    if (method === 'vodafone_cash') return `Hello NEXORA, my order ${orderNumber} has been placed. Payment method: Vodafone Cash. I will send the transfer screenshot to confirm payment.`;
    if (method === 'valu') return `Hello NEXORA, my order ${orderNumber} has been placed. Payment method: ValU Installments. Please contact me to confirm installment details.`;
    return `Hello NEXORA, my order ${orderNumber} has been placed. Payment method: Cash on Delivery. Please confirm the order and delivery time.`;
  }
  if (method === 'instapay') return `أهلاً NEXORA، تم تسجيل طلبي رقم ${orderNumber}. طريقة الدفع: Instapay. سأرسل Screenshot التحويل لتأكيد الطلب.`;
  if (method === 'vodafone_cash') return `أهلاً NEXORA، تم تسجيل طلبي رقم ${orderNumber}. طريقة الدفع: Vodafone Cash. سأرسل Screenshot التحويل لتأكيد الطلب.`;
  if (method === 'valu') return `أهلاً NEXORA، تم تسجيل طلبي رقم ${orderNumber}. طريقة الدفع: ValU Installments. برجاء التواصل معي لتأكيد تفاصيل التقسيط.`;
  return `أهلاً NEXORA، تم تسجيل طلبي رقم ${orderNumber}. طريقة الدفع: الدفع عند الاستلام. برجاء تأكيد الطلب وموعد التوصيل.`;
}

export function buildAdminOrderWhatsAppMessage(order: Order, purpose: 'confirm' | 'payment' | 'shipping' | 'valu' = 'confirm'): string {
  const method = getPaymentMethodLabel(order.paymentMethod, 'ar');
  if (purpose === 'valu' || order.paymentMethod === 'valu') {
    return `أهلاً، معاك NEXORA. استلمنا طلبك رقم ${order.orderNumber} واخترت التقسيط مع ValU. هنأكد معاك التفاصيل وخطة التقسيط المتاحة على واتساب.`;
  }
  if (purpose === 'payment') {
    return `أهلاً، معاك NEXORA. بنأكد طلبك رقم ${order.orderNumber}. الإجمالي ${order.total} EGP. طريقة الدفع ${method}. برجاء إرسال Screenshot التحويل على واتساب لتأكيد الطلب.`;
  }
  if (purpose === 'shipping') {
    return `أهلاً، معاك NEXORA. طلبك رقم ${order.orderNumber} قيد التجهيز. هنبلغك بتحديث الشحن أول ما يخرج للتوصيل.`;
  }
  return `أهلاً، معاك NEXORA. بنأكد طلبك رقم ${order.orderNumber}. طريقة الدفع ${method}. برجاء تأكيد بيانات التوصيل.`;
}
