/* eslint-disable @typescript-eslint/no-explicit-any */
type PixelPayload = Record<string, unknown>;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

let activePixelId = '';
let scriptInjected = false;

export function installMetaPixel(pixelId?: string | null, enabled = true) {
  if (typeof window === 'undefined') return;
  const cleanId = String(pixelId || (import.meta as any).env?.VITE_META_PIXEL_ID || '').trim();
  if (!enabled || !cleanId) return;
  activePixelId = cleanId;

  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if ((fbq as any).callMethod) {
        (fbq as any).callMethod.apply(fbq, args);
      } else {
        (fbq as any).queue.push(args);
      }
    } as any;
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;
  }

  if (!scriptInjected && !document.querySelector('script[data-nexora-meta-pixel="true"]')) {
    scriptInjected = true;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.dataset.nexoraMetaPixel = 'true';
    document.head.appendChild(script);
  }

  const fbq = window.fbq;
  if (fbq) {
    fbq('init', cleanId);
    fbq('track', 'PageView');
  }
}

export function trackMetaPixelEvent(eventName: string, payload: PixelPayload = {}) {
  if (typeof window === 'undefined' || !activePixelId || !window.fbq) return;
  window.fbq('track', eventName, payload);
}

export function mapAnalyticsToMeta(eventName: string, payload: PixelPayload = {}) {
  const currency = 'EGP';
  if (eventName === 'page_view') trackMetaPixelEvent('PageView', {});
  if (eventName === 'product_view') trackMetaPixelEvent('ViewContent', {
    content_ids: [payload.productId].filter(Boolean),
    content_name: payload.productName,
    content_type: 'product',
    currency,
  });
  if (eventName === 'add_to_cart') trackMetaPixelEvent('AddToCart', {
    content_ids: [payload.productId].filter(Boolean),
    content_name: payload.productName,
    content_type: 'product',
    value: payload.price || payload.value,
    currency,
  });
  if (eventName === 'checkout_start' || eventName === 'checkout_started') trackMetaPixelEvent('InitiateCheckout', {
    num_items: payload.itemsCount,
    value: payload.subtotal || payload.total,
    currency,
  });
  if (eventName === 'order_success' || eventName === 'order_created') trackMetaPixelEvent('Purchase', {
    value: payload.total,
    currency,
    order_id: payload.orderNumber,
    content_ids: payload.productIds,
    contents: payload.contents,
  });
}
