// ============================================================
// NEXORA V5 Pro — Cart/order math helpers
// ============================================================

import type { CartItem } from '@/types';

export type CheckoutTotalsInput = {
  subtotal: number;
  discount?: number;
  deliveryFee?: number;
  codFee?: number;
  paymentMethod: string;
};

export function computeCheckoutTotals(input: CheckoutTotalsInput) {
  const subtotal = Number(input.subtotal || 0);
  const discount = Number(input.discount || 0);
  const deliveryFee = Number(input.deliveryFee || 0);
  const codFee = input.paymentMethod === 'cod' ? Number(input.codFee || 0) : 0;
  return {
    subtotal,
    discount,
    deliveryFee,
    codFee,
    shipping: deliveryFee + codFee,
    total: Math.max(0, subtotal - discount + deliveryFee + codFee),
  };
}

export function cartItemKey(item: Pick<CartItem, 'productId' | 'variantId' | 'size' | 'color'>): string {
  return [item.productId, item.variantId || 'base', item.size || 'nosize', item.color || 'default'].join('::');
}
