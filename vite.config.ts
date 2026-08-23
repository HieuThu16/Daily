/// <reference types="vitest/config" />
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Thư mục api/ là serverless function của Vercel; `vite dev` không chạy nó nên
 * mọi lời gọi /api/* đều 404 khi phát triển. Plugin này nạp thẳng handler bằng
 * ssrLoadModule và giả lập req/res kiểu Express để dùng lại đúng file production.
 */
function apiDevServer(): Plugin {
  return {
    name: 'api-dev-server',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/')) return next()

        const [pathname, query = ''] = url.slice('/api/'.length).split('?')
        const name = pathname.replace(/\/+$/, '')
        // Chặn ../ để không nạp được file ngoài thư mục api/
        if (!name || !/^[\w-]+$/.test(name)) return next()

        const file = resolve(process.cwd(), 'api', `${name}.ts`)
        if (!existsSync(file)) return next()

        void (async () => {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const raw = Buffer.concat(chunks).toString('utf8')

          let statusCode = 200
          const shim = {
            status(code: number) {
              statusCode = code
              return shim
            },
            setHeader(key: string, value: string) {
              res.setHeader(key, value)
              return shim
            },
            json(payload: unknown) {
              res.statusCode = statusCode
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(payload))
            },
            send(payload: unknown) {
              res.statusCode = statusCode
              res.end(typeof payload === 'string' ? payload : JSON.stringify(payload))
            },
            end(payload?: unknown) {
              res.statusCode = statusCode
              res.end(payload as any)
            },
          }

          try {
            const mod = await server.ssrLoadModule(`/api/${name}.ts`)
            await mod.default(
              {
                method: req.method,
                headers: req.headers,
                url,
                query: Object.fromEntries(new URLSearchParams(query)),
                body: raw ? JSON.parse(raw) : {},
              },
              shim,
            )
          } catch (err) {
            server.config.logger.error(`[api/${name}] ${(err as Error).message}`)
            if (!res.writableEnded) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: (err as Error).message }))
            }
          }
        })()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Handler đọc process.env.YOUTUBE_API_KEY / SUPABASE_SERVICE_ROLE_KEY (không có
  // tiền tố VITE_) nên phải nạp .env vào process.env cho chế độ dev.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [
      react(),
      apiDevServer(),
      VitePWA({
        registerType: 'prompt',
        // pdfjs + jszip chỉ cần khi nhập sách và việc nhập luôn cần mạng (lưu lên Supabase).
        // Không precache để cài PWA không phải tải thêm ~1.8MB.
        // workbox tự sinh sw.js nên không sửa thẳng được; nạp thêm file xử lý Web Push
        // bằng importScripts thay vì đổi cả dự án sang chế độ injectManifest.
        workbox: {
          maximumFileSizeToCacheInBytes: 35 * 1024 * 1024,
          globIgnores: ['**/book-parsers-*.js', '**/pdf.worker*.mjs', '**/ngontinh_manga-*.js', '**/bl_manga-*.js'],
          importScripts: ['/push-sw.js'],
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,

          // Ảnh truyện đã đọc giữ lại trong cache: mất mạng vẫn đọc lại được.
          // CacheFirst + trần 600 ảnh (~30 ngày) để khỏi phình bộ nhớ máy.
          runtimeCaching: [
            {
              urlPattern: ({ request }: { request: Request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'manga-images',
                expiration: { maxEntries: 600, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        manifest: { name: 'My Space', short_name: 'My Space', theme_color: '#466147', background_color: '#fafaf7', display: 'standalone', icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        // Nhấn giữ icon app trên màn hình chính sẽ ra bốn lối tắt này.
        // PWA không làm được widget thật, shortcuts là thứ gần nhất và miễn phí.
        // Chia sẻ link từ app khác (YouTube, trình duyệt) thẳng vào form thêm nhạc/video.
        share_target: {
          action: '/share',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        shortcuts: [
          { name: 'Viết nhật ký', short_name: 'Nhật ký', url: '/daily' },
          { name: 'Tick thói quen', short_name: 'Thói quen', url: '/habit' },
          { name: 'Thêm việc', short_name: 'Việc', url: '/tasks' },
          { name: 'Ghi khoản tiền', short_name: 'Tiền', url: '/money' },
        ] },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id: string) => (/node_modules[\/](pdfjs-dist|jszip)[\/]/.test(id) ? 'book-parsers' : undefined),
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      // Worktree có node_modules riêng -> React bị nạp 2 lần, mọi test trong đó fail giả.
      exclude: ['node_modules/**', 'dist/**', '.claude/**'],
    },
  }
})
