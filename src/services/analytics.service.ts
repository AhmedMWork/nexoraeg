import { trackVisitorEvent } from '@/lib/analytics/tracker';
import { mapAnalyticsToMeta } from '@/lib/metaPixel';

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
  | 'checkout_contact_entered'
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
  | 'lead_captured'
  | 'notify_me'
  | 'private_list_joined'
  | 'whatsapp_click';

export async function trackEvent(eventName: AnalyticsEventName, payload: Record<string, unknown> = {}) {
  mapAnalyticsToMeta(eventName, payload);
  await trackVisitorEvent(eventName, payload);
}
