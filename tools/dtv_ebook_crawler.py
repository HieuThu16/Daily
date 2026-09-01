#!/usr/bin/env python3
"""
dtv-ebook.com.vn → Daily Library Crawler
==========================================
Cào toàn bộ sách từ dtv-ebook.com.vn (có PDF + ảnh bìa) và nhập vào
thư viện Daily qua Supabase REST API.

Yêu cầu:
  pip install requests beautifulsoup4 browser-cookie3

Cách dùng:
  1. Đăng nhập vào dtv-ebook.com.vn trên Chrome hoặc Firefox
  2. Chạy script: python dtv_ebook_crawler.py
  3. Script sẽ tự đọc cookies từ trình duyệt, cào sách và import

Tùy chọn:
  python dtv_ebook_crawler.py --browser firefox   # dùng Firefox thay Chrome
  python dtv_ebook_crawler.py --max 50            # giới hạn 50 sách
  python dtv_ebook_crawler.py --category van-hoc  # chỉ lấy thể loại cụ thể
  python dtv_ebook_crawler.py --dry-run           # không import, chỉ in ra danh sách
"""

import argparse
import json
import sys
import time
import re
import urllib.parse
from typing import Optional

try:
    import requests
    from bs4 import BeautifulSoup
    import browser_cookie3
except ImportError:
    print("❌ Thiếu thư viện. Chạy lệnh sau để cài:")
    print("   pip install requests beautifulsoup4 browser-cookie3")
    sys.exit(1)

# ─── CẤU HÌNH ─────────────────────────────────────────────────────────────────
SUPABASE_URL = "https://ejcwwiohwgidksablzjl.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_DOnxwKqFdzH9FPF5hvgFSw_MqodIX7P"

BASE_URL = "https://dtv-ebook.com.vn"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Cache-Control": "max-age=0",
}

# Delay giữa các request (giây) - đừng cào quá nhanh!
DELAY_BETWEEN_PAGES = 2.0
DELAY_BETWEEN_BOOKS = 1.5

# ─── SUPABASE FUNCTIONS ────────────────────────────────────────────────────────
def supabase_get(table: str, params: dict) -> list:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
    }
    resp = requests.get(url, headers=headers, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


def supabase_insert(table: str, data: dict) -> dict:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    resp = requests.post(url, headers=headers, json=data, timeout=15)
    if resp.status_code == 409:
        return {"duplicate": True}
    resp.raise_for_status()
    result = resp.json()
    return result[0] if isinstance(result, list) else result


def check_book_exists(title: str) -> bool:
    """Kiểm tra sách đã có trong thư viện chưa (theo tên)."""
    try:
        result = supabase_get("media_items", {
            "type": "eq.BOOK",
            "title": f"eq.{title}",
            "select": "id",
            "limit": "1",
        })
        return len(result) > 0
    except Exception:
        return False


# ─── CRAWLING FUNCTIONS ────────────────────────────────────────────────────────
def get_session_with_cookies(browser: str = "chrome") -> requests.Session:
    """Tạo requests.Session với cookies từ trình duyệt."""
    session = requests.Session()
    session.headers.update(HEADERS)

    print(f"📂 Đang đọc cookies từ {browser}...")
    try:
        if browser == "chrome":
            cookies = browser_cookie3.chrome(domain_name=".dtv-ebook.com.vn")
        elif browser == "firefox":
            cookies = browser_cookie3.firefox(domain_name=".dtv-ebook.com.vn")
        elif browser == "edge":
            cookies = browser_cookie3.edge(domain_name=".dtv-ebook.com.vn")
        else:
            raise ValueError(f"Browser không hỗ trợ: {browser}")

        for cookie in cookies:
            session.cookies.set(cookie.name, cookie.value, domain=cookie.domain)

        print(f"✅ Đọc được {len(session.cookies)} cookies từ {browser}")
    except Exception as e:
        print(f"⚠️  Không đọc được cookies: {e}")
        print("   Script sẽ thử kết nối không có cookies...")

    return session


def safe_get(session: requests.Session, url: str, retries: int = 3) -> Optional[BeautifulSoup]:
    """GET trang với retry và kiểm tra Cloudflare."""
    for attempt in range(retries):
        try:
            resp = session.get(url, timeout=20)
            if resp.status_code == 403:
                print(f"   ⚠️  403 Cloudflare block! Cần đăng nhập trình duyệt trước.")
                return None
            if resp.status_code == 429:
                wait = 30 * (attempt + 1)
                print(f"   ⚠️  Rate limited! Đợi {wait}s...")
                time.sleep(wait)
                continue
            resp.raise_for_status()

            # Kiểm tra có phải trang Cloudflare challenge không
            if "cloudflare" in resp.text.lower() and "challenge" in resp.text.lower():
                print(f"   ⚠️  Cloudflare challenge! Mở trình duyệt và đăng nhập trước.")
                return None

            return BeautifulSoup(resp.content, "html.parser")
        except Exception as e:
            if attempt < retries - 1:
                print(f"   ↻ Lỗi ({e}), thử lại sau {2**attempt}s...")
                time.sleep(2 ** attempt)
            else:
                print(f"   ❌ Thất bại sau {retries} lần: {e}")
    return None


def extract_book_links_from_list(soup: BeautifulSoup) -> list[str]:
    """Lấy tất cả link sách từ trang danh sách."""
    links = []
    selectors = [
        "a[href*='/sach/']",
        "a[href*='/ebook/']",
        ".book-item a",
        ".product-item a",
        ".book-card a",
        ".item a",
        "h3 a",
        "h2 a",
        ".title a",
    ]
    seen = set()
    for sel in selectors:
        for a in soup.select(sel):
            href = a.get("href", "")
            if not href:
                continue
            if href.startswith("/"):
                href = BASE_URL + href
            if not href.startswith("http"):
                href = BASE_URL + "/" + href
            if href not in seen and BASE_URL in href:
                seen.add(href)
                links.append(href)

    return list(dict.fromkeys(links))  # dedup giữ order


def find_pagination_urls(soup: BeautifulSoup, current_url: str) -> list[str]:
    """Tìm các URL trang kế tiếp từ pagination."""
    urls = []

    # Thử tìm nút "Tiếp" hoặc "Next"
    next_btn = soup.find("a", string=re.compile(r'next|tiếp|sau|›|»', re.I))
    if next_btn and next_btn.get("href"):
        href = next_btn["href"]
        if href.startswith("/"):
            href = BASE_URL + href
        urls.append(href)

    # Tìm pagination numbers
    pager = soup.select(".pagination a, .pager a, nav.pages a, [class*=page] a")
    for a in pager:
        href = a.get("href", "")
        if href and href not in urls:
            if href.startswith("/"):
                href = BASE_URL + href
            urls.append(href)

    return urls


def extract_book_detail(soup: BeautifulSoup, url: str) -> Optional[dict]:
    """Trích xuất thông tin chi tiết một cuốn sách."""
    if not soup:
        return None

    # Tên sách
    title = None
    for sel in ["h1.book-title", "h1.title", "h1", ".product-name", "[itemprop='name']", "h2.book-name"]:
        el = soup.select_one(sel)
        if el and el.text.strip():
            title = el.text.strip()
            break
    if not title:
        title = soup.title.string.replace(" - DTV eBook", "").replace(" | DTV", "").strip() if soup.title else "Unknown"

    # Tác giả
    author = None
    for sel in ["[itemprop='author']", ".author", ".book-author", ".writer", "a[href*='author']", ".info-author"]:
        el = soup.select_one(sel)
        if el and el.text.strip():
            author = el.text.strip()
            break

    # Ảnh bìa
    cover_url = None
    imgs = soup.find_all("img")
    candidates = []
    for img in imgs:
        src = img.get("src") or img.get("data-src") or ""
        if not src:
            continue
        if any(x in src.lower() for x in ["logo", "banner", "icon", "sprite", "avatar", "btn", "arrow"]):
            continue
        alt = img.get("alt", "").lower()
        cls = " ".join(img.get("class", [])).lower()
        score = 0
        if any(x in alt+cls+src.lower() for x in ["cover", "bìa", "thumb", "book", "bia"]):
            score += 10
        try:
            w = int(img.get("width", 0) or 0)
            h = int(img.get("height", 0) or 0)
            if w > 80 or h > 80:
                score += 5
        except Exception:
            pass
        candidates.append((score, src))

    if candidates:
        candidates.sort(reverse=True)
        cover_url = candidates[0][1]
        if cover_url.startswith("/"):
            cover_url = BASE_URL + cover_url

    # Link PDF/Download
    pdf_url = None
    for a in soup.find_all("a"):
        href = a.get("href", "")
        text = a.text.lower()
        cls = " ".join(a.get("class", [])).lower()
        if ".pdf" in href or "download" in href:
            pdf_url = href
            if pdf_url.startswith("/"):
                pdf_url = BASE_URL + pdf_url
            break
        if any(x in text+cls for x in ["tải về", "download", "tải xuống", "đọc offline"]):
            if href and href != "#":
                pdf_url = href
                if pdf_url.startswith("/"):
                    pdf_url = BASE_URL + pdf_url
                break

    # Thể loại
    genre = None
    for sel in ["[itemprop='genre']", ".category a", ".genre a", "a[href*='the-loai']", "a[href*='category']"]:
        el = soup.select_one(sel)
        if el and el.text.strip():
            genre = el.text.strip()
            break

    # Mô tả
    description = None
    for sel in ["[itemprop='description']", ".description", ".book-desc", ".summary", ".synopsis", ".gioi-thieu", "#description", ".content-desc"]:
        el = soup.select_one(sel)
        if el and el.text.strip():
            description = el.text.strip()[:800]
            break

    return {
        "title": title,
        "author": author,
        "cover_url": cover_url,
        "pdf_url": pdf_url,
        "genre": genre,
        "description": description,
        "source_url": url,
    }


def import_book_to_daily(book: dict, dry_run: bool = False) -> str:
    """Import một cuốn sách vào thư viện Daily. Returns: 'imported'|'skipped'|'error'"""
    title = book["title"]

    if dry_run:
        print(f"   [DRY RUN] Sẽ import: {title}")
        return "dry_run"

    # Kiểm tra đã có chưa
    if check_book_exists(title):
        print(f"   ⏭ Bỏ qua (đã có): {title}")
        return "skipped"

    # Import vào Supabase
    try:
        from datetime import date
        has_audio = bool(book.get("audio_tracks") and len(book["audio_tracks"]) > 0)
        notes_dict = {
            "source": "DTV eBook",
            "source_url": book.get("source_url"),
            "pdfUrl": book.get("pdf_url"),
            "tracks": book.get("audio_tracks", []),
            "totalDuration": book.get("total_duration"),
            "durationFormatted": book.get("duration_formatted"),
        }

        payload = {
            "type": "BOOK",
            "title": title,
            "author": book.get("author"),
            "genre": book.get("genre"),
            "cover_url": book.get("cover_url"),
            "description": book.get("description"),
            "status": "PLANNED",
            "is_favorite": False,
            "log_date": date.today().isoformat(),
            "book_format": "LISTEN" if has_audio else "READ",
            "url": (book.get("audio_tracks", [{}])[0].get("url") if has_audio else book.get("pdf_url")),
            "notes": json.dumps(notes_dict, ensure_ascii=False),
        }
        # Xóa None values để không ghi null không cần thiết
        payload = {k: v for k, v in payload.items() if v is not None}

        result = supabase_insert("media_items", payload)

        if result.get("duplicate"):
            print(f"   ⏭ Bỏ qua (trùng): {title}")
            return "skipped"

        print(f"   ✅ Đã import: {title} ({'Sách nói' if has_audio else 'Sách đọc PDF'})")
        if book.get("pdf_url"):
            print(f"      PDF: {book['pdf_url'][:80]}...")
        if has_audio:
            print(f"      Audio: {len(book['audio_tracks'])} phần ({book.get('duration_formatted', '')})")
        return "imported"

    except Exception as e:
        print(f"   ❌ Lỗi import '{title}': {e}")
        return "error"


# ─── MAIN CRAWLER ─────────────────────────────────────────────────────────────
def crawl(args):
    session = get_session_with_cookies(args.browser)

    # Xác định danh sách trang để cào
    if args.category:
        start_urls = [f"{BASE_URL}/{args.category}"]
    elif args.urls:
        start_urls = args.urls
    else:
        # Các trang danh sách mặc định
        start_urls = [
            f"{BASE_URL}/sach-moi",
            f"{BASE_URL}/sach-hay",
            f"{BASE_URL}/danh-sach-sach",
            f"{BASE_URL}/",
        ]

    visited_list_pages = set()
    book_urls = []
    stats = {"imported": 0, "skipped": 0, "error": 0, "dry_run": 0}

    print(f"\n🕷️  Bắt đầu cào từ {len(start_urls)} trang danh sách...")

    # Phase 1: Thu thập link sách
    queue = list(start_urls)
    while queue and len(book_urls) < args.max * 3:  # Lấy dư để có sách mới
        list_url = queue.pop(0)
        if list_url in visited_list_pages:
            continue
        visited_list_pages.add(list_url)

        print(f"\n📄 Trang danh sách: {list_url}")
        soup = safe_get(session, list_url)
        if not soup:
            continue

        page_books = extract_book_links_from_list(soup)
        new_books = [b for b in page_books if b not in book_urls]
        book_urls.extend(new_books)
        print(f"   📚 Tìm thấy {len(new_books)} link sách mới (tổng: {len(book_urls)})")

        # Tìm trang tiếp theo
        if len(visited_list_pages) < 20:  # Giới hạn số trang danh sách
            next_pages = find_pagination_urls(soup, list_url)
            for p in next_pages:
                if p not in visited_list_pages and p not in queue:
                    queue.append(p)

        if len(book_urls) >= args.max:
            break

        time.sleep(DELAY_BETWEEN_PAGES)

    book_urls = list(dict.fromkeys(book_urls))[:args.max]
    print(f"\n📚 Tổng số link sách sẽ xử lý: {len(book_urls)}")

    if args.dry_run:
        print("\n[DRY RUN MODE - không import thực sự]\n")

    # Phase 2: Crawl chi tiết từng sách và import
    all_books = []
    for i, book_url in enumerate(book_urls, 1):
        print(f"\n[{i}/{len(book_urls)}] {book_url}")

        soup = safe_get(session, book_url)
        book = extract_book_detail(soup, book_url) if soup else None

        if not book:
            print(f"   ⚠️  Không lấy được thông tin sách")
            stats["error"] += 1
            continue

        print(f"   📖 {book['title']}")
        if book.get("author"):
            print(f"   ✍️  {book['author']}")

        result = import_book_to_daily(book, dry_run=args.dry_run)
        stats[result] += 1
        all_books.append(book)

        # Lưu kết quả ra file JSON (để theo dõi tiến độ)
        with open("dtv_ebook_crawled.json", "w", encoding="utf-8") as f:
            json.dump(all_books, f, ensure_ascii=False, indent=2)

        time.sleep(DELAY_BETWEEN_BOOKS)

    # Tóm tắt
    print("\n" + "="*60)
    print("📊 KẾT QUẢ:")
    print(f"   ✅ Đã import:  {stats['imported']} sách")
    print(f"   ⏭  Đã bỏ qua: {stats['skipped']} sách (đã có)")
    print(f"   ❌ Lỗi:        {stats['error']} sách")
    if args.dry_run:
        print(f"   🔍 Dry run:    {stats['dry_run']} sách")
    print(f"\n💾 Dữ liệu đã cào lưu tại: dtv_ebook_crawled.json")
    print("="*60)


# ─── CLI ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Cào sách từ dtv-ebook.com.vn và import vào thư viện Daily",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ví dụ:
  python dtv_ebook_crawler.py                          # Cào sách mới nhất
  python dtv_ebook_crawler.py --max 100                # Giới hạn 100 sách
  python dtv_ebook_crawler.py --browser firefox        # Dùng cookies Firefox
  python dtv_ebook_crawler.py --dry-run                # Xem trước, không import
  python dtv_ebook_crawler.py --category van-hoc       # Chỉ thể loại văn học
  python dtv_ebook_crawler.py --urls https://dtv-ebook.com.vn/sach/ten-sach
        """
    )
    parser.add_argument("--browser", choices=["chrome", "firefox", "edge"], default="chrome",
                        help="Trình duyệt để lấy cookies (mặc định: chrome)")
    parser.add_argument("--max", type=int, default=200,
                        help="Số lượng sách tối đa (mặc định: 200)")
    parser.add_argument("--category", type=str, default=None,
                        help="Thể loại cụ thể (slug trong URL, vd: van-hoc)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Chỉ xem trước, không thực sự import")
    parser.add_argument("--urls", nargs="+", metavar="URL",
                        help="Danh sách URL cụ thể để cào")

    args = parser.parse_args()
    crawl(args)
