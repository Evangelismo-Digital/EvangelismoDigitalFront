import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const siteUrl = 'https://www.findhope.digital';
const articlesDir = path.resolve(__dirname, '../src/articleContent/articlesData');

async function generateSitemap() {
  const urls: Array<{
    loc: string;
    lastmod: string;
    changefreq: string;
    priority: number;
  }> = [];
  
  // Homepage
  urls.push({
    loc: siteUrl,
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'weekly',
    priority: 1.0,
  });

  urls.push({
    loc: `${siteUrl}/privacidade`,
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'yearly',
    priority: 0.3,
  });

  // Auto-discover all article files
  const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.ts'));

  for (const file of files) {
    const articleId = file.replace('.ts', '');
    
    try {
      const filePath = path.join(articlesDir, file);
      const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;
      const module = await import(fileUrl);
      const article = module.default;

      if (article?.dateModified) {
        urls.push({
          loc: `${siteUrl}/artigo/${articleId}`,
          lastmod: article.dateModified.toISOString().split('T')[0],
          changefreq: 'monthly',
          priority: 0.8,
        });
      }
    } catch (error: unknown) {
      console.error(`❌ Error loading ${articleId}:`, (error as Error).message);
    }
  }

  // Generate XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  urls.forEach((url) => {
    xml += '  <url>\n';
    xml += `    <loc>${url.loc}</loc>\n`;
    xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
    xml += `    <priority>${url.priority}</priority>\n`;
    xml += '  </url>\n';
  });

  xml += '</urlset>';

  // Write sitemap
  const outputPath = path.resolve(__dirname, '../public/sitemap.xml');
  fs.writeFileSync(outputPath, xml, 'utf-8');

  console.log('✅ Sitemap generated successfully!');
  console.log(`📄 Total URLs: ${urls.length}`);
  urls.forEach(url => console.log(`   - ${url.loc} (${url.lastmod})`));
}

generateSitemap();