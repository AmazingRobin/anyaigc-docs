const locales = ['zh', 'en', 'ko', 'ja', 'es', 'de'];

module.exports = {
  siteUrl: process.env.SITE_URL || 'https://docs.anyaigc.com',
  generateRobotsTxt: true,
  outDir: './out',
  generateIndexSitemap: true,
  sitemapSize: 5000,
  trailingSlash: false,
  exclude: ['*/_placeholder', '/admin*'],
  transform: async (config, path) => {
    if (path.includes('/_placeholder') || path.startsWith('/admin')) return null;
    let priority = 0.7;
    let changefreq = 'weekly';

    if (path === '/') {
      priority = 1.0;
      changefreq = 'daily';
    } else {
      const segments = path.split('/').filter(Boolean);
      if (segments.length === 1 && locales.includes(segments[0])) {
        priority = 0.9;
        changefreq = 'daily';
      }
    }

    return {
      loc: path,
      changefreq,
      priority,
      lastmod: new Date().toISOString(),
    };
  },
};
