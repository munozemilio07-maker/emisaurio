import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Expediciones de Ashenfall',
        short_name: 'Ashenfall',
        description: 'Cuaderno de cartógrafo para completar al 100% RuneScape: Dragonwilds.',
        lang: 'es',
        display: 'standalone',
        orientation: 'any',
        background_color: '#15110c',
        theme_color: '#15110c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App, datos, fuentes y los zooms bajos del mapa quedan precacheados;
        // los zooms altos se guardan al verlos o con "Descargar mapa" en Ajustes.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}', 'tiles/*/{1,2,3,4}/**/*.webp'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/tiles/'),
            handler: 'CacheFirst',
            options: { cacheName: 'ashenfall-tiles', expiration: { maxEntries: 6000 }, cacheableResponse: { statuses: [200] } },
          },
        ],
      },
    }),
  ],
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  build: { chunkSizeWarningLimit: 1200 },
  test: { include: ['tests/**/*.test.ts'] },
});
