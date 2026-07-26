// Nuxt config for the party-game hub.
// - websocket: real-time per-player state push (server/routes/ws.ts)
// - host 0.0.0.0 so phones on the LAN can reach dev server; prod uses HOST env.
export default defineNuxtConfig({
  compatibilityDate: '2025-07-01',
  css: ['~/assets/css/theme.css'],
  app: {
    head: {
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }],
    },
  },
  devServer: { host: '0.0.0.0', port: 3333 },
  nitro: { experimental: { websocket: true } },
})
