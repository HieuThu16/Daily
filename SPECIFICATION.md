# MASTER PROMPT — PERSONAL LIFE MANAGEMENT PWA

## 1. Vai trò

Bạn là một **Senior Full-Stack Engineer + Product Designer + UI/UX Designer**, có kinh nghiệm xây dựng:

* React + TypeScript
* Vite
* TailwindCSS
* Progressive Web App (PWA)
* Supabase
* PostgreSQL
* Supabase Auth
* Google OAuth
* Row Level Security (RLS)
* Responsive mobile-first UI
* Modern minimal design

Hãy xây dựng hoàn chỉnh một **Personal Life Management PWA** dành cho một người dùng cá nhân.

Ứng dụng dùng để quản lý:

1. Daily Journal
2. Habits
3. Todo
4. Ideas
5. Personal Library:

   * Books
   * Movies
   * YouTube
   * Music

Mục tiêu của app là tạo ra một **không gian cá nhân thống nhất**, nơi người dùng có thể:

* ghi lại những gì xảy ra mỗi ngày,
* theo dõi những thói quen đơn giản,
* quản lý những việc cần làm,
* lưu lại ý tưởng,
* lưu những nội dung muốn xem/đọc/nghe,
* theo dõi trạng thái của chúng.

Không xây dựng app theo hướng project-management phức tạp.

---

# 2. Product Philosophy

Ứng dụng phải có cảm giác:

> "Đây là không gian cá nhân của tôi."

Không phải:

> "Đây là một phần mềm quản lý công việc."

Ưu tiên:

* đơn giản,
* nhanh,
* dễ dùng hàng ngày,
* ít thao tác,
* ít form phức tạp,
* nhiều khoảng trắng,
* typography rõ ràng,
* mobile-first,
* không có những tính năng không cần thiết.

Không tự ý thêm:

* deadline cho Todo,
* priority cho Todo,
* category cho Todo,
* streak cho Habit,
* gamification,
* rating cho Library,
* social features,
* comments,
* sharing,
* followers,
* API tìm kiếm media,
* upload ảnh,
* hệ thống emotion tracking phức tạp.

---

# 3. Technology Stack

## Frontend

Sử dụng:

* React
* TypeScript
* Vite
* TailwindCSS
* React Router
* Supabase JavaScript Client
* PWA support

Có thể sử dụng thêm các thư viện nhỏ nếu thực sự cần thiết, nhưng không thêm dependency không cần thiết.

Ưu tiên:

* component reusable,
* typed data,
* clean architecture,
* separation of concerns.

---

# 4. Backend / Database

Không xây dựng Spring Boot backend.

Sử dụng hoàn toàn:

**Supabase**

Bao gồm:

* Supabase Auth
* PostgreSQL
* Row Level Security
* Supabase client từ frontend

Google OAuth là phương thức đăng nhập duy nhất.

Không sử dụng:

* email/password,
* username/password,
* guest account.

---

# 5. Authentication

## Google Login

Người dùng chỉ đăng nhập bằng Google.

Login flow:

```text
Open App
    ↓
Check Supabase Session
    ↓
Has Session?
 ┌───────┴───────┐
YES              NO
 ↓                ↓
Home          Login Page
                  ↓
             Continue with Google
                  ↓
             Google OAuth
                  ↓
             Supabase Session
                  ↓
                 Home
```

Session phải được persist lâu dài.

Khi người dùng mở lại PWA:

* tự động kiểm tra session,
* nếu session hợp lệ → vào Home,
* không bắt đăng nhập lại mỗi lần mở app.

Cần xử lý:

* loading auth state,
* expired session,
* logout,
* auth error.

---

# 6. Database Security

Mỗi user chỉ được phép truy cập dữ liệu của chính mình.

Sử dụng:

```sql
auth.uid()
```

cho Row Level Security.

Tất cả bảng chứa dữ liệu cá nhân phải có:

```text
user_id
```

RLS phải đảm bảo:

```text
SELECT → chỉ dữ liệu của chính user
INSERT → chỉ tạo dữ liệu với user_id của chính user
UPDATE → chỉ sửa dữ liệu của chính user
DELETE → không hard delete
```

Không bao giờ tin `user_id` do frontend gửi lên.

Khi insert record:

```text
user_id = authenticated user's id
```

Các RLS policy phải được viết rõ ràng.

---

# 7. Soft Delete

Không hard delete dữ liệu người dùng.

Các entity chính phải hỗ trợ:

```text
deleted_at
```

Quy tắc:

```text
deleted_at IS NULL
→ dữ liệu đang hoạt động

deleted_at IS NOT NULL
→ dữ liệu đã xóa
```

UI bình thường chỉ query:

```text
deleted_at IS NULL
```

Khi người dùng xóa:

```text
UPDATE
SET deleted_at = now()
```

Không cần xây dựng Trash UI.

Không cần Restore UI.

Không cần auto-delete.

Dữ liệu soft-deleted được giữ **vô thời hạn** trong database.

---

# 8. Main Navigation

Mobile-first.

Sử dụng **Bottom Navigation với 5 tab**.

```text
┌─────────────────────────────────────┐
│                                     │
│              CONTENT                │
│                                     │
├─────────────────────────────────────┤
│ Home Habit Daily Tasks Library      │
│  🏠    🔥    📝     📋      📚      │
└─────────────────────────────────────┘
```

5 tab:

```text
1. Home
2. Habit
3. Daily
4. Tasks
5. Library
```

Bottom navigation phải:

* fixed ở bottom trên mobile,
* dễ bấm bằng ngón tay,
* có active state rõ ràng,
* không quá cao,
* không gây che content.

Desktop có thể chuyển thành sidebar hoặc giữ navigation phù hợp responsive layout, nhưng mobile phải là ưu tiên số 1.

---

# 9. Design System

Phong cách:

**Minimal / Clean / Spacious**

Không sử dụng UI quá màu mè.

Ưu tiên:

* white space,
* rounded cards vừa phải,
* subtle border,
* subtle shadow,
* typography rõ ràng,
* icon đơn giản,
* hierarchy tốt.

Theme:

```text
Light Mode = mặc định
Dark Mode = hỗ trợ
```

Có thể dùng system preference để khởi tạo nhưng Light Mode phải là default.

Không hard-code quá nhiều màu trong component.

Tạo design tokens / Tailwind classes hợp lý.

---

# 10. HOME

Home là **dashboard tổng quan nhanh**.

Không phải nơi nhập liệu chính.

Home phải giúp người dùng mở app và trong vài giây biết:

* hôm nay đã làm gì,
* habit hôm nay ra sao,
* còn Todo gì,
* đang xem/đọc gì.

## Home sections

### Header

Hiển thị:

```text
Good morning / Good afternoon / Good evening

[User name]
```

và ngày hiện tại.

Ví dụ:

```text
Good evening
Hieu

Tuesday, August 11
```

---

## Today's Habits

Hiển thị các habit active.

Ví dụ:

```text
Today's Habits

☑ Read books
☐ Exercise
☑ Learn English
```

Người dùng có thể tick nhanh trực tiếp từ Home.

---

## Today's Daily

Hiển thị preview Daily hôm nay.

Nếu chưa có:

```text
How was your day?

Write something...
```

Có CTA:

```text
Write Daily
```

---

## Todo

Hiển thị Todo chưa hoàn thành.

Ví dụ:

```text
Todo

☐ Fix login bug
☐ Read Spring Security
☐ Clean desk

View all →
```

Cho phép tick hoàn thành nhanh.

---

## Currently Watching / Reading

Hiển thị Library items có status:

```text
IN_PROGRESS
```

Ví dụ:

```text
Currently

📚 Clean Code
Reading

🎬 Interstellar
Watching

▶️ Spring Boot Tutorial
Watching
```

---

## Dashboard Statistics

Home hoặc một khu vực Statistics riêng trong Home có thể hiển thị:

### Daily

```text
Daily entries
28
```

và progress/activity đơn giản.

### Habit

```text
Today's habits
3 / 5 completed
```

### Library

```text
Books
12

Movies
8

YouTube
20

Music
15
```

Có thể hiển thị progress theo trạng thái.

Không xây dựng analytics quá phức tạp.

---

# 11. DAILY JOURNAL

Daily là **module quan trọng nhất của app**.

Triết lý:

> Nhật ký tự do.

Không ép người dùng phải điền đúng 3 trường.

Ba mục:

```text
Điều mới
Điều buồn
Việc nhỏ đã làm
```

chỉ là **gợi ý**.

---

# 12. Daily Data Model

Một Daily entry nên là một record.

Không cần một record cố định cho mỗi ngày.

Người dùng có thể tạo nhiều Daily entries trong cùng một ngày.

Mỗi entry chỉ cần text.

Không:

* ảnh,
* video,
* rich text,
* emotion tracking,
* rating.

Schema đề xuất:

```text
daily_entries

id
user_id
content
created_at
updated_at
deleted_at
```

Có thể thêm:

```text
entry_date
```

để dễ query theo ngày.

Nên có:

```text
entry_date DATE
```

và dùng nó làm ngày mà người dùng nhìn thấy entry.

---

# 13. Daily UX

Khi mở Daily:

Hiển thị ngày hiện tại.

Ví dụ:

```text
Tuesday
August 11, 2026

How was your day?

[ Write something... ]

Suggestions:

✨ Điều mới
😔 Điều buồn
🌱 Việc nhỏ đã làm
```

Các suggestion chỉ giúp người dùng bắt đầu viết.

Không bắt buộc.

---

# 14. Daily Create

Thao tác chính:

```text
Write → Save
```

Form cực kỳ đơn giản:

```text
[ Textarea ]

Write anything...

                    Save
```

Sau khi save:

* record được tạo,
* UI cập nhật ngay,
* không reload toàn page.

---

# 15. Daily Edit

Cho phép sửa Daily của:

**bất kỳ ngày nào.**

Không chỉ hôm nay.

Khi edit:

```text
Update
```

Không tạo version history.

Chỉ lưu nội dung hiện tại.

---

# 16. Daily Delete

Soft delete.

Không hard delete.

Có thể yêu cầu confirmation trước khi xóa nếu UX phù hợp.

Sau khi xóa:

```text
deleted_at = now()
```

Không hiển thị entry đó nữa.

---

# 17. Daily View

Daily phải hỗ trợ:

### Calendar

Cho phép chọn ngày.

Ví dụ:

```text
August 2026

Mon Tue Wed Thu Fri Sat Sun
                  1   2
3   4   5   6   7   8   9
...
```

Chọn ngày:

```text
August 11

Entries
────────────

09:30
Learned something new...

20:15
Small thing I completed...
```

---

# 18. Daily Timeline

Ngoài calendar, Daily phải có timeline.

Timeline sắp xếp:

```text
newest → oldest
```

Ví dụ:

```text
Today

20:15
Finished cleaning my desk.

09:30
Learned something interesting.

Yesterday

22:10
...
```

---

# 19. Daily Search

Có search.

Search theo:

```text
content
```

Ví dụ:

```text
Search Daily...

[ spring boot ]

Results:
Aug 10
...
Aug 04
...
July 21
...
```

---

# 20. HABITS

Habit rất đơn giản.

Không xây dựng habit management phức tạp.

## Rule

Tất cả habit đều:

```text
Daily
```

Không có:

* weekly schedule,
* selected days,
* streak,
* points,
* reward,
* gamification.

---

# 21. Habit Create

Form:

```text
Habit name

[ Read books ]

[ Create Habit ]
```

Mỗi habit mặc định là daily.

---

# 22. Habit Tracking

Mỗi ngày người dùng chỉ cần:

```text
☐
```

hoặc:

```text
☑
```

Ví dụ:

```text
Today's Habits

☑ Read books
☐ Exercise
☑ Learn English
```

Click:

```text
unchecked → completed
completed → unchecked
```

---

# 23. Habit History

Có lịch sử tick theo ngày.

Ví dụ:

```text
Read Books

August 2026

Mon Tue Wed Thu Fri Sat Sun
 ✓   ✓   ✗   ✓   ✓   ✓   ✗
```

Không cần streak calculation.

Không cần gamification.

---

# 24. Habit Data Model

```text
habits

id
user_id
name
is_active
created_at
updated_at
deleted_at
```

Habit completion:

```text
habit_logs

id
habit_id
user_id
date
completed
created_at
updated_at
```

Nên enforce unique:

```text
habit_id + date
```

để một habit chỉ có một log cho mỗi ngày.

---

# 25. TODO

Todo cực kỳ đơn giản.

Một danh sách duy nhất.

Không:

* deadline,
* priority,
* category,
* tags,
* project,
* assignee.

---

# 26. Todo UI

Tasks tab có hai khu vực:

```text
Tasks

TODO
──────────────

☐ Fix login
☐ Read Spring Security
☐ Clean desk


IDEAS
──────────────

...
```

Todo statuses:

```text
TODO
COMPLETED
```

---

# 27. Todo Create

Quick add:

```text
+ Add Todo

[ What needs to be done? ]

[ Add ]
```

Thao tác chính:

* Add
* Complete

---

# 28. Todo Completion

Click checkbox:

```text
TODO
 ↓
COMPLETED
```

Completed item có thể:

* line-through,
* opacity thấp hơn.

Không cần animation phức tạp.

---

# 29. Todo Search

Search theo:

```text
title
```

Ví dụ:

```text
Search Todo...

[ spring ]

☐ Learn Spring Security
✓ Review Spring project
```

---

# 30. Todo Data Model

```text
todos

id
user_id
title
completed
created_at
updated_at
deleted_at
```

Không có deadline.

Không có priority.

Không có category.

---

# 31. IDEAS

Ideas nằm chung trong **Tasks tab**.

Tasks:

```text
Todo
Ideas
```

Hai khu vực tách biệt rõ ràng.

---

# 32. Idea Data

Idea chỉ là text.

Schema:

```text
ideas

id
user_id
title
content
created_at
updated_at
deleted_at
```

Không:

* tags,
* category,
* priority,
* status.

---

# 33. Idea UI

Danh sách:

```text
Ideas

+ Add Idea

────────────────

Build a Pokemon game
I want to create...

Personal finance app
Maybe build...

English learning system
...
```

Hiển thị:

```text
Title
Content preview
```

---

# 34. Idea Search

Search theo:

```text
title
content
```

Ví dụ:

```text
Search Ideas...

[ game ]

Pokemon Battle Game
...
```

---

# 35. Library

Library gồm 4 tab riêng:

```text
Books
Movies
YouTube
Music
```

Không sử dụng API.

Không tìm kiếm external service.

Không URL.

Không upload image.

Người dùng nhập thủ công.

---

# 36. Library Item

Thông tin mỗi item:

```text
name
description
status
favorite
```

Không:

* rating,
* cover,
* image,
* URL,
* author metadata bắt buộc,
* API metadata.

---

# 37. Library Status

Status concept:

```text
PLANNED
IN_PROGRESS
COMPLETED
```

Label hiển thị phụ thuộc loại:

### Books

```text
Muốn đọc
Đang đọc
Đã đọc
```

### Movies

```text
Muốn xem
Đang xem
Đã xem
```

### YouTube

```text
Muốn xem
Đang xem
Đã xem
```

### Music

```text
Muốn nghe
Đang nghe
Đã nghe
```

Database vẫn có thể dùng chung enum:

```text
PLANNED
IN_PROGRESS
COMPLETED
```

---

# 38. Library Favorite

Mỗi item có:

```text
is_favorite BOOLEAN
```

UI:

```text
♡
```

hoặc:

```text
❤️
```

Click để toggle.

Áp dụng cho:

* Books
* Movies
* YouTube
* Music

Không cần rating.

---

# 39. Library UI

Ví dụ:

```text
Library

[ Books ] [ Movies ] [ YouTube ] [ Music ]

Search...

                    + Add

────────────────────────

Currently reading

Clean Code
Đang đọc

────────────────────────

Want to read

Atomic Habits
Muốn đọc

────────────────────────

Completed

...
```

Có thể dùng horizontal tabs trên mobile.

Tabs phải scroll ngang nếu cần.

---

# 40. Library Quick Actions

Ưu tiên:

```text
+ Add
Search
Change Status
Favorite
```

Không tạo flow phức tạp.

---

# 41. Library Create Form

Mỗi loại có form riêng.

Ví dụ Book:

```text
Add Book

Name
[ Clean Code ]

Description
[ ... ]

Status
[ Muốn đọc ]

Favorite
[ ♡ ]

[ Save ]
```

Movie:

```text
Add Movie

Name
Description
Status
Favorite
```

YouTube:

```text
Add YouTube

Name
Description
Status
Favorite
```

Music:

```text
Add Music

Name
Description
Status
Favorite
```

Không cần URL.

Không cần image.

---

# 42. Library Search

Mỗi tab có search riêng.

Search theo:

```text
name
description
```

Ví dụ:

```text
Books

Search books...

[ clean ]

Clean Code
Clean Architecture
```

---

# 43. Library Data Model

Có thể dùng một bảng chung:

```text
media_items

id
user_id
type
name
description
status
is_favorite
created_at
updated_at
deleted_at
```

Type:

```text
BOOK
MOVIE
YOUTUBE
MUSIC
```

Status:

```text
PLANNED
IN_PROGRESS
COMPLETED
```

---

# 44. Statistics

Có dashboard statistics.

Nhưng statistics phải đơn giản.

Không cần analytics engine.

## Daily

Hiển thị:

```text
Total Daily Entries
```

và progress/activity theo thời gian.

Ví dụ:

```text
Daily

28 entries

This month
████████████░░░
```

---

## Habit

Hiển thị:

```text
Today's Habits
3 / 5 completed
```

và progress:

```text
████████████░░░
```

Không streak.

---

## Library

Hiển thị:

```text
Books
12

Movies
8

YouTube
20

Music
15
```

Có thể breakdown:

```text
Books

Want to read: 4
Reading: 2
Completed: 6
```

Tương tự với các loại còn lại.

---

# 45. Search Architecture

Search được hỗ trợ ở:

```text
Daily
Todo
Ideas
Library
```

Search behavior:

* realtime hoặc debounce nhẹ,
* case-insensitive,
* title/content matching,
* không cần full-text search phức tạp ở MVP.

---

# 46. Forms

Mỗi entity có form riêng:

```text
DailyForm
HabitForm
TodoForm
IdeaForm
BookForm
MovieForm
YoutubeForm
MusicForm
```

Form phải hỗ trợ:

```text
create
edit
validation
loading
error
success
```

Không dùng một form khổng lồ cho tất cả entity.

---

# 47. Loading States

Mọi async operation phải có loading state.

Ví dụ:

```text
Loading Daily...
```

hoặc skeleton.

Không để UI trống không có feedback.

---

# 48. Empty States

Mỗi section phải có empty state.

Ví dụ:

```text
No habits yet.

Create your first habit.
```

Todo:

```text
You're all clear ✨
No pending tasks.
```

Ideas:

```text
No ideas yet.

Capture your first idea.
```

Library:

```text
Nothing here yet.

Add something you want to watch.
```

---

# 49. Error Handling

Phải xử lý:

* network error,
* Supabase error,
* authentication error,
* validation error,
* database error.

Thông báo ngắn gọn, dễ hiểu.

Ví dụ:

```text
Something went wrong.
Please try again.
```

Không hiển thị raw database error cho user.

---

# 50. Network / Offline

Offline không phải mục tiêu.

Khi mất mạng:

* app có thể hiển thị dữ liệu đã tải/cached nếu có,
* không cho phép ghi dữ liệu offline,
* các thao tác create/update/delete cần internet,
* hiển thị trạng thái offline rõ ràng.

Không xây dựng offline-first sync engine.

Không xây dựng conflict resolution.

---

# 51. PWA

App phải là PWA.

Yêu cầu:

* installable,
* manifest,
* icons,
* theme color,
* standalone mode,
* service worker,
* responsive,
* mobile viewport.

Trên mobile, khi install:

```text
Open app
```

phải cho cảm giác gần giống native app.

Không cần offline database synchronization.

---

# 52. Responsive Design

Mobile-first.

Thiết kế ưu tiên:

```text
360px
390px
414px
```

Sau đó responsive cho:

```text
768px
1024px
1440px+
```

Mobile:

```text
Bottom Navigation
```

Desktop:

Có thể chuyển thành sidebar nếu hợp lý.

Không chỉ phóng to giao diện mobile lên desktop.

---

# 53. Accessibility

Áp dụng cơ bản:

* semantic HTML,
* button có aria-label khi cần,
* keyboard accessible,
* focus states,
* contrast tốt,
* input label rõ ràng.

Không dùng icon-only button mà không có accessible label.

---

# 54. Architecture

Tổ chức frontend theo feature/domain.

Ví dụ:

```text
src/
│
├── app/
│   ├── router/
│   ├── providers/
│   └── layout/
│
├── components/
│   ├── ui/
│   ├── navigation/
│   └── common/
│
├── features/
│   ├── auth/
│   ├── home/
│   ├── daily/
│   ├── habits/
│   ├── todos/
│   ├── ideas/
│   ├── library/
│   └── statistics/
│
├── lib/
│   ├── supabase.ts
│   ├── utils.ts
│   └── constants.ts
│
├── hooks/
│
├── types/
│
└── styles/
```

Mỗi feature nên có:

```text
components/
hooks/
services/
types/
```

khi cần thiết.

Không tạo abstraction chỉ để làm code phức tạp hơn.

---

# 55. Supabase Structure

Tạo migration SQL đầy đủ.

Tables:

```text
daily_entries
habits
habit_logs
todos
ideas
media_items
```

Auth user được quản lý bởi Supabase Auth.

Không cần tạo profile table nếu không cần thiết.

---

# 56. Suggested SQL

Thiết kế database theo hướng:

```sql
daily_entries
---------------
id uuid primary key
user_id uuid not null
entry_date date not null
content text not null
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz
```

```sql
habits
---------------
id uuid primary key
user_id uuid not null
name text not null
is_active boolean default true
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz
```

```sql
habit_logs
---------------
id uuid primary key
habit_id uuid not null
user_id uuid not null
date date not null
completed boolean default false
created_at timestamptz
updated_at timestamptz
```

Unique:

```text
(habit_id, date)
```

---

```sql
todos
---------------
id uuid primary key
user_id uuid not null
title text not null
completed boolean default false
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz
```

---

```sql
ideas
---------------
id uuid primary key
user_id uuid not null
title text not null
content text not null
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz
```

---

```sql
media_items
---------------
id uuid primary key
user_id uuid not null
type text not null
name text not null
description text
status text not null
is_favorite boolean default false
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz
```

---

# 57. Database Constraints

Use UUID primary keys.

Use:

```text
gen_random_uuid()
```

hoặc Supabase-compatible UUID generation.

Tạo foreign keys phù hợp.

Tạo indexes cho:

```text
user_id
deleted_at
entry_date
created_at
media type
media status
```

Đặc biệt:

```text
habit_id + date
```

unique.

---

# 58. RLS

Bật RLS trên tất cả bảng.

Ví dụ concept:

```sql
user_id = auth.uid()
```

cho SELECT / INSERT / UPDATE.

Với soft delete:

Không cho phép frontend thực hiện hard delete.

Nếu vẫn expose DELETE policy, cân nhắc không cấp DELETE và chỉ cho UPDATE `deleted_at`.

Mục tiêu:

```text
User A
  ↓
chỉ thấy User A data

User B
  ↓
chỉ thấy User B data
```

---

# 59. Data Fetching

Không fetch toàn bộ database nếu không cần.

Home:

Fetch only:

```text
today habits
today daily preview
pending todos
in-progress media
statistics
```

Daily:

Fetch theo selected date / search query.

Library:

Fetch theo selected type.

Todo:

Fetch active/completed todos.

Ideas:

Fetch ideas.

---

# 60. State Management

Không cần Redux nếu app chưa có nhu cầu phức tạp.

Có thể sử dụng:

* React state
* Context cho auth/theme
* custom hooks
* Supabase queries

Nếu cần server-state caching, có thể dùng TanStack Query.

Không đưa Redux vào chỉ vì "đây là app lớn".

---

# 61. Routing

Protected routes:

```text
/
 /home
 /habit
 /daily
 /tasks
 /library
```

Auth:

```text
/login
```

Nếu chưa authenticated:

```text
→ /login
```

Nếu authenticated:

```text
→ /home
```

Library nested routes hoặc state:

```text
/library/books
/library/movies
/library/youtube
/library/music
```

hoặc tabs trong cùng route.

Chọn cách nào clean hơn.

---

# 62. UX Principles

Mọi thao tác thường xuyên phải nhanh.

Ví dụ Todo:

```text
Tap +
Type
Save
```

Daily:

```text
Open
Write
Save
```

Habit:

```text
Open
Tap checkbox
Done
```

Library:

```text
Open
Tap +
Enter information
Save
```

Không bắt user đi qua nhiều màn hình không cần thiết.

---

# 63. Confirmation Rules

Không hỏi confirmation cho:

* tick Habit,
* complete Todo,
* favorite Library.

Có thể hỏi confirmation cho:

* xóa Daily,
* xóa Habit,
* xóa Todo,
* xóa Idea,
* xóa Library item.

Vì các thao tác này sẽ soft delete.

---

# 64. Edit Behavior

Cho phép edit:

### Daily

Có.

### Habit

Có.

### Todo

Có.

### Idea

Có.

### Library

Có.

Sau update:

* update database,
* update UI,
* không reload toàn app.

---

# 65. Date Handling

Cẩn thận timezone.

Ứng dụng phục vụ cá nhân và Daily dựa trên ngày local.

Không để lỗi:

```text
August 11
```

bị lưu thành:

```text
August 10
```

do UTC conversion.

Daily và Habit date phải được xử lý theo local calendar date.

---

# 66. Security

Không hard-code:

```text
service_role_key
```

vào frontend.

Frontend chỉ dùng Supabase anon/public key phù hợp.

Không expose service role key.

Không tin user_id từ client.

RLS là lớp bảo mật bắt buộc.

---

# 67. Environment Variables

Sử dụng:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Không commit `.env`.

Tạo:

```text
.env.example
```

---

# 68. Google OAuth Setup Documentation

Trong README phải hướng dẫn:

1. Tạo Supabase project.
2. Mở Authentication.
3. Configure Google provider.
4. Tạo Google OAuth credentials.
5. Configure redirect URL.
6. Điền environment variables.
7. Chạy project.

Không hard-code credential.

---

# 69. README

README phải có:

```text
Project Overview

Features

Tech Stack

Project Structure

Environment Variables

Supabase Setup

Google OAuth Setup

Database Setup

RLS Setup

Local Development

Build

PWA Installation
```

Có ví dụ:

```bash
npm install
npm run dev
```

Nếu dùng pnpm thì ưu tiên:

```bash
pnpm install
pnpm dev
```

---

# 70. Implementation Order

Không xây mọi thứ cùng lúc.

Thực hiện theo thứ tự:

## Phase 1

Project setup:

* React
* TypeScript
* Vite
* Tailwind
* PWA
* Supabase client
* routing
* design system

## Phase 2

Authentication:

* Login page
* Google OAuth
* session persistence
* protected routes
* logout

## Phase 3

Database:

* migrations
* tables
* indexes
* RLS

## Phase 4

Daily:

* create
* edit
* soft delete
* calendar
* timeline
* search

## Phase 5

Habit:

* create
* edit
* daily tick
* history calendar

## Phase 6

Tasks:

* Todo
* Ideas
* search
* create/edit/delete

## Phase 7

Library:

* Books
* Movies
* YouTube
* Music
* status
* favorite
* search
* CRUD

## Phase 8

Home:

* today's overview
* habit progress
* daily preview
* pending todos
* currently watching
* statistics

## Phase 9

Polish:

* loading states
* empty states
* error states
* responsive
* dark mode
* accessibility
* PWA install experience

---

# 71. Important: Do Not Overengineer

Đây là một app cá nhân.

Không xây:

* microservices,
* REST backend riêng,
* complex state machine,
* event-driven architecture,
* CQRS,
* unnecessary abstractions,
* unnecessary APIs.

Supabase đã là backend.

Ưu tiên:

```text
Simple
Reliable
Fast
Maintainable
```

---

# 72. Final User Experience

Sau khi hoàn thành, flow chính phải như sau:

## Open App

```text
Google Session
      ↓
Home
```

Home:

```text
Today's Daily
Today's Habits
Pending Todo
Currently Reading/Watching
Statistics
```

---

## Daily

```text
Daily
 ↓
Select date
 ↓
Read existing entries
 ↓
Write new entry
 ↓
Save
```

---

## Habit

```text
Habit
 ↓
Today's habits
 ↓
Tap checkbox
 ↓
Completed
```

---

## Tasks

```text
Tasks

Todo
 ↓
Add / Complete

Ideas
 ↓
Add / Search / Edit
```

---

## Library

```text
Library

Books
Movies
YouTube
Music
```

Mỗi tab:

```text
Search
+
Add

Planned
In Progress
Completed
```

Item:

```text
Name
Description
Status
❤️ Favorite
```

---

# 73. Definition of Done

Project chỉ được xem là hoàn thành khi:

* [ ] Google Login hoạt động.
* [ ] Session được persist.
* [ ] Protected routes hoạt động.
* [ ] Supabase database hoạt động.
* [ ] RLS hoạt động đúng.
* [ ] User A không thể đọc User B data.
* [ ] Soft delete hoạt động.
* [ ] Daily CRUD hoạt động.
* [ ] Daily calendar hoạt động.
* [ ] Daily timeline hoạt động.
* [ ] Daily search hoạt động.
* [ ] Habit CRUD hoạt động.
* [ ] Habit daily tick hoạt động.
* [ ] Habit history hoạt động.
* [ ] Todo CRUD hoạt động.
* [ ] Todo completion hoạt động.
* [ ] Todo search hoạt động.
* [ ] Ideas CRUD hoạt động.
* [ ] Ideas search hoạt động.
* [ ] Books CRUD hoạt động.
* [ ] Movies CRUD hoạt động.
* [ ] YouTube CRUD hoạt động.
* [ ] Music CRUD hoạt động.
* [ ] Library search hoạt động.
* [ ] Library status hoạt động.
* [ ] Library favorite hoạt động.
* [ ] Home dashboard hoạt động.
* [ ] Statistics hoạt động.
* [ ] Light mode hoạt động.
* [ ] Dark mode hoạt động.
* [ ] Mobile-first responsive.
* [ ] Desktop responsive.
* [ ] PWA installable.
* [ ] Loading states đầy đủ.
* [ ] Empty states đầy đủ.
* [ ] Error states đầy đủ.
* [ ] README đầy đủ.
* [ ] `.env.example` có sẵn.
* [ ] Không expose Supabase service role key.

---

# 74. Coding Instruction

Hãy bắt đầu bằng việc:

1. Phân tích requirement.
2. Đề xuất folder structure.
3. Thiết kế database schema.
4. Viết Supabase SQL migrations.
5. Viết RLS policies.
6. Setup frontend.
7. Implement authentication.
8. Implement từng feature theo phase.
9. Test từng feature.
10. Cuối cùng polish UI/UX.

Không bỏ qua database/RLS để làm UI trước rồi mới nghĩ backend.

Không tạo mock backend nếu Supabase có thể được sử dụng trực tiếp.

Nếu cần đưa ra quyết định kỹ thuật nhỏ mà requirement chưa nói rõ, hãy chọn phương án:

> đơn giản nhất, an toàn nhất, dễ maintain nhất.

Không tự ý thêm feature ngoài requirement.

Trong toàn bộ quá trình, hãy giữ đúng product philosophy:

> **A minimal personal space for managing my days, habits, tasks, ideas, and things I want to watch, read, or listen to.**
