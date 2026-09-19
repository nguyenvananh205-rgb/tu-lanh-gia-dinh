-- ============================================================
-- App Nhắn tin — Supabase schema
-- Chạy toàn bộ file này trong Supabase Dashboard > SQL Editor
--
-- Trước khi chạy:
--   Authentication > Sign In / Providers > Email: BẬT.
--   Để đăng ký xong vào dùng được ngay, TẮT "Confirm email".
--
-- Nguyên tắc bảo mật: mỗi người chỉ đọc được hội thoại mà mình là thành viên,
-- và chỉ thấy hồ sơ của người đang trò chuyện cùng. Muốn mở box chat mới thì
-- phải có link mời của người kia (bảng chat_invites + hàm accept_invite).
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

-- Tên hiển thị không được trùng (không phân biệt hoa/thường)
create unique index if not exists chat_users_display_name_unique
  on public.chat_users (lower(display_name));

-- Sinh tên hiển thị mặc định, đảm bảo không trùng
create or replace function public.generate_display_name()
returns text
language plpgsql security definer set search_path = public as $$
declare
  nouns text[] := array['Gấu','Mèo','Cún','Cáo','Hổ','Nai','Sóc','Cá Heo','Chim Sẻ','Ong','Bướm','Rùa','Cú','Hươu'];
  adjectives text[] := array['Vui','Hiền','Nhanh','Lanh Lợi','Ấm Áp','Bình Yên','Xinh','Mạnh Mẽ','Nhẹ Nhàng','Rực Rỡ'];
  candidate text;
begin
  for i in 1..50 loop
    candidate :=
      nouns[1 + floor(random() * array_length(nouns, 1))::int] || ' ' ||
      adjectives[1 + floor(random() * array_length(adjectives, 1))::int] || ' ' ||
      lpad(floor(random() * 10000)::int::text, 4, '0');
    if not exists (
      select 1 from public.chat_users where lower(display_name) = lower(candidate)
    ) then
      return candidate;
    end if;
  end loop;
  return 'Người dùng ' || substr(md5(random()::text), 1, 8);
end;
$$;

-- Vừa đăng ký xong là có hồ sơ với tên mặc định + emoji ngẫu nhiên
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  emojis text[] := array['🙂','😎','🐱','🐶','🦊','🐼','🐧','🌻','⚡','🍀','🎧','🚀'];
begin
  insert into public.chat_users (id, display_name, avatar_emoji)
  values (
    new.id,
    public.generate_display_name(),
    emojis[1 + floor(random() * array_length(emojis, 1))::int]
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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

-- ── Link mời mở box chat ─────────────────────────────────────────
create table if not exists public.chat_invites (
  token text primary key,
  owner_id uuid references public.chat_users(id) on delete cascade not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked boolean not null default false,
  uses integer not null default 0
);

create index if not exists chat_invites_owner_idx on public.chat_invites (owner_id);

-- ── Hàm phụ trợ (security definer để RLS không bị đệ quy) ────────
create or replace function public.is_conversation_member(conv uuid, uid uuid default auth.uid())
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = conv and m.user_id = uid
  );
$$;

-- Tôi có đang ở chung hội thoại nào với người này không?
create or replace function public.shares_conversation_with(target uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.conversation_members a
    join public.conversation_members b on b.conversation_id = a.conversation_id
    where a.user_id = auth.uid() and b.user_id = target
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

-- Nhận link mời: tạo (hoặc trả về) box chat 1-1 giữa người mời và người bấm link
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv public.chat_invites;
  me uuid := auth.uid();
  conv uuid;
begin
  if me is null then
    raise exception 'Bạn cần đăng nhập trước';
  end if;

  select * into inv from public.chat_invites where token = p_token;
  if not found then
    raise exception 'Link mời không tồn tại';
  end if;
  if inv.revoked then
    raise exception 'Link mời đã bị thu hồi';
  end if;
  if inv.expires_at < now() then
    raise exception 'Link mời đã hết hạn';
  end if;
  if inv.owner_id = me then
    raise exception 'Đây là link mời của chính bạn';
  end if;

  select c.id into conv
  from public.conversations c
  join public.conversation_members m1 on m1.conversation_id = c.id and m1.user_id = me
  join public.conversation_members m2 on m2.conversation_id = c.id and m2.user_id = inv.owner_id
  where c.type = 'direct'
  limit 1;

  if conv is null then
    insert into public.conversations (type, created_by)
    values ('direct', inv.owner_id)
    returning id into conv;

    insert into public.conversation_members (conversation_id, user_id)
    values (conv, me), (conv, inv.owner_id);
  end if;

  update public.chat_invites set uses = uses + 1 where token = p_token;
  return conv;
end;
$$;

grant execute on function public.accept_invite(text) to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────
alter table public.chat_users enable row level security;
alter table public.chat_invites enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_hides enable row level security;

-- Hồ sơ: chỉ thấy chính mình và người đang trò chuyện cùng
drop policy if exists "chat_users_read" on public.chat_users;
create policy "chat_users_read" on public.chat_users
  for select to authenticated
  using (id = auth.uid() or public.shares_conversation_with(id));

drop policy if exists "chat_users_insert_self" on public.chat_users;
create policy "chat_users_insert_self" on public.chat_users
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "chat_users_update_self" on public.chat_users;
create policy "chat_users_update_self" on public.chat_users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Link mời: chỉ chủ link tự quản lý (người nhận dùng hàm accept_invite)
drop policy if exists "chat_invites_own" on public.chat_invites;
create policy "chat_invites_own" on public.chat_invites
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Hội thoại: chỉ thành viên đọc được
drop policy if exists "conversations_member_read" on public.conversations;
create policy "conversations_member_read" on public.conversations
  for select to authenticated using (public.is_conversation_member(id));

-- Thành viên: thấy người cùng hội thoại, chỉ tự sửa mốc đã nhận/đã xem của mình
drop policy if exists "conversation_members_read" on public.conversation_members;
create policy "conversation_members_read" on public.conversation_members
  for select to authenticated using (public.is_conversation_member(conversation_id));

drop policy if exists "conversation_members_update_self" on public.conversation_members;
create policy "conversation_members_update_self" on public.conversation_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Rời hội thoại (chỉ xoá chính mình)
drop policy if exists "conversation_members_delete_self" on public.conversation_members;
create policy "conversation_members_delete_self" on public.conversation_members
  for delete to authenticated using (user_id = auth.uid());

-- Không có policy INSERT cho conversations / conversation_members:
-- box chat mới chỉ được tạo qua hàm accept_invite (security definer).

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
-- Thêm bảng vào publication, bỏ qua bảng đã có (để chạy lại file này được)
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array['messages', 'conversation_members', 'conversations'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ── Storage: ảnh / video / voice ─────────────────────────────────
-- Bucket ĐỂ RIÊNG TƯ: file chỉ mở được bằng signed URL do app tạo, và chỉ
-- thành viên của box chat mới xin được link đó.
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-media', 'chat-media', false, 26214400) -- 25 MB
on conflict (id) do update set public = false, file_size_limit = 26214400;

-- Đường dẫn file luôn là "<conversation_id>/<uuid>.<ext>" → lấy id box chat từ tên file
create or replace function public.conversation_id_from_storage_name(object_name text)
returns uuid
language plpgsql immutable as $$
declare
  first_folder text := split_part(object_name, '/', 1);
begin
  if first_folder ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return first_folder::uuid;
  end if;
  return null;
end;
$$;

drop policy if exists "chat_media_read" on storage.objects;
create policy "chat_media_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media'
    and public.is_conversation_member(public.conversation_id_from_storage_name(name))
  );

drop policy if exists "chat_media_upload" on storage.objects;
create policy "chat_media_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and public.is_conversation_member(public.conversation_id_from_storage_name(name))
  );

drop policy if exists "chat_media_delete_own" on storage.objects;
create policy "chat_media_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-media' and owner = auth.uid());
