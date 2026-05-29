import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Dev proxy omija CORS: przeglądarka woła własny origin (/api),
  // a serwer Vite przekazuje żądanie do mempool.space.
  server: {
    proxy: {
      // Salda adresów: mempool.space
      '/api': {
        target: 'https://mempool.space',
        changeOrigin: true,
      },
      // Salda ETH: Blockscout (REST, GET-only, bez klucza API)
      '/eth': {
        target: 'https://eth.blockscout.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/eth/, ''),
      },
      // Ceny i statystyki: CoinGecko (PLN + wiele walut, zmiany 24h/7d/30d).
      // Jeśli ustawisz CG_DEMO_KEY w env, dev proxy doda go jako nagłówek —
      // tak samo jak Pages Function na produkcji.
      '/cg': {
        target: 'https://api.coingecko.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cg/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'gazewallet (dev)')
            const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
              .process?.env
            const key = env?.CG_DEMO_KEY
            if (key) proxyReq.setHeader('x-cg-demo-api-key', key)
          })
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'gazewallet',
        short_name: 'gazewallet',
        description: 'Minimalist watch-only crypto portfolio tracker',
        theme_color: '#0b0d10',
        background_color: '#0b0d10',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
