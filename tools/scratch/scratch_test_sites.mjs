import * as cheerio from 'cheerio';

async function checkTeamsany() {
  try {
    const res = await fetch('https://teamsany.com/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    console.log('--- TEAMSANY GENRES ---');
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href && (href.includes('genres') || href.includes('genre') || href.includes('the-loai'))) {
        console.log(`${text}: ${href}`);
      }
    });
  } catch (e) {
    console.error('Teamsany error:', e.message);
  }
}

async function checkDuaLeo() {
  try {
    const res = await fetch('https://dualeotruyencw.com/the-loai/dam-my', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    console.log('--- DUALEOTRUYEN GENRES ---');
    $('a[href*="/the-loai/"]').each((_, el) => {
      console.log(`${$(el).text().trim()}: ${$(el).attr('href')}`);
    });
  } catch (e) {
    console.error('DuaLeo error:', e.message);
  }
}

async function testOtherSites() {
  const candidates = [
    'https://truyentranhdammyy.site',
    'https://meomeoteam.site',
    'https://lorangeteam.org',
    'https://doctruyen3q.info',
    'https://baotangtruyen18.com',
    'https://saytruyenhay.tv',
    'https://saytruyen.top',
    'https://manhwavn.top',
    'https://yaomic.com',
    'https://truyentranhaudio.online',
    'https://cmanga.link',
    'https://nettruyenx.com',
    'https://topmanhua.org'
  ];

  console.log('--- TESTING CANDIDATE SITES ---');
  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      clearTimeout(timeout);
      console.log(`[${res.status}] ${url}`);
    } catch (e) {
      console.log(`[FAIL] ${url} -> ${e.message}`);
    }
  }
}

async function main() {
  await checkTeamsany();
  await checkDuaLeo();
  await testOtherSites();
}

main();
