# Nhắn tin — app chat 1-1

App nhắn tin độc lập (React + TypeScript + Vite + Supabase). Không liên quan tới app
"Tủ lạnh gia đình" ở thư mục gốc: có `package.json`, cấu hình build và schema Supabase
riêng.

## Tài khoản & quyền riêng tư

- **Ai có URL cũng đăng ký được, nhưng phải được admin duyệt mới dùng được app.**
  Tài khoản mới ở trạng thái *chờ duyệt*: không mở được box chat, không tạo được link
  mời, không đọc/gửi được tin nhắn (điều kiện `is_approved()` nằm trong mọi RLS policy,
  không phải chỉ ẩn ở giao diện).
- **Đăng nhập bằng email + mật khẩu** do người dùng tự đặt (màn hình Đăng nhập / Đăng ký),
  có **Quên mật khẩu** (Supabase gửi email đặt lại) và **Đổi mật khẩu** trong mục Hồ sơ
  (phải nhập đúng mật khẩu hiện tại).
- **Tên hiển thị mặc định do hệ thống sinh**, dạng `Mèo Hiền 1907`, đảm bảo không trùng
  (unique index trên `lower(display_name)` + hàm `generate_display_name`). Người dùng đổi
  lại được bất cứ lúc nào trong mục Hồ sơ; tên trùng sẽ bị từ chối.
- **Mỗi người chỉ thấy box chat của mình**: RLS chỉ cho đọc hội thoại mà mình là thành
  viên, và chỉ thấy hồ sơ của người đang trò chuyện cùng. Không có danh sách người dùng
  công khai.
- **Mở box chat mới bằng link mời**: người kia mở link → đăng nhập → box chat giữa hai
  người xuất hiện. Không có link thì không ai mở được box chat với bạn.

Link mời hết hạn sau 7 ngày, dùng được cho nhiều người (mỗi người một box chat riêng), và
có nút **Link mới** để thu hồi link cũ.

**Ảnh/video/voice nằm trong bucket riêng tư.** File chỉ mở được bằng signed URL (hạn 1 giờ)
mà app xin hộ, và RLS chỉ cấp cho thành viên của đúng box chat chứa file đó — kể cả có URL
cũ trong tay cũng hết hạn.

## Duyệt người dùng (quyền admin)

Cấp quyền admin cho chính bạn **một lần** sau khi đăng ký, trong Supabase SQL Editor:

```sql
update public.chat_users set status = 'approved', role = 'admin'
where id = (select id from auth.users where email = 'email-cua-ban@example.com');
```

Từ đó, biểu tượng khiên trên header mở trang **Duyệt người dùng** (kèm badge số tài khoản
đang chờ). Ở đó bạn thấy tên hiển thị, email, thời điểm đăng ký và:

- **Duyệt** → người đó dùng app được ngay (họ bấm "Kiểm tra lại" ở màn chờ là vào).
- **Từ chối** → vẫn ở ngoài, thấy thông báo liên hệ người gửi link.
- **Thu hồi** người đang dùng → mất truy cập ngay lập tức, kể cả các box chat cũ.

Người dùng thường không tự sửa được trạng thái hay vai trò của mình: trigger
`protect_user_privileges` hoàn tác mọi thay đổi không đến từ admin, và hàm
`admin_set_user_status` tự kiểm tra quyền ở phía database.

## Số tin nhắn chưa đọc

Mỗi box chat trong danh sách có badge số tin chưa đọc (đếm chính xác tới 99), header hiện
tổng số. Số này được tính lại từ database mỗi lần mở app, cộng dồn theo thời gian thực khi
có tin mới, và chỉ về 0 khi bạn **thật sự đang xem** box chat đó (tab đang hiện và cửa sổ
đang focus) — để ngoài tab thì tin vẫn nằm im là chưa đọc, người gửi cũng chưa thấy "Đã xem".
Rời app lâu rồi quay lại, danh sách tự nạp lại để số liệu chắc chắn đúng.

## Thông báo tin nhắn mới

Nút chuông trên header xin quyền Notification của trình duyệt. Khi có tin nhắn đến mà bạn
đang ở tab khác, cửa sổ khác hoặc đang mở box chat khác, app hiện thông báo — bấm vào là
mở đúng box chat đó. Tiêu đề tab cũng hiện số tin chưa đọc, ví dụ `(3) Nhắn tin`.

Lưu ý: đây là thông báo **khi app đang mở**. Muốn báo cả khi đã đóng app thì cần Web Push
(service worker + VAPID key + một Edge Function gửi push) — chưa có trong bản này.

## 10 chức năng nhắn tin và nơi cài đặt

| # | Chức năng | Cài đặt ở đâu |
|---|-----------|----------------|
| 1 | Gửi/nhận tin nhắn văn bản | `messages.kind='text'` · `useChat.sendText` · realtime `subscribeConversation` |
| 2 | Gửi ảnh/video | `MessageComposer` → `uploadChatMedia` (bucket `chat-media`) → `kind='image' \| 'video'`; xem lớn ở `MediaViewer` |
| 4 | Gửi voice message | `useVoiceRecorder` (MediaRecorder + đo mức âm) → `kind='voice'` kèm `duration_ms`, `waveform`; phát lại ở `VoicePlayer` |
| 5 | Emoji/sticker/GIF | `EmojiStickerPicker`: emoji (`data/emoji.ts`), 24 sticker (`data/stickers.ts`), GIF qua Tenor hoặc dán link (`utils/gif.ts`) |
| 6 | Chat 1-1 | `conversations.type='direct'` 2 thành viên, tạo qua hàm `accept_invite` |
| 8 | Reply/quote tin nhắn | `messages.reply_to_id`; bấm khung quote để nhảy tới tin gốc |
| 10 | Chỉnh sửa/xóa tin nhắn | Sửa: `messages.edited_at`. Xóa: `message_hides` — chỉ ẩn ở phía người xóa |
| 11 | Thu hồi tin nhắn | `messages.recalled_at` + xoá file media; mọi người thấy "Tin nhắn đã được thu hồi" |
| 12 | Đã gửi/đã nhận/đã xem | `conversation_members.last_delivered_at` / `last_read_at`; suy ra trạng thái ở `resolveStatus` |

**Xóa** (#10) là "xóa ở phía tôi" — người kia vẫn thấy. **Thu hồi** (#11) là gỡ với mọi người.

## Chạy app

```bash
cd chat-app
npm install
cp .env.example .env     # điền VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY
npm run dev
```

Trên Supabase:

1. **Authentication → Sign In / Providers → Email: bật.**
   Để đăng ký xong vào dùng được ngay, **tắt "Confirm email"** (nếu bật, người dùng phải
   xác nhận email trước khi đăng nhập — app có hiển thị thông báo tương ứng).
2. **SQL Editor → chạy `supabase/schema.sql`** (bảng, RLS, trigger sinh tên hiển thị,
   hàm `accept_invite`, realtime, bucket riêng tư `chat-media`). File chạy lại được nhiều lần.
3. (Tuỳ chọn) Tìm GIF: thêm `VITE_TENOR_API_KEY` vào `.env`, hoặc nhập key ngay trong tab
   GIF. Không có key vẫn gửi GIF được bằng cách dán link.

Thử nhắn tin giữa 2 người: đăng ký 2 tài khoản ở 2 trình duyệt (hoặc một cửa sổ ẩn danh),
bên A bấm **Mở box chat mới bằng link** → copy link → bên B mở link đó.

## Deploy

Repo đã có sẵn workflow `.github/workflows/deploy.yml` build cả hai app và đẩy lên
GitHub Pages trong một lần:

| App | Đường dẫn |
|-----|-----------|
| Tủ lạnh gia đình | `https://nguyenvananh205-rgb.github.io/tu-lanh-gia-dinh/` |
| Nhắn tin | `https://nguyenvananh205-rgb.github.io/tu-lanh-gia-dinh/chat/` |

Workflow chạy mỗi khi push vào `main` (và các nhánh được liệt kê trong file), hoặc bấm
**Run workflow** thủ công trong tab Actions.

### Cần làm một lần (3 việc, khoảng 10 phút)

**1. Đưa code lên nhánh `main`** — workflow chỉ chạy trên `main`, và GitHub Pages cũng chỉ
cho nhánh đó deploy. App nhắn tin hiện nằm ở nhánh `claude/messaging-features-es2k77`, cần
merge vào `main` thì bản deploy mới có nó.

**2. Lấy khoá Supabase và dán vào GitHub**

Trong Supabase Dashboard, chọn project của bạn:

- **Project URL**: Settings (bánh răng) → **API** (bản mới gọi là *Data API*). Dòng
  *Project URL*, dạng `https://abcdxyz.supabase.co`.
- **Anon key**: cùng trang, mục *Project API keys* → khoá tên **anon / public**
  (bản mới gọi là *publishable key*). Đây là khoá dành cho trình duyệt — **không** lấy
  `service_role`, khoá đó bỏ qua RLS và không bao giờ được đưa vào app.

Rồi sang GitHub, repo này:

> Settings → Secrets and variables → **Actions** → tab **Variables** →
> **New repository variable**, tạo 2 biến:
>
> | Tên | Giá trị |
> |-----|---------|
> | `VITE_SUPABASE_URL` | Project URL vừa copy |
> | `VITE_SUPABASE_ANON_KEY` | anon / public key |
>
> (Đặt ở tab *Secrets* cũng chạy — workflow đọc cả hai chỗ. Muốn tìm GIF thì thêm
> `VITE_TENOR_API_KEY`.)

**3. Trỏ Supabase về đúng URL đã deploy**

> Supabase → Authentication → **URL Configuration** → đặt **Site URL** và thêm vào
> **Redirect URLs**: `https://nguyenvananh205-rgb.github.io/tu-lanh-gia-dinh/chat/`

Thiếu bước này thì link đặt lại mật khẩu trong email sẽ trỏ về `localhost`.

Xong 3 bước thì vào tab **Actions → Deploy to GitHub Pages → Run workflow** (hoặc push
thêm commit) để chạy lại. Bước *"Kiểm tra cấu hình Supabase"* trong log sẽ in
"Đã có cấu hình Supabase" nếu biến đã được đọc đúng.

Anon key của Supabase là khoá công khai — nó nằm trong file JS đã build, và dữ liệu được
bảo vệ bằng RLS chứ không phải bằng việc giấu key.

Muốn deploy lên chỗ khác (Vercel / Netlify / Cloudflare Pages / domain riêng): app là web
tĩnh, chỉ cần `npm run build` rồi trỏ tới thư mục `dist`, không cần đặt `VITE_BASE_PATH`
(mặc định là `/`). Nhớ cập nhật lại Site URL / Redirect URLs cho khớp domain mới.

## Trước khi mời người dùng thật

- [ ] **Cấp quyền admin cho bạn** bằng câu SQL ở mục "Duyệt người dùng" — nếu quên, sẽ
      không ai duyệt được ai.
- [ ] **SMTP riêng** (Resend, SendGrid, Gmail SMTP…) nếu dùng quên mật khẩu hoặc bật
      "Confirm email": bộ gửi mail mặc định của Supabase chỉ vài email mỗi giờ và chỉ dành
      cho lúc thử nghiệm.
- [ ] **Dung lượng**: gói Supabase miễn phí có hạn mức database / storage / băng thông,
      mà mỗi file cho phép tới 25 MB. Đông người dùng thì hạ `file_size_limit` của bucket
      `chat-media` hoặc lên gói trả phí.
- [ ] **Chạy thử một vòng thật**: đăng ký 2 tài khoản → duyệt trong trang quản trị → gửi
      link mời → nhắn text, ảnh, voice, sticker → sửa / thu hồi / xóa → kiểm tra "đã xem"
      và số tin chưa đọc → quên mật khẩu → đổi mật khẩu.

Chưa có (cân nhắc nếu mở rộng thêm): xoá tài khoản & dữ liệu theo yêu cầu người dùng,
giới hạn tần suất gửi tin nhắn, và sao lưu dữ liệu. Việc chặn người quấy rối thì đã làm
được bằng nút **Thu hồi** trong trang quản trị.

## Cấu trúc

```
src/
  App.tsx                    Khung app: header, hồ sơ, link mời, bố cục 2 cột / 1 cột
  types.ts                   Kiểu dữ liệu dùng chung
  lib/supabase.ts            Khởi tạo client + sinh UUID
  lib/users.ts               Đăng ký/đăng nhập, hồ sơ, đổi tên hiển thị
  lib/invites.ts             Tạo / thu hồi / nhận link mời
  lib/chat.ts                Hội thoại, tin nhắn, upload, realtime
  lib/media.ts               Cache + xin signed URL theo lô
  hooks/useAuth.ts           Phiên đăng nhập, hồ sơ, quên/đổi mật khẩu
  hooks/useNotifications.ts  Thông báo trình duyệt khi có tin mới
  hooks/useMediaUrl.ts       Signed URL cho ảnh/video/voice
  hooks/useChat.ts           State hội thoại/tin nhắn, gửi lạc quan, đã xem
  hooks/useVoiceRecorder.ts  Ghi âm + sóng âm
  utils/format.ts            Định dạng giờ, tên, trạng thái, xem trước
  utils/gif.ts               Tìm GIF (Tenor) / gửi GIF bằng link
  data/emoji.ts              Bộ emoji theo nhóm
  data/stickers.ts           2 bộ sticker dựng sẵn
  components/
    AuthScreen.tsx           Đăng nhập / đăng ký / quên mật khẩu
    PendingApprovalScreen.tsx Màn chờ admin duyệt (hoặc bị từ chối)
    AdminPanel.tsx           Trang duyệt / từ chối / thu hồi người dùng
    ResetPasswordScreen.tsx  Đặt mật khẩu mới khi mở link trong email
    ProfileDialog.tsx        Đổi tên hiển thị, ảnh đại diện, đổi mật khẩu, đăng xuất
    InviteDialog.tsx         Link mời: copy, tạo link mới
    ConversationList.tsx     Danh sách box chat của tôi
    ChatThread.tsx           Khung hội thoại, phân cách ngày, tải tin cũ
    MessageBubble.tsx        Bong bóng tin nhắn + menu hành động
    MessageComposer.tsx      Soạn tin, đính kèm, ghi âm, trả lời, sửa
    EmojiStickerPicker.tsx   Tab Emoji / Sticker / GIF
    VoicePlayer.tsx          Trình phát voice có sóng âm
    MediaViewer.tsx          Xem ảnh/video toàn màn hình
supabase/schema.sql          Bảng, RLS, trigger, hàm accept_invite, bucket chat-media
```

## Cách "đã gửi / đã nhận / đã xem" hoạt động

- Vừa bấm gửi → **Đang gửi** (đồng hồ); server xác nhận → **Đã gửi** (✓).
- Máy người nhận nhận được sự kiện realtime → cập nhật `last_delivered_at` → **Đã nhận** (✓✓ xám).
- Người nhận mở hội thoại → `last_read_at` → **Đã xem** (✓✓ xanh).
- Gửi lỗi (mất mạng, upload hỏng) → **Gửi lỗi** kèm nút **Gửi lại**.

## Kiểm thử schema

`supabase/tests/` có bộ kiểm thử chạy trên Postgres cục bộ (không cần project
Supabase): trigger sinh tên không trùng, luồng link mời, và toàn bộ ràng buộc RLS.
Xem `supabase/tests/README.md`.

## Giới hạn hiện tại

- Thông báo chỉ chạy khi app đang mở (xem mục Thông báo ở trên).
- Phạm vi bản này đúng 10 chức năng đã chốt: chưa có chat nhóm, trạng thái "đang nhập…",
  tìm kiếm trong nội dung tin nhắn.
- Link mời chưa giới hạn số lượt dùng (cố ý: một link gửi cho nhiều người).
