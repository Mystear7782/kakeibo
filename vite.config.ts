import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages のプロジェクトページ（https://<user>.github.io/kakeibo/）で配信する
const base = '/kakeibo/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: '家計簿',
        short_name: '家計簿',
        lang: 'ja',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#14161A',
        theme_color: '#14161A',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // API 応答はキャッシュしない。画面の静的ファイルだけをキャッシュする
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{js,css,html,png,svg}'],
      },
    }),
  ],
})
