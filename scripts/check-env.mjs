const required = ['VITE_SITE_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'];

const missing = required.filter((key) => !process.env[key] || !String(process.env[key]).trim());

if (missing.length) {
  console.error(`Missing required public env vars: ${missing.join(', ')}`);
  console.error('Add them to Vercel Environment Variables before deploying Nexora.');
  process.exit(1);
}

try {
  const siteUrl = new URL(process.env.VITE_SITE_URL);
  if (!['http:', 'https:'].includes(siteUrl.protocol)) {
    throw new Error('VITE_SITE_URL must start with http:// or https://');
  }
} catch {
  console.error('VITE_SITE_URL must be a valid absolute URL, for example https://nexoraeg.vercel.app');
  process.exit(1);
}

try {
  const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '').trim();
  const url = new URL(supabaseUrl);
  const invalidSuffix = ['/rest/v1', '/functions/v1', '/auth/v1'].find((part) => supabaseUrl.includes(part));
  if (invalidSuffix) {
    console.error(`VITE_SUPABASE_URL is wrong: remove ${invalidSuffix}.`);
    console.error('Correct format: https://ccmuazjkgzjqzybxwrfd.supabase.co');
    process.exit(1);
  }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) {
    console.error('VITE_SUPABASE_URL must be the Supabase project root, for example https://ccmuazjkgzjqzybxwrfd.supabase.co');
    process.exit(1);
  }
} catch {
  console.error('VITE_SUPABASE_URL must be a valid absolute URL, for example https://ccmuazjkgzjqzybxwrfd.supabase.co');
  process.exit(1);
}

console.log('Required Nexora public env vars are valid.');
