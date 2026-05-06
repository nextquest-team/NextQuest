// Redirige les utilisateurs déjà connectés hors des pages auth (login, register, landing)
export default defineNuxtRouteMiddleware(() => {
  const store = useAuthStore()
  if (store.isAuthenticated) {
    return navigateTo('/dashboard')
  }
})
