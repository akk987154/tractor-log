import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'TractorLog — 农机维护日志',
        short_name: 'TractorLog',
        description: '记录和追踪拖拉机保养维护',
        theme_color: '#16a34a',
        background_color: '#fafaf5',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
    }),
  ],
})
