// Restaure silencieusement la session utilisateur au chargement de la page
// via le refresh token stocké dans le cookie httpOnly
export default defineNuxtPlugin(async () => {
  const { refreshTokens } = useAuth()
  await refreshTokens()
})
