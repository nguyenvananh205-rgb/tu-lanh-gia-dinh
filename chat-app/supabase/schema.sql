-- ============================================================
-- App Nhắn tin — Supabase schema
-- Chạy toàn bộ file này trong Supabase Dashboard > SQL Editor
--
-- Trước khi chạy, bật: Authentication > Sign In / Providers > Anonymous sign-ins.
-- App không có màn hình đăng nhập: mỗi thiết bị được cấp một danh tính ẩn danh,
-- người dùng chỉ cần đặt tên hiển thị.
--
-- 10 chức năng nhỏ được phủ bởi schema này:
--   1. Văn bản              → messages.kind = 'text'
--   2. Ảnh/video            → kind = 'image' | 'video' + bucket chat-media
--   4. Voice message        → kind = 'voice' (duration_ms, waveform)
--   5. Emoji/sticker/GIF    → emoji nằm trong text; kind = 'sticker' | 'gif'
--   6. Chat 1-1             → conversations.type = 'direct' (2 thành viên)
--   8. Reply/quote          → messages.reply_to_id
--  10. Sửa / xóa            → messages.edited_at / bảng message_hides
--  11. Thu hồi              → messages.recalled_at
--  12. Đã gửi/nhận/xem      → conversation_members.last_delivered_at / last_read_at
-- ============================================================

-- ── Người dùng ───────────────────────────────────────────────────
create table if not exists public.chat_users (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  avatar_emoji text default '🙂',
  created_at timestamptz default now(),
  last_seen_at timestamptz default now()
);

-- ── Hội thoại ────────────────────────────────────────────────────
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  type text not null default 'direct' check (type in ('direct', 'group')),
  title text,
  created_by uuid references public.chat_users(id) on delete set null,
  last_message_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.chat_users(id) on delete cascade,
  joined_at timestamptz default now(),
  last_read_at timestamptz,       -- đã xem tới thời điểm này
  last_delivered_at timestamptz,  -- máy đã nhận tới thời điểm này
  primary key (conversation_id, user_id)
);

-- ── Tin nhắn ─────────────────────────────────────────────────────
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.chat_users(id) on delete cascade not null,
  kind text not null default 'text'
    check (kind in ('text', 'image', 'video', 'voice', 'sticker', 'gif')),
  body text,              -- nội dung text / chú thích / mã sticker
  media_url text,
  media_path text,        -- đường dẫn trong storage (xoá khi thu hồi)
  media_mime text,
  media_size integer,
  duration_ms integer,    -- voice / video
  waveform jsonb,         -- mảng số 0–100 để vẽ sóng âm
  reply_to_id uuid references public.messages(id) on delete set null,
  edited_at timestamptz,
  recalled_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

-- "Xóa ở phía tôi"
create table if not exists public.message_hides (
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references public.chat_users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  hidden_at timestamptz default now(),
  primary key (message_id, user_id)
);

create index if not exists message_hides_user_conv_idx
  on public.message_hides (user_id, conversation_id);

-- ── Hàm phụ trợ (security definer để RLS không bị đệ quy) ────────
create or replace function public.is_conversation_member(conv uuid, uid uuid default auth.uid())
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = conv and m.user_id = uid
  );
$$;

-- Đẩy last_message_at lên để sắp xếp danh sách hội thoại
create or replace function public.bump_conversation_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_bump_conversation on public.messages;
create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation_activity();

-- ── RLS ──────────────────────────────────────────────────────────
alter table public.chat_users enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_hides enable row level security;

-- Danh sách người dùng: ai đã đăng nhập (kể cả ẩn danh) đều xem được để chọn người nhắn
drop policy if exists "chat_users_read" on public.chat_users;
create policy "chat_users_read" on public.chat_users
  for select to authenticated using (true);

drop policy if exists "chat_users_insert_self" on public.chat_users;
create policy "chat_users_insert_self" on public.chat_users
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "chat_users_update_self" on public.chat_users;
create policy "chat_users_update_self" on public.chat_users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Hội thoại: chỉ thành viên đọc được
drop policy if exists "conversations_member_read" on public.conversations;
create policy "conversations_member_read" on public.conversations
  for select to authenticated using (public.is_conversation_member(id));

drop policy if exists "conversations_insert" on public.conversations;
create policy "conversations_insert" on public.conversations
  for insert to authenticated with check (created_by = auth.uid());

-- Thành viên: thấy người cùng hội thoại, chỉ tự sửa mốc đã nhận/đã xem của mình
drop policy if exists "conversation_members_read" on public.conversation_members;
create policy "conversation_members_read" on public.conversation_members
  for select to authenticated using (public.is_conversation_member(conversation_id));

drop policy if exists "conversation_members_insert" on public.conversation_members;
create policy "conversation_members_insert" on public.conversation_members
  for insert to authenticated with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
  );

drop policy if exists "conversation_members_update_self" on public.conversation_members;
create policy "conversation_members_update_self" on public.conversation_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Tin nhắn: thành viên đọc; chỉ người gửi sửa / thu hồi / xoá hẳn
drop policy if exists "messages_member_read" on public.messages;
create policy "messages_member_read" on public.messages
  for select to authenticated using (public.is_conversation_member(conversation_id));

drop policy if exists "messages_send" on public.messages;
create policy "messages_send" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid() and public.is_conversation_member(conversation_id)
  );

drop policy if exists "messages_sender_update" on public.messages;
create policy "messages_sender_update" on public.messages
  for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());

drop policy if exists "messages_sender_delete" on public.messages;
create policy "messages_sender_delete" on public.messages
  for delete to authenticated using (sender_id = auth.uid());

-- Ẩn tin nhắn: mỗi người chỉ quản lý bản ghi của mình
drop policy if exists "message_hides_own" on public.message_hides;
create policy "message_hides_own" on public.message_hides
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Realtime ─────────────────────────────────────────────────────
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.conversations;

-- ── Storage: ảnh / video / voice ─────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-media', 'chat-media', true, 26214400) -- 25 MB
on conflict (id) do nothing;

drop policy if exists "chat_media_read" on storage.objects;
create policy "chat_media_read" on storage.objects
  for select using (bucket_id = 'chat-media');

drop policy if exists "chat_media_upload" on storage.objects;
create policy "chat_media_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'chat-media');

drop policy if exists "chat_media_delete_own" on storage.objects;
create policy "chat_media_delete_own" on storage.objects
  for delete to authenticated using (bucket_id = 'chat-media' and owner = auth.uid());
