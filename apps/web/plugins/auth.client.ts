// Restaure silencieusement la session utilisateur au chargement de la page
// via le refresh token stocké dans le cookie httpOnly.
// Marque ensuite le store comme initialisé pour que le middleware
// puisse prendre des décisions de navigation fiables.
export default defineNuxtPlugin(async () => {
  const { refreshTokens } = useAuth()
  const store = useAuthStore()
  await refreshTokens()
  store.setInitialized()
})
