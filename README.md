# NEXORA V5.5.1 — Light Admin + Checkout Stability + Supabase Recovery

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


## V5.5.2 Checkout Hotfix

This package includes a checkout database hotfix for Supabase projects that return `function gen_random_bytes(integer) does not exist` during order creation.

Apply it with:

```powershell
supabase db push
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-supabase-functions.ps1 -ProjectRef ccmuazjkgzjqzybxwrfd
```

No reset is required. The hotfix migration is:

```txt
supabase/migrations/0011_nexora_v5_5_2_pgcrypto_checkout_hotfix.sql
```

## V5.5.4 Hotfix Note

This package includes `0013_nexora_v5_5_4_uuid_defaults_studio_customers_hotfix.sql`, which fixes live Supabase projects where `studio-customers` or order/customer inserts fail with `function gen_random_bytes(integer) does not exist`.


## NEXORA V5.5.5 Recovery Stable Hotfix

This package focuses on live production recovery and stability:

- Replaces UUID defaults across public tables with `public.nexora_uuid_v5_5_5()` which has no pgcrypto or uuid-ossp dependency.
- Adds `0014_nexora_v5_5_5_recovery_stabilization.sql` to repair existing Supabase projects without resetting data.
- Makes `studio-customers` resilient: customer page can still load using order-derived fallback data if CRM refresh/table setup is temporarily broken.
- Normalizes `SUPABASE_URL` inside Edge Functions if a `/rest/v1` or `/functions/v1` suffix was accidentally saved as a secret.
- Keeps the V5.5.2 checkout order-number hotfix and V5.5.3 clean light admin reset.

Deploy without database reset:

```powershell
supabase link --project-ref ccmuazjkgzjqzybxwrfd
supabase db push
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-supabase-functions.ps1 -ProjectRef ccmuazjkgzjqzybxwrfd
```

If `db push` cannot be used, run the standalone SQL in:

```txt
supabase/hotfixes/FIX_V5_5_5_RECOVERY_STABILIZATION_STANDALONE.sql
```
