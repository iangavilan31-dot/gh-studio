import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Pin the PostCSS config to this directory. Without this, Vite searches
  // upward and finds the unrelated Tailwind config belonging to the site at
  // the repository root, which then fails to resolve. The dashboard uses plain
  // CSS custom properties and needs no PostCSS pipeline of its own.
  css: { postcss: { plugins: [] } },
  server: {
    port: 5173,
    proxy: {
      // The engine API binds to localhost only. Proxying keeps the browser
      // on one origin so there is no CORS dance and no port in fetch URLs.
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:8787', ws: true },
    },
  },
})
