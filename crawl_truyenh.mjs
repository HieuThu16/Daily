import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';

// Usage: node crawl_truyenh.mjs [STORY_OR_CHAPTER_URL]
// e.g.: node crawl_truyenh.mjs https://metruyen18.app/truyen/mot-buoc-len-may/chapter-1
// e.g.: node crawl_truyenh.mjs https://metruyen18.app/truyen/mot-buoc-len-may

let inputUrl = process.argv[2] || 'https://metruyen18.app/truyen/mot-buoc-len-may';

// Normalize chapter-1 url to story url
const chapterMatch = inputUrl.match(/^(https?:\/\/[^\/]+\/truyen\/[^\/]+)\/chapter-\d+/i);
if (chapterMatch) {
  inputUrl = chapterMatch[1];
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchWithRetry(url, referer, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          ...(referer ? { 'Referer': referer } : {})
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function crawlStory(storyUrl) {
  console.log('===> Crawling story:', storyUrl);
  const html = await fetchWithRetry(storyUrl);
  const $ = cheerio.load(html);

  const urlObj = new URL(storyUrl);
  const slug = urlObj.pathname.split('/').filter(Boolean).pop() || 'truyen-h';

  const title = $('h1').first().text().trim() 
    || $('meta[property="og:title"]').attr('content')?.replace(/HentaiVN.*/i, '').trim()
    || slug.replace(/-/g, ' ');
  
  const cover = $('meta[property="og:image"]').attr('content') 
    || $('.thumb img, .story-thumb img, .tab-summary img').attr('src') || '';
  
  const description = $('.story-description, .desc, .summary, .detail-content, .story-detail-info, .description-summary').text().trim() 
    || $('meta[name="description"]').attr('content') || '';
  
  let author = 'Ðang c?p nh?t';
  let status = 'Ðang ti?n hành';
  const genres = ['Hentai', 'Manhwa', '18+'];

  $('a[href*="/the-loai/"], a[href*="/the-loai-truyen/"], a[href*="/genres/"], a.hashtag').each((_, el) => {
    const g = $(el).text().trim().replace(/^#/, '');
    if (g && !genres.includes(g)) genres.push(g);
  });

  $('li, tr, div, p').each((_, el) => {
    const text = $(el).text();
    if ((text.includes('Tác gi?') || text.includes('Author')) && author === 'Ðang c?p nh?t') {
      const val = $(el).find('a, span, td').last().text().trim();
      if (val && val !== 'Tác gi?') author = val;
    }
    if ((text.includes('T?nh tr?ng') || text.includes('Tr?ng thái') || text.includes('Status')) && status === 'Ðang ti?n hành') {
      const val = $(el).find('a, span, td').last().text().trim();
      if (val && !val.includes('T?nh tr?ng')) status = val;
    }
  });

  const rawChapters = [];
  const searchPattern = `/truyen/${slug}/chapter-`;
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes(searchPattern) || href.includes(`/chapter-`)) {
      const match = href.match(/chapter-(\d+(\.\d+)?)/i);
      if (match && (href.includes(slug) || !href.includes('/truyen/'))) {
        const num = parseFloat(match[1]);
        if (!rawChapters.some(c => c.number === num)) {
          rawChapters.push({
            number: num,
            name: `Chapter ${num}`,
            url: href.startsWith('http') ? href : `https://metruyen18.app${href}`
          });
        }
      }
    }
  });

  rawChapters.sort((a, b) => a.number - b.number);
  console.log(`Found ${rawChapters.length} chapters for "${title}". Fetching chapter images...`);

  const chaptersWithImages = [];
  const CONCURRENCY = 5;
  for (let i = 0; i < rawChapters.length; i += CONCURRENCY) {
    const chunk = rawChapters.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(async (ch) => {
      try {
        const chHtml = await fetchWithRetry(ch.url, storyUrl);
        const ch$ = cheerio.load(chHtml);
        const images = [];
        ch$('img').each((_, imgEl) => {
          let src = ch$(imgEl).attr('data-src') || ch$(imgEl).attr('data-original') || ch$(imgEl).attr('data-cdn') || ch$(imgEl).attr('src');
          if (src) {
            src = src.trim();
            if ((src.includes('/dcn/') || src.includes('/images/') || src.includes('chapter') || src.includes('mbpro.vip') || src.includes('.jpg') || src.includes('.png') || src.includes('.webp')) 
                && !src.includes('loading') && !src.includes('logo') && !src.includes('banner') && !src.includes('avatar') && !src.includes('icon')) {
              if (!images.some(img => img.url === src)) {
                images.push({
                  url: src,
                  alt: `Trang ${images.length + 1}`,
                  index: images.length + 1
                });
              }
            }
          }
        });
        console.log(`  ? Chapter ${ch.number}: ${images.length} pages`);
        return {
          ...ch,
          images
        };
      } catch (err) {
        console.error(`  ? Error chapter ${ch.number}:`, err.message);
        return {
          ...ch,
          images: []
        };
      }
    }));
    chaptersWithImages.push(...results);
  }

  const mangaObj = {
    slug,
    title,
    cover,
    description,
    author,
    status,
    genres,
    url: storyUrl,
    source: 'metruyen18',
    sourceName: 'Mê Truy?n 18',
    updatedAt: new Date().toISOString(),
    totalChapters: chaptersWithImages.length,
    chapters: chaptersWithImages
  };

  const outPath = path.resolve('public/data/h_manga.json');
  let allManga = [mangaObj];
  try {
    const existing = JSON.parse(await fs.readFile(outPath, 'utf8'));
    if (Array.isArray(existing)) {
      const idx = existing.findIndex(m => m.slug === mangaObj.slug);
      if (idx >= 0) {
        existing[idx] = mangaObj;
        allManga = existing;
      } else {
        allManga = [mangaObj, ...existing];
      }
    }
  } catch {}

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(allManga, null, 2), 'utf8');

  // Also sync to dist/data if dist exists
  const distPath = path.resolve('dist/data/h_manga.json');
  try {
    await fs.mkdir(path.dirname(distPath), { recursive: true });
    await fs.writeFile(distPath, JSON.stringify(allManga, null, 2), 'utf8');
  } catch {}

  console.log(`\n?? DONE! Saved "${title}" (${chaptersWithImages.length} chapters) to ${outPath}`);
}

crawlStory(inputUrl).catch(console.error);
