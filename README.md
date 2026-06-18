# Nexora

Production-ready Nexora storefront and admin package.

## Deploy

1. Add Vercel environment variables from `.env.example`.
2. Link Supabase:

```powershell
supabase link --project-ref ccmuazjkgzjqzybxwrfd
```

3. Push database migrations:

```powershell
supabase db push
```

4. Deploy Edge Functions:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-supabase-functions.ps1 -ProjectRef ccmuazjkgzjqzybxwrfd
```

5. Redeploy on Vercel with Clear Build Cache.

Do not put the Supabase service role key in Vercel.
