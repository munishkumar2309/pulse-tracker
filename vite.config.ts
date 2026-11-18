/// <reference types="vitest/config" />
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    {
      // Dev only: a missing file under /models/ must 404 (as on the phone), not fall back to index.html,
      // so Transformers.js skips optional files (tokenizer) and can fall back to Hugging Face.
      name: 'models-404',
      configureServer(server) {
        server.middlewares.use('/models', (req, res, next) => {
          if (existsSync('public/models' + decodeURIComponent((req.url ?? '').split('?')[0]))) return next()
          res.statusCode = 404
          res.end()
        })
      },
    },
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { globIgnores: ['**/*.wasm', 'models/**'] }, // food-photo runtime (27 MB) + model: loaded on use, not precached
      manifest: {
        name: 'Pulse — Money & Health',
        short_name: 'Pulse',
        theme_color: '#0E1822',
        background_color: '#0E1822',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
  test: { environment: 'node' },
})
