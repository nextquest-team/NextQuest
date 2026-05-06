// Middleware global : protège toutes les routes par défaut.
// Les visiteurs non connectés ne peuvent accéder qu'aux routes publiques :
//   - / (landing)
//   - /auth/login, /auth/register
//   - /auth/forgot-password
//   - /auth/callback (atterrissage OAuth)
// Toute autre route redirige vers /auth/login.

const PUBLIC_ROUTES = new Set<string>([
  '/',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/callback',
])

export default defineNuxtRouteMiddleware((to) => {
  if (PUBLIC_ROUTES.has(to.path)) return

  const store = useAuthStore()
  if (!store.isAuthenticated) {
    return navigateTo('/auth/login')
  }
})
