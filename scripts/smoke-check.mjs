import fs from 'node:fs';

const required = [
  'src/App.tsx',
  'src/content/brand.ts',
  'src/components/ui/SizeGuideModal.tsx',
  'src/components/ui/TrustStrip.tsx',
  'src/components/ui/FreeShippingProgress.tsx',
  'supabase/functions/studio-audit-logs/index.ts',
  'supabase/migrations/0004_nexora_v5_1_commerce_ops.sql',
  'V5_1_RELEASE_REPORT.md',
  'V5_1_QA_CHECKLIST.md',
  'V5_1_DEPLOYMENT_GUIDE.md',
];

let failed = false;
for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`Missing required V5.1 file: ${file}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('NEXORA V5.1 smoke check passed.');
