import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'GameQueue',
        short_name: 'GameQueue',
        description: 'Your games backlog: queue, wishlist and the best prices.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#07080c',
        theme_color: '#07080c',
        categories: ['games', 'entertainment', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Find a game', short_name: 'Search', url: '/?search=1', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Last known list so the installed app opens offline
            urlPattern: ({ url, request }) => url.pathname === '/api/games' && request.method === 'GET',
            handler: 'NetworkFirst',
            options: { cacheName: 'api-games', networkTimeoutSeconds: 4, expiration: { maxEntries: 2 } },
          },
          {
            urlPattern: ({ url, request }) => url.pathname.startsWith('/api/steam/') && request.method === 'GET',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'api-steam', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 } },
          },
          {
            urlPattern: ({ request, url }) => request.destination === 'image' && url.origin !== self.location.origin,
            handler: 'CacheFirst',
            options: {
              cacheName: 'covers',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
  },
})
