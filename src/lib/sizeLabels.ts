export const DEFAULT_SIZE_WEIGHT_RANGES: Record<string, string> = {
  XS: '45-55KG',
  S: '50-65KG',
  SMALL: '50-65KG',
  M: '65-75KG',
  MEDIUM: '65-75KG',
  L: '75-85KG',
  LARGE: '75-85KG',
  XL: '85-95KG',
  XXL: '95-110KG',
  '2XL': '95-110KG',
  XXXL: '110-125KG',
  '3XL': '110-125KG',
};

export function normalizeSizeKey(size?: string) {
  return String(size || '').trim().toUpperCase();
}

export function getWeightRangeForSize(size?: string, explicit?: string) {
  if (explicit && String(explicit).trim()) return String(explicit).trim();
  const key = normalizeSizeKey(size);
  return DEFAULT_SIZE_WEIGHT_RANGES[key] || '';
}

export function getSizeDisplayLabel(size?: string, explicitWeightRange?: string, explicitLabel?: string) {
  if (explicitLabel && String(explicitLabel).trim()) return String(explicitLabel).trim();
  const cleanSize = String(size || '').trim();
  const weight = getWeightRangeForSize(cleanSize, explicitWeightRange);
  return weight ? `${cleanSize} (${weight})` : cleanSize;
}

export const RETURN_EXCHANGE_POLICY_AR = [
  'الاسترجاع متاح فقط أثناء تواجد مندوب الشحن.',
  'يُرجى مراجعة الطلب جيدًا قبل مغادرة المندوب، ولا يُقبل الاسترجاع بعد ذلك.',
  'في حالة وجود مشكلة في الطباعة، يمكن استرجاع المنتج خلال 14 يومًا من الاستلام.',
  'الاستبدال متاح خلال 5 أيام من الاستلام عبر التواصل على واتساب.',
  'لا يمكن تقسيم الطلب - يتم استلامه أو استرجاعه كاملًا.',
  'المنتجات المخفضة تُسترجع فقط وقت التسليم ولا يُسمح باستبدالها.',
  'مدة الشحن: من 4 إلى 7 أيام عمل، عدا الجمعة والعطلات الرسمية.',
];

export const SHIPPING_ESTIMATE_TEXT = '4-7 business days, excluding Fridays and official holidays.';
export const SHIPPING_ESTIMATE_TEXT_AR = 'من 4 إلى 7 أيام عمل، عدا الجمعة والعطلات الرسمية.';
