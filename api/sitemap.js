const SB_URL = 'https://jllasxulphugltnzjlcp.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsbGFzeHVscGh1Z2x0bnpqbGNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwOTgyMTcsImV4cCI6MjA5MzY3NDIxN30.n9p8GYQ-ndfg3mRA8CI7bqGHloFzdzfU2Q4JMwHpxJ0';

const STATIC_URLS = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' },
  { loc: '/services/electrician', priority: '0.95', changefreq: 'monthly' },
  { loc: '/services/solar', priority: '0.95', changefreq: 'monthly' },
  { loc: '/services/growth-systems', priority: '0.9', changefreq: 'monthly' },
  { loc: '/services/seo-electricians', priority: '0.9', changefreq: 'monthly' },
  { loc: '/services/seo-solar', priority: '0.9', changefreq: 'monthly' },
  { loc: '/services/marketing', priority: '0.9', changefreq: 'monthly' },
  { loc: '/services/marketing-solar', priority: '0.9', changefreq: 'monthly' },
  { loc: '/case-studies', priority: '0.85', changefreq: 'monthly' },
  { loc: '/faq', priority: '0.7', changefreq: 'monthly' },
  { loc: '/book-a-call', priority: '0.9', changefreq: 'monthly' },
  { loc: '/blog', priority: '0.8', changefreq: 'daily' },
  { loc: '/privacy-policy', priority: '0.3', changefreq: 'yearly' },
  { loc: '/terms-of-service', priority: '0.3', changefreq: 'yearly' },
  { loc: '/cookie-policy', priority: '0.3', changefreq: 'yearly' },
];

module.exports = async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const urls = STATIC_URLS.map(u =>
    `  <url><loc>https://zentra-co.com${u.loc}</loc><lastmod>${today}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
  );

  try {
    const r = await fetch(`${SB_URL}/rest/v1/blog_posts?select=slug,published_at&order=published_at.desc`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    if (r.ok) {
      const posts = await r.json();
      for (const p of posts) {
        const lastmod = (p.published_at || today).slice(0, 10);
        urls.push(`  <url><loc>https://zentra-co.com/blog/post/?slug=${encodeURIComponent(p.slug)}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`);
      }
    }
  } catch {
    // Supabase unreachable: still serve the static routes below
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(xml);
};
