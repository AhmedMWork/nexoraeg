export type CheckoutErrorKind = 'network_error' | 'stock_error' | 'coupon_error' | 'validation_error' | 'duplicate_order_risk' | 'server_error';

export function classifyCheckoutError(error: unknown): { kind: CheckoutErrorKind; message: string } {
  const raw = error instanceof Error ? error.message : String(error || '');
  const message = raw || 'Checkout could not be completed.';
  const lower = message.toLowerCase();
  if (/stock|quantity|available|sold out/.test(lower)) return { kind: 'stock_error', message };
  if (/coupon|code|discount/.test(lower)) return { kind: 'coupon_error', message };
  if (/phone|required|valid|address|governorate|city/.test(lower)) return { kind: 'validation_error', message };
  if (/duplicate|already/.test(lower)) return { kind: 'duplicate_order_risk', message };
  if (/network|fetch|failed to fetch|timeout/.test(lower)) return { kind: 'network_error', message: 'Network connection failed. Please try again before placing another order.' };
  return { kind: 'server_error', message };
}
