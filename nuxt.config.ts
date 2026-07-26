// Nuxt config for the party-game hub.
// - websocket: real-time per-player state push (server/routes/ws.ts)
// - host 0.0.0.0 so phones on the LAN can reach dev server; prod uses HOST env.
export default defineNuxtConfig({
  compatibilityDate: '2025-07-01',
  // Devtools instrumentation (vue-router __vrv_devtools) crashes on some phone
  // browsers when hitting the dev server; off since phones are the whole point.
  devtools: { enabled: false },
  modules: ['@vite-pwa/nuxt'],
  css: ['~/assets/css/theme.css'],
  app: {
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#120a17' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      ],
      link: [{ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    },
  },
  devServer: { host: '0.0.0.0', port: 3333 },
  nitro: { experimental: { websocket: true } },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Party Hub',
      short_name: 'Party Hub',
      description: 'LAN party games — Music Impostor & 5 Second Rule',
      theme_color: '#120a17',
      background_color: '#120a17',
      display: 'standalone',
      orientation: 'portrait',
      icons: [
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    // Live game — don't serve stale content; just precache the shell for installability.
    workbox: { navigateFallback: '/', globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'] },
  },
})
