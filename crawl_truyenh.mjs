import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';

// Usage: node crawl_truyenh.mjs [URL]
// Supports both metruyen18.app and vietmanhwa.com

let inputUrl = process.argv[2] || 'https://vietmanhwa.com/manhwa-18/toi-duoc-giao-nhiem-vu-dit-het-gai-chung-cu';

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
  throw new Error('Fetch failed');
}

async function crawlVietManhwaStory(inputUrl) {
  let storyUrl = inputUrl.trim();
  const chapMatch = storyUrl.match(/^(https?:\/\/[^\/]+\/manhwa-18\/[^\/]+)\/chap(?:ter)?-\d+/i);
  if (chapMatch) storyUrl = chapMatch[1];

  const slug = storyUrl.split('/').filter(Boolean).pop() || 'vietmanhwa';

  console.log('===> Crawling VietManhwa story:', storyUrl);
  const html = await fetchWithRetry(storyUrl);
  const $ = cheerio.load(html);

  const title = $('h1').first().text().trim() 
    || $('title').text().replace(/[-|].*$/, '').trim() 
    || slug.replace(/-/g, ' ');
  
  const cover = $('meta[property="og:image"]').attr('content') 
    || $('img[src*="images-story"]').attr('src') || '';
  
  let description = '';
  $('p, div').each((_, el) => {
    const t = $(el).text().trim();
    if (t.length > 50 && !t.includes('window.') && !description) {
      description = t;
    }
  });

  const rawChapters = [];
  $('a[href*="/chap-"], a[href*="/chapter-"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes(slug) || !href.includes('/manhwa-18/')) {
      const match = href.match(/chap(?:ter)?-(\d+(\.\d+)?)/i);
      if (match) {
        const num = parseFloat(match[1]);
        if (!rawChapters.some(c => c.number === num)) {
          rawChapters.push({
            number: num,
            name: `Chapter ${num}`,
            url: href.startsWith('http') ? href : `https://vietmanhwa.com${href}`
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
        const matches = [...chHtml.matchAll(/(https?:\/\/cdn\.vietmanhwa\.com\/manga-images\/[a-zA-Z0-9_\-./]+|\/manga-images\/[a-zA-Z0-9_\-./]+)/gi)];
        const urls = [...new Set(matches.map(m => m[1].startsWith('http') ? m[1] : `https://cdn.vietmanhwa.com${m[1]}`))];
        
        const images = urls.map((imgUrl, idx) => ({
          url: imgUrl,
          alt: `Trang ${idx + 1}`,
          index: idx + 1
        }));

        console.log(`  ✓ Chapter ${ch.number}: ${images.length} pages`);
        return { ...ch, images };
      } catch (err) {
        console.error(`  ✗ Error chapter ${ch.number}:`, err.message);
        return { ...ch, images: [] };
      }
    }));
    chaptersWithImages.push(...results);
  }

  return {
    slug,
    title,
    cover,
    description,
    author: 'Đang cập nhật',
    status: 'Đang tiến hành',
    genres: ['Hentai', 'Manhwa', '18+'],
    url: storyUrl,
    source: 'vietmanhwa',
    sourceName: 'Việt Manhwa',
    updatedAt: new Date().toISOString(),
    totalChapters: chaptersWithImages.length,
    chapters: chaptersWithImages
  };
}

async function crawlMetruyen18Story(inputUrl) {
  let storyUrl = inputUrl.trim();
  const chapterMatch = storyUrl.match(/^(https?:\/\/[^\/]+\/truyen\/[^\/]+)\/chapter-\d+/i);
  if (chapterMatch) storyUrl = chapterMatch[1];

  const slug = storyUrl.split('/').filter(Boolean).pop() || 'truyen-h';

  console.log('===> Crawling MeTruyen18 story:', storyUrl);
  const html = await fetchWithRetry(storyUrl);
  const $ = cheerio.load(html);

  const title = $('h1').first().text().trim() 
    || $('meta[property="og:title"]').attr('content')?.replace(/HentaiVN.*/i, '').trim()
    || slug.replace(/-/g, ' ');
  
  const cover = $('meta[property="og:image"]').attr('content') 
    || $('.thumb img, .story-thumb img, .tab-summary img').attr('src') || '';
  
  const description = $('.story-description, .desc, .summary, .detail-content, .story-detail-info, .description-summary').text().trim() 
    || $('meta[name="description"]').attr('content') || '';
  
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
        console.log(`  ✓ Chapter ${ch.number}: ${images.length} pages`);
        return { ...ch, images };
      } catch (err) {
        console.error(`  ✗ Error chapter ${ch.number}:`, err.message);
        return { ...ch, images: [] };
      }
    }));
    chaptersWithImages.push(...results);
  }

  return {
    slug,
    title,
    cover,
    description,
    author: 'Đang cập nhật',
    status: 'Đang tiến hành',
    genres: ['Hentai', 'Manhwa', '18+'],
    url: storyUrl,
    source: 'metruyen18',
    sourceName: 'Mê Truyện 18',
    updatedAt: new Date().toISOString(),
    totalChapters: chaptersWithImages.length,
    chapters: chaptersWithImages
  };
}

async function run() {
  const isVietManhwa = inputUrl.includes('vietmanhwa.com');
  const mangaObj = isVietManhwa ? await crawlVietManhwaStory(inputUrl) : await crawlMetruyen18Story(inputUrl);

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

  console.log(`\n🎉 DONE! Saved "${mangaObj.title}" (${mangaObj.chapters.length} chapters) to ${outPath}`);
}

run().catch(console.error);
