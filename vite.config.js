import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      // autoUpdate 由插件生成的注册脚本调用 skipWaiting/clientsClaim，
      // 新版本部署后会立即接管已打开的页面。对当前"单 bundle、无懒加载路由"的
      // 结构是安全的；一旦引入代码分割或懒加载，需要改为 prompt 并配合
      // useRegisterSW 提供更新提示，否则已打开的页面可能请求到已清理的旧 chunk。
      registerType: 'autoUpdate',
      // manifest.icons 里的图标默认会被额外加入 precache 清单，
      // 而 globPatterns 已经覆盖了 svg，两者叠加会让 favicon.svg 出现两次
      includeManifestIcons: false,
      manifest: {
        name: 'TractorLog — 农机维护日志',
        short_name: 'TractorLog',
        description: '记录和追踪拖拉机保养维护',
        // 未显式指定时 vite-plugin-pwa 会写入 lang: 'en'，与 index.html 的 zh-CN 不一致
        lang: 'zh-CN',
        // 显式声明 id，避免将来修改 start_url 时被浏览器视为另一个应用而重复安装
        id: '/',
        start_url: '/',
        scope: '/',
        theme_color: '#16a34a',
        background_color: '#fafaf5',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        // globPatterns 已覆盖 svg，不要再把 favicon.svg 放进 includeAssets，
        // 否则它会在 precache manifest 里出现两次
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // 没有 denylist 时，任意不存在的路径都会被兜底到 index.html 并返回 200，
        // 真实 404 会被掩盖，给排查问题带来干扰
        navigateFallbackDenylist: [/^\/api\//, /^\/__\//],
      },
    }),
  ],
})
