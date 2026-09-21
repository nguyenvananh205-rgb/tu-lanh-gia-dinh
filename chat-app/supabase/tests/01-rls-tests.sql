-- Kiểm thử luồng nghiệp vụ + RLS của app Nhắn tin
\set ON_ERROR_STOP on
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'
\set C '33333333-3333-3333-3333-333333333333'

insert into auth.users (id, email) values
  (:'A', 'a@example.com'), (:'B', 'b@example.com'), (:'C', 'c@example.com');

-- 0. Mặc định mọi tài khoản mới đều ở trạng thái chờ duyệt
do $$
declare n int;
begin
  select count(*) into n from public.chat_users where status = 'pending';
  if n <> 3 then raise exception 'FAIL: tài khoản mới phải ở trạng thái chờ duyệt (% pending)', n; end if;
end $$;
\echo '[OK] 0. Tài khoản mới mặc định là chờ admin duyệt'

-- A là admin (mô phỏng bước cấp quyền admin đầu tiên trong SQL Editor), B & C được duyệt
update public.chat_users set status = 'approved', role = 'admin' where id = :'A';
update public.chat_users set status = 'approved' where id in (:'B', :'C');

-- 1. Trigger tạo hồ sơ + tên hiển thị tự sinh, không trùng
do $$
declare n int;
begin
  select count(*) into n from public.chat_users;
  if n <> 3 then raise exception 'FAIL: trigger không tạo đủ hồ sơ (có %)', n; end if;
  select count(distinct lower(display_name)) into n from public.chat_users;
  if n <> 3 then raise exception 'FAIL: tên hiển thị bị trùng'; end if;
end $$;
\echo '[OK] 1. Đăng ký xong có hồ sơ + tên hiển thị tự sinh không trùng'
select display_name, avatar_emoji from public.chat_users order by display_name;

-- 2. A tạo link mời (dưới quyền authenticated, RLS bật)
select set_config('request.jwt.claim.sub', :'A', false);
set role authenticated;
insert into public.chat_invites (token, owner_id) values ('tok_a', :'A');
reset role;
\echo '[OK] 2. Chủ link tạo được link mời của mình'

-- 3. B không đọc được link mời của A
select set_config('request.jwt.claim.sub', :'B', false);
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.chat_invites;
  if n <> 0 then raise exception 'FAIL: RLS để lộ link mời của người khác (% dòng)', n; end if;
end $$;
reset role;
\echo '[OK] 3. Người khác không đọc được bảng link mời'

-- 4. B nhận link → có box chat với A; bấm lại không tạo box trùng
select set_config('request.jwt.claim.sub', :'B', false);
set role authenticated;
do $$
declare conv1 uuid; conv2 uuid; n int;
begin
  conv1 := public.accept_invite('tok_a');
  conv2 := public.accept_invite('tok_a');
  if conv1 <> conv2 then raise exception 'FAIL: bấm link 2 lần tạo 2 box chat'; end if;
  select count(*) into n from public.conversation_members where conversation_id = conv1;
  if n <> 2 then raise exception 'FAIL: box chat không có đúng 2 thành viên (%)', n; end if;
end $$;
reset role;
\echo '[OK] 4. Nhận link tạo box chat 1-1; bấm lại không tạo box trùng'

-- 5. C dùng CÙNG link → box chat riêng, khác của B
select set_config('request.jwt.claim.sub', :'C', false);
set role authenticated;
do $$
declare convC uuid; n int;
begin
  convC := public.accept_invite('tok_a');
  select count(*) into n
  from public.conversation_members m
  where m.conversation_id = convC and m.user_id = '22222222-2222-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL: C bị nhét chung box chat với B'; end if;
end $$;
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.conversations;
  if n <> 2 then raise exception 'FAIL: phải có 2 box chat (A-B, A-C), đang có %', n; end if;
end $$;
\echo '[OK] 5. Link dùng nhiều lần, mỗi người một box chat riêng với chủ link'

-- 6. Mỗi người chỉ thấy box chat của mình
select set_config('request.jwt.claim.sub', :'B', false);
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.conversations;
  if n <> 1 then raise exception 'FAIL: B thấy % box chat (phải là 1)', n; end if;
  select count(*) into n from public.chat_users;
  if n <> 2 then raise exception 'FAIL: B thấy % hồ sơ (phải là 2: mình + A)', n; end if;
end $$;
reset role;
\echo '[OK] 6. Mỗi user chỉ thấy box chat của mình và hồ sơ người đang chat cùng'

-- 7. B gửi tin nhắn; C không đọc được, cũng không gửi vào box của người khác
select set_config('request.jwt.claim.sub', :'B', false);
set role authenticated;
insert into public.messages (conversation_id, sender_id, kind, body)
select id, :'B', 'text', 'xin chào' from public.conversations limit 1;
reset role;

select set_config('request.jwt.claim.sub', :'C', false);
set role authenticated;
do $$
declare n int; target uuid;
begin
  select count(*) into n from public.messages;
  if n <> 0 then raise exception 'FAIL: C đọc được tin nhắn của box chat khác'; end if;

  reset role;
  select conversation_id into target from public.messages limit 1;
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
  set role authenticated;
  begin
    insert into public.messages (conversation_id, sender_id, kind, body)
    values (target, '33333333-3333-3333-3333-333333333333', 'text', 'chen ngang');
    raise exception 'FAIL: C gửi được tin nhắn vào box chat không thuộc về mình';
  exception when insufficient_privilege then
    null; -- đúng như mong đợi: RLS chặn
  end;
end $$;
reset role;
\echo '[OK] 7. Tin nhắn chỉ đọc/gửi được trong box chat của mình'

-- 8. Không tự thêm mình vào box chat của người khác (chỉ accept_invite mới tạo được)
select set_config('request.jwt.claim.sub', :'C', false);
set role authenticated;
do $$
declare target uuid;
begin
  select conversation_id into target from public.messages limit 1;
  begin
    insert into public.conversation_members (conversation_id, user_id)
    values (target, '33333333-3333-3333-3333-333333333333');
    raise exception 'FAIL: tự thêm mình vào box chat của người khác được';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;
\echo '[OK] 8. Không ai tự chen vào box chat nếu không có link mời'

-- 9. Đổi tên hiển thị trùng người khác → bị từ chối
select set_config('request.jwt.claim.sub', :'B', false);
set role authenticated;
do $$
declare a_name text;
begin
  reset role;
  select display_name into a_name from public.chat_users
   where id = '11111111-1111-1111-1111-111111111111';
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
  set role authenticated;
  begin
    update public.chat_users set display_name = a_name
     where id = '22222222-2222-2222-2222-222222222222';
    raise exception 'FAIL: đặt được tên trùng người khác';
  exception when unique_violation then
    null;
  end;
  -- tên mới, không trùng → phải thành công
  update public.chat_users set display_name = 'Tên Mới Của B'
   where id = '22222222-2222-2222-2222-222222222222';
end $$;
reset role;
\echo '[OK] 9. Đổi tên hiển thị: trùng thì bị chặn, không trùng thì lưu được'

-- 10. Link của chính mình / link đã thu hồi → báo lỗi rõ ràng
select set_config('request.jwt.claim.sub', :'A', false);
set role authenticated;
do $$
begin
  begin
    perform public.accept_invite('tok_a');
    raise exception 'FAIL: chủ link tự nhận link của mình được';
  exception when others then
    if sqlerrm not like '%link mời của chính bạn%' then raise; end if;
  end;

  update public.chat_invites set revoked = true where token = 'tok_a';
end $$;
reset role;

select set_config('request.jwt.claim.sub', :'C', false);
set role authenticated;
do $$
begin
  begin
    perform public.accept_invite('tok_a');
    raise exception 'FAIL: link đã thu hồi vẫn dùng được';
  exception when others then
    if sqlerrm not like '%thu hồi%' then raise; end if;
  end;
end $$;
reset role;
\echo '[OK] 10. Link của chính mình và link đã thu hồi đều bị chặn'

-- 11. File ảnh/video/voice: chỉ thành viên box chat mới đọc/tải lên được
select set_config('request.jwt.claim.sub', :'B', false);
set role authenticated;
do $$
declare conv uuid;
begin
  select conversation_id into conv from public.messages limit 1;
  insert into storage.objects (bucket_id, name, owner)
  values ('chat-media', conv || '/anh1.png', '22222222-2222-2222-2222-222222222222');
end $$;
reset role;

select set_config('request.jwt.claim.sub', :'C', false);
set role authenticated;
do $$
declare n int; conv uuid;
begin
  select count(*) into n from storage.objects;
  if n <> 0 then raise exception 'FAIL: C đọc được file của box chat khác'; end if;

  reset role;
  select conversation_id into conv from public.messages limit 1;
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
  set role authenticated;
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('chat-media', conv || '/chen-ngang.png', '33333333-3333-3333-3333-333333333333');
    raise exception 'FAIL: C tải được file vào box chat của người khác';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

do $$
declare is_public boolean;
begin
  select public into is_public from storage.buckets where id = 'chat-media';
  if is_public then raise exception 'FAIL: bucket chat-media vẫn đang public'; end if;
end $$;
\echo '[OK] 11. Bucket riêng tư: chỉ thành viên box chat đọc/tải file lên được'

-- 12. Tài khoản chờ duyệt không dùng được gì
insert into auth.users (id, email)
values ('44444444-4444-4444-4444-444444444444', 'd@example.com');

select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
set role authenticated;
do $$
declare n int;
begin
  -- Không nhận được link mời
  begin
    perform public.accept_invite('tok_a2');
    raise exception 'FAIL: tài khoản chờ duyệt vẫn mở được box chat';
  exception when others then
    if sqlerrm not like '%chờ admin duyệt%' then raise; end if;
  end;

  -- Không tạo được link mời của riêng mình
  begin
    insert into public.chat_invites (token, owner_id)
    values ('tok_d', '44444444-4444-4444-4444-444444444444');
    raise exception 'FAIL: tài khoản chờ duyệt vẫn tạo được link mời';
  exception when insufficient_privilege then
    null;
  end;

  -- Không tự duyệt cho mình được (trigger chặn)
  update public.chat_users set status = 'approved', role = 'admin'
   where id = '44444444-4444-4444-4444-444444444444';
  select count(*) into n from public.chat_users
   where id = '44444444-4444-4444-4444-444444444444' and status = 'approved';
  if n <> 0 then raise exception 'FAIL: người dùng tự duyệt được tài khoản của mình'; end if;
end $$;
reset role;
\echo '[OK] 12. Tài khoản chờ duyệt: không mở box chat, không tạo link, không tự duyệt'

-- 13. Người thường không duyệt được ai; admin thì duyệt được
select set_config('request.jwt.claim.sub', :'B', false);
set role authenticated;
do $$
declare n int;
begin
  begin
    perform public.admin_set_user_status('44444444-4444-4444-4444-444444444444', 'approved');
    raise exception 'FAIL: người dùng thường duyệt được tài khoản khác';
  exception when others then
    if sqlerrm not like '%Chỉ admin%' then raise; end if;
  end;

  select count(*) into n from public.admin_list_users();
  if n <> 0 then raise exception 'FAIL: người dùng thường xem được danh sách quản trị'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub', :'A', false);
set role authenticated;
do $$
declare n int; st text;
begin
  select count(*) into n from public.admin_list_users();
  if n <> 4 then raise exception 'FAIL: admin phải thấy 4 tài khoản, đang thấy %', n; end if;

  perform public.admin_set_user_status('44444444-4444-4444-4444-444444444444', 'approved');
  reset role;
  select status into st from public.chat_users where id = '44444444-4444-4444-4444-444444444444';
  if st <> 'approved' then raise exception 'FAIL: admin duyệt không ăn (status = %)', st; end if;
end $$;
reset role;
\echo '[OK] 13. Chỉ admin xem được danh sách tài khoản và duyệt được'

-- 14. Bị thu hồi quyền thì mất sạch quyền đọc, dù vẫn là thành viên box chat
select set_config('request.jwt.claim.sub', :'A', false);
set role authenticated;
select public.admin_set_user_status(:'C', 'rejected');
reset role;

select set_config('request.jwt.claim.sub', :'C', false);
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.conversations;
  if n <> 0 then raise exception 'FAIL: tài khoản bị thu hồi vẫn thấy % box chat', n; end if;
  select count(*) into n from public.messages;
  if n <> 0 then raise exception 'FAIL: tài khoản bị thu hồi vẫn đọc được tin nhắn'; end if;
end $$;
reset role;
\echo '[OK] 14. Thu hồi quyền là mất truy cập ngay, kể cả box chat cũ'

\echo ''
\echo '===== TẤT CẢ KIỂM THỬ ĐỀU ĐẠT ====='
