import type { User } from '@nextquest/shared'

interface AuthResponse {
  user: User
  accessToken: string
}

export const useAuth = () => {
  const store = useAuthStore()
  const config = useRuntimeConfig()
  const router = useRouter()
  const apiBase = config.public.apiBase

  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function login(email: string, password: string) {
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<AuthResponse>(`${apiBase}/api/auth/login`, {
        method: 'POST',
        body: { email, password },
        credentials: 'include',
      })
      store.setAuth(data.user, data.accessToken)
      // TODO: rediriger vers le dashboard quand la page existe
      await router.push('/')
    } catch (err: any) {
      error.value = err.data?.error ?? 'Email ou mot de passe incorrect'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function register(username: string, email: string, password: string) {
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<AuthResponse>(`${apiBase}/api/auth/register`, {
        method: 'POST',
        body: { username, email, password },
        credentials: 'include',
      })
      store.setAuth(data.user, data.accessToken)
      // TODO: rediriger vers le dashboard quand la page existe
      await router.push('/')
    } catch (err: any) {
      if (err.status === 409) {
        error.value = 'Cet email ou ce pseudo est déjà utilisé'
      } else {
        error.value = err.data?.error ?? "Erreur lors de l'inscription"
      }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    try {
      await $fetch(`${apiBase}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      store.clearAuth()
      await router.push('/')
    }
  }

  // Appelé au chargement de l'app pour restaurer la session depuis le cookie httpOnly
  async function refreshTokens(): Promise<boolean> {
    try {
      const data = await $fetch<AuthResponse>(`${apiBase}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      store.setAuth(data.user, data.accessToken)
      return true
    } catch {
      store.clearAuth()
      return false
    }
  }

  return {
    user: computed(() => store.user),
    isAuthenticated: computed(() => store.isAuthenticated),
    isLoading: readonly(isLoading),
    error: readonly(error),
    login,
    register,
    logout,
    refreshTokens,
  }
}
