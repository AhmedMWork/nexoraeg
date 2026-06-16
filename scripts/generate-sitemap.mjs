import fs from 'node:fs';
import path from 'node:path';

const rawSiteUrl = process.env.VITE_SITE_URL;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!rawSiteUrl || !String(rawSiteUrl).trim()) {
  console.error('VITE_SITE_URL is required to generate sitemap.xml.');
  console.error('Set VITE_SITE_URL in Vercel to the final production domain, for example https://yourdomain.com');
  process.exit(1);
}

let siteUrl;
try {
  siteUrl = new URL(rawSiteUrl);
} catch {
  console.error('VITE_SITE_URL must be a valid absolute URL.');
  process.exit(1);
}

const baseUrl = siteUrl.toString().replace(/\/$/, '');
const staticRoutes = ['/', '/shop', '/shop/men', '/shop/women', '/shop/unisex', '/limited', '/reviews', '/contact', '/track', '/info/about', '/info/shipping-returns', '/info/faq'];

async function fetchProductRoutes() {
  if (!supabaseUrl || !supabaseKey) return [];
  try {
    const endpoint = `${String(supabaseUrl).replace(/\/$/, '')}/rest/v1/products?select=slug,updated_at,status&status=in.(active,sold_out)&order=updated_at.desc`;
    const response = await fetch(endpoint, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });
    if (!response.ok) throw new Error(`Supabase products request failed: ${response.status}`);
    const products = await response.json();
    return products
      .filter((product) => product?.slug)
      .map((product) => ({ loc: `/product/${product.slug}`, lastmod: product.updated_at }));
  } catch (error) {
    console.warn(`Could not add dynamic product routes to sitemap: ${error instanceof Error ? error.message : 'unknown error'}`);
    return [];
  }
}

function xmlUrl({ loc, priority = '0.7', changefreq = 'weekly', lastmod }) {
  return `  <url>\n    <loc>${baseUrl}${loc}</loc>\n    ${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>\n    ` : ''}<changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

const productRoutes = await fetchProductRoutes();
const routes = [
  ...staticRoutes.map((loc, index) => ({ loc, priority: index === 0 ? '1.0' : '0.8', changefreq: loc.startsWith('/info') ? 'monthly' : 'weekly' })),
  ...productRoutes.map((route) => ({ ...route, priority: '0.9', changefreq: 'daily' })),
];

const uniqueRoutes = Array.from(new Map(routes.map((route) => [route.loc, route])).values());
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${uniqueRoutes.map(xmlUrl).join('\n')}\n</urlset>\n`;

const publicDir = path.join(process.cwd(), 'public');
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), xml);

const robots = `User-agent: *\nAllow: /\nDisallow: /nexora-admin/\nDisallow: /studio/\nDisallow: /admin/\n\nSitemap: ${baseUrl}/sitemap.xml\n`;
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots);

console.log(`Generated sitemap.xml and robots.txt for ${baseUrl} (${uniqueRoutes.length} routes, ${productRoutes.length} products).`);
