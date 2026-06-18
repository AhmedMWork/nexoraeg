# Nexora Deployment Checklist

## Vercel

- `VITE_SITE_URL` = production domain
- `VITE_SUPABASE_URL` = `https://PROJECT_REF.supabase.co` with no `/rest/v1` or `/functions/v1`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = public anon/publishable key
- `VITE_STORE_WHATSAPP` = store WhatsApp number
- `VITE_SUPPORT_EMAIL` = support email

## Supabase Secrets

- `REQUIRE_STUDIO_PIN=true`
- `STUDIO_ACCESS_PIN=YOUR_PRIVATE_PIN`
- `STUDIO_SESSION_SECRET=LONG_RANDOM_SECRET`
- `ALLOWED_ORIGIN=https://your-production-domain.com`
- Optional: `SHIPBLU_API_KEY`

## Commands

```powershell
supabase link --project-ref ccmuazjkgzjqzybxwrfd
supabase db push
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-supabase-functions.ps1 -ProjectRef ccmuazjkgzjqzybxwrfd
```

Then redeploy Vercel with Clear Build Cache.
