# Thu thập series review phim (YouTube + TikTok)

Nhập kênh **một lần**, hệ thống tự tìm video, gom thành series theo phim, đoán số
phần và tự đánh giá series đã đủ phần hay chưa. Không tải video, chỉ lưu link và
mã nhúng chính thức.

## Chạy

```bash
npm run crawl:reviews -- --add youtube https://www.youtube.com/@TenKenh
npm run crawl:reviews          # sync lại mọi kênh đã thêm
```

Chạy lại bao nhiêu lần cũng được: mọi bản ghi đều upsert theo khoá tự nhiên.

Muốn tự động hằng ngày thì thêm dòng trên vào [../scheduler/crawl_nightly.bat](../scheduler/crawl_nightly.bat).

## Biến môi trường

Thêm vào `.env`:

```env
YOUTUBE_API_KEY=...
TIKTOK_ACCESS_TOKEN=...          # chỉ cần nếu dùng kênh TikTok
SUPABASE_SERVICE_ROLE_KEY=...
```

`VITE_SUPABASE_URL` đã có sẵn trong `.env` của dự án.

### 1. YOUTUBE_API_KEY

Miễn phí, hạn mức 10.000 đơn vị quota/ngày (đủ cho vài chục kênh).

1. Vào <https://console.cloud.google.com/> → tạo project mới (tên gì cũng được).
2. **APIs & Services → Library** → tìm **YouTube Data API v3** → **Enable**.
3. **APIs & Services → Credentials** → **Create credentials** → **API key**.
4. Copy key dán vào `.env`.
5. Nên bấm **Restrict key** → **API restrictions** → chỉ chọn YouTube Data API v3.
   Key lộ ra ngoài cũng không dùng được cho dịch vụ khác.

Không cần OAuth, không cần sở hữu kênh — key này đọc được kênh công khai bất kỳ.

### 2. TIKTOK_ACCESS_TOKEN

Khó hơn nhiều, và có một giới hạn phải biết trước khi bắt tay:

> TikTok Display API **chỉ trả về video của chính tài khoản đã đăng nhập cấp
> quyền**. Không có API chính thức nào cho phép liệt kê video của người khác.
> Nghĩa là phần TikTok chỉ dùng được cho kênh của bạn.

1. Vào <https://developers.tiktok.com/> → đăng nhập → **Manage apps** → **Create an app**.
2. Trong app, mục **Products**, thêm **Login Kit** và **Display API**.
3. Ở **Scopes**, bật `user.info.basic` và `video.list`.
4. Khai báo **Redirect URI** (lúc phát triển dùng `http://localhost:5173/callback` được).
5. Gửi app đi duyệt. Chưa duyệt xong thì chỉ tài khoản trong danh sách
   **Target users / sandbox** mới đăng nhập được — đủ để thử.
6. Chạy luồng OAuth để đổi lấy `access_token`, dán vào `.env`.

Token có hạn (~24 giờ) và kèm `refresh_token`. Nếu định chạy job hằng đêm, phải
lưu `refresh_token` và làm mới token trước mỗi lần chạy — phần này **chưa có
trong code**, hiện đang đọc thẳng `TIKTOK_ACCESS_TOKEN` từ `.env`.

### 3. SUPABASE_SERVICE_ROLE_KEY

Supabase Dashboard → **Project Settings → API → service_role**. Key này bỏ qua
RLS nên **chỉ dùng trong script chạy ở máy bạn**, tuyệt đối không đưa vào code
frontend hay commit lên repo.

## Áp migration

```bash
supabase db push
```

Hoặc dán [../supabase/migrations/20260911000000_review_series.sql](../supabase/migrations/20260911000000_review_series.sql)
vào SQL Editor của Supabase.

Bốn bảng được tạo:

| Bảng | Chứa gì |
| --- | --- |
| `review_creators` | Kênh đã đăng ký theo dõi |
| `review_series` | Mỗi phim × mỗi kênh một dòng, kèm trạng thái hoàn chỉnh |
| `review_videos` | Từng video: link, mã nhúng, số phần |
| `review_sync_runs` | Lịch sử mỗi lần chạy, để soi khi số liệu lạ |

## Trạng thái hoàn chỉnh

Cột `review_series.status`. Web **chỉ được hiện "đã đủ phần" khi status là
`COMPLETE`** — các giá trị còn lại đều nghĩa là chưa chắc.

| Trạng thái | Khi nào | Bằng chứng |
| --- | --- | --- |
| `COMPLETE` | Playlist báo đủ số item, hoặc có "phần cuối" + dãy phần liền mạch từ 1 | Mạnh |
| `INCOMPLETE` | Thiếu phần ở giữa, hoặc số video ít hơn số playlist công bố | Mạnh |
| `POSSIBLY_COMPLETE` | Có chữ "phần cuối" nhưng dãy phần không đọc được đầy đủ | Vừa |
| `STALLED` | Lâu không có video mới (mặc định 30 ngày) | Yếu |
| `UNKNOWN` | Không đủ căn cứ để nói gì | — |
| `ERROR` | Sync hỏng | — |

Điểm quan trọng: **im lặng lâu không phải là đã xong**. Kênh nghỉ 3 năm vẫn là
`STALLED`, không bao giờ tự lên `COMPLETE`.

`missing_parts` liệt kê thẳng các phần còn thiếu, ví dụ `{4}` khi đã có 1,2,3,5.

## Vì sao YouTube ra `COMPLETE` còn TikTok thì hiếm

`COMPLETE` mạnh nhất đến từ số item playlist do nền tảng công bố. YouTube trả số
này trong `playlists.contentDetails.itemCount`. TikTok Display API không có thứ
tương đương, nên series TikTok thường dừng ở `UNKNOWN` hoặc `POSSIBLY_COMPLETE`.
Đó là hành vi cố ý — thà nói không biết còn hơn báo đủ mà thiếu.

## Video bị xoá hoặc để riêng tư

Bản ghi không bị xoá, chỉ được đóng dấu `review_videos.unavailable_at`. Lần sync
sau series sẽ hụt phần và tự chuyển về `INCOMPLETE`, thay vì âm thầm coi như đủ.

## Mã nguồn

| File | Việc |
| --- | --- |
| [../src/lib/reviewSeries/youtube.ts](../src/lib/reviewSeries/youtube.ts) | Gọi YouTube Data API v3 |
| [../src/lib/reviewSeries/tiktok.ts](../src/lib/reviewSeries/tiktok.ts) | Gọi TikTok Display API v2 |
| [../src/lib/reviewSeries/partDetector.ts](../src/lib/reviewSeries/partDetector.ts) | Đọc "phần 3", "P3/5", "tập cuối"… và rút tên phim |
| [../src/lib/reviewSeries/seriesResolver.ts](../src/lib/reviewSeries/seriesResolver.ts) | Gom video thành series |
| [../src/lib/reviewSeries/completion.ts](../src/lib/reviewSeries/completion.ts) | Quyết định trạng thái hoàn chỉnh |
| [../crawl_review_series.mjs](../crawl_review_series.mjs) | Job đồng bộ, ghi xuống Supabase |

Chạy test: `npx vitest run src/lib/reviewSeries`
