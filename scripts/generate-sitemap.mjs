import fs from 'node:fs';
import path from 'node:path';

const rawSiteUrl = process.env.VITE_SITE_URL;

if (!rawSiteUrl || !String(rawSiteUrl).trim()) {
  console.error('VITE_SITE_URL is required to generate sitemap.xml.');
  console.error('Set VITE_SITE_URL in Vercel to the final production domain, for example https://yourdomain.com');
  process.exit(1);
}

let siteUrl;
try {
  siteUrl = new URL(rawSiteUrl);
} catch (error) {
  console.error('VITE_SITE_URL must be a valid absolute URL.');
  process.exit(1);
}

const baseUrl = siteUrl.toString().replace(/\/$/, '');
const routes = ['/', '/shop', '/shop/men', '/shop/women', '/shop/unisex', '/limited', '/reviews', '/contact', '/track'];

function url(loc, priority = '0.7', changefreq = 'weekly') {
  return `  <url>\n    <loc>${baseUrl}${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((route, index) => url(route, index === 0 ? '1.0' : '0.8')).join('\n')}\n</urlset>\n`;

const publicDir = path.join(process.cwd(), 'public');
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), xml);

const robots = `User-agent: *\nAllow: /\nDisallow: /nexora-admin/\nDisallow: /studio/\nDisallow: /admin/\n\nSitemap: ${baseUrl}/sitemap.xml\n`;
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots);

console.log(`Generated sitemap.xml and robots.txt for ${baseUrl}`);
