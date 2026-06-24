# NEXORA — Final Admin Pro Package

Generated on 2026-06-22.

## Scope
This package upgrades the latest NEXORA source into a cleaner production-ready source package focused on real operational improvements:

- Bilingual customer checkout.
- Arabic-first admin operations area.
- Simpler shipping management.
- Cleaner setup/readiness page without environment-variable exposure.
- Improved footer WhatsApp action and removal of TikTok from the visible footer/social campaign UI.
- Admin order editing for customer-requested changes.
- Safer payment and total calculations.

## Customer checkout

- Added `src/content/checkoutCopy.ts` with Arabic and English checkout copy.
- Checkout now follows the active storefront language instead of always showing Arabic.
- Localized contact, delivery, payment, review, validation, success, and WhatsApp text.
- Payment method cards remain clear for COD, Instapay, Vodafone Cash, and ValU.
- COD fee appears and is calculated only for Cash on Delivery.
- Instapay/Vodafone Cash continue to require payment proof messaging.
- ValU uses manual confirmation messaging instead of transfer-proof messaging.

## Footer

- Removed TikTok from the visible footer social links.
- Improved WhatsApp footer icon styling.
- Footer WhatsApp opens a localized inquiry message.

## Admin Arabic HQ

Core admin operations were converted to Arabic-first UI:

- Admin navigation labels.
- Admin header/sidebar wording.
- Orders page.
- Order detail page.
- Shipping page.
- Controls/setup page.
- Campaign/report visible TikTok references removed from the admin UI.

Brand/service names such as WhatsApp, Instapay, Vodafone Cash, ValU, ShipBlu, Facebook, Instagram, and Google are intentionally kept as service names.

## Setup / Controls

- Removed the visible Environment tab from admin controls.
- Setup now presents store readiness, payment settings, integrations, privacy, and recovery in admin-friendly Arabic wording.
- No VITE keys or environment values are shown to the daily admin user.

## Shipping

- Rebuilt `AdminShipping` into a simpler page:
  - Summary cards.
  - General shipping settings.
  - Add/edit delivery area form.
  - Clear delivery zones table.
  - Recent shipments section.
- Kept COD fee settings but clarified that the fee applies only to COD orders.

## Order editing

Added admin-side order editing for customer-requested changes:

- Edit customer name and phone.
- Edit governorate, city, address, and delivery notes.
- Edit payment method/status.
- Edit shipping fee, COD fee, discount, and coupon.
- Edit item name, size, color, quantity, and unit price.
- Add/remove order items.
- Live recalculated totals.
- Save with an edit reason.

Backend support added:

- `updateOrderAdmin` client helper in `src/lib/supabase/db.ts`.
- `update-order-admin` action in `supabase/functions/studio-orders/index.ts`.
- Migration `0020_v5_1_admin_arabic_order_editing.sql` for order edit support and follow-up/event compatibility.

Important note: this order-editing flow updates order data and totals. Automatic inventory delta reconciliation for item edits should be treated as a V5.2 hardening task; for now, stock changes should be reviewed manually if an admin adds/removes/changes items after an order is created.

## Files added or heavily changed

- `src/content/checkoutCopy.ts`
- `src/pages/CheckoutPage.tsx`
- `src/components/layout/Footer.tsx`
- `src/lib/whatsapp.ts`
- `src/pages/admin/AdminControls.tsx`
- `src/pages/admin/AdminShipping.tsx`
- `src/pages/admin/AdminOrders.tsx`
- `src/pages/admin/AdminOrderDetail.tsx`
- `src/lib/supabase/db.ts`
- `src/lib/constants.ts`
- `src/components/layout/AdminSidebar.tsx`
- `src/components/layout/AdminLayout.tsx`
- `supabase/functions/studio-orders/index.ts`
- `supabase/migrations/0020_v5_1_admin_arabic_order_editing.sql`

## Validation results

Executed successfully:

```bash
npm ci
npm run typecheck
npm run lint
npm run smoke
npm run v5:audit
VITE_SITE_URL=https://example.com VITE_SUPABASE_URL=https://ccmuazjkgzjqzybxwrfd.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=placeholder VITE_STORE_WHATSAPP=201037141322 npm run build
```

The local environment used Node 22 and showed an engine warning because the project is configured for Node 20. Build still passed. Production/Vercel should use Node 20.x.

## Deployment notes

1. Deploy first to Staging.
2. Run:

```bash
supabase db push
supabase functions deploy
```

3. Confirm all environment variables in Vercel.
4. Test real Supabase order creation and admin order editing before Production.
5. Do not use `supabase db reset --linked` on Production.

## Recommended next hardening

- Add Playwright E2E tests for checkout and order editing.
- Add automatic inventory delta updates when order items are edited.
- Expand full Arabic polish to every secondary analytics/marketing page.
- Add upload/attach payment proof from tracking page.
- Add order event timeline UI backed by `order_events`.
