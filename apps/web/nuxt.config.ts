export default defineNuxtConfig({
  compatibilityDate: '2026-03-31',
  devtools: { enabled: true },
  devServer: { port: 3001 },

  // Polling pour que le watcher détecte les nouveaux fichiers dans Docker/macOS
  vite: {
    server: {
      watch: {
        usePolling: true,
        interval: 1000,
      },
    },
  },

  modules: ['@pinia/nuxt', 'vuetify-nuxt-module', '@nuxtjs/i18n'],

  i18n: {
    locales: [
      { code: 'fr', file: 'fr.json' },
      { code: 'en', file: 'en.json' },
    ],
    defaultLocale: 'fr',
    langDir: 'locales',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'nq_locale',
      fallbackLocale: 'en',
      // fr-BE, fr-CA, fr-CH, etc. → match 'fr' ; tout le reste → 'en'
      alwaysRedirect: false,
    },
  },

  css: [
    '~/assets/css/main.css',
    '@mdi/font/css/materialdesignicons.min.css',
  ],

  runtimeConfig: {
    // Côté serveur (SSR/middleware) — jamais exposé au browser
    apiBase: process.env.NUXT_API_BASE || 'http://localhost:3000',
    public: {
      // Côté client (browser) — doit pointer sur localhost
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3000',
    },
  },

  vuetify: {
    moduleOptions: {
      // Empêche vuetify-nuxt-module de brancher @nuxtjs/i18n comme adaptateur
      // Vuetify — sinon Vuetify cherche ses clés internes ($vuetify.*) dans
      // nos fichiers fr.json/en.json où elles n'existent pas.
      i18n: false,
    },
    vuetifyOptions: {
      icons: { defaultSet: 'mdi' },
      theme: {
        defaultTheme: 'nextquest',
        themes: {
          nextquest: {
            dark: false,
            colors: {
              primary: '#5C3317',
              secondary: '#F8F4EA',
              background: '#EDE8DC',
              surface: '#F8F4EA',
              error: '#8B1F1F',
              'on-background': '#3A1A0A',
              'on-surface': '#3A1A0A',
            },
          },
        },
      },
    },
  },
})
