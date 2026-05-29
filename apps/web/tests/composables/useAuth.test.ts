// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { setActivePinia, createPinia } from 'pinia'
import { useAuth } from '~/composables/useAuth'
import { useAuthStore } from '~/stores/auth'

// Mock du router : on ne veut pas tester la navigation, juste la logique du composable.
// Stub complet car Nuxt utilise afterEach/beforeResolve/etc en interne.
const pushMock = vi.fn().mockResolvedValue(undefined)
const fakeRouter = {
  push: pushMock,
  replace: pushMock,
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  afterEach: () => () => {},
  beforeEach: () => () => {},
  beforeResolve: () => () => {},
  onError: () => () => {},
  isReady: () => Promise.resolve(),
  resolve: (to: any) => ({
    fullPath: typeof to === 'string' ? to : (to.path ?? '/'),
    path: typeof to === 'string' ? to : (to.path ?? '/'),
    query: {},
    hash: '',
    name: undefined,
    params: {},
    matched: [],
    meta: {},
    redirectedFrom: undefined,
    href: typeof to === 'string' ? to : (to.path ?? '/'),
  }),
  currentRoute: { value: { path: '/', fullPath: '/', query: {}, hash: '', name: undefined, params: {}, matched: [], meta: {} } },
  options: { routes: [] },
  hasRoute: () => false,
  getRoutes: () => [],
  addRoute: vi.fn(),
  removeRoute: vi.fn(),
}
mockNuxtImport('useRouter', () => () => fakeRouter)

const fakeUser = {
  id: 'u-1',
  email: 'lo@test.fr',
  username: 'lo',
  displayName: null,
  avatarUrl: null,
  locale: 'fr' as const,
  bio: null,
  visibility: 'public' as const,
  emailVerified: false,
  onboardingCompleted: false,
  createdAt: new Date().toISOString(),
}

describe('useAuth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    pushMock.mockClear()
  })

  it('login stocke user + token et redirige vers /dashboard', async () => {
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
    expect(pushMock).toHaveBeenCalledWith('/dashboard')
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

  it('loginWithOAuth expose un message friendly en cas d\'échec sans throw', async () => {
    const apiError = Object.assign(new Error('Bad Request'), {
      status: 400,
      data: { error: 'Provider google is not configured' },
    })
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(apiError))

    const { loginWithOAuth, error } = useAuth()
    // Ne doit PAS throw (l'appelant @click ne peut pas catch)
    await expect(loginWithOAuth('google')).resolves.toBeUndefined()
    expect(error.value).toBe('Connexion Google indisponible pour le moment')
  })

  it('loginWithOAuth ouvre une popup vers l\'URL du provider', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=...',
    }))

    // Stub de window.open : retourne un faux objet popup non fermé
    const fakePopup = { closed: false, close: vi.fn() } as unknown as Window
    const openMock = vi.fn().mockReturnValue(fakePopup)
    vi.stubGlobal('open', openMock)

    const { loginWithOAuth } = useAuth()
    await loginWithOAuth('google')

    expect(openMock).toHaveBeenCalledWith(
      expect.stringContaining('accounts.google.com'),
      'nq-oauth',
      expect.stringContaining('width=500'),
    )
  })

  it('loginWithOAuth fait un fallback en redirection complète si la popup est bloquée', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=...',
    }))

    // window.open retourne null = popup bloquée
    vi.stubGlobal('open', vi.fn().mockReturnValue(null))

    const locationStub = { href: '', origin: 'http://localhost:3001' }
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
