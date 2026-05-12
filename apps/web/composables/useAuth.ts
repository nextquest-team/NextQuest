import type { User } from '@nextquest/shared'

interface AuthResponse {
  user: User
  accessToken: string
}

interface OAuthInitResponse {
  url: string
}

type OAuthProvider = 'google' | 'microsoft'

export const useAuth = () => {
  const store = useAuthStore()
  const config = useRuntimeConfig()
  const router = useRouter()
  const apiBase = import.meta.server ? config.apiBase : config.public.apiBase

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
      await router.push('/dashboard')
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
      await router.push('/dashboard')
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
    // Échec réseau silencieux : l'utilisateur est déconnecté localement
    // quoi qu'il arrive (cleanup garanti par le finally)
    try {
      await $fetch(`${apiBase}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // ignore
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

  // Récupère le profil du user connecté via le JWT (utilisé après OAuth)
  async function fetchMe(token?: string): Promise<User | null> {
    try {
      const accessToken = token ?? store.accessToken
      if (!accessToken) return null
      const user = await $fetch<User>(`${apiBase}/api/auth/me`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      store.setAuth(user, accessToken)
      return user
    } catch {
      store.clearAuth()
      return null
    }
  }

  // Démarre un flow OAuth : ouvre une popup vers le provider.
  // La popup poste son résultat (token ou erreur) au parent via postMessage,
  // puis se ferme. Si le navigateur bloque la popup, fallback sur la redirection complète.
  async function loginWithOAuth(provider: OAuthProvider) {
    isLoading.value = true
    error.value = null

    let data: OAuthInitResponse
    try {
      data = await $fetch<OAuthInitResponse>(
        `${apiBase}/api/auth/oauth/${provider}`,
        { credentials: 'include' },
      )
    } catch {
      const label = provider === 'google' ? 'Google' : 'Microsoft'
      error.value = `Connexion ${label} indisponible pour le moment`
      isLoading.value = false
      return
    }

    // Popup centrée
    const w = 500
    const h = 700
    const left = window.screenX + (window.outerWidth - w) / 2
    const top = window.screenY + (window.outerHeight - h) / 2
    const popup = window.open(
      data.url,
      'nq-oauth',
      `width=${w},height=${h},left=${left},top=${top}`,
    )

    // Popup bloquée par le navigateur → fallback
    if (!popup) {
      window.location.href = data.url
      return
    }

    // Écoute les messages de la popup et nettoie quand elle se ferme
    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const msg = event.data
      if (!msg || typeof msg !== 'object') return

      if (msg.type === 'nq-oauth-success' && typeof msg.token === 'string') {
        window.removeEventListener('message', onMessage)
        await fetchMe(msg.token)
        isLoading.value = false
        await router.push('/dashboard')
      } else if (msg.type === 'nq-oauth-error') {
        window.removeEventListener('message', onMessage)
        const label = provider === 'google' ? 'Google' : 'Microsoft'
        error.value = msg.message ?? `Connexion ${label} échouée`
        isLoading.value = false
      }
    }
    window.addEventListener('message', onMessage)

    // Si la popup se ferme sans postMessage (l'utilisateur a annulé)
    const watchClosed = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(watchClosed)
        window.removeEventListener('message', onMessage)
        if (isLoading.value) isLoading.value = false
      }
    }, 500)
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
    fetchMe,
    loginWithOAuth,
  }
}
