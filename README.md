# Nexora

Production-ready NEXORA storefront and admin system.

## Latest included upgrades

- Dynamic Storefront tiles in `/nexora-admin/storefront`:
  - Add tile
  - Hide/show tile
  - Delete tile
  - Reorder tiles
  - Seasonal labels: Summer / Winter / All year
  - Maximum 5 tiles
- Premium manual payment flow:
  - Cash on delivery
  - Instapay / Bank transfer
  - Vodafone Cash
  - ValU Installments
  - Transfer/contact WhatsApp number: `01037141322`
  - Screenshot confirmation instructions for Instapay and Vodafone Cash
- Admin order page:
  - Separate order detail page
  - Invoice with product images
  - Payment status and notes
  - Follow-up timeline
  - WhatsApp actions
- Product page improvements:
  - Size + weight labels
  - Buy It Now
  - Return/exchange policy
  - Shipping estimate updated to 4–7 business days
- Meta Pixel-ready tracking and social links.

## Deploy

```powershell
cd D:\nexora\Nexora
supabase link --project-ref ccmuazjkgzjqzybxwrfd
# Production-safe: push migrations only
supabase db push
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-supabase-functions.ps1 -ProjectRef ccmuazjkgzjqzybxwrfd
```

Then in Vercel: Redeploy → Clear Build Cache and Redeploy. Do not upload an old `dist` folder manually; always rebuild from this source or generate a fresh `dist`.

Required Vercel env:

```txt
VITE_SITE_URL=https://nexoraeg.vercel.app
VITE_SUPABASE_URL=https://ccmuazjkgzjqzybxwrfd.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_ANON_KEY
VITE_STORE_WHATSAPP=201037141322
VITE_SUPPORT_EMAIL=support@nexora.com
```
