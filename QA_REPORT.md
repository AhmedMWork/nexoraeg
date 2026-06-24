# QA Report

## Automated Checks

```bash
npm run lint
npm run typecheck
npm run v5:audit
npm run smoke
npm run build
```

All completed successfully in the build environment.

## Build Note
The sitemap generator could not fetch dynamic product routes with placeholder Supabase env values. This is expected outside a real staging/production environment and did not fail the build.

## Staging Checklist
- Apply migration `0022_admin_command_center_workflow_reviews_shipping.sql`.
- Deploy new functions `studio-workflow` and `submit-review`.
- Redeploy updated `studio-reviews` and `studio-shipping`.
- Test one customer site review.
- Test one customer product review.
- Approve the review from admin.
- Edit order statuses from Workflow.
- Save a follow-up and verify latest activity appears at top.
- Test Create Shipment with ShipBlu configured.
- Test Manual Shipment fallback without ShipBlu.
