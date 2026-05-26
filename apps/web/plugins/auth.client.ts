// Restaure silencieusement la session utilisateur au chargement de la page
// via le refresh token stocké dans le cookie httpOnly.
// Marque ensuite le store comme initialisé pour que le middleware
// puisse prendre des décisions de navigation fiables.
export default defineNuxtPlugin(async () => {
  const store = useAuthStore()

  // Sur /auth/callback (popup OAuth ou fallback plein écran), une session vient
  // tout juste d'être créée côté API. Appeler refreshTokens() ici déclencherait
  // une rotation immédiate du refresh token et créerait une 2e ligne dans la
  // table sessions (à 1s d'écart). La page callback gère sa propre session via
  // le token reçu en query string.
  if (window.location.pathname === '/auth/callback') {
    store.setInitialized()
    return
  }

  const { refreshTokens } = useAuth()
  await refreshTokens()
  store.setInitialized()
})
