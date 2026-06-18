# NEXORA V5.5 — Supabase Edge Functions Deploy

Run from project root:

```powershell
supabase link --project-ref ccmuazjkgzjqzybxwrfd
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-supabase-functions.ps1 -ProjectRef ccmuazjkgzjqzybxwrfd
```

V5.5 function list:

```txt
verify-studio-access
create-order
validate-coupon
track-order
studio-dashboard
studio-health-check
studio-products
studio-orders
studio-reviews
studio-drops
studio-coupons
studio-promotions
studio-settings
studio-audit-logs
studio-media-upload
studio-media-delete
track-visitor-event
capture-lead
track-whatsapp-click
studio-visitors
studio-leads
studio-customers
studio-campaigns
studio-reports
calculate-shipping
studio-shipping
create-shipment
track-shipment
```

After deployment, open:

```txt
/nexora-admin/controls
```

and run Launch Checklist.


## V5.5.1 additional function

```powershell
supabase functions deploy checkout-health-check
```
