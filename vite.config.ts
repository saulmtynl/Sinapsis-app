import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base: './' (not an absolute '/') so the build works unmodified whether it
// ends up served at the root of a GitHub Pages user site or under a project
// site's /<repo>/ subpath — no repo name needs to be hardcoded here.
export default defineConfig({
  base: './',
  // Allows testing the dev server from a phone via a tunnel (localtunnel,
  // ngrok, etc.) during development — Vite blocks unrecognized Host headers
  // by default. Dev-server-only setting; doesn't affect the production
  // build served from GitHub Pages.
  server: {
    allowedHosts: ['.loca.lt']
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Precache only the static app shell (HTML/CSS/JS/icons). Map data,
      // media and Drive API responses are intentionally never cached here —
      // this app always requires a live connection to Drive, per the
      // Milestone 9 spec (no offline data mode, just an offline banner).
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallbackDenylist: [/^\/oauth2?/]
      },
      manifest: {
        name: 'Sinapsis',
        short_name: 'Sinapsis',
        description: 'Navega, edita y graba contenido de tus mapas de Sinapsis desde el celular.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#fafafa',
        theme_color: '#6366f1',
        icons: [
          { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-maskable.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      }
    })
  ]
})
