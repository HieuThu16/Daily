/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest: { name: 'My Space', short_name: 'My Space', theme_color: '#466147', background_color: '#fafaf7', display: 'standalone', icons: [] } })],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
