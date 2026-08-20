# Nghiên cứu app quản lý cá nhân — 20/08/2026

Đối chiếu Daily (My Space) với các app cùng loại, để biết còn thiếu gì.
Ghi lại nguồn để lần sau không phải tra lại từ đầu.

## Các app đã khảo sát

| Mảng | App tham chiếu |
|---|---|
| Việc / kế hoạch | Todoist, TickTick, Any.do, OmniFocus, Motion, Sunsama, Microsoft To Do |
| Thói quen | Streaks, Habitica, Habitify |
| Nhật ký | Day One |
| Tiền | YNAB, Spendee, Goodbudget, Money Lover |
| Học / thẻ ghi nhớ | Anki (FSRS), Brainscape |
| Sách | StoryGraph, Goodreads |
| Tổng hợp / dashboard | Notion, ClickUp, Lifestack |

## Nguồn

- Lifestack — Personal task apps 2026: https://lifestack.ai/blog/personal-task-management-app
- Temporal — TickTick vs Todoist 2026: https://temporal.day/blog/ticktick-vs-todoist-2026
- Toolfinder — Todoist vs TickTick: https://toolfinder.com/comparisons/todoist-vs-ticktick
- Day One — Features: https://dayoneapp.com/features/
- DeepJournal — Private journaling apps 2026: https://deepjournal.app/blog/best-private-journaling-apps-in-2026
- Streaks 2026 (App Store): https://apps.apple.com/us/app/streaks-2026-habit-tracker/id6740426283
- Knack — Best habit trackers 2026: https://www.knack.com/blog/best-habit-tracker-app/
- NerdWallet — Best budget apps 2026: https://www.nerdwallet.com/finance/learn/best-budget-apps
- Ramsey — Budgeting apps comparison: https://www.ramseysolutions.com/budgeting/budgeting-apps-comparison
- SlideToAnki — FSRS guide 2026: https://slidetoanki.com/blog/how-to-use-fsrs-anki-guide
- SlideToAnki — Best Anki add-ons 2026: https://slidetoanki.com/blog/best-anki-addons-2026
- Makeheadway — StoryGraph vs Goodreads 2026: https://makeheadway.com/blog/storygraph-vs-goodreads/
- ClickUp — Life planning tools 2026: https://clickup.com/blog/life-planning-software/
- Notion — Weekly review dashboards: https://www.notion.com/templates/weekly-review-dashboard

## Khoảng cách đã xác định

### Việc (Tasks)
- Không có việc lặp lại (Todoist hiểu cả "every 3rd Wednesday", "after 2 days" tính từ lúc hoàn thành).
- Không có nhập ngôn ngữ tự nhiên ("họp 3h chiều thứ 5" → tự điền hạn) — chuẩn mực của Todoist.
- Không có Pomodoro gắn với từng việc (TickTick có sẵn, miễn phí).
- Chưa kéo-thả sắp thứ tự (cần cột `sort_order`).

### Thói quen
- Chưa có chuỗi hiện tại / chuỗi dài nhất / % đều đặn cho **từng** thói quen (Streaks, Habitify có).
- Chưa có lịch linh hoạt: "3 lần/tuần", "thứ 2-4-6", "cách 2 ngày".
- Chưa có nhắc giờ riêng cho từng thói quen.

### Nhật ký (Daily)
- Chưa có "Ngày này năm trước" (tính năng được nhắc nhiều nhất của Day One).
- Chưa có tìm kiếm trong nhật ký, chưa có tag. (Đánh dấu yêu thích thì **đã có**.)
- Không tự gắn metadata: thời tiết, vị trí, số bước (Day One đính tự động).
- Không có khoá app (PIN/vân tay), không mã hoá.

### Tiền
- Không có ngân sách / hạn mức theo danh mục (lõi của YNAB, Spendee, Goodbudget).
- Không có giao dịch định kỳ, không nhắc hạn hoá đơn.
- Danh mục cứng 8 loại, không sửa được; không đa tiền tệ; không xuất CSV.
- Không có ví chung/chia sẻ (Spendee có; app đã có tính năng cặp đôi nên rất hợp).

### Học (Kiến thức / English)
- Đang dùng SM-2 rút gọn; Anki đã sang FSRS — giảm 20-30% số thẻ ôn mỗi ngày với độ nhớ tương đương.
- Không có cloze (điền khuyết), không có che ảnh (image occlusion).
- Chưa có biểu đồ dự báo lượng ôn sắp tới và tỉ lệ nhớ.

### Sách / thư viện
- Thiếu trang thống kê đọc (StoryGraph: số trang/ngày, tốc độ, phân bố thể loại, tâm trạng).
- Chưa có mục tiêu đọc theo tháng/năm (Goodreads Reading Challenge).

### Toàn app
- Chưa nhập lại được backup (chỉ xuất JSON) — lỗ hổng dữ liệu nguy hiểm nhất.
- Chưa có widget / shortcut. Widget thật (iOS/Android) cần app native; PWA chỉ khai báo được
  `shortcuts` trong manifest (menu nhấn giữ icon) — miễn phí, chi phí thấp.
- Không đồng bộ lịch (ICS / Google Calendar).
- Xem lại tuần chỉ có số liệu, chưa có bộ câu hỏi gợi ý như Notion weekly review.

## Thứ tự ưu tiên đã chốt

1. Việc lặp lại + nhập ngôn ngữ tự nhiên (Tasks)
2. Nhập lại backup
3. Ngân sách theo danh mục + giao dịch định kỳ (Tiền)
4. "Ngày này năm trước" + tìm kiếm nhật ký
5. Khoá app bằng PIN

---

# Đợt 2 — 20/08/2026: nền tảng web & API miễn phí

## Nguồn

- Chrome for Developers — Built-in AI: https://developer.chrome.com/docs/ai/built-in
- Chrome for Developers — Prompt API: https://developer.chrome.com/docs/ai/prompt-api
- Gemini Nano trong trình duyệt (Chrome 148): https://pasqualepillitteri.it/en/news/3145/gemini-nano-chrome-built-in-ai-client-side-en
- Open-Meteo (không cần API key): https://open-meteo.com/
- APIScout — 50+ free APIs 2026: https://apiscout.dev/guides/best-free-apis-2026
- Mixed Analytics — API công khai không cần auth: https://mixedanalytics.com/blog/list-actually-free-open-no-auth-needed-apis/
- Calen.events — Hướng dẫn ICS cho lập trình viên: https://www.calen.events/blog/ics-file-calendar-integration-guide
- Alphonso Labs — 15 tính năng PWA 2026: https://www.alphonsolabs.com/pwa-must-have-features-2026/
- Progressier — PWA capabilities 2026: https://progressier.com/pwa-capabilities

## Đã làm trong đợt này

- Web Share Target + đoán loại link (kênh đã theo dõi > YouTube Music/VEVO > từ khoá)
- Badge số việc trên icon app
- View Transitions khi đổi tab
- Hàng đợi ghi offline (localStorage, tự đẩy khi online/focus)

## Ứng viên tiếp theo

### AI chạy ngay trên máy — miễn phí, không API key
Chrome 148 đưa Gemini Nano vào thẳng trình duyệt: Prompt / Summarizer / Translator /
Writer / Rewriter. Model tải một lần, chạy bằng WebGPU, dữ liệu không rời máy, Google
không tính tiền. Hợp với app này ở: tóm tắt nhật ký tuần, gợi ý tên việc từ câu gõ vội,
tóm tắt video đã xem, dịch câu tiếng Anh trong tab English. Cần dự phòng cho trình duyệt
chưa hỗ trợ (`'LanguageModel' in self`).

### Xuất lịch ICS (RFC 5545)
Việc có hạn + dịp của người thân + kỷ niệm → file .ics tải về, nhập vào Google/Apple
Calendar. Chỉ là ghép chuỗi, không cần thư viện. Thêm được cả link "đăng ký lịch" nếu
sau này có endpoint public.

### Thời tiết Open-Meteo (không cần key)
Đính nhiệt độ/thời tiết vào nhật ký như Day One làm, và vào báo cáo ngày.
Toạ độ lấy từ `navigator.geolocation`, có cache theo ngày để khỏi gọi lại.

### Các mảng còn nợ từ đợt 1
- Ngân sách theo danh mục + giao dịch định kỳ (tab Tiền)
- FSRS thay SM-2 (tab học)
- Khoá app bằng passkey/vân tay (WebAuthn)
- CBZ/EPUB nhập từ máy (đã có jszip)
- Background Sync thật trong service worker (cần injectManifest)

---

# Đợt 3 — 20/08/2026: soi lại theo hướng "cấp bách", không phải "hay ho"

## Nguồn

- Ink & Switch — Local-first software: https://www.inkandswitch.com/essay/local-first/
- Local-First Software Guide 2026: https://www.alexcloudstar.com/blog/local-first-software-developer-guide-2026/
- Educative — Data conflict detection and resolution: https://www.educative.io/courses/mobile-system-design/lta/data-conflict-detection-and-resolution
- TechBuzz — Mất 30 năm dữ liệu vì khoá tài khoản: https://www.techbuzz.ai/articles/cloud-storage-nightmare-user-loses-30-years-of-data-after-microsoft-account-lock
- UBOS — OneDrive xoá nhầm file: https://ubos.tech/news/onedrive-data-loss-concerns-rise-as-users-report-deleted-files-ubos-news/
- Day One — Passcode & Biometric: https://dayoneapp.com/features/passcode-biometric-security/
- Day One — Privacy FAQs: https://dayoneapp.com/privacy-faqs/
- Todoist — 2026 changelog: https://www.todoist.com/help/articles/2026-changelog-HD3jJAtLd

## Cấp bách (đã kiểm chứng trong mã nguồn)

1. **Không có ErrorBoundary** — `grep -rn "ErrorBoundary\|componentDidCatch" src` không ra kết quả nào.
   Một lỗi render ở bất kỳ tab nào là trắng màn hình toàn app, không có nút thoát.
2. **Backup thủ công, không ai nhắc** — `exportBackup` chỉ chạy khi tự bấm ở Hồ sơ.
   Toàn bộ dữ liệu nằm một chỗ trên Supabase free tier.
3. **Không có khoá app** — nhật ký, tiền, tin nhắn cặp đôi mở thẳng khi đưa máy cho người khác.
   Day One coi passcode/vân tay là tính năng nền tảng.
4. **Ghi đè không cảnh báo** — mọi update là last-write-wins, không so `updated_at`.
   Hai thiết bị sửa cùng bản ghi thì bên lưu sau nuốt bên kia, im lặng.
5. **Hàng đợi offline mới phủ 2 chỗ** — chỉ `daily_entries` và `todos` insert.
   Các tab khác mất mạng là mất thao tác.

## Chưa cấp bách nhưng còn nợ

- Tiền: không ngân sách theo danh mục, không giao dịch định kỳ, không xuất CSV.
- Thói quen: chưa có lịch linh hoạt (3 lần/tuần, thứ 2-4-6), chưa nhắc giờ riêng.
- Học: chưa có cloze / che ảnh, chưa có biểu đồ dự báo lượng ôn.
