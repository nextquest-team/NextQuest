import { $fetch, type FetchOptions } from 'ofetch'

/**
 * Wrapper autour de $fetch qui gère le renouvellement silencieux du token.
 *
 * Flux :
 *   1. Appel API avec le token courant.
 *   2. Si 401 → appel de refreshTokens() (cookie httpOnly → nouveau access token).
 *   3. Retry unique avec le nouveau token.
 *   4. Si le refresh échoue → logout + redirect /auth/login.
 */
export const useAuthFetch = () => {
  const store = useAuthStore()
  const { refreshTokens } = useAuth()
  const router = useRouter()
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase

  async function authFetch<T>(
    url: string,
    options: FetchOptions<'json'> = {},
  ): Promise<T> {
    const buildOptions = (): FetchOptions<'json'> => ({
      ...options,
      credentials: 'include',
      headers: {
        ...(options.headers ?? {}),
        ...(store.accessToken
          ? { Authorization: `Bearer ${store.accessToken}` }
          : {}),
      },
    })

    try {
      return await $fetch<T>(url, buildOptions())
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode ?? err?.response?.status
      if (status !== 401) throw err

      // Token expiré → on tente un refresh
      const refreshed = await refreshTokens()

      if (!refreshed) {
        // Refresh token aussi expiré → on déconnecte et on redirige
        await router.push('/auth/login')
        throw err
      }

      // Retry avec le nouveau token (store.accessToken mis à jour par refreshTokens)
      return await $fetch<T>(url, buildOptions())
    }
  }

  return { authFetch, apiBase }
}
