# NEXORA V5.5 — Admin OS & CRM Intelligence Production Ready

NEXORA V5.5 is the production-ready Admin OS release for the Supabase-powered luxury commerce platform.

## Included

- React + Vite + TypeScript storefront.
- Supabase Database / Storage / Edge Functions.
- Hidden NEXORA HQ admin at `/nexora-admin`.
- Grouped Admin OS sidebar: Command, Catalog, Growth, Store.
- Today action inbox for orders, shipping, stock, catalog gaps, leads, and setup status.
- Controls / Launch Checklist page for diagnosing Edge Function and Supabase setup issues.
- Products HQ with setup metrics and server-side validation.
- Orders, inventory, shipping and ShipBlu framework from V5.4.
- Customer CRM profiles with tags, notes, order value and source/campaign fields.
- Leads CRM pipeline with follow-up tasks.
- Visitors, campaigns, analytics and reports.
- COD checkout with server-side shipping calculation.
- Arabic/English storefront foundation.

## Quick start

```powershell
npm config set registry https://registry.npmjs.org/
npm ci
npm run build
npm run dev
```

## Required Vercel environment variables

```env
VITE_SITE_URL=https://nexoraeg.vercel.app
VITE_SUPABASE_URL=https://ccmuazjkgzjqzybxwrfd.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_public_key
VITE_STORE_WHATSAPP=201xxxxxxxxx
VITE_SUPPORT_EMAIL=support@nexora.com
```

Important: `VITE_SUPABASE_URL` must be the project root only. Do not add `/rest/v1` or `/functions/v1`.

## Required Supabase secrets

```powershell
supabase secrets set REQUIRE_STUDIO_PIN=true
supabase secrets set STUDIO_ACCESS_PIN=YOUR_PRIVATE_PIN
supabase secrets set STUDIO_SESSION_SECRET=YOUR_LONG_RANDOM_SECRET
supabase secrets set ALLOWED_ORIGIN=https://nexoraeg.vercel.app
```

Optional ShipBlu:

```powershell
supabase secrets set SHIPBLU_API_KEY="YOUR_SHIPBLU_API_KEY"
```

Do not put Service Role Key in Vercel frontend variables.

## Deploy

Read:

- `V5_5_DEPLOYMENT_GUIDE.md`
- `V5_5_FINAL_RELEASE_REPORT.md`
- `V5_5_ADMIN_OS_QA_CHECKLIST.md`
