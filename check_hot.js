import * as cheerio from 'cheerio';

const BASE = 'https://dualeotruyencw.com';

async function testHotPages() {
  const pages = ['/truyen-tranh-hot', '/top-ngay', '/top-tuan', '/top-thang'];
  for (const p of pages) {
    console.log(`\n=== PAGE: ${p} ===`);
    try {
      const html = await fetch(`${BASE}${p}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.text());
      const $ = cheerio.load(html);
      const items = [];
      $('a[href*="/truyen-tranh/"]').each((_, a) => {
        const href = $(a).attr('href');
        if (!href || /\/chapter-/i.test(href)) return;
        const slug = href.match(/\/truyen-tranh\/([^/?#]+)/)?.[1];
        if (!slug) return;
        const title = $(a).attr('title')?.trim() || $(a).find('img').attr('alt')?.trim() || $(a).find('h3, h2, .title').text().trim();
        const views = $(a).closest('.item, .row, li, tr').find('.view, .views, .eye, span:contains("Lượt xem")').text().trim();
        if (title && !items.some(x => x.slug === slug)) {
          items.push({ slug, title, views, href });
        }
      });
      console.log(`Found ${items.length} items on ${p}:`);
      items.slice(0, 8).forEach((it, idx) => {
        console.log(`  #${idx + 1}: ${it.title} (${it.slug}) [views: ${it.views || 'N/A'}]`);
      });
    } catch (e) {
      console.error('Error on', p, e.message);
    }
  }
}

testHotPages();
