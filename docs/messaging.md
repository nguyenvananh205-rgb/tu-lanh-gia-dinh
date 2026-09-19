# Chức năng nhắn tin

Module nhắn tin cho phép các thành viên của cùng một tủ lạnh nhắn tin riêng (1-1)
với nhau ngay trong app, ở tab **Nhắn tin**.

## 1. Bản đồ chức năng nhỏ → nơi cài đặt

| # | Chức năng nhỏ | Cài đặt ở đâu |
|---|---------------|----------------|
| 1 | Gửi/nhận tin nhắn văn bản | `messages.kind = 'text'` · `useMessaging.sendText` · realtime `subscribeConversation` |
| 2 | Gửi ảnh/video | `MessageComposer` (nút ảnh) → `uploadChatMedia` lên bucket `chat-media` → `kind = 'image' \| 'video'`, xem toàn màn hình ở `MediaViewer` |
| 4 | Gửi voice message | `useVoiceRecorder` (MediaRecorder + đo mức âm) → `kind = 'voice'` với `duration_ms`, `waveform`; phát lại bằng `VoicePlayer` |
| 5 | Emoji/sticker/GIF | `EmojiStickerPicker`: emoji chèn vào ô nhập (`data/emoji.ts`), sticker gửi thành `kind = 'sticker'` (`data/stickers.ts`), GIF qua Tenor hoặc dán link (`utils/gifSearch.ts`) |
| 6 | Chat 1-1 | `conversations.type = 'direct'` với đúng 2 thành viên · `getOrCreateDirectConversation` |
| 8 | Reply/quote tin nhắn | `messages.reply_to_id` · khung quote trong `MessageBubble`, bấm vào quote sẽ nhảy tới tin nhắn gốc |
| 10 | Chỉnh sửa/xóa tin nhắn | Sửa: `messages.edited_at` + `useMessaging.editText` (chỉ tin nhắn text của mình). Xóa: bảng `message_hides` — chỉ ẩn ở phía người xóa |
| 11 | Thu hồi tin nhắn | `messages.recalled_at` + xóa file media trong storage; mọi người thấy "Tin nhắn đã được thu hồi", kể cả trong khung quote |
| 12 | Đã gửi/đã nhận/đã xem | `conversation_members.last_delivered_at` / `last_read_at`; trạng thái từng tin nhắn suy ra ở `resolveStatus` (`utils/chatFormat.ts`) |

Điểm khác nhau giữa **xóa** (#10) và **thu hồi** (#11) theo đúng thói quen người dùng Việt:
xóa là "xóa ở phía tôi" (người kia vẫn thấy), thu hồi là "thu hồi với mọi người".

## 2. Cấu trúc file

```
supabase/messaging-schema.sql      Bảng, RLS, realtime, bucket chat-media
src/lib/messaging.ts               Toàn bộ truy vấn Supabase + upload + realtime
src/hooks/useMessaging.ts          State hội thoại/tin nhắn, gửi lạc quan, đã xem
src/hooks/useVoiceRecorder.ts      Ghi âm + sóng âm
src/utils/chatFormat.ts            Định dạng giờ, tên, trạng thái, xem trước
src/utils/gifSearch.ts             Tìm GIF (Tenor) và gửi GIF bằng link
src/data/emoji.ts, stickers.ts     Bộ emoji & sticker dựng sẵn
src/components/chat/
  ChatTab.tsx                      Bố cục 2 cột (desktop) / 1 cột (mobile)
  ConversationList.tsx             Danh sách hội thoại + thành viên chưa chat
  ChatThread.tsx                   Khung hội thoại, phân cách ngày, cuộn, tải thêm
  MessageBubble.tsx                Bong bóng tin nhắn + menu hành động
  MessageComposer.tsx              Ô soạn tin, đính kèm, ghi âm, trả lời, sửa
  EmojiStickerPicker.tsx           Tab Emoji / Sticker / GIF
  VoicePlayer.tsx                  Trình phát voice có sóng âm
  MediaViewer.tsx                  Xem ảnh/video toàn màn hình
```

## 3. Cài đặt

1. Cấu hình Supabase như phần còn lại của app (`.env`):
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
2. Chạy `supabase/schema.sql` (nếu chưa), rồi chạy `supabase/messaging-schema.sql`
   trong Supabase Dashboard → SQL Editor. File này tạo bảng, RLS, bật realtime và
   tạo bucket `chat-media`.
3. (Tuỳ chọn) Để tìm GIF: thêm `VITE_TENOR_API_KEY=...` vào `.env`, hoặc nhập key
   ngay trong tab GIF của bộ chọn. Không có key vẫn gửi được GIF bằng cách dán link.

Nhắn tin chỉ bật khi đã cấu hình Supabase **và** người dùng đã đăng nhập; khách vãng
lai sẽ thấy lời mời tạo tài khoản.

## 4. Cách trạng thái "đã gửi / đã nhận / đã xem" hoạt động

- Gửi xong, tin nhắn hiện **Đang gửi** (đồng hồ) cho tới khi server xác nhận → **Đã gửi** (✓).
- Khi máy người nhận nhận được sự kiện realtime, nó cập nhật `last_delivered_at`
  → tin nhắn thành **Đã nhận** (✓✓ xám).
- Khi người nhận mở hội thoại, `last_read_at` được cập nhật → **Đã xem** (✓✓ xanh).
- Trạng thái tính theo mốc thời gian, nên chỉ cần 2 cột trên bảng thành viên thay vì
  một bản ghi cho mỗi tin nhắn.

Gửi lỗi (mất mạng, upload thất bại) sẽ hiện **Gửi lỗi** kèm nút **Gửi lại**.

## 5. Giới hạn hiện tại & hướng mở rộng

- Bucket `chat-media` để public (đường dẫn chứa UUID). Nếu cần riêng tư hơn: đổi
  bucket thành private và thay `getPublicUrl` bằng `createSignedUrl` trong
  `src/lib/messaging.ts`.
- Schema đã có `conversations.type = 'group'` nhưng UI mới làm chat 1-1 (mục #6).
  Chat nhóm, danh sách "đã xem bởi ai" là bước mở rộng tiếp theo.
- Chưa có: thông báo đẩy khi có tin nhắn mới, trạng thái "đang nhập...", tìm kiếm
  trong nội dung tin nhắn, ghim tin nhắn (các mục #3, #7, #9 vốn không nằm trong
  danh sách yêu cầu).
- Tin nhắn tải theo trang 40 tin/lần, có nút "Xem tin nhắn cũ hơn".
