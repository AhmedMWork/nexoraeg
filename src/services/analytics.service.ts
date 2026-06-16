import { supabase } from '@/lib/supabase/client';

export type AnalyticsEventName =
  | 'page_view'
  | 'product_view'
  | 'shop_filter_used'
  | 'search_used'
  | 'color_select'
  | 'size_select'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'cart_quantity_changed'
  | 'cart_view'
  | 'checkout_started'
  | 'checkout_start'
  | 'coupon_attempted'
  | 'coupon_apply'
  | 'coupon_applied'
  | 'coupon_fail'
  | 'coupon_failed'
  | 'checkout_error'
  | 'order_submit'
  | 'order_created'
  | 'order_success'
  | 'order_failed'
  | 'track_order_opened'
  | 'track_order_success'
  | 'track_order_failed'
  | 'studio_login_success'
  | 'studio_login_failed'
  | 'studio_order_updated'
  | 'studio_product_updated'
  | 'whatsapp_click';

function sessionId() {
  const key = 'nexora-analytics-session-v5-1';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const value = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(key, value);
  return value;
}

function deviceType() {
  if (typeof navigator === 'undefined') return 'unknown';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
}

export async function trackEvent(eventName: AnalyticsEventName, payload: Record<string, unknown> = {}) {
  try {
    await supabase.from('analytics_events').insert({
      event_name: eventName,
      session_id: sessionId(),
      path: window.location.pathname,
      referrer: document.referrer || null,
      language: document.documentElement.lang || 'en',
      device: deviceType(),
      payload,
    });
  } catch {
    // Analytics must never break the storefront.
  }
}
