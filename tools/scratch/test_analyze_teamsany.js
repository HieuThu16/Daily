import { execFileSync } from 'child_process';
import * as cheerio from 'cheerio';

function fetchPage(url) {
  try {
    const out = execFileSync('curl.exe', [
      '-s', '-L',
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '-H', 'Referer: https://teamsany.com/',
      url
    ], { encoding: 'utf-8', maxBuffer: 15 * 1024 * 1024, timeout: 20000 });
    return out;
  } catch (err) {
    console.error(`Failed to fetch ${url}:`, err.message);
    return null;
  }
}

async function analyzeAll() {
  console.log('--- Analyzing Teamsany.com ---');
  
  // Test pages from 1 to 15 to find total pages
  const allMangaMap = new Map();

  for (let p = 1; p <= 15; p++) {
    const url = p === 1 ? 'https://teamsany.com/' : `https://teamsany.com/page/${p}/`;
    const html = fetchPage(url);
    if (!html) break;

    const $ = cheerio.load(html);
    let pageCount = 0;
    
    // Selectors for manga items
    $('.listupd .bs, .bsx, .page-item-detail').each((_, el) => {
      const a = $(el).find('a').first();
      const href = a.attr('href');
      const title = $(el).find('.tt, .post-title, .title, h4, h3').first().text().trim() || a.attr('title');
      const img = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src');
      const latestChap = $(el).find('.epxs, .chapter, .adds').first().text().trim();
      const rating = $(el).find('.numscore, .rating').text().trim();

      if (href && href.includes('/manga/')) {
        const slug = href.replace(/^https?:\/\/teamsany\.com\/manga\//, '').replace(/\/$/, '');
        if (slug && !allMangaMap.has(slug)) {
          allMangaMap.set(slug, {
            slug,
            title,
            url: href,
            cover: img,
            latestChap,
            rating,
            sourcePage: p
          });
          pageCount++;
        }
      }
    });

    console.log(`Page ${p}: found ${pageCount} new mangas (Total accumulated: ${allMangaMap.size})`);
    if (pageCount === 0) {
      console.log(`No more items on page ${p}, stopping pagination.`);
      break;
    }
  }

  console.log(`\nTotal unique mangas found across all pages: ${allMangaMap.size}`);
  const list = Array.from(allMangaMap.values());
  console.log('\nSample 5 mangas:', JSON.stringify(list.slice(0, 5), null, 2));

  // Now test parsing a detail page in full
  if (list.length > 0) {
    const sample = list[0];
    console.log(`\n--- Testing full detail parsing for: ${sample.title} (${sample.url}) ---`);
    const detailHtml = fetchPage(sample.url);
    if (detailHtml) {
      const $d = cheerio.load(detailHtml);
      const title = $d('h1.entry-title').text().trim() || sample.title;
      const cover = $d('.thumb img').attr('src') || $d('.thumb img').attr('data-src') || sample.cover;
      const desc = $d('.entry-content, .description-summary, .summary__content').text().trim();
      const genres = [];
      $d('.genres-content a, .mgen a, .seriestugenre a').each((_, a) => {
        const g = $d(a).text().trim();
        if (g) genres.push(g);
      });

      let status = '';
      let author = '';
      let artist = '';
      $d('.tsinfo .imptdt, .spe span, .infox .spe').each((_, el) => {
        const text = $d(el).text().trim();
        if (text.includes('Tình Trạng') || text.includes('Status')) {
          status = text.replace(/Tình Trạng|Status|:/gi, '').trim();
        }
        if (text.includes('Tác Giả') || text.includes('Author')) {
          author = text.replace(/Tác Giả|Author|:/gi, '').trim();
        }
        if (text.includes('Họa sĩ') || text.includes('Artist')) {
          artist = text.replace(/Họa sĩ|Artist|:/gi, '').trim();
        }
      });

      const chapters = [];
      $d('#chapterlist li, .eplister li, .bxcl li, .cl li').each((_, el) => {
        const chapA = $d(el).find('a').first();
        const chapUrl = chapA.attr('href');
        const chapName = $d(el).find('.chapternum, .eph-num, .lch').text().trim() || chapA.text().trim();
        const chapDate = $d(el).find('.chapterdate, .date').text().trim();
        
        // Extract chapter number from chapName or url
        let chapNum = null;
        const numMatch = (chapName + ' ' + (chapUrl || '')).match(/chap(?:ter)?[\s\-_]*(\d+(?:\.\d+)?)/i) || chapName.match(/(\d+(?:\.\d+)?)/);
        if (numMatch) {
          chapNum = parseFloat(numMatch[1]);
        }

        if (chapUrl) {
          chapters.push({
            number: chapNum,
            name: chapName,
            url: chapUrl,
            date: chapDate
          });
        }
      });

      console.log('Parsed Detail:', {
        title,
        cover,
        status,
        author,
        artist,
        genres,
        descLen: desc.length,
        chaptersCount: chapters.length,
        firstChap: chapters[0],
        lastChap: chapters[chapters.length - 1]
      });

      if (chapters.length > 0) {
        const testChap = chapters[chapters.length - 1];
        console.log(`\n--- Testing chapter images for ${testChap.name} (${testChap.url}) ---`);
        const chapHtml = fetchPage(testChap.url);
        if (chapHtml) {
          const $c = cheerio.load(chapHtml);
          const images = [];
          
          // Check $.reader json in script
          $c('script').each((_, s) => {
            const t = $c(s).html() || '';
            const match = t.match(/ch_image\s*=\s*\$\.reader\(\s*(\{[\s\S]*?\})\s*\)/);
            if (match) {
              try {
                const parsed = JSON.parse(match[1]);
                if (parsed && parsed.array) {
                  Object.values(parsed.array).forEach((item, idx) => {
                    if (item && item.image) {
                      images.push({ index: idx, url: item.image });
                    }
                  });
                }
              } catch (err) {
                console.log('Error parsing reader json:', err.message);
              }
            }
          });

          // Fallback to DOM img tags if script json not found
          if (images.length === 0) {
            $c('.reader-area img, #readerarea img, .reading-content img').each((idx, img) => {
              const src = $c(img).attr('src') || $c(img).attr('data-src') || $c(img).attr('data-lazy-src');
              if (src && !src.includes('banner') && !src.includes('ads') && !src.includes('logo')) {
                images.push({ index: idx, url: src.trim() });
              }
            });
          }

          console.log(`Found ${images.length} images for chapter:`, images.slice(0, 3));
        }
      }
    }
  }
}

analyzeAll();
