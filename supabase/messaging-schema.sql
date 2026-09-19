-- ============================================================
-- Tủ lạnh gia đình — Schema chức năng NHẮN TIN
-- Chạy file này trong Supabase Dashboard > SQL Editor
-- (chạy sau supabase/schema.sql)
--
-- Bao phủ các chức năng nhỏ:
--   1. Gửi/nhận tin nhắn văn bản      → messages.kind = 'text'
--   2. Gửi ảnh/video                  → kind = 'image' | 'video' + bucket chat-media
--   4. Gửi voice message              → kind = 'voice' (duration_ms, waveform)
--   5. Emoji/sticker/GIF              → emoji nằm trong text; kind = 'sticker' | 'gif'
--   6. Chat 1-1                       → conversations.type = 'direct' (2 thành viên)
--   8. Reply/quote tin nhắn           → messages.reply_to_id
--  10. Chỉnh sửa/xóa tin nhắn         → messages.edited_at / bảng message_hides (xóa phía tôi)
--  11. Thu hồi tin nhắn               → messages.recalled_at (thu hồi với mọi người)
--  12. Đã gửi/đã nhận/đã xem          → conversation_members.last_delivered_at / last_read_at
-- ============================================================

-- ── Helper functions (security definer để tránh đệ quy trong RLS) ──

-- Tất cả tủ lạnh mà user hiện tại có quyền (sở hữu hoặc đã tham gia)
create or replace function public.my_fridge_ids()
returns setof uuid
language sql security definer stable set search_path = public as $$
  select id from public.fridges where owner_id = auth.uid()
  union
  select fridge_id from public.fridge_access where user_id = auth.uid();
$$;

-- User có đang ở chung tủ lạnh nào với người khác không?
create or replace function public.shares_fridge_with(target uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.fridges f
    where f.id in (select public.my_fridge_ids())
      and (
        f.owner_id = target
        or exists (
          select 1 from public.fridge_access a
          where a.fridge_id = f.id and a.user_id = target
        )
      )
  );
$$;

-- User hiện tại (hoặc uid chỉ định) có thuộc cuộc trò chuyện không?
create or replace function public.is_conversation_member(conv uuid, uid uuid default auth.uid())
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = conv and m.user_id = uid
  );
$$;

-- ── Bảng ─────────────────────────────────────────────────────────

-- Cuộc trò chuyện (hiện dùng type = 'direct' cho chat 1-1)
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  fridge_id uuid references public.fridges(id) on delete cascade,
  type text not null default 'direct' check (type in ('direct', 'group')),
  title text,
  created_by uuid references public.profiles(id),
  last_message_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Thành viên cuộc trò chuyện + mốc "đã nhận" / "đã xem" của từng người
create table if not exists public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  last_read_at timestamptz,       -- đã xem tới thời điểm này
  last_delivered_at timestamptz,  -- máy đã nhận tới thời điểm này
  primary key (conversation_id, user_id)
);

-- Tin nhắn
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) not null,
  kind text not null default 'text'
    check (kind in ('text', 'image', 'video', 'voice', 'sticker', 'gif')),
  body text,              -- nội dung text / chú thích ảnh / mã sticker
  media_url text,         -- link ảnh, video, voice, GIF
  media_path text,        -- đường dẫn trong storage (để xoá khi thu hồi)
  media_mime text,
  media_size integer,
  duration_ms integer,    -- voice / video
  waveform jsonb,         -- mảng số 0–100 vẽ sóng âm cho voice
  reply_to_id uuid references public.messages(id) on delete set null,
  edited_at timestamptz,
  recalled_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

-- "Xóa ở phía tôi": tin nhắn bị ẩn với riêng một người
create table if not exists public.message_hides (
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  hidden_at timestamptz default now(),
  primary key (message_id, user_id)
);

create index if not exists message_hides_user_conv_idx
  on public.message_hides (user_id, conversation_id);

-- Cập nhật last_message_at khi có tin nhắn mới (để sắp xếp danh sách hội thoại)
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
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_hides enable row level security;

-- Hội thoại: chỉ thành viên đọc được; chỉ tạo hội thoại trong tủ lạnh của mình
drop policy if exists "conversations_member_read" on public.conversations;
create policy "conversations_member_read" on public.conversations
  for select using (public.is_conversation_member(id));

drop policy if exists "conversations_insert" on public.conversations;
create policy "conversations_insert" on public.conversations
  for insert with check (
    created_by = auth.uid()
    and (fridge_id is null or fridge_id in (select public.my_fridge_ids()))
  );

drop policy if exists "conversations_member_update" on public.conversations;
create policy "conversations_member_update" on public.conversations
  for update using (public.is_conversation_member(id));

-- Thành viên: thấy thành viên cùng hội thoại, chỉ tự sửa mốc đã xem của mình
drop policy if exists "conversation_members_read" on public.conversation_members;
create policy "conversation_members_read" on public.conversation_members
  for select using (public.is_conversation_member(conversation_id));

drop policy if exists "conversation_members_insert" on public.conversation_members;
create policy "conversation_members_insert" on public.conversation_members
  for insert with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
  );

drop policy if exists "conversation_members_update_self" on public.conversation_members;
create policy "conversation_members_update_self" on public.conversation_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Tin nhắn: thành viên đọc, chỉ người gửi sửa/xoá (chỉnh sửa & thu hồi)
drop policy if exists "messages_member_read" on public.messages;
create policy "messages_member_read" on public.messages
  for select using (public.is_conversation_member(conversation_id));

drop policy if exists "messages_send" on public.messages;
create policy "messages_send" on public.messages
  for insert with check (
    sender_id = auth.uid() and public.is_conversation_member(conversation_id)
  );

drop policy if exists "messages_sender_update" on public.messages;
create policy "messages_sender_update" on public.messages
  for update using (sender_id = auth.uid()) with check (sender_id = auth.uid());

drop policy if exists "messages_sender_delete" on public.messages;
create policy "messages_sender_delete" on public.messages
  for delete using (sender_id = auth.uid());

-- Ẩn tin nhắn: mỗi người chỉ quản lý bản ghi của chính mình
drop policy if exists "message_hides_own" on public.message_hides;
create policy "message_hides_own" on public.message_hides
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Cho phép đọc hồ sơ của người dùng chung tủ lạnh (để hiện tên trong chat)
drop policy if exists "profiles_shared_fridge_read" on public.profiles;
create policy "profiles_shared_fridge_read" on public.profiles
  for select using (id = auth.uid() or public.shares_fridge_with(id));

-- Cho phép thành viên tủ lạnh xem danh sách thành viên khác (để chọn người nhắn)
drop policy if exists "fridge_access_member_read" on public.fridge_access;
create policy "fridge_access_member_read" on public.fridge_access
  for select using (fridge_id in (select public.my_fridge_ids()));

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
