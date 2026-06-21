# NEXORA Changelog

## V5 Pro Source Upgrade

### Added
- `src/lib/payments.ts` centralized payment settings, labels, statuses and success copy.
- `src/lib/whatsapp.ts` centralized WhatsApp phone normalization and message builders.
- `src/lib/orderMath.ts` centralized checkout totals and cart item identity.
- `src/lib/designTokens.ts` reference tokens for V5 UI work.
- Reusable UI primitives: `ColorSwatch`, `CopyButton`, `OptimizedImage`, `StatusBadge`, `SectionCard`.
- Admin Controls → Payments tab for payment method toggles and customer-facing instructions.
- Supabase migration `0019_v5_pro_payment_settings_order_events.sql`.
- `npm run v5:audit` regression scan.

### Changed
- Checkout now reads normalized payment settings from site settings.
- Checkout initial payment statuses now come from shared helper.
- Cart and Product Detail use reusable image/color components.
- Admin Orders and Order Detail use shared payment and WhatsApp helpers.
- Product Detail shipping/payment tab now includes ValU.

### Verified
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run v5:audit` passed.
- `npm run smoke` passed.
- `npm run build` passed with valid public env placeholders.
