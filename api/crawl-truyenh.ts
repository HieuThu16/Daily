import * as cheerio from 'cheerio';

export const config = { maxDuration: 60 };

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchWithRetry(url: string, referer?: string, retries = 3): Promise<string> {
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
      await new Promise(r => setTimeout(r, 800));
    }
  }
  throw new Error('Fetch failed');
}

export function normalizeStoryUrl(inputUrl: string): { storyUrl: string; slug: string; isVietManhwa: boolean } {
  let url = inputUrl.trim();
  const isVietManhwa = url.includes('vietmanhwa.com');

  if (!url.startsWith('http')) {
    url = isVietManhwa 
      ? `https://vietmanhwa.com/manhwa-18/${url.replace(/^\/+/, '')}`
      : `https://metruyen18.app/truyen/${url.replace(/^\/+/, '')}`;
  }

  // Remove chapter suffix for VietManhwa
  if (isVietManhwa) {
    const chapMatch = url.match(/^(https?:\/\/[^\/]+\/manhwa-18\/[^\/]+)\/chap(?:ter)?-\d+/i);
    if (chapMatch) url = chapMatch[1];
  } else {
    // Remove chapter suffix for MeTruyen18
    const chapterMatch = url.match(/^(https?:\/\/[^\/]+\/truyen\/[^\/]+)\/chapter-\d+/i);
    if (chapterMatch) url = chapterMatch[1];
  }

  const urlObj = new URL(url);
  const segments = urlObj.pathname.split('/').filter(Boolean);
  const slug = segments[segments.length - 1] || 'truyen-h';

  return { storyUrl: url, slug, isVietManhwa };
}

export async function crawlVietManhwaStory(inputUrl: string) {
  const { storyUrl, slug } = normalizeStoryUrl(inputUrl);

  const html = await fetchWithRetry(storyUrl);
  const $ = cheerio.load(html);

  const title = $('h1').first().text().trim() 
    || $('title').text().replace(/[-|].*$/, '').trim() 
    || slug.replace(/-/g, ' ');
  
  let cover = '';
  $('img').each((_, el) => {
    const src = $(el).attr('data-src') || $(el).attr('src') || '';
    const alt = $(el).attr('alt') || '';
    if (!cover && src && (alt.toLowerCase().includes('bìa') || src.includes('/story-images/') || src.includes('/manga-posters/'))) {
      if (!src.includes('011111111111') && !src.includes('logo') && !src.includes('banner')) {
        cover = src.startsWith('http') ? src : `https://cdn.vietmanhwa.com${src}`;
      }
    }
  });
  if (!cover) {
    const ogImg = $('meta[property="og:image"]').attr('content') || '';
    if (ogImg && !ogImg.includes('011111111111') && !ogImg.includes('images-story')) {
      cover = ogImg;
    }
  }
  
  let description = '';
  $('p, div').each((_, el) => {
    const t = $(el).text().trim();
    if (t.length > 50 && !t.includes('window.') && !description) {
      description = t;
    }
  });
  if (!description) {
    description = $('meta[name="description"]').attr('content') || '';
  }

  let author = 'Đang cập nhật';
  let status = 'Đang tiến hành';
  const genres = ['Hentai', 'Manhwa', '18+'];

  $('a[href*="/the-loai/"], a[href*="/the-loai-truyen/"], a[href*="/genres/"], a.hashtag').each((_, el) => {
    const g = $(el).text().trim().replace(/^#/, '');
    if (g && !genres.includes(g)) genres.push(g);
  });

  const rawChapters: { number: number; name: string; url: string }[] = [];
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

  // Fetch chapters images with concurrency
  const chaptersWithImages: any[] = [];
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

        return { ...ch, images };
      } catch {
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
    author,
    status,
    genres,
    url: storyUrl,
    source: 'vietmanhwa',
    sourceName: 'Việt Manhwa',
    updatedAt: new Date().toISOString(),
    totalChapters: chaptersWithImages.length,
    chapters: chaptersWithImages
  };
}

export async function crawlMetruyen18Story(inputUrl: string) {
  const { storyUrl, slug } = normalizeStoryUrl(inputUrl);

  const html = await fetchWithRetry(storyUrl);
  const $ = cheerio.load(html);

  const title = $('h1').first().text().trim() 
    || $('meta[property="og:title"]').attr('content')?.replace(/HentaiVN.*/i, '').trim()
    || slug.replace(/-/g, ' ');
  
  const cover = $('meta[property="og:image"]').attr('content') 
    || $('.thumb img, .story-thumb img, .tab-summary img').attr('src') || '';
  
  const description = $('.story-description, .desc, .summary, .detail-content, .story-detail-info, .description-summary').text().trim() 
    || $('meta[name="description"]').attr('content') || '';
  
  let author = 'Đang cập nhật';
  let status = 'Đang tiến hành';
  const genres = ['Hentai', 'Manhwa', '18+'];

  $('a[href*="/the-loai/"], a[href*="/the-loai-truyen/"], a[href*="/genres/"], a.hashtag').each((_, el) => {
    const g = $(el).text().trim().replace(/^#/, '');
    if (g && !genres.includes(g)) genres.push(g);
  });

  $('li, tr, div, p').each((_, el) => {
    const text = $(el).text();
    if ((text.includes('Tác giả') || text.includes('Author')) && author === 'Đang cập nhật') {
      const val = $(el).find('a, span, td').last().text().trim();
      if (val && val !== 'Tác giả') author = val;
    }
    if ((text.includes('Tình trạng') || text.includes('Trạng thái') || text.includes('Status')) && status === 'Đang tiến hành') {
      const val = $(el).find('a, span, td').last().text().trim();
      if (val && !val.includes('Tình trạng')) status = val;
    }
  });

  const rawChapters: { number: number; name: string; url: string }[] = [];
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

  // Fetch chapters images with concurrency
  const chaptersWithImages: any[] = [];
  const CONCURRENCY = 5;
  for (let i = 0; i < rawChapters.length; i += CONCURRENCY) {
    const chunk = rawChapters.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(async (ch) => {
      try {
        const chHtml = await fetchWithRetry(ch.url, storyUrl);
        const ch$ = cheerio.load(chHtml);
        const images: { url: string; alt: string; index: number }[] = [];
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
        return { ...ch, images };
      } catch {
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
    author,
    status,
    genres,
    url: storyUrl,
    source: 'metruyen18',
    sourceName: 'Mê Truyện 18',
    updatedAt: new Date().toISOString(),
    totalChapters: chaptersWithImages.length,
    chapters: chaptersWithImages
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ nhận phương thức POST' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch {}
  }

  const url = String(body?.url || '').trim();
  if (!url) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đường dẫn truyện từ metruyen18.app hoặc vietmanhwa.com' });
  }

  try {
    const isVietManhwa = url.includes('vietmanhwa.com');
    const manga = isVietManhwa ? await crawlVietManhwaStory(url) : await crawlMetruyen18Story(url);
    return res.status(200).json({ success: true, manga });
  } catch (err: any) {
    console.error('Error crawling manga:', err);
    return res.status(500).json({ error: err.message || 'Lỗi khi cào dữ liệu truyện' });
  }
}
