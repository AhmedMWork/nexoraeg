# NEXORA Experience & Operations Upgrade

## Summary
This package upgrades the current NEXORA source into a more premium, clearer, and more operationally focused store experience.

The work focused on five production-facing goals:

1. Make the admin panel fully English and more professional.
2. Make checkout clearer, easier to understand, and visually stronger.
3. Add a lightweight premium motion system without hurting performance.
4. Keep the footer cleaner with a stronger WhatsApp action and no TikTok.
5. Simplify daily operations pages, especially Orders, Order Detail, Controls, and Shipping.

## Major customer-facing improvements

### Checkout clarity
- Checkout now has clearer bilingual copy.
- English checkout copy is no longer vague or mixed with Arabic.
- Arabic checkout copy is clearer and more step-by-step.
- Payment cards now explain the next action for each method:
  - Cash on Delivery: no transfer needed.
  - Instapay: transfer then send screenshot.
  - Vodafone Cash: send screenshot with amount/reference visible.
  - ValU: no transfer before manual team confirmation.
- The final order summary now uses higher-contrast brand surfaces.
- A trust strip was added to highlight WhatsApp confirmation, clear totals, and easy order updates.
- COD fee logic remains protected: COD fees apply only to COD orders.

### Motion and visual polish
- Added a lightweight motion system in `src/lib/motion.ts`.
- Added CSS utilities for soft reveal, hover lift, button press, and premium checkout card entrance.
- Added global `prefers-reduced-motion` support.
- Improved footer WhatsApp visual hierarchy.
- Kept brand colors and premium NEXORA identity intact.

### Footer
- TikTok remains removed.
- WhatsApp now appears as the primary social action.
- WhatsApp link keeps language-aware messages.
- Social icons are more consistent and premium.

## Admin improvements

### Fully English admin UI
The visible admin interface was converted to English across the operational areas:
- Admin layout/header/sidebar.
- Dashboard readiness copy.
- Orders page.
- Order Detail page.
- Controls / Store Readiness.
- Shipping page.
- Campaigns page.
- Reports page.

Arabic storefront fields are still supported where they are part of customer-facing bilingual content management.

### Orders and order editing
- Orders table labels/actions are English.
- Payment labels and statuses use English in admin.
- Order Detail follow-up labels are English.
- Existing order editing flow remains available from Order Detail.
- Order edit history support from the previous migration remains intact.

### Shipping simplification
- Shipping page is now English and easier to scan.
- The page is organized around:
  - Status cards.
  - General settings.
  - Add/edit zone.
  - Zones table.
  - Recent shipments.
- Technical courier details are present only where needed.

### Store Readiness / Controls
- Environment keys are not shown directly to admin users.
- Technical labels are normalized into user-friendly connection/readiness messages.
- Payments, integrations, privacy, and recovery are organized into English tabs.

## Database / Supabase
Added migration:

`supabase/migrations/0021_experience_admin_english_motion.sql`

It safely updates follow-up type labels to English and reinforces useful indexes for follow-ups and order edit history.

## QA results
Executed successfully:

```bash
npm ci
npm run lint
npm run typecheck
npm run v5:audit
npm run smoke
npm run build
```

Build completed successfully with placeholder public env values. The build generated a warning that dynamic product sitemap routes could not be fetched with placeholder Supabase credentials; this is expected outside the real production/staging environment.

## Deployment notes
Use Node 20.x on Vercel.

Required public env vars:

```env
VITE_SITE_URL=https://your-production-domain.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_REAL_SUPABASE_KEY
VITE_STORE_WHATSAPP=201037141322
```

Before production, deploy to staging and run:

```bash
supabase db push
supabase functions deploy
```

Then test:
- Checkout in Arabic and English.
- COD / Instapay / Vodafone Cash / ValU.
- Admin Orders.
- Admin Order Detail edit flow.
- Shipping settings.
- Store Readiness checks.

## Package policy
The final ZIP is source-ready and intentionally excludes:
- `node_modules`
- `dist`
- `.git`
- `.env`
- logs/cache files
