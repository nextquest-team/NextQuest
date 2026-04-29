// Redirige les utilisateurs déjà connectés hors des pages auth (login, register)
export default defineNuxtRouteMiddleware(() => {
  const store = useAuthStore()
  if (store.isAuthenticated) {
    // TODO: rediriger vers /dashboard quand la page existe
    return navigateTo('/')
  }
})
