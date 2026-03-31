export default defineNuxtConfig({
  compatibilityDate: "2026-03-31",
  devtools: { enabled: true },
  modules: ["@nuxtjs/tailwindcss"],
  devServer: {
    port: 3001,
  },
  runtimeConfig: {
    public: {
      apiUrl: "http://localhost:3000/api",
    },
  },
});
