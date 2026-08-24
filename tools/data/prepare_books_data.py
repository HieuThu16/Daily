import os
import sys
import re
import json
import csv
import unicodedata
from pathlib import Path
import fitz

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

NGUON_DIR = r"D:\Desktop\React-PWA-App-read-book\nguồn"
LIBRARY_DIR = r"D:\Desktop\React-PWA-App-read-book\data\library"
CSV_PATH = r"D:\Desktop\React-PWA-App-read-book\danh_sach_sach.csv"
CUSTOM_META_PATH = r"D:\Desktop\React-PWA-App-read-book\data\custom-metadata.json"
OUTPUT_PREPARED = r"d:\Desktop\Daily\prepared_books.json"
EXTRACTED_COVERS_DIR = r"d:\Desktop\Daily\extracted_covers"

os.makedirs(EXTRACTED_COVERS_DIR, exist_ok=True)

IGNORED_PDFS = {
    "CV_TruongNguyenMinhHieu_JavaBackend.pdf",
    "CV_TruongNguyenMinhHieu_TraineeQA.pdf",
    "TruongNguyenMinhHieu_AIEngineerIntern_CV.pdf",
    "TruongNguyenMinhHieu_CV_FullStackDeveloperIntern_ITL.pdf",
}

# Standard Genre dictionary mapping keywords to clean genres
GENRE_MAPPINGS = [
    (r"(trinh thám|phá án|án mạng|hình sự|thám tử|sherlock)", "Trinh thám"),
    (r"(kinh dị|ma quái|rùng rợn|u tối|quỷ)", "Kinh dị"),
    (r"(kinh điển|cổ điển|classic)", "Văn học kinh điển"),
    (r"(thiếu nhi|cổ tích|hoàng tử bé|totto-chan|alice)", "Văn học thiếu nhi"),
    (r"(khoa học|vũ trụ|sapiens|lược sử|tương đối|hawking|einstein)", "Khoa học"),
    (r"(kỹ năng|tự lực|self-help|thói quen|học cách học|quẳng gánh)", "Kỹ năng sống"),
    (r"(tâm lý|tâm thần|trầm cảm|cảm xúc)", "Tâm lý học"),
    (r"(triết học|suy tưởng|ý nghĩa cuộc sống|lẽ sống)", "Triết học"),
    (r"(lịch sử|sử thi|việt sử|chiến tranh|iliad|odyssey)", "Lịch sử"),
    (r"(tản văn|tùy bút|du ký|hành lý hư vô)", "Tản văn"),
    (r"(tiểu thuyết|văn học đương đại|tình yêu|ngôn tình|truyện dài)", "Tiểu thuyết"),
]

def clean_key(s):
    if not s:
        return ""
    s = re.sub(r"\.(pdf|epub|jpe?g|webp|png|json)$", "", str(s), flags=re.I)
    s = re.sub(r"(-|_)(\d{6}_\d{6})", "", s)
    s = re.sub(r"(thuviensach\.vn|SachMoi\.Net|Webhoctap\.net|nhasachmienphi|ebook|prc|pdf|epub|azw3|mobi|\b\d{3,5}\b)", "", s, flags=re.I)
    s = re.sub(r"[\(\)\[\]\-–—_.,&+=]", " ", s)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace("đ", "d")
    s = re.sub(r"\s+", " ", s).strip()
    return s

def clean_title(title):
    if not title:
        return "Sách không tên"
    t = str(title).strip()
    # Remove file extensions
    t = re.sub(r"\.(pdf|epub|azw3|mobi|json)$", "", t, flags=re.I)
    # Remove website prefixes / suffixes
    t = re.sub(r"^(SachMoi\.Net|Webhoctap\.net|nhasachmienphi)[-_ ]*", "", t, flags=re.I)
    t = re.sub(r"[-_ ]*(thuviensach\.vn|SachMoi\.Net|ebook|pdf|epub|azw3|mobi)$", "", t, flags=re.I)
    t = re.sub(r"^\d+[-_ ]*", "", t)  # Leading numbers like 10270-
    t = re.sub(r"\s*-\s*.*?(dịch|biên dịch|tác giả|dich).*?$", "", t, flags=re.I)
    t = re.sub(r"\s+", " ", t).strip()
    if not t:
        t = str(title).strip()
    # If title is in UPPERCASE or all lowercase, capitalize nicely
    if t.isupper() or t.islower():
        t = t.capitalize()
    return t

def clean_author(author, title=""):
    if not author:
        # Try to infer from title if title has " - Author"
        if " - " in title:
            parts = title.split(" - ")
            if len(parts) >= 2:
                candidate = parts[-1].strip()
                if len(candidate) > 2 and len(candidate) < 40 and not re.search(r"(tap|tập|phần|quyển|\d)", candidate, re.I):
                    return candidate
        return "Nhiều tác giả"
    a = str(author).strip()
    a = re.sub(r"\s*&\s*.*?(dịch|biên dịch).*?$", "", a, flags=re.I)
    a = re.sub(r"\[.*?dịch.*?\]", "", a, flags=re.I)
    a = re.sub(r"\(.*?dịch.*?\)", "", a, flags=re.I)
    a = re.sub(r"\s+", " ", a).strip()
    if not a or a.lower() in ("unknown", "nhiều tác giả", "khuyết danh", "none", "null"):
        return "Nhiều tác giả"
    return a

def infer_genre(title, author, raw_genres, content=""):
    # First check raw_genres
    if raw_genres:
        if isinstance(raw_genres, list) and len(raw_genres) > 0:
            first_g = str(raw_genres[0]).strip()
            if first_g and len(first_g) > 2:
                # normalize genre
                for pattern, std_g in GENRE_MAPPINGS:
                    if re.search(pattern, first_g, re.I):
                        return std_g
                return first_g
        elif isinstance(raw_genres, str) and len(raw_genres.strip()) > 0:
            for pattern, std_g in GENRE_MAPPINGS:
                if re.search(pattern, raw_genres, re.I):
                    return std_g
            return raw_genres.split(",")[0].strip()

    # Match by Author
    author_clean = clean_key(author)
    if any(k in author_clean for k in ["higashino keigo", "agatha christie", "loi me", "tu kim tran", "arthur conan doyle", "chan ho kei", "donato carrisi", "alex michaelides"]):
        return "Trinh thám"
    if any(k in author_clean for k in ["haruki murakami", "nguyen nhat anh", "nguyen ngoc tu", "fredrik backman", "mac ngon", "diem lien khoa"]):
        return "Tiểu thuyết"
    if any(k in author_clean for k in ["leo tolstoy", "dostoevsky", "victor hugo", "charles dickens", "alexandre dumas", "albert camus", "franz kafka", "hemingway", "steinbeck"]):
        return "Văn học kinh điển"
    if any(k in author_clean for k in ["stephen hawking", "albert einstein", "yuval noah harari", "jared diamond"]):
        return "Khoa học"

    # Match by Title
    for pattern, std_g in GENRE_MAPPINGS:
        if re.search(pattern, title, re.I):
            return std_g

    return "Tiểu thuyết"

def format_chapter_title(raw_title, idx):
    if not raw_title or raw_title.strip() == "":
        return f"Chương {idx + 1}"
    t = raw_title.strip()
    t = re.sub(r"\s+", " ", t)
    # Remove leading numbering like "1. ", "01. " if followed by text
    if re.match(r"^chuong\s+\d+", t, re.I):
        return t.capitalize()
    return t

def extract_pdf_direct(pdf_path):
    """Direct PyMuPDF extraction if JSON is missing or empty"""
    doc = fitz.open(pdf_path)
    page_count = len(doc)
    
    # Try outline/TOC first
    toc = doc.get_toc() # [[lvl, title, page, ...]]
    chapters = []
    
    if toc and len(toc) >= 2:
        for i in range(len(toc)):
            lvl, title, pno = toc[i][0], toc[i][1], toc[i][2]
            start_p = max(0, pno - 1)
            end_p = (toc[i+1][2] - 1) if (i + 1 < len(toc)) else page_count
            end_p = max(start_p + 1, min(page_count, end_p))
            
            # Extract text from start_p to end_p
            chapter_text_parts = []
            for p in range(start_p, end_p):
                page_text = doc[p].get_text("text").strip()
                if page_text:
                    chapter_text_parts.append(page_text)
            
            content = "\n\n".join(chapter_text_parts)
            # clean paragraphs
            paras = [p.strip() for p in content.split("\n\n") if len(p.strip()) > 0]
            if paras:
                chapters.append({
                    "title": title.strip() or f"Mục {i+1}",
                    "content": "\n\n".join(paras)
                })

    # If no TOC or failed, split by heading / page chunks
    if len(chapters) == 0:
        chunk_size = max(1, page_count // 15) if page_count > 30 else 5
        current_chunk = []
        c_idx = 1
        for p in range(page_count):
            p_text = doc[p].get_text("text").strip()
            if p_text:
                current_chunk.append(p_text)
            if (p + 1) % chunk_size == 0 or p == page_count - 1:
                if current_chunk:
                    content = "\n\n".join(current_chunk)
                    paras = [para.strip() for para in content.split("\n\n") if len(para.strip()) > 0]
                    if paras:
                        chapters.append({
                            "title": f"Phần {c_idx}",
                            "content": "\n\n".join(paras)
                        })
                        c_idx += 1
                current_chunk = []

    doc.close()
    return page_count, chapters

def main():
    print("=== BẮT ĐẦU CHUẨN BỊ DỮ LIỆU SÁCH ===")
    
    # 1. Load CSV metadata
    csv_meta = {}
    if os.path.exists(CSV_PATH):
        with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            headers = next(reader, None)
            for row in reader:
                if row and len(row) >= 2:
                    t = row[0].strip()
                    a = row[1].strip() if len(row) > 1 else ""
                    g = row[2].strip() if len(row) > 2 else ""
                    csv_meta[clean_key(t)] = {"title": t, "author": a, "genre": g}

    print(f"Loaded {len(csv_meta)} entries from CSV")

    # 2. Index cover images from nguồn
    nguon_files = os.listdir(NGUON_DIR)
    images = [f for f in nguon_files if re.search(r"\.(jpe?g|webp|png)$", f, re.I)]
    image_index = []
    for img in images:
        image_index.append((clean_key(img), os.path.join(NGUON_DIR, img)))

    print(f"Loaded {len(images)} images from nguồn")

    # 3. Index existing library JSONs
    json_files = [f for f in os.listdir(LIBRARY_DIR) if f.endswith(".json")]
    json_by_key = {}
    for jf in json_files:
        try:
            with open(os.path.join(LIBRARY_DIR, jf), "r", encoding="utf-8") as f:
                data = json.load(f)
                src_fn = data.get("source", {}).get("filename") or jf
                json_by_key[clean_key(src_fn)] = data
                json_by_key[clean_key(jf)] = data
                if data.get("title"):
                    json_by_key[clean_key(data["title"])] = data
        except Exception as e:
            pass

    print(f"Loaded {len(json_files)} JSONs from data/library")

    # 4. Scan all PDFs & EPUBs in nguồn
    source_books = [f for f in nguon_files if (f.lower().endswith(".pdf") or f.lower().endswith(".epub")) and f not in IGNORED_PDFS]
    print(f"Found {len(source_books)} book files in nguồn to process")

    prepared_books = []
    
    for idx, filename in enumerate(source_books, 1):
        file_path = os.path.join(NGUON_DIR, filename)
        file_key = clean_key(filename)
        
        # Check if we have processed JSON
        cached_json = json_by_key.get(file_key)
        
        title = ""
        author = ""
        genre = ""
        description = ""
        chapters = []
        page_count = 0

        if cached_json and cached_json.get("chapters") and len(cached_json["chapters"]) > 0:
            title = cached_json.get("title") or filename
            author = cached_json.get("author") or ""
            genre = cached_json.get("genre") or cached_json.get("genres") or ""
            description = cached_json.get("description") or ""
            page_count = cached_json.get("source", {}).get("pageCount") or 0
            
            for c_order, c in enumerate(cached_json["chapters"]):
                c_title = c.get("title") or f"Chương {c_order + 1}"
                paras = c.get("paragraphs") or []
                c_content = "\n\n".join(p.strip() for p in paras if p and p.strip())
                if c_content:
                    chapters.append({
                        "title": format_chapter_title(c_title, c_order),
                        "content": c_content
                    })

        # If no chapters from JSON, extract from PDF directly
        if len(chapters) == 0 and filename.lower().endswith(".pdf"):
            try:
                page_count, raw_chapters = extract_pdf_direct(file_path)
                for c_order, c in enumerate(raw_chapters):
                    chapters.append({
                        "title": format_chapter_title(c["title"], c_order),
                        "content": c["content"]
                    })
            except Exception as ex:
                print(f"Error extracting {filename}: {ex}")

        if len(chapters) == 0:
            print(f"Skipping {filename}: no readable content")
            continue

        # Clean metadata
        if not title or title == filename:
            title = clean_title(filename)
        else:
            title = clean_title(title)

        # Check CSV for author/genre fallback
        csv_info = csv_meta.get(clean_key(title)) or csv_meta.get(file_key)
        if csv_info:
            if not author or author == "Nhiều tác giả":
                author = csv_info.get("author") or author
            if not genre:
                genre = csv_info.get("genre") or genre

        author = clean_author(author, title)
        genre = infer_genre(title, author, genre)

        # Match Cover Image
        matched_cover_path = None
        best_score = 0
        file_words = set(file_key.split()) | set(clean_key(title).split())
        
        for img_key, img_path in image_index:
            img_words = set(img_key.split())
            if not img_words: continue
            common = len(file_words & img_words)
            union = len(file_words | img_words)
            score = common / union if union > 0 else 0
            if file_key in img_key or img_key in file_key:
                score = max(score, 0.8)
            if clean_key(title) in img_key:
                score = max(score, 0.9)
            if score > best_score and score >= 0.35:
                best_score = score
                matched_cover_path = img_path

        # Fallback: Extract page 0 from PDF if cover not matched
        if not matched_cover_path and filename.lower().endswith(".pdf"):
            try:
                doc = fitz.open(file_path)
                if len(doc) > 0:
                    page = doc[0]
                    pix = page.get_pixmap(dpi=150)
                    out_name = f"cover_{clean_key(filename)[:30]}.jpg"
                    out_path = os.path.join(EXTRACTED_COVERS_DIR, out_name)
                    pix.save(out_path)
                    matched_cover_path = out_path
                doc.close()
            except Exception as ex:
                pass

        prepared_books.append({
            "source_filename": filename,
            "title": title,
            "author": author,
            "genre": genre,
            "description": description or f"Cuốn sách {title} của tác giả {author}.",
            "cover_path": matched_cover_path,
            "page_count": page_count,
            "chapters": chapters
        })

        if idx % 20 == 0 or idx == len(source_books):
            print(f"Prepared {idx}/{len(source_books)} books...")

    with open(OUTPUT_PREPARED, "w", encoding="utf-8") as f:
        json.dump(prepared_books, f, ensure_ascii=False, indent=2)

    print(f"\n HOÀN THÀNH CHUẨN BỊ {len(prepared_books)} CUỐN SÁCH! File lưu tại: {OUTPUT_PREPARED}")

if __name__ == "__main__":
    main()
