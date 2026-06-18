import fs from 'node:fs';

const required = [
  'src/App.tsx',
  'src/pages/admin/AdminStorefront.tsx',
  'src/pages/admin/AdminInventory.tsx',
  'src/content/brand.ts',
  'src/lib/analytics/tracker.ts',
  'src/components/growth/PrivateListForm.tsx',
  'src/components/growth/FloatingWhatsApp.tsx',
  'src/components/growth/ConsentBanner.tsx',
  'src/pages/admin/AdminVisitors.tsx',
  'src/pages/admin/AdminLeads.tsx',
  'src/pages/admin/AdminCampaigns.tsx',
  'src/pages/admin/AdminReports.tsx',
  'supabase/functions/create-order/index.ts',
  'supabase/functions/studio-products/index.ts',
  'supabase/functions/track-visitor-event/index.ts',
  'supabase/functions/capture-lead/index.ts',
  'supabase/functions/track-whatsapp-click/index.ts',
  'supabase/functions/studio-visitors/index.ts',
  'supabase/functions/studio-leads/index.ts',
  'supabase/functions/studio-campaigns/index.ts',
  'supabase/functions/studio-reports/index.ts',
  'supabase/migrations/0005_nexora_v5_2_growth_intelligence.sql',
  'supabase/migrations/0006_nexora_v5_2_1_storefront_inventory_reports.sql',
  'supabase/migrations/0007_nexora_v5_3_commerce_correctness.sql',
  'V5_3_FINAL_RELEASE_REPORT.md',
  'V5_3_DEPLOYMENT_GUIDE.md',
  'V5_3_QA_CHECKLIST.md',
];

let failed = false;
for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`Missing required V5.3 file: ${file}`);
    failed = true;
  }
}

const constants = fs.readFileSync('src/lib/constants.ts', 'utf8');
for (const forbidden of ['/nexora-admin/settings', '/nexora-admin/system-health', '/nexora-admin/audit-logs']) {
  if (constants.includes(forbidden)) {
    console.error(`Forbidden sidebar route still present: ${forbidden}`);
    failed = true;
  }
}

const app = fs.readFileSync('src/App.tsx', 'utf8');
if (!app.includes('AdminStorefront') || !app.includes('path="/storefront"')) {
  console.error('Admin storefront route is not registered.');
  failed = true;
}

const vercel = fs.readFileSync('vercel.json', 'utf8');
if (!vercel.includes('/nexora-admin/(.*)')) {
  console.error('Vercel admin SPA rewrite is missing.');
  failed = true;
}

const secrets = fs.readFileSync('scripts/set-supabase-secrets.ps1', 'utf8');
if (secrets.includes('SUPABASE_SERVICE_ROLE_KEY') && secrets.includes('secrets set SUPABASE_SERVICE_ROLE_KEY')) {
  console.error('set-supabase-secrets.ps1 still tries to set reserved SUPABASE_SERVICE_ROLE_KEY.');
  failed = true;
}

if (failed) process.exit(1);
console.log('NEXORA V5.3 smoke check passed.');
