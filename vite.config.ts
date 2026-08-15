/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // pdfjs + jszip chỉ cần khi nhập sách và việc nhập luôn cần mạng (lưu lên Supabase).
      // Không precache để cài PWA không phải tải thêm ~1.8MB.
      // workbox tự sinh sw.js nên không sửa thẳng được; nạp thêm file xử lý Web Push
      // bằng importScripts thay vì đổi cả dự án sang chế độ injectManifest.
      workbox: {
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
        globIgnores: ['**/book-parsers-*.js', '**/pdf.worker*.mjs'],
        importScripts: ['/push-sw.js'],
      },
      manifest: { name: 'My Space', short_name: 'My Space', theme_color: '#466147', background_color: '#fafaf7', display: 'standalone', icons: [] },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => (/node_modules[\\/](pdfjs-dist|jszip)[\\/]/.test(id) ? 'book-parsers' : undefined),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
