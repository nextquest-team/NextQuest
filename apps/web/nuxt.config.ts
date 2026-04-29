export default defineNuxtConfig({
  compatibilityDate: '2026-03-31',
  devtools: { enabled: true },
  devServer: { port: 3001 },

  modules: ['@pinia/nuxt', 'vuetify-nuxt-module'],

  css: [
    '~/assets/css/main.css',
    '@mdi/font/css/materialdesignicons.min.css',
  ],

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3000',
    },
  },

  vuetify: {
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
