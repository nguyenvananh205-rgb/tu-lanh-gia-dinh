import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Khi deploy vào đường dẫn con (GitHub Pages: /Vanh/chat/) thì truyền VITE_BASE_PATH.
// Chạy ở máy hoặc deploy lên domain riêng thì để mặc định "/".
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react()],
});
