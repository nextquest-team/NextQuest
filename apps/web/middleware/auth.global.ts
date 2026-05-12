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

  // SSR : la session est gérée côté client uniquement (cookie httpOnly + plugin).
  // On laisse le serveur rendre la page, le client prend le relais.
  if (import.meta.server) return

  // Client : si le plugin n'a pas encore restauré la session, on attend.
  if (!store.initialized) return

  if (!store.isAuthenticated) {
    return navigateTo('/auth/login')
  }
})
