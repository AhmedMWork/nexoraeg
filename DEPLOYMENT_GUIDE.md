# Deployment Guide

## Required Runtime
Use Node 20.x on Vercel.

## Vercel Env
```env
VITE_SITE_URL=https://your-domain.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-public-key
VITE_STORE_WHATSAPP=201037141322
```

## Supabase
```bash
supabase db push
supabase functions deploy
```

At minimum deploy:
```bash
supabase functions deploy studio-workflow
supabase functions deploy submit-review
supabase functions deploy studio-reviews
supabase functions deploy studio-shipping
supabase functions deploy create-shipment
supabase functions deploy track-shipment
```

## ShipBlu Secrets
Set these in Supabase only when using ShipBlu live integration:
```bash
supabase secrets set SHIPBLU_API_KEY=...
supabase secrets set SHIPBLU_BASE_URL=https://api.shipblu.com
```

Manual shipment fallback works even when ShipBlu is not configured.
