/**
 * DTV-Ebook → Daily Bookmarklet SOURCE
 * Dùng để đọc/chỉnh sửa. File minify để copy vào bookmark là dtv-ebook-bookmarklet.min.js
 */

(function () {
  const SUPABASE_URL = 'https://ejcwwiohwgidksablzjl.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_DOnxwKqFdzH9FPF5hvgFSw_MqodIX7P';

  async function supabaseInsert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`Supabase ${res.status}: ${err}`); }
    return res.json();
  }

  async function supabaseSelect(table, params) {
    const q = new URLSearchParams(params);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${q}`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) throw new Error(`Supabase select ${res.status}`);
    return res.json();
  }

  function extractBookInfo() {
    const title =
      document.querySelector('h1.book-title,h1.title,h1,.product-name,[itemprop="name"]')?.textContent?.trim() ||
      document.querySelector('title')?.textContent?.replace(/ ?[-|–] ?DTV.*$/i,'').trim() ||
      'Sách chưa đặt tên';

    const author =
      document.querySelector('[itemprop="author"],.author,.book-author,.writer,a[href*="author"]')?.textContent?.trim() ||
      null;

    const imgs = Array.from(document.querySelectorAll('img'));
    const coverCandidates = imgs
      .filter(i => i.src && !/(logo|banner|icon|sprite)/i.test(i.src) && (/(cover|thumb|book|bia)/i.test(i.className+i.alt+i.src) || i.width > 100))
      .sort((a,b) => (b.naturalWidth||b.width||0) - (a.naturalWidth||a.width||0));
    const coverUrl = coverCandidates[0]?.src || null;

    const pdfLinks = Array.from(document.querySelectorAll('a[href*=".pdf"],a[href*="download"],a.btn-download,a.download-btn,[class*="download"] a'));
    const pdfUrl = pdfLinks.find(a => a.href)?.href || null;

    const genre =
      document.querySelector('[itemprop="genre"],.category a,.genre a,a[href*="the-loai"],a[href*="category"]')?.textContent?.trim() ||
      null;

    const description =
      document.querySelector('[itemprop="description"],.description,.book-desc,.summary,.synopsis,.gioi-thieu,#description')?.textContent?.trim()?.slice(0,500) ||
      null;

    return { title, author, coverUrl, pdfUrl, genre, description };
  }

  function createUI(info) {
    document.getElementById('daily-import-overlay')?.remove();

    const overlay = Object.assign(document.createElement('div'), { id: 'daily-import-overlay' });
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.65);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;font-family:-apple-system,Segoe UI,sans-serif';

    const card = document.createElement('div');
    card.style.cssText = 'background:#1e1e2e;border:1px solid #3a3a5c;border-radius:16px;padding:24px;max-width:440px;width:90%;color:#e0e0f0;box-shadow:0 24px 80px rgba(0,0,0,.7)';

    const pdfColor = info.pdfUrl ? '#86efac' : '#f87171';
    const coverColor = info.coverUrl ? '#86efac' : '#f87171';
    const coverHtml = info.coverUrl
      ? `<img src="${info.coverUrl}" style="width:80px;height:110px;object-fit:cover;border-radius:8px;border:2px solid #3a3a5c;flex-shrink:0">`
      : `<div style="width:80px;height:110px;border-radius:8px;background:#2a2a4a;display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0">📚</div>`;

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <span style="font-size:22px">📚</span>
        <h3 style="margin:0;font-size:16px;font-weight:700;color:#c084fc">Import sách vào Daily</h3>
        <button id="dl-close" style="margin-left:auto;background:transparent;border:none;color:#888;font-size:20px;cursor:pointer;line-height:1">✕</button>
      </div>
      <div style="display:flex;gap:14px;margin-bottom:18px">${coverHtml}
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:700;color:#f0f0ff;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${info.title.replace(/"/g,'&quot;')}">${info.title}</div>
          <div style="font-size:12px;color:#a0a0c0;margin-bottom:8px">${info.author||'Chưa rõ tác giả'}</div>
          ${info.genre?`<span style="font-size:11px;background:#2a1a4a;color:#c084fc;padding:2px 8px;border-radius:20px">${info.genre}</span>`:''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;font-size:12px">
        <div>🔗 PDF: <span style="color:${pdfColor}">${info.pdfUrl?'✅ Tìm thấy':'❌ Không tìm thấy – nhập thủ công'}</span></div>
        <div>🖼 Bìa: <span style="color:${coverColor}">${info.coverUrl?'✅ Tìm thấy':'❌ Không tìm thấy'}</span></div>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.06em">Link PDF</label>
        <input id="dl-pdf" type="text" value="${info.pdfUrl||''}" placeholder="Dán link PDF tại đây..." style="display:block;width:100%;box-sizing:border-box;margin-top:6px;background:#2a2a4a;border:1px solid #3a3a5c;border-radius:8px;color:#e0e0f0;padding:8px 10px;font-size:12px">
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.06em">Trạng thái</label>
        <select id="dl-status" style="display:block;width:100%;margin-top:6px;background:#2a2a4a;border:1px solid #3a3a5c;border-radius:8px;color:#e0e0f0;padding:8px 10px;font-size:13px">
          <option value="PLANNED">📌 Sẽ đọc</option>
          <option value="IN_PROGRESS">⏳ Đang đọc</option>
          <option value="COMPLETED">✅ Đã đọc</option>
        </select>
      </div>
      <div style="display:flex;gap:10px">
        <button id="dl-cancel" style="flex:1;padding:10px;border-radius:10px;border:1px solid #3a3a5c;background:transparent;color:#a0a0c0;font-size:13px;font-weight:600;cursor:pointer">Hủy</button>
        <button id="dl-import" style="flex:2;padding:10px;border-radius:10px;border:none;background:linear-gradient(135deg,#7c3aed,#c026d3);color:#fff;font-size:13px;font-weight:700;cursor:pointer">📥 Import vào thư viện</button>
      </div>
      <div id="dl-msg" style="margin-top:10px;font-size:12px;text-align:center;min-height:18px"></div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target===overlay) close(); });
    document.getElementById('dl-close').onclick = close;
    document.getElementById('dl-cancel').onclick = close;

    document.getElementById('dl-import').addEventListener('click', async () => {
      const msg = document.getElementById('dl-msg');
      const btn = document.getElementById('dl-import');
      const pdfUrl = document.getElementById('dl-pdf').value.trim();
      const status = document.getElementById('dl-status').value;

      btn.disabled = true; btn.textContent = '⏳ Đang xử lý...';
      msg.style.color = '#fbbf24'; msg.textContent = 'Kiểm tra sách đã tồn tại chưa...';

      try {
        const existing = await supabaseSelect('media_items', { type:'eq.BOOK', name:`eq.${info.title}`, select:'id', limit:'1' });
        if (existing?.length > 0) {
          msg.textContent = `⚠️ "${info.title}" đã có trong thư viện!`;
          btn.disabled = false; btn.textContent = '📥 Import vào thư viện';
          return;
        }

        msg.textContent = 'Đang lưu sách...';
        const today = new Date().toISOString().slice(0,10);
        const result = await supabaseInsert('media_items', {
          type:'BOOK', name:info.title, author:info.author||null,
          genre:info.genre||null, cover_url:info.coverUrl||null,
          description:info.description||null, status, is_favorite:false,
          log_date:today, book_format:'READ',
          youtube_url:pdfUrl||null,  // Lưu PDF link vào youtube_url để có thể dùng sau
        });

        if (result?.[0]) {
          msg.style.color = '#86efac';
          msg.textContent = `✅ Đã import thành công! ID: ${result[0].id}`;
          btn.textContent = '✅ Xong!';
        } else throw new Error('Không nhận được response');
      } catch (err) {
        msg.style.color = '#f87171';
        msg.textContent = `❌ ${err.message}`;
        btn.disabled = false; btn.textContent = '📥 Thử lại';
      }
    });
  }

  createUI(extractBookInfo());
})();
