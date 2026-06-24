# NEXORA Final Ready Release

## Scope
This package contains the final polished source-ready version for Vercel deployment.
It is intended to be built by Vercel using the real production environment variables.

## Main changes

### Checkout
- Rebuilt the checkout page with premium Arabic customer-facing copy.
- Added clear payment cards for COD, Instapay, Vodafone Cash, and ValU.
- Added method-specific confirmation messages and WhatsApp flow.
- Added transfer-number copy action for manual payment methods.
- Added payment-aware CTA labels.
- Improved order summary with size, weight range, color indicator, quantity, shipping, discount, and total.
- COD fee is now shown and calculated only for Cash on Delivery.
- Instapay, Vodafone Cash, and ValU no longer include COD fee in the frontend total.

### Admin
- Removed the visible label "متابعة 2" from the admin UI.
- Replaced follow-up labels with professional Arabic labels while keeping compatible internal values where needed.
- Improved Orders HQ with operational queue cards:
  - New orders
  - Waiting payment screenshot
  - ValU follow-up
  - Ready to ship
- Improved Dashboard action inbox to surface payment screenshots, ValU follow-up, and fulfillment tasks.
- Rebuilt Admin Settings into a cleaner Light HQ layout with a dedicated Payment Settings section.

### Supabase
- Added migration: `supabase/migrations/0018_checkout_admin_final_polish.sql`.
- The migration recreates `nexora_create_order_atomic_v5_4` with payment-aware COD fees.
- Screenshot requirement is limited to Instapay and Vodafone Cash.
- ValU is set to `pending_confirmation`.
- Instapay/Vodafone Cash are set to `waiting_transfer`.
- Improved item snapshot matching using product, size, variant, and color when available.
- Added polished default payment instructions to site settings.

### Deployment and safety
- Updated `supabase/config.toml` with missing Edge Function config entries.
- Updated README deployment commands to use production-safe `supabase db push`.
- Removed the dangerous production reset instruction from the main deployment flow.
- Updated WhatsApp env example to use international format: `201037141322`.

## Verification performed
- `npm ci` completed. Node engine warning appeared because the local runner used Node 22 while the project requires Node 20.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed with placeholder public env values for local validation.
- `npm run smoke` passed.
- Verified there is no remaining visible `متابعة 2` or the old placeholder `Sent / متابعة 2` in source, Supabase migrations, or README.

## Important deployment note
This release is source-ready. Build it on Vercel with the real environment variables:

```env
VITE_SITE_URL=https://your-production-domain.com
VITE_SUPABASE_URL=https://ccmuazjkgzjqzybxwrfd.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_REAL_SUPABASE_PUBLISHABLE_OR_ANON_KEY
VITE_STORE_WHATSAPP=201037141322
VITE_SUPPORT_EMAIL=support@your-domain.com
```

Then run/push the database migrations with:

```powershell
supabase link --project-ref ccmuazjkgzjqzybxwrfd
supabase db push
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-supabase-functions.ps1 -ProjectRef ccmuazjkgzjqzybxwrfd
```

Do not use `supabase db reset --linked` on production data.
