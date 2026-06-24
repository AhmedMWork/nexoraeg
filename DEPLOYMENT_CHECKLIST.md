# Nexora Deployment Checklist

1. Confirm Vercel env variables are set.
2. Reset Supabase only if there is no live data.
3. Run migrations.
4. Deploy Edge Functions.
5. Clear Vercel build cache and redeploy.
6. Clear browser storage and test fresh checkout.

## Required tests

- Product page opens on mobile.
- Size + weight labels show correctly.
- Add to cart works.
- Buy It Now works.
- Checkout COD works.
- Checkout Instapay / Bank transfer works and shows screenshot instructions.
- Checkout Vodafone Cash works and shows screenshot instructions.
- Checkout ValU works and saves pending confirmation.
- Admin Orders opens.
- Admin separate order detail page opens.
- Invoice shows product images.
- Follow-up log saves Sent / متابعة 2 / Paid / ShipBlu.
- Storefront page can add, hide, delete, reorder tiles up to max 5.
- Facebook/Instagram links open correctly.
- Meta Pixel can be saved in Controls.
