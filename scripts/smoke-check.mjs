import fs from 'node:fs';

const required = [
  'src/App.tsx',
  'src/content/brand.ts',
  'src/lib/analytics/tracker.ts',
  'src/components/growth/PrivateListForm.tsx',
  'src/components/growth/FloatingWhatsApp.tsx',
  'src/components/growth/ConsentBanner.tsx',
  'src/pages/admin/AdminVisitors.tsx',
  'src/pages/admin/AdminLeads.tsx',
  'src/pages/admin/AdminCampaigns.tsx',
  'src/pages/admin/AdminReports.tsx',
  'supabase/functions/track-visitor-event/index.ts',
  'supabase/functions/capture-lead/index.ts',
  'supabase/functions/track-whatsapp-click/index.ts',
  'supabase/functions/studio-visitors/index.ts',
  'supabase/functions/studio-leads/index.ts',
  'supabase/functions/studio-campaigns/index.ts',
  'supabase/functions/studio-reports/index.ts',
  'supabase/migrations/0005_nexora_v5_2_growth_intelligence.sql',
  'V5_2_ULTIMATE_RELEASE_REPORT.md',
  'V5_2_ULTIMATE_DEPLOYMENT_GUIDE.md',
  'V5_2_ULTIMATE_QA_CHECKLIST.md',
];

let failed = false;
for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`Missing required V5.2 Ultimate file: ${file}`);
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

if (failed) process.exit(1);
console.log('NEXORA V5.2 Ultimate smoke check passed.');
