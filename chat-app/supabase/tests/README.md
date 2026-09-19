# Kiểm thử schema bằng Postgres cục bộ

Chạy được mà không cần project Supabase: file `00-supabase-stub.sql` giả lập những
thứ Supabase cung cấp sẵn (schema `auth`/`storage`, hàm `auth.uid()`, role
`authenticated`, publication `supabase_realtime`), sau đó chạy `../schema.sql` và
bộ kiểm thử `01-rls-tests.sql`.

```bash
# cần Postgres 14+ đang chạy, ví dụ trên cổng 5433
createdb -h /tmp -p 5433 -U postgres apptest
psql -h /tmp -p 5433 -U postgres -d apptest -v ON_ERROR_STOP=1 -f supabase/tests/00-supabase-stub.sql
psql -h /tmp -p 5433 -U postgres -d apptest -v ON_ERROR_STOP=1 -f supabase/schema.sql
psql -h /tmp -p 5433 -U postgres -d apptest -v ON_ERROR_STOP=1 -f supabase/tests/01-rls-tests.sql
```

Bộ kiểm thử phủ: trigger sinh tên hiển thị không trùng, link mời dùng nhiều lần
(mỗi người một box chat riêng), bấm link 2 lần không tạo box trùng, link của chính
mình / link đã thu hồi bị chặn, và các ràng buộc RLS (chỉ thấy box chat của mình,
không đọc/gửi được vào box của người khác, không tự thêm mình vào box chat).

Lưu ý: bộ này kiểm tra tầng database. Phần HTTP của Supabase (đăng ký/đăng nhập,
realtime, storage) vẫn phải thử trên project thật.
