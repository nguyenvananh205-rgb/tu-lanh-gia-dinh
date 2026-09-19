# Nhắn tin — app chat 1-1

App nhắn tin độc lập (React + TypeScript + Vite + Supabase). Không liên quan tới app
"Tủ lạnh gia đình" ở thư mục gốc: có `package.json`, cấu hình build và schema Supabase
riêng.

## 10 chức năng nhỏ và nơi cài đặt

| # | Chức năng | Cài đặt ở đâu |
|---|-----------|----------------|
| 1 | Gửi/nhận tin nhắn văn bản | `messages.kind='text'` · `useChat.sendText` · realtime `subscribeConversation` |
| 2 | Gửi ảnh/video | `MessageComposer` → `uploadChatMedia` (bucket `chat-media`) → `kind='image' \| 'video'`; xem lớn ở `MediaViewer` |
| 4 | Gửi voice message | `useVoiceRecorder` (MediaRecorder + đo mức âm) → `kind='voice'` kèm `duration_ms`, `waveform`; phát lại ở `VoicePlayer` |
| 5 | Emoji/sticker/GIF | `EmojiStickerPicker`: emoji (`data/emoji.ts`), 24 sticker (`data/stickers.ts`), GIF qua Tenor hoặc dán link (`utils/gif.ts`) |
| 6 | Chat 1-1 | `conversations.type='direct'` 2 thành viên · `getOrCreateDirectConversation` |
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

1. **Authentication → Sign In / Providers → bật Anonymous sign-ins.**
   App không có màn hình đăng nhập: mỗi thiết bị nhận một danh tính ẩn danh, người dùng
   chỉ đặt tên hiển thị và chọn ảnh đại diện (emoji).
2. **SQL Editor → chạy `supabase/schema.sql`** (tạo bảng, RLS, bật realtime, tạo bucket
   `chat-media`).
3. (Tuỳ chọn) Tìm GIF: thêm `VITE_TENOR_API_KEY` vào `.env`, hoặc nhập key ngay trong tab
   GIF. Không có key vẫn gửi GIF được bằng cách dán link.

Muốn thử nhắn tin giữa 2 người: mở app ở 2 trình duyệt khác nhau (hoặc một cửa sổ ẩn danh),
đặt 2 tên khác nhau — mỗi bên sẽ thấy người kia ở mục "Người đang dùng app".

## Cấu trúc

```
src/
  App.tsx                    Khung app: header, hồ sơ, bố cục 2 cột / 1 cột
  types.ts                   Kiểu dữ liệu dùng chung
  lib/supabase.ts            Khởi tạo client + sinh UUID
  lib/users.ts               Phiên ẩn danh, hồ sơ, danh sách người dùng
  lib/chat.ts                Hội thoại, tin nhắn, upload, realtime
  hooks/useIdentity.ts       Danh tính & hồ sơ của tôi
  hooks/useChat.ts           State hội thoại/tin nhắn, gửi lạc quan, đã xem
  hooks/useVoiceRecorder.ts  Ghi âm + sóng âm
  utils/format.ts            Định dạng giờ, tên, trạng thái, xem trước
  utils/gif.ts               Tìm GIF (Tenor) / gửi GIF bằng link
  data/emoji.ts              Bộ emoji theo nhóm
  data/stickers.ts           2 bộ sticker dựng sẵn
  components/
    IdentityGate.tsx         Đặt tên + ảnh đại diện (thay cho đăng nhập)
    ConversationList.tsx     Danh sách hội thoại + người chưa chat
    ChatThread.tsx           Khung hội thoại, phân cách ngày, tải tin cũ
    MessageBubble.tsx        Bong bóng tin nhắn + menu hành động
    MessageComposer.tsx      Soạn tin, đính kèm, ghi âm, trả lời, sửa
    EmojiStickerPicker.tsx   Tab Emoji / Sticker / GIF
    VoicePlayer.tsx          Trình phát voice có sóng âm
    MediaViewer.tsx          Xem ảnh/video toàn màn hình
supabase/schema.sql          Bảng, RLS, realtime, bucket chat-media
```

## Cách "đã gửi / đã nhận / đã xem" hoạt động

- Vừa bấm gửi → **Đang gửi** (đồng hồ); server xác nhận → **Đã gửi** (✓).
- Máy người nhận nhận được sự kiện realtime → cập nhật `last_delivered_at` → **Đã nhận** (✓✓ xám).
- Người nhận mở hội thoại → `last_read_at` → **Đã xem** (✓✓ xanh).
- Gửi lỗi (mất mạng, upload hỏng) → **Gửi lỗi** kèm nút **Gửi lại**.

Cách này chỉ cần 2 cột trên bảng thành viên thay vì một bản ghi trạng thái cho mỗi tin nhắn.

## Giới hạn hiện tại

- Bucket `chat-media` để public (đường dẫn chứa UUID ngẫu nhiên). Cần kín hơn thì đổi bucket
  sang private và thay `getPublicUrl` bằng `createSignedUrl` trong `src/lib/chat.ts`.
- Danh tính gắn với trình duyệt: xoá dữ liệu trình duyệt là mất danh tính cũ. Nếu sau này
  cần đăng nhập thật (số điện thoại/email), thay `ensureSession` trong `src/lib/users.ts`.
- Mọi người dùng app đều thấy nhau trong danh sách để bắt đầu chat (chưa có kết bạn/mã mời).
- Phạm vi bản này đúng 10 chức năng đã chốt: chưa có chat nhóm, thông báo đẩy, trạng thái
  "đang nhập…", tìm kiếm trong nội dung tin nhắn.
