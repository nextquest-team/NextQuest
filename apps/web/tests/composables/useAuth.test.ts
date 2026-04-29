// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuth } from '~/composables/useAuth'
import { useAuthStore } from '~/stores/auth'

const fakeUser = {
  id: 'u-1',
  email: 'lo@test.fr',
  username: 'lo',
  displayName: null,
  avatarUrl: null,
  locale: 'fr' as const,
  isPublic: true,
  createdAt: new Date(),
  updatedAt: null,
}

describe('useAuth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('login stocke user + token et redirige vers /', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      user: fakeUser,
      accessToken: 'jwt-token',
    })
    vi.stubGlobal('$fetch', fetchMock)

    const { login } = useAuth()
    await login('lo@test.fr', 'password123')

    const store = useAuthStore()
    expect(store.user).toEqual(fakeUser)
    expect(store.accessToken).toBe('jwt-token')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({
        method: 'POST',
        body: { email: 'lo@test.fr', password: 'password123' },
        credentials: 'include',
      }),
    )
  })

  it('login expose une erreur si l\'API renvoie 401', async () => {
    const apiError = Object.assign(new Error('Unauthorized'), {
      status: 401,
      data: { error: 'Email ou mot de passe incorrect' },
    })
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(apiError))

    const { login, error } = useAuth()
    await expect(login('lo@test.fr', 'wrong')).rejects.toThrow()
    expect(error.value).toBe('Email ou mot de passe incorrect')
  })

  it('register expose une erreur 409 personnalisée', async () => {
    const apiError = Object.assign(new Error('Conflict'), {
      status: 409,
      data: { error: 'duplicate' },
    })
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(apiError))

    const { register, error } = useAuth()
    await expect(register('lo', 'lo@test.fr', 'password123')).rejects.toThrow()
    expect(error.value).toBe('Cet email ou ce pseudo est déjà utilisé')
  })

  it('refreshTokens renvoie true et hydrate le store en cas de succès', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      user: fakeUser,
      accessToken: 'new-jwt',
    }))

    const { refreshTokens } = useAuth()
    const result = await refreshTokens()

    expect(result).toBe(true)
    expect(useAuthStore().accessToken).toBe('new-jwt')
  })

  it('refreshTokens renvoie false et nettoie le store en cas d\'échec', async () => {
    const store = useAuthStore()
    store.setAuth(fakeUser, 'old-jwt')

    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('401')))

    const { refreshTokens } = useAuth()
    const result = await refreshTokens()

    expect(result).toBe(false)
    expect(store.user).toBeNull()
    expect(store.accessToken).toBeNull()
  })

  it('loginWithOAuth redirige le navigateur vers l\'URL du provider', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=...',
    }))

    // Stub window.location.href pour vérifier la redirection
    const locationStub = { href: '' }
    Object.defineProperty(window, 'location', {
      writable: true,
      value: locationStub,
    })

    const { loginWithOAuth } = useAuth()
    await loginWithOAuth('google')

    expect(locationStub.href).toContain('accounts.google.com')
  })

  it('logout vide le store même si l\'API échoue', async () => {
    const store = useAuthStore()
    store.setAuth(fakeUser, 'jwt')

    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('network')))

    const { logout } = useAuth()
    await logout()

    expect(store.user).toBeNull()
    expect(store.accessToken).toBeNull()
  })

  it('fetchMe stocke le user et le token quand fourni', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(fakeUser))

    const { fetchMe } = useAuth()
    const result = await fetchMe('jwt-from-oauth')

    expect(result).toEqual(fakeUser)
    const store = useAuthStore()
    expect(store.user).toEqual(fakeUser)
    expect(store.accessToken).toBe('jwt-from-oauth')
  })

  it('fetchMe nettoie le store si l\'API renvoie une erreur', async () => {
    const store = useAuthStore()
    store.setAuth(fakeUser, 'old-jwt')

    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('401')))

    const { fetchMe } = useAuth()
    const result = await fetchMe('jwt-from-oauth')

    expect(result).toBeNull()
    expect(store.user).toBeNull()
    expect(store.accessToken).toBeNull()
  })

  it('fetchMe sans token ni store retourne null sans appeler l\'API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)

    const { fetchMe } = useAuth()
    const result = await fetchMe()

    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
