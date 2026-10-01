# Hướng dẫn cài đặt App Nhắn tin — từng bước

Code đã xong và đã deploy. Phần còn lại là **5 việc trong tài khoản của bạn**
(Supabase + GitHub), làm đúng thứ tự dưới đây là dùng được.

- Web nhắn tin: https://nguyenvananh205-rgb.github.io/tu-lanh-gia-dinh/chat/
- Hiện tại mở link này sẽ thấy màn hình **"Cần cấu hình Supabase"** — đó là
  đúng, vì chưa có bước 1–4.

---

## Bước 1 — Tạo project Supabase (≈5 phút)

1. Mở https://supabase.com → **Start your project** → đăng nhập bằng GitHub.
2. **New project**:
   - *Name*: `app-nhan-tin` (tên gì cũng được)
   - *Database Password*: bấm **Generate a password** rồi **lưu lại** (sau này
     cần để truy cập DB trực tiếp; không cần cho app).
   - *Region*: **Southeast Asia (Singapore)** — gần Việt Nam nhất.
   - *Plan*: **Free**.
3. Bấm **Create new project** rồi đợi ~2 phút cho tới khi hết chữ
   "Setting up project".

## Bước 2 — Chạy file schema (tạo bảng + phân quyền)

1. Trong project Supabase, menu bên trái → **SQL Editor** → **New query**.
2. Mở file `chat-app/supabase/schema.sql` trong repo này, **copy toàn bộ**
   (khoảng 400 dòng) và dán vào ô SQL.
3. Bấm **Run** (hoặc Ctrl/Cmd + Enter).
4. Kết quả đúng: dòng chữ **Success. No rows returned**.
   - Nếu báo lỗi, copy nguyên văn lỗi gửi tôi.
   - File này chạy lại nhiều lần không sao (idempotent), nên lỡ chạy 2 lần
     cũng không hỏng gì.

> Bước này tạo: bảng người dùng, hội thoại, tin nhắn, link mời, toàn bộ
> policy bảo mật (RLS) và bucket `chat-media` để chứa ảnh/video/voice.

## Bước 3 — Bật đăng nhập bằng email

1. Menu trái → **Authentication** → **Sign In / Providers**.
2. Mục **Email**: bật **Enable email provider**.
3. **Tắt** công tắc **Confirm email** → **Save**.
   - Tắt để người được mời đăng ký xong vào dùng ngay, không phải chờ mail xác
     thực (bản Free của Supabase gửi mail rất giới hạn).
4. Vẫn trong **Authentication** → **URL Configuration**:
   - *Site URL*: `https://nguyenvananh205-rgb.github.io/tu-lanh-gia-dinh/chat/`
   - *Redirect URLs* → **Add URL**, dán đúng địa chỉ trên.
   - **Save**. (Bước này để link "quên mật khẩu" quay về app đúng chỗ.)

## Bước 4 — Đưa 2 khoá vào GitHub rồi build lại

### 4a. Lấy khoá trong Supabase

1. Menu trái → **Project Settings** (bánh xe) → **API Keys** (hoặc **API**).
2. Copy 2 giá trị:
   - **Project URL** → dạng `https://abcdxyz.supabase.co`
   - **anon** / **public** key → chuỗi rất dài bắt đầu bằng `eyJ...`
3. ⚠️ **Chỉ lấy khoá `anon`/`public`.** Tuyệt đối **không** dùng
   `service_role` — khoá đó bỏ qua mọi phân quyền, lộ ra là mất dữ liệu.
   Khoá `anon` công khai được, dữ liệu đã được RLS bảo vệ.

### 4b. Dán vào GitHub

1. Mở https://github.com/nguyenvananh205-rgb/tu-lanh-gia-dinh/settings/variables/actions
2. Bấm **New repository variable**, thêm lần lượt:

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | Project URL ở trên |
   | `VITE_SUPABASE_ANON_KEY` | khoá anon `eyJ...` |

3. (Tuỳ chọn, cho tab GIF) thêm `VITE_TENOR_API_KEY` — khoá miễn phí lấy ở
   Google Cloud → Tenor API. Không có thì tab GIF trống, emoji/sticker vẫn chạy.

### 4c. Build lại

Vite nhúng 2 biến này **vào lúc build**, nên phải chạy lại workflow sau khi
thêm biến:

1. https://github.com/nguyenvananh205-rgb/tu-lanh-gia-dinh/actions
2. Chọn workflow **Deploy to GitHub Pages** → lần chạy mới nhất →
   **Re-run all jobs**.
3. Đợi ~2 phút cho 2 ô xanh (build + deploy).
4. Mở lại web nhắn tin: phải thấy **màn hình đăng nhập**, không còn chữ
   "Cần cấu hình Supabase".

## Bước 5 — Tự cấp quyền admin cho mình

1. Mở web nhắn tin → **Tạo tài khoản** bằng email của bạn + mật khẩu bạn tự đặt.
2. Sẽ thấy màn hình **"Đang chờ duyệt"** — đúng, kể cả bạn cũng phải được duyệt.
3. Về Supabase → **SQL Editor** → **New query**, dán (thay email của bạn):

   ```sql
   update public.chat_users
   set status = 'approved', role = 'admin'
   where id = (select id from auth.users where email = 'email-cua-ban@example.com');
   ```

4. **Run** → phải báo **Success**. Nếu `rows affected = 0` là email nhập sai.
5. Quay lại web, bấm **Tải lại** (hoặc F5) → vào được app, trên thanh đầu xuất
   hiện **nút khiên 🛡 (Quản trị)**.

> Chỉ cần làm **một lần duy nhất** bằng SQL. Từ đây mọi người khác bạn duyệt
> ngay trong app.

---

## Dùng hằng ngày

### Mời người mới

1. Trong app → nút 🔗 trên thanh đầu (**Tạo link mời**) → hộp **Link mời trò
   chuyện** hiện ra, link đã có sẵn → bấm **Copy link**.
2. Gửi link đó cho người bạn muốn (Zalo/Messenger/email đều được).
3. Một link dùng được cho **nhiều người**; mỗi người click + đăng ký sẽ có
   **một box chat riêng với bạn**, không ai thấy ai.
4. Link **hết hạn sau 7 ngày**. Muốn chặn giữa đường thì bấm **Link mới** —
   link cũ lập tức vô hiệu, người đã vào vẫn giữ box chat của họ.

### Duyệt người mới

1. Người mới đăng ký xong nằm ở trạng thái **Chờ duyệt** và chưa đọc/gửi được gì.
2. Bạn mở nút **🛡 Duyệt người dùng** → tab **Chờ duyệt (n)** → thấy danh sách
   kèm email → bấm **Duyệt** (✓) hoặc **Từ chối** (✕).
3. Duyệt xong họ F5 là vào chat được. Người đã duyệt muốn khoá lại thì bấm
   **Thu hồi quyền dùng app**; khoá rồi muốn mở lại thì bấm **Cho dùng lại**.

### Mẹo nhỏ

- **Không duyệt người lạ.** Ai có URL cũng đăng ký được, nhưng không duyệt thì
  họ không xem được gì cả.
- Mỗi người **đổi tên hiển thị** trong nút hồ sơ (ảnh đại diện góc phải);
  tên không được trùng với người khác.
- **Thông báo** tin nhắn mới: bấm nút 🔔 một lần để cho phép trên trình duyệt.
- **Voice message** cần trình duyệt cho phép micro; iPhone phải dùng Safari.
- Ảnh/video nằm trong bucket **riêng tư**, chỉ thành viên của box chat mở được.

---

## Lỗi hay gặp

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| Vẫn thấy "Cần cấu hình Supabase" | Chưa thêm biến ở bước 4b, hoặc đã thêm mà **chưa re-run workflow** (bước 4c). |
| "Invalid login credentials" khi đăng nhập | Sai mật khẩu, hoặc chưa tạo tài khoản. Dùng **Quên mật khẩu**. |
| Đăng ký xong đòi xác thực email | Chưa tắt **Confirm email** (bước 3). |
| Mắc ở "Đang chờ duyệt" | Đúng quy trình — chờ admin duyệt; nếu là chính bạn thì làm bước 5. |
| Click link mời nhưng không có box chat | Phải **đăng nhập/đăng ký xong** link mới được áp dụng; link có thể đã bị thu hồi. |
| Ảnh không hiện | Chưa chạy hết `schema.sql` (thiếu bucket `chat-media`) — chạy lại bước 2. |
