import * as cheerio from 'cheerio';
import { requireAuth } from './_auth.js'

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

export function normalizeBLUrl(inputUrl: string): { storyUrl: string; slug: string; source: 'teamsany' | 'dualeo' | 'otruyen' } {
  let url = inputUrl.trim();
  let source: 'teamsany' | 'dualeo' | 'otruyen';

  if (url.includes('dualeo') || url.startsWith('dl-')) {
    source = 'dualeo';
  } else if (url.includes('otruyen')) {
    source = 'otruyen';
  } else {
    source = 'teamsany';
  }

  if (!url.startsWith('http')) {
    if (source === 'dualeo') {
      const cleanSlug = url.replace(/^dl-/, '');
      url = `https://dualeotruyencw.com/truyen-tranh/${cleanSlug}`;
    } else if (source === 'otruyen') {
      url = `https://otruyenapi.com/v1/api/truyen-tranh/${url}`;
    } else {
      url = `https://teamsany.com/manga/${url.replace(/^\/+/, '')}/`;
    }
  }

  // Remove chapter suffix
  if (url.includes('/chap-') || url.includes('/chapter-') || url.includes('/chuong-')) {
    url = url.replace(/\/chap(?:ter)?-[\d.]+\/?.*$/i, '/').replace(/\/chuong-[\d.]+\/?.*$/i, '/');
  }

  const urlObj = new URL(url);
  const segments = urlObj.pathname.split('/').filter(Boolean);
  const slug = segments[segments.length - 1] || 'bl-manga';

  return { storyUrl: url, slug, source };
}

export async function crawlTeamsanyStory(inputUrl: string, existingChapters?: any[]) {
  const { storyUrl, slug } = normalizeBLUrl(inputUrl);

  const html = await fetchWithRetry(storyUrl);
  const $ = cheerio.load(html);

  let title = $('h1.entry-title').text().trim() || $('.post-title').text().trim() || $('h1').first().text().trim() || slug.replace(/-/g, ' ');
  title = title.replace(/^Đăng Nhập\s+/i, '').trim();

  let cover = $('.thumb img').attr('src') || $('.thumb img').attr('data-src') || $('.summary_image img').attr('src') || '';
  if (cover && cover.startsWith('//')) cover = 'https:' + cover;
  if (!cover) {
    cover = $('meta[property="og:image"]').attr('content') || '';
  }

  const description = $('.entry-content, .description-summary, .summary__content').text().trim() || $('meta[name="description"]').attr('content') || '';

  const genres: string[] = ['Boylove', 'Đam Mỹ', 'Manhwa'];
  $('.genres-content a, .mgen a, .seriestugenre a, .genre a').each((_, a) => {
    const g = $(a).text().trim();
    if (g && !genres.includes(g)) genres.push(g);
  });

  let status = 'Đang tiến hành';
  let author = 'Đang cập nhật';
  let artist = '';

  $('.tsinfo .imptdt, .spe span, .infox .spe span, .infox .spe').each((_, el) => {
    const text = $(el).text().trim();
    if (/Tình Trạng|Status/i.test(text)) {
      status = text.replace(/Tình Trạng|Status|:/gi, '').trim();
    }
    if (/Tác Giả|Author/i.test(text)) {
      author = text.replace(/Tác Giả|Author|:/gi, '').trim();
    }
    if (/Họa Sĩ|Artist/i.test(text)) {
      artist = text.replace(/Họa Sĩ|Artist|:/gi, '').trim();
    }
  });

  const rawChapters: { number: number; name: string; url: string }[] = [];
  const seenUrls = new Set<string>();

  $('.lchx a, .epsleft a, .bxcl li a, #chapterlist li a, .eplister li a, .cl li a').each((_, a) => {
    const chapUrl = $(a).attr('href');
    const chapName = $(a).text().trim();
    if (chapUrl && !seenUrls.has(chapUrl) && (chapUrl.includes('chap') || chapUrl.includes('chuong') || chapUrl.includes(slug) || /\d+/.test(chapName))) {
      seenUrls.add(chapUrl);

      let num = 0;
      const match = chapName.match(/chap(?:ter)?[\s\-_]*(\d+(?:\.\d+)?)/i) || 
                    chapUrl.match(/chap(?:ter)?[\s\-_]*(\d+(?:\.\d+)?)/i) ||
                    chapName.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        num = parseFloat(match[1]);
      } else {
        num = rawChapters.length + 1;
      }

      if (!rawChapters.some(c => c.number === num)) {
        rawChapters.push({
          number: num,
          name: chapName || `Chapter ${num}`,
          url: chapUrl.startsWith('http') ? chapUrl : `https://teamsany.com${chapUrl}`
        });
      }
    }
  });

  rawChapters.sort((a, b) => a.number - b.number);

  // Reuse existing chapter images
  const existingMap = new Map<number, any>();
  if (Array.isArray(existingChapters)) {
    for (const ch of existingChapters) {
      if (typeof ch?.number === 'number' && Array.isArray(ch.images) && ch.images.length > 0) {
        existingMap.set(ch.number, ch);
      }
    }
  }

  const chaptersWithImages: any[] = [];
  const chaptersToFetch = rawChapters.filter(ch => !existingMap.has(ch.number));

  const CONCURRENCY = 5;
  const newlyFetched = new Map<number, any>();

  for (let i = 0; i < chaptersToFetch.length; i += CONCURRENCY) {
    const chunk = chaptersToFetch.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(async (ch) => {
      try {
        const chHtml = await fetchWithRetry(ch.url, storyUrl);
        const ch$ = cheerio.load(chHtml);
        const images: { url: string; alt: string; index: number }[] = [];

        // Check for $.reader
        ch$('script').each((_, s) => {
          const text = ch$(s).html() || '';
          const match = text.match(/ch_image\s*=\s*\$\.reader\(\s*(\{[\s\S]*?\})\s*\)/);
          if (match) {
            try {
              const parsed = JSON.parse(match[1]);
              if (parsed && parsed.array) {
                Object.values(parsed.array).forEach((it: any, idx) => {
                  if (it && it.image) {
                    let imgUrl = it.image.replace(/\\\//g, '/');
                    if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
                    images.push({
                      url: imgUrl,
                      index: idx + 1,
                      alt: `Trang ${idx + 1}`
                    });
                  }
                });
              }
            } catch {}
          }
        });

        if (images.length === 0) {
          ch$('.reader-area img, #readerarea img, .reading-content img, .entry-content img').each((idx, img) => {
            let src = ch$(img).attr('src') || ch$(img).attr('data-src') || ch$(img).attr('data-lazy-src') || ch$(img).attr('data-cfsrc');
            if (src && !src.includes('banner') && !src.includes('ads') && !src.includes('logo') && !src.includes('avatar')) {
              if (src.startsWith('//')) src = 'https:' + src;
              images.push({
                url: src.trim(),
                index: idx + 1,
                alt: `Trang ${idx + 1}`
              });
            }
          });
        }

        return { ...ch, images, imageCount: images.length };
      } catch {
        return { ...ch, images: [], imageCount: 0 };
      }
    }));
    for (const res of results) {
      newlyFetched.set(res.number, res);
    }
  }

  for (const ch of rawChapters) {
    if (existingMap.has(ch.number)) {
      chaptersWithImages.push(existingMap.get(ch.number));
    } else if (newlyFetched.has(ch.number)) {
      chaptersWithImages.push(newlyFetched.get(ch.number));
    } else {
      chaptersWithImages.push({ ...ch, images: [], imageCount: 0 });
    }
  }

  return {
    slug,
    title,
    cover,
    description,
    genres,
    url: storyUrl,
    status,
    author,
    artist,
    type: 'Manhwa',
    source: 'teamsany',
    sourceName: 'Sany Team',
    updatedAt: new Date().toISOString(),
    totalChapters: chaptersWithImages.length,
    chapters: chaptersWithImages
  };
}

export async function crawlOtruyenStory(inputUrl: string, existingChapters?: any[]) {
  const { storyUrl, slug } = normalizeBLUrl(inputUrl);
  const cleanSlug = slug.replace(/^otruyen-/, '');
  const apiUrl = `https://otruyenapi.com/v1/api/truyen-tranh/${cleanSlug}`;

  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`OTruyen API lỗi HTTP ${res.status}`);
  // JSON của OTruyen, không có schema — các dòng dưới đã phòng bằng ?. và ||
  const json = (await res.json()) as any;
  if (json?.status !== 'success' || !json?.data?.item) {
    throw new Error(json?.message || 'Không tìm thấy truyện trên OTruyen');
  }

  const item = json.data.item;
  const cdnDomain = json.data.APP_DOMAIN_CDN_IMAGE || 'https://img.otruyenapi.com';

  const cover = item.thumb_url ? `${cdnDomain}/uploads/comics/${item.thumb_url}` : null;
  const description = item.content ? item.content.replace(/<[^>]+>/g, '').trim() : '';
  const author = Array.isArray(item.author) && item.author[0] ? item.author.join(', ') : 'Đang cập nhật';
  const genres = Array.isArray(item.category) ? item.category.map((c: any) => c.name) : ['Boylove', 'Đam Mỹ'];

  const serverData = item.chapters?.[0]?.server_data || [];
  const rawChapters: any[] = [];

  for (const ch of serverData) {
    const num = parseFloat(ch.chapter_name) || (rawChapters.length + 1);
    rawChapters.push({
      number: num,
      name: `Chapter ${ch.chapter_name || num}`,
      title: ch.chapter_title || undefined,
      url: ch.chapter_api_data,
      chapterId: ch.chapter_api_data,
      images: [],
      imageCount: 0
    });
  }

  rawChapters.sort((a, b) => a.number - b.number);

  return {
    slug: `otruyen-${cleanSlug}`,
    title: item.name || cleanSlug,
    cover,
    description,
    genres,
    url: apiUrl,
    status: item.status === 'completed' ? 'Đã hoàn thành' : 'Đang tiến hành',
    author,
    type: 'Manhwa',
    source: 'otruyen',
    sourceName: 'OTruyen',
    updatedAt: new Date().toISOString(),
    totalChapters: rawChapters.length,
    chapters: rawChapters
  };
}

export default async function handler(req: any, res: any) {
  if (await requireAuth(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ nhận phương thức POST' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch {}
  }

  const url = String(body?.url || '').trim();
  const existingChapters = Array.isArray(body?.existingChapters) ? body.existingChapters : undefined;
  if (!url) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đường dẫn hoặc slug truyện BL' });
  }

  try {
    const { source } = normalizeBLUrl(url);
    const manga = source === 'otruyen'
      ? await crawlOtruyenStory(url, existingChapters)
      : await crawlTeamsanyStory(url, existingChapters);
    return res.status(200).json({ success: true, manga });
  } catch (err: any) {
    console.error('Error crawling BL manga:', err);
    return res.status(500).json({ error: err.message || 'Lỗi khi cào dữ liệu truyện BL' });
  }
}
