import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages (repo tu-lanh-gia-dinh) cần VITE_BASE_PATH=/tu-lanh-gia-dinh/; Vercel/Netlify/máy local để mặc định "/".
const base = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Tủ lạnh gia đình',
        short_name: 'Tủ lạnh',
        description: 'Quản lý thực phẩm, kế hoạch bữa ăn và danh sách mua sắm',
        theme_color: '#10b981',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'vi',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        categories: ['food', 'lifestyle', 'productivity'],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // App Nhắn tin (<base>chat/) và thiệp sinh nhật (<base>sinh-nhat/) — không để service worker của app tủ lạnh
        // trả về index.html của mình cho các đường dẫn đó
        navigateFallbackDenylist: [new RegExp(`^${base}chat/`), new RegExp(`^${base}sinh-nhat/`)],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.anthropic\.com\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
