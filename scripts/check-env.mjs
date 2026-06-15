const required = ['VITE_SITE_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'];

const missing = required.filter((key) => !process.env[key] || !String(process.env[key]).trim());

if (missing.length) {
  console.error(`Missing required public env vars: ${missing.join(', ')}`);
  console.error('Add them to Vercel Environment Variables before deploying NEXORA V5.');
  process.exit(1);
}

try {
  const siteUrl = new URL(process.env.VITE_SITE_URL);
  if (!['http:', 'https:'].includes(siteUrl.protocol)) {
    throw new Error('VITE_SITE_URL must start with http:// or https://');
  }
} catch (error) {
  console.error('VITE_SITE_URL must be a valid absolute URL, for example https://yourdomain.com');
  process.exit(1);
}

console.log('Required NEXORA public env vars are present.');
