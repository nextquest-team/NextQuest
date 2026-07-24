export default defineNuxtConfig({
  compatibilityDate: '2026-03-31',
  devtools: { enabled: false },
  devServer: { port: 3001 },

  // Polling pour que le watcher détecte les nouveaux fichiers dans Docker/macOS
  vite: {
    server: {
      watch: {
        usePolling: true,
        interval: 1000,
        // Évite que le watcher se déclenche sur les fichiers que Nuxt
        // génère lui-même dans .nuxt/ au démarrage, ce qui provoquait un
        // redémarrage immédiat du serveur dev et un crash du WS HMR
        // ("handleUpgrade() was called more than once with the same socket").
        // node_modules et .git sont déjà ignorés par défaut par Vite.
        ignored: ['**/.nuxt/**'],
      },
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'My Next Quest is...',
      titleTemplate: '%s — My Next Quest is...',
    },
  },

  modules: ['@pinia/nuxt', 'vuetify-nuxt-module', '@nuxtjs/i18n'],

  routeRules: {
    // Le suivi (followedGames) dépend du localStorage client, désactiver le
    // SSR évite un flash de contenu vide et l'écrasement du state par le
    // payload Pinia serveur (le definePageMeta ssr:false n'a pas d'effet ici).
    '/timeline': { ssr: false },
  },

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
      // @ts-expect-error — propriété runtime valide, absente des types MOptions
      i18n: false,
    },
    vuetifyOptions: {
      display: {
        mobileBreakpoint: 600,
      },
      icons: { defaultSet: 'mdi' },
      theme: {
        defaultTheme: 'nextquest',
        themes: {
          nextquest: {
            dark: false,
            colors: {
              primary: '#5C3317',
              'primary-light': '#A07850',
              'primary-dark': '#7A3E2A',
              secondary: '#F8F4EA',
              'secondary-light': '#EDC78E',
              gold: '#C8A44A',
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
