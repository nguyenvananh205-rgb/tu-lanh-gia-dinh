# Tủ lạnh gia đình

Ứng dụng web (PWA) quản lý thực phẩm trong tủ lạnh, lên kế hoạch bữa ăn và danh sách mua sắm cho gia đình. Cài được lên điện thoại như một app.

## Tính năng chính

- **Tủ lạnh**: quản lý thực phẩm theo ngăn và danh mục, theo dõi hạn sử dụng, có thông báo khi sắp hết hạn
- **Thêm nhanh**: nhập bằng giọng nói hoặc chụp ảnh, AI (Claude) tự nhận diện thực phẩm
- **Bữa ăn**: kế hoạch bữa ăn, gợi ý món từ những gì đang có trong tủ, quản lý công thức
- **Mua sắm**: danh sách mua sắm kèm gợi ý nên mua gì
- **Chia sẻ**: đăng nhập, tạo tủ lạnh riêng, mời người nhà bằng mã hoặc link `?join=CODE`
- **Chế độ khách**: dùng ngay không cần đăng nhập, dữ liệu lưu trên máy

## Công nghệ

React 19 · TypeScript · Vite · Tailwind CSS · Supabase (auth + database) · vite-plugin-pwa · driver.js (hướng dẫn lần đầu)

## Chạy trên máy

```bash
npm install
cp .env.example .env.local   # điền thông tin Supabase (không bắt buộc)
npm run dev
```

Nếu không có Supabase, app vẫn chạy ở chế độ khách (dữ liệu lưu trong trình duyệt).

### Cài đặt Supabase (cho đăng nhập và chia sẻ)

1. Tạo project tại [supabase.com](https://supabase.com)
2. Mở **SQL Editor**, chạy toàn bộ file [`supabase/schema.sql`](supabase/schema.sql)
3. Điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` vào `.env.local`

### API key cho AI

Tính năng nhận diện ảnh và gợi ý dùng Claude API. Người dùng tự nhập API key trong phần **Cài đặt** của app. Key chỉ lưu trên trình duyệt, không nằm trong mã nguồn.

## Cấu trúc thư mục

```
├── src/
│   ├── components/   # Các màn hình và thành phần giao diện
│   ├── hooks/        # Logic dùng chung (auth, dữ liệu tủ lạnh, giọng nói, thông báo)
│   ├── utils/        # Xử lý ảnh/giọng nói, chấm điểm món ăn, gợi ý mua sắm
│   ├── data/         # Dữ liệu mặc định (thực phẩm, công thức, bữa ăn)
│   ├── lib/          # Kết nối Supabase
│   ├── App.tsx       # Khung app và điều hướng tab
│   └── types.ts      # Kiểu dữ liệu
├── public/           # Icon, hình ảnh tĩnh
├── supabase/         # Schema database
├── docs/
│   └── conversations/  # Lịch sử hội thoại khi phát triển
└── .github/workflows/  # Tự động build và deploy lên GitHub Pages
```

## Lệnh thường dùng

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy server phát triển |
| `npm run build` | Build bản production vào `dist/` |
| `npm run preview` | Xem thử bản build |
| `npm run lint` | Kiểm tra code |

## Deploy

App là web tĩnh, đường dẫn gốc lấy từ biến `VITE_BASE_PATH` (mặc định `/`).

- **Vercel / Netlify**: import repo, framework **Vite**, thêm `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`. Không cần đặt `VITE_BASE_PATH`.
- **GitHub Pages**: workflow `.github/workflows/deploy.yml` build với `VITE_BASE_PATH=/tu-lanh-gia-dinh/` mỗi khi push lên `main`. Chỉ chạy được khi repo public hoặc tài khoản GitHub Pro.

## App nhắn tin (thư mục `chat-app/`)

Repo còn chứa một app độc lập, không liên quan tới app tủ lạnh:
[`chat-app/`](chat-app/README.md) — **Nhắn tin**, chat 1-1 riêng tư với tài khoản riêng,
schema Supabase riêng và admin duyệt người dùng. Cùng workflow deploy, chạy ở
`/tu-lanh-gia-dinh/chat/`.

Riêng tab "Nhắn tin" bên trong app tủ lạnh là một module khác, xem
[`docs/messaging.md`](docs/messaging.md).
