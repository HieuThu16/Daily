#!/usr/bin/env python3
"""
Crawl và tự động nhóm video TikTok theo Series / Phim.
Hỗ trợ lấy dữ liệu từ yt-dlp hoặc file JSON, gom nhóm qua Regex thông minh,
sắp xếp theo thứ tự phần (P1, P2, P3...), kiểm tra tính đầy đủ và lưu ra file/Supabase.

Cách dùng:
  python crawl_tiktok.py --channel https://www.tiktok.com/@username
  python crawl_tiktok.py --json channel.json --output series_output.json
  python crawl_tiktok.py --channel https://www.tiktok.com/@username --supabase
"""

import argparse
import json
import os
import re
import subprocess
import sys
import unicodedata
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

# =====================================================================
# 1. Regex & Tiền xử lý Caption
# =====================================================================

def remove_accents(text: str) -> str:
    """Chuyển tiếng Việt có dấu sang không dấu để so khớp regex chuẩn xác."""
    text = unicodedata.normalize('NFD', text)
    text = re.sub(r'[\u0300-\u036f]', '', text)
    text = text.replace('đ', 'd').replace('Đ', 'D')
    return text.strip()

# Từ khóa đánh dấu tập cuối
FINAL_KEYWORDS = re.compile(
    r'\b(?:part\s*cuoi|phan\s*cuoi|tap\s*cuoi|ky\s*cuoi|final(?:\s*part)?|finale|the\s*end|ending|ket\s*thuc|het|full\s*review|end)\b',
    re.IGNORECASE
)

# Các mẫu nhận diện số tập: "P1", "Phần 2", "Tập 3", "Ep 04", "Part 5", "Tập 3/5", "#02"
PART_PATTERNS = [
    # Mẫu 1: "phần 2", "tap 3", "p 01", "ep 4", "part 5" kèm "/10" nếu có
    re.compile(r'\b(?:part|phan|tap|ep|episode|p)\s*[.:\-_]?\s*0*(\d{1,3})\b(?:\s*(?:\/|of|tren)\s*0*(\d{1,3}))?', re.IGNORECASE),
    # Mẫu 2: "#03" hoặc "#3/5"
    re.compile(r'#\s*0*(\d{1,3})\b(?:\s*\/\s*0*(\d{1,3}))?', re.IGNORECASE),
    # Mẫu 3: "3/5" hoặc "3 of 5"
    re.compile(r'\b0*(\d{1,3})\s*(?:\/|of)\s*0*(\d{1,3})\b', re.IGNORECASE),
]

# Từ khóa nhiễu cần lọc khi rút tên phim
NOISE_KEYWORDS = re.compile(
    r'\b(?:review|tom\s*tat|full|hd|4k|vietsub|thuyet\s*minh|phim|movie|series|official|trailer|reaction|spoiler|toan\s*bo|hay\s*nhat|kenh|tiktok)\b',
    re.IGNORECASE
)

def extract_part_info(raw_title: str) -> Dict[str, Any]:
    """Nhận diện số tập/phần từ caption TikTok."""
    norm = remove_accents(raw_title)
    is_final = bool(FINAL_KEYWORDS.search(norm))
    
    for pattern in PART_PATTERNS:
        match = pattern.search(norm)
        if match:
            part_num = int(match.group(1))
            total_parts = int(match.group(2)) if match.group(2) else None
            # Tránh nhầm ngày tháng như 12/5 (nếu tổng < số tập hiện tại thì bỏ qua)
            if total_parts is not None and total_parts < part_num:
                total_parts = None
            return {
                'part_number': part_num,
                'total_parts': total_parts,
                'is_final': is_final,
                'confidence': 0.9
            }
            
    return {
        'part_number': None,
        'total_parts': None,
        'is_final': is_final,
        'confidence': 0.4 if is_final else 0.0
    }

def extract_series_name(raw_title: str) -> str:
    """
    Rút trích tên bộ phim/series sạch sẽ:
    - Loại bỏ hashtag (#fyp, #xuhuong, #reviewphim)
    - Loại bỏ đánh số phần (P1, Tập 2, Part 3)
    - Loại bỏ các từ quảng cáo rác (review, tóm tắt phim...)
    - Giữ lại tên phim có nghĩa
    """
    # 1. Bỏ hashtag
    text = re.sub(r'#\S+', ' ', raw_title)
    
    # 2. Bỏ các mẫu số phần
    text = re.sub(r'\b(?:part|phan|phần|tap|tập|ep|episode|p)\s*[.:\-_]?\s*0*(\d{1,3})\b(?:\s*(?:\/|of|trên|tren)\s*0*(\d{1,3}))?', ' ', text, flags=re.IGNORECASE)
    text = re.sub(r'#\s*0*(\d{1,3})\b(?:\s*\/\s*0*(\d{1,3}))?', ' ', text)
    text = re.sub(r'\b0*(\d{1,3})\s*(?:\/|of)\s*0*(\d{1,3})\b', ' ', text)
    text = FINAL_KEYWORDS.sub(' ', text)
    
    # 3. Bỏ từ khóa thừa
    text = re.sub(r'\b(?:review|tóm\s*tắt|tom\s*tat|full|hd|4k|vietsub|thuyết\s*minh|thuyet\s*minh|phim|movie|series|official|trailer|reaction|spoiler|toàn\s*bộ|hay\s*nhất)\b', ' ', text, flags=re.IGNORECASE)
    
    # 4. Làm sạch ký tự ngăn cách
    text = re.sub(r'[|\-_–—:;,.!?]+', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    
    # Nếu bị xóa hết thì trả về 30 ký tự đầu của caption gốc
    return text if len(text) >= 2 else raw_title[:40].strip()

def normalize_series_key(name: str) -> str:
    """Tạo key duy nhất không dấu để gom các video cùng một phim về một nhóm."""
    clean = remove_accents(name).lower()
    clean = re.sub(r'[^a-z0-9]+', ' ', clean).strip()
    return clean

# =====================================================================
# 2. Cào video TikTok bằng yt-dlp
# =====================================================================

def fetch_tiktok_channel_videos(channel_url: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Sử dụng yt-dlp để lấy toàn bộ danh sách video công khai của kênh TikTok.
    Lệnh: yt-dlp --flat-playlist -J "<url>"
    """
    print(f"🚀 Đang quét video từ kênh: {channel_url} ...")
    cmd = [
        'yt-dlp',
        '--flat-playlist',
        '-J',
        '--extractor-args', 'tiktok:api_hostname=api22-normal-c-useast1a.tiktokv.com',
        channel_url
    ]
    
    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        data = json.loads(proc.stdout)
    except FileNotFoundError:
        print("❌ Lỗi: Chưa cài đặt 'yt-dlp'. Vui lòng cài đặt: pip install yt-dlp hoặc choco install yt-dlp")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"❌ Lỗi khi chạy yt-dlp: {e.stderr}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"❌ Lỗi parse JSON từ yt-dlp: {e}")
        sys.exit(1)

    entries = data.get('entries', []) or []
    creator_info = {
        'creator_id': data.get('channel_id') or data.get('uploader_id') or data.get('uploader') or 'tiktok_creator',
        'creator_name': data.get('channel') or data.get('uploader') or channel_url.split('@')[-1].split('/')[0],
        'creator_url': channel_url
    }
    
    print(f"✅ Đã tìm thấy {len(entries)} video từ @{creator_info['creator_name']}")
    return entries, creator_info

# =====================================================================
# 3. Pipeline Gom nhóm & Sắp xếp Series
# =====================================================================

def process_and_group_videos(entries: List[Dict[str, Any]], creator_info: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Xử lý danh sách video:
    1. Parse từng caption -> Part Info & Clean Title
    2. Gom nhóm theo Series Key
    3. Sắp xếp thứ tự các phần từ 1 -> N
    4. Đánh giá tính hoàn thành của series
    """
    series_map: Dict[str, Dict[str, Any]] = {}
    
    for item in entries:
        raw_title = item.get('title') or item.get('description') or ''
        video_id = str(item.get('id') or '')
        url = item.get('url') or item.get('webpage_url') or f"https://www.tiktok.com/@{creator_info['creator_name']}/video/{video_id}"
        thumbnail = item.get('thumbnail') or (item.get('thumbnails', [{}])[-1].get('url') if item.get('thumbnails') else None)
        timestamp = item.get('timestamp') or item.get('upload_date')
        published_at = datetime.fromtimestamp(timestamp).isoformat() if isinstance(timestamp, (int, float)) else str(timestamp)
        duration = item.get('duration')
        
        part_info = extract_part_info(raw_title)
        display_title = extract_series_name(raw_title)
        series_key = normalize_series_key(display_title)
        
        if not series_key:
            series_key = "video_le"
            display_title = "Video đơn lẻ"
            
        video_obj = {
            'video_id': video_id,
            'title': raw_title,
            'clean_title': display_title,
            'url': url,
            'embed_url': f"https://www.tiktok.com/embed/v2/{video_id}",
            'thumbnail': thumbnail,
            'duration': duration,
            'published_at': published_at,
            'part_number': part_info['part_number'],
            'total_parts': part_info['total_parts'],
            'is_final': part_info['is_final'],
        }
        
        if series_key not in series_map:
            series_map[series_key] = {
                'series_key': f"tiktok:{creator_info['creator_id']}:{series_key}",
                'title': display_title,
                'creator_id': creator_info['creator_id'],
                'creator_name': creator_info['creator_name'],
                'creator_url': creator_info['creator_url'],
                'cover': thumbnail,
                'videos': []
            }
            
        series_map[series_key]['videos'].append(video_obj)

    # Sắp xếp các tập trong mỗi series
    result_series = []
    for s_key, s_data in series_map.items():
        videos = s_data['videos']
        
        # Sắp xếp: ưu tiên số tập (1, 2, 3...), nếu không có số tập thì theo ngày đăng cũ -> mới
        def sort_key(v):
            p = v['part_number'] if v['part_number'] is not None else 9999
            return (p, v.get('published_at') or '')
            
        sorted_videos = sorted(videos, key=sort_key)
        
        # Đánh giá hoàn thành (Completion Check)
        part_numbers = [v['part_number'] for v in sorted_videos if v['part_number'] is not None]
        has_final = any(v['is_final'] for v in sorted_videos)
        
        status = 'UNKNOWN'
        if len(part_numbers) > 1:
            is_sequential = part_numbers == list(range(1, len(part_numbers) + 1))
            if is_sequential and has_final:
                status = 'COMPLETE'
            elif is_sequential:
                status = 'IN_PROGRESS'
            else:
                status = 'INCOMPLETE'  # Thiếu tập ở giữa
        elif len(sorted_videos) == 1 and not has_final and not part_numbers:
            status = 'SINGLE'
            
        s_data['videos'] = sorted_videos
        s_data['video_count'] = len(sorted_videos)
        s_data['status'] = status
        s_data['found_parts'] = len(part_numbers)
        result_series.append(s_data)

    # Sắp xếp series nhiều video lên đầu
    result_series.sort(key=lambda s: s['video_count'], reverse=True)
    return result_series

# =====================================================================
# 4. Lưu vào Supabase (Tùy chọn)
# =====================================================================

def save_to_supabase(series_list: List[Dict[str, Any]], creator_info: Dict[str, Any]):
    """Upsert kết quả cào vào Supabase Database."""
    from dotenv import load_dotenv
    load_dotenv()
    
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not service_key:
        print("⚠️ Thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env. Bỏ qua bước lưu Supabase.")
        return

    try:
        from supabase import create_client
        supabase = create_client(supabase_url, service_key)
        
        # 1. Upsert Creator
        supabase.table('review_creators').upsert({
            'platform': 'tiktok',
            'creator_url': creator_info['creator_url'],
            'creator_id': str(creator_info['creator_id']),
            'creator_name': creator_info['creator_name'],
            'last_synced_at': datetime.utcnow().isoformat()
        }, on_conflict='platform,creator_url').execute()
        
        # 2. Upsert Series & Videos
        for s in series_list:
            supabase.table('review_series').upsert({
                'series_key': s['series_key'],
                'platform': 'tiktok',
                'creator_id': str(s['creator_id']),
                'creator_name': s['creator_name'],
                'title': s['title'],
                'movie_title': s['title'],
                'status': 'COMPLETE' if s['status'] == 'COMPLETE' else 'UNKNOWN',
                'found_parts': s['found_parts'],
                'updated_at': datetime.utcnow().isoformat()
            }, on_conflict='series_key').execute()
            
            for v in s['videos']:
                supabase.table('review_videos').upsert({
                    'platform': 'tiktok',
                    'video_id': v['video_id'],
                    'series_key': s['series_key'],
                    'creator_id': str(s['creator_id']),
                    'creator_name': s['creator_name'],
                    'title': v['title'],
                    'canonical_url': v['url'],
                    'embed_url': v['embed_url'],
                    'thumbnail': v['thumbnail'],
                    'duration': v['duration'],
                    'part_number': v['part_number'],
                    'total_parts': v['total_parts'],
                    'is_final': v['is_final'],
                    'last_seen_at': datetime.utcnow().isoformat()
                }, on_conflict='platform,video_id').execute()
                
        print("🎉 Đã lưu toàn bộ series và video vào cơ sở dữ liệu Supabase thành công!")
    except Exception as e:
        print(f"❌ Lỗi khi lưu vào Supabase: {e}")

# =====================================================================
# 5. CLI Main Execution
# =====================================================================

def main():
    parser = argparse.ArgumentParser(description="Pipeline cào & nhóm series TikTok tự động.")
    parser.add_argument('--channel', type=str, help="Link kênh TikTok (vd: https://www.tiktok.com/@reviewphimhay)")
    parser.add_argument('--json', type=str, help="Đọc dữ liệu từ file JSON có sẵn")
    parser.add_argument('--output', type=str, default="tiktok_series.json", help="File output kết quả JSON")
    parser.add_argument('--supabase', action='store_true', help="Tự động đồng bộ lên Supabase Database")
    
    args = parser.parse_args()
    
    if not args.channel and not args.json:
        print("⚠️ Vui lòng cung cấp --channel <url> hoặc --json <path_to_json>")
        parser.print_help()
        sys.exit(1)
        
    entries = []
    creator_info = {'creator_id': 'unknown', 'creator_name': 'TikTok Creator', 'creator_url': ''}
    
    if args.json:
        with open(args.json, 'r', encoding='utf-8') as f:
            raw_data = json.load(f)
            if isinstance(raw_data, dict):
                entries = raw_data.get('entries', [raw_data])
                creator_info['creator_name'] = raw_data.get('uploader') or 'tiktok_user'
                creator_info['creator_id'] = raw_data.get('uploader_id') or creator_info['creator_name']
            elif isinstance(raw_data, list):
                entries = raw_data
        print(f"📂 Đã nạp {len(entries)} video từ file JSON: {args.json}")
    elif args.channel:
        entries, creator_info = fetch_tiktok_channel_videos(args.channel)
        
    series_list = process_and_group_videos(entries, creator_info)
    
    print("\n" + "=" * 60)
    print(f"📊 KẾT QUẢ GOM SERIES: @{creator_info['creator_name']}")
    print(f"Tổng số series tìm thấy: {len(series_list)}")
    print("=" * 60)
    
    for i, s in enumerate(series_list[:10], 1):
        print(f"\n🎬 {i}. {s['title']} ({s['video_count']} video, Trạng thái: {s['status']})")
        for v in s['videos'][:5]:
            p_str = f"P{v['part_number']}" if v['part_number'] else "Tập ?"
            print(f"   - {p_str}: {v['url']}")
        if len(s['videos']) > 5:
            print(f"   ... và {len(s['videos']) - 5} video khác")
            
    # Lưu ra file JSON
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump({
            'creator': creator_info,
            'total_series': len(series_list),
            'total_videos': len(entries),
            'series': series_list
        }, f, ensure_ascii=False, indent=2)
    print(f"\n💾 Đã lưu kết quả hoàn chỉnh vào: {args.output}")
    
    if args.supabase:
        save_to_supabase(series_list, creator_info)

if __name__ == '__main__':
    main()
