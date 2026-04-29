// Protège les routes qui nécessitent d'être connecté
export default defineNuxtRouteMiddleware(() => {
  const store = useAuthStore()
  if (!store.isAuthenticated) {
    return navigateTo('/auth/login')
  }
})
