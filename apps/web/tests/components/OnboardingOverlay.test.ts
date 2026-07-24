// @vitest-environment nuxt
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import OnboardingOverlay from '~/components/dashboard/OnboardingOverlay.vue'

// ──────────────────────────────────────────────────────────
// Mock driver.js — capture la config pour tester les callbacks
// ──────────────────────────────────────────────────────────
let capturedConfig: Record<string, any> | null = null
const driveMock = vi.fn()
const destroyMock = vi.fn()
const driverFactoryMock = vi.fn()

vi.mock('driver.js', () => ({
  driver: (config: any) => {
    capturedConfig = config
    driverFactoryMock(config)
    return { drive: driveMock, destroy: destroyMock }
  },
}))

// Le CSS de driver.js est un side-effect import ; on le neutralise en test
vi.mock('driver.js/dist/driver.css', () => ({}))

// ──────────────────────────────────────────────────────────
// Mock $fetch (import explicite depuis 'ofetch' dans OnboardingOverlay.vue)
// ──────────────────────────────────────────────────────────
const $fetchMock = vi.fn()
vi.mock('ofetch', () => ({
  $fetch: (...args: any[]) => $fetchMock(...args),
}))

// ──────────────────────────────────────────────────────────
// Mocks Nuxt auto-imports
// ──────────────────────────────────────────────────────────
mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
}))

// mockUserRef est un ref Vue réactif : le composant y souscrit via watch(show, ...)
const mockUserRef = ref<any>(null)

mockNuxtImport('useAuth', () => () => ({
  user: mockUserRef,
}))

// Mock du store — évite les problèmes d'instance Pinia entre composant et test.
// Le store est un objet plain dont les propriétés sont lues au moment de l'appel.
const setAuthMock = vi.fn()
const mockStore = {
  user: null as any,
  accessToken: null as string | null,
  setAuth: setAuthMock,
}

mockNuxtImport('useAuthStore', () => () => mockStore)

// ──────────────────────────────────────────────────────────
// Fixture
// ──────────────────────────────────────────────────────────
const fakeUser = {
  id: 'u-1',
  email: 'lo@test.fr',
  username: 'lo',
  displayName: null,
  avatarUrl: null,
  locale: 'fr' as const,
  bio: null,
  country: null,
  birthdate: null,
  favoritePlatform: null,
  socialLinks: null,
  visibility: 'public' as const,
  emailVerified: false,
  onboardingCompleted: false,
  createdAt: new Date().toISOString(),
}

// ──────────────────────────────────────────────────────────
// Suite
// ──────────────────────────────────────────────────────────
let wrapper: ReturnType<typeof mount> | null = null

describe('OnboardingOverlay', () => {
  beforeEach(() => {
    capturedConfig = null
    driveMock.mockReset()
    destroyMock.mockReset()
    driverFactoryMock.mockReset()
    $fetchMock.mockReset().mockResolvedValue({})
    setAuthMock.mockReset()
    // Réinitialiser le store mocké
    mockStore.user = { ...fakeUser }
    mockStore.accessToken = 'jwt'
    // Aucun utilisateur par défaut pour le ref (évite les réactions croisées)
    mockUserRef.value = null
  })

  afterEach(() => {
    // Indispensable : le watch({ immediate: true }) du composant précédent
    // réagirait sinon sur mockUserRef et déclencherait startTour dans les tests suivants
    wrapper?.unmount()
    wrapper = null
  })

  it('ne démarre pas le tour si onboardingCompleted est true', async () => {
    mockUserRef.value = { ...fakeUser, onboardingCompleted: true }
    wrapper = mount(OnboardingOverlay)
    await flushPromises()

    expect(driverFactoryMock).not.toHaveBeenCalled()
    expect(driveMock).not.toHaveBeenCalled()
  })

  it('démarre le tour si onboardingCompleted est false', async () => {
    mockUserRef.value = { ...fakeUser, onboardingCompleted: false }
    wrapper = mount(OnboardingOverlay)
    await flushPromises()

    expect(driverFactoryMock).toHaveBeenCalledOnce()
    expect(driveMock).toHaveBeenCalledOnce()
  })

  it('ne démarre pas le tour si user est null', async () => {
    mockUserRef.value = null
    wrapper = mount(OnboardingOverlay)
    await flushPromises()

    expect(driverFactoryMock).not.toHaveBeenCalled()
  })

  it('configure exactement 5 étapes dans le tour', async () => {
    mockUserRef.value = { ...fakeUser }
    wrapper = mount(OnboardingOverlay)
    await flushPromises()

    expect(capturedConfig?.steps).toHaveLength(5)
  })

  it('les 5 étapes ciblent les bons data-onb-target', async () => {
    mockUserRef.value = { ...fakeUser }
    wrapper = mount(OnboardingOverlay)
    await flushPromises()

    const elements = capturedConfig?.steps.map((s: any) => s.element)
    expect(elements).toEqual([
      '[data-onb-target="wheel"]',
      '[data-onb-target="bag"]',
      '[data-onb-target="profile"]',
      '[data-onb-target="parchemin"]',
      '[data-onb-target="timeline"]',
    ])
  })

  // ── onDestroyStarted : confirme la fermeture du tour ──
  it('onDestroyStarted appelle destroy() pour fermer vraiment le tour (Done/X/Échap)', async () => {
    // driver.js appelle onDestroyStarted mais n'effectue PAS la destruction si
    // destroy() n'est pas rappelé à l'intérieur — le tour resterait affiché.
    mockUserRef.value = { ...fakeUser }
    wrapper = mount(OnboardingOverlay)
    await flushPromises()

    capturedConfig?.onDestroyStarted()

    expect(destroyMock).toHaveBeenCalledOnce()
  })

  it('onDestroyStarted n\'appelle pas complete() directement', async () => {
    mockUserRef.value = { ...fakeUser }
    wrapper = mount(OnboardingOverlay)
    await flushPromises()

    capturedConfig?.onDestroyStarted()
    await flushPromises()

    expect($fetchMock).not.toHaveBeenCalled()
  })

  // ── onDestroyed : marque l'onboarding après fermeture effective ──
  it('onDestroyed appelle POST /api/users/me/onboarding/complete', async () => {
    mockUserRef.value = { ...fakeUser }
    wrapper = mount(OnboardingOverlay)
    await flushPromises()

    await capturedConfig?.onDestroyed()
    await flushPromises()

    expect($fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/users/me/onboarding/complete',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
  })

  it('onDestroyed appelle setAuth avec onboardingCompleted = true', async () => {
    mockUserRef.value = { ...fakeUser }
    wrapper = mount(OnboardingOverlay)
    await flushPromises()

    await capturedConfig?.onDestroyed()
    await flushPromises()

    expect(setAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({ onboardingCompleted: true }),
      'jwt',
    )
  })

  it('ne met pas à jour le store si l\'appel API échoue', async () => {
    $fetchMock.mockRejectedValue(new Error('network'))
    mockUserRef.value = { ...fakeUser }
    wrapper = mount(OnboardingOverlay)
    await flushPromises()

    await capturedConfig?.onDestroyed()
    await flushPromises()

    expect(setAuthMock).not.toHaveBeenCalled()
  })

  it('envoie le token d\'autorisation dans le header', async () => {
    mockStore.accessToken = 'secret-jwt'
    mockUserRef.value = { ...fakeUser }
    wrapper = mount(OnboardingOverlay)
    await flushPromises()

    await capturedConfig?.onDestroyed()
    await flushPromises()

    expect($fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer secret-jwt' }),
      }),
    )
  })

  // ── Skip : ferme le tour et marque l'onboarding via onDestroyed ──
  it('Skip appelle destroy() et ne déclenche pas complete() directement', async () => {
    mockUserRef.value = { ...fakeUser }
    wrapper = mount(OnboardingOverlay)
    await flushPromises()

    const fakeFooter = { appendChild: vi.fn() }
    capturedConfig?.onPopoverRender({ footer: fakeFooter })
    const skipBtn = fakeFooter.appendChild.mock.calls[0][0] as HTMLButtonElement

    skipBtn.onclick?.(new PointerEvent('click'))
    await flushPromises()

    // Skip appelle destroy() (qui déclenchera onDestroyed en vrai)
    expect(destroyMock).toHaveBeenCalledOnce()
    // Pas de POST direct — complete() passe exclusivement par onDestroyed
    expect($fetchMock).not.toHaveBeenCalled()
  })

  it('la garde tourStarted empêche un double démarrage du tour', async () => {
    mockUserRef.value = { ...fakeUser, onboardingCompleted: false }
    wrapper = mount(OnboardingOverlay)
    await flushPromises()
    expect(driverFactoryMock).toHaveBeenCalledOnce()

    // Simule show : true → false → true (ex. store mis à jour puis réinitialisé)
    mockUserRef.value = { ...fakeUser, onboardingCompleted: true }
    await flushPromises()
    mockUserRef.value = { ...fakeUser, onboardingCompleted: false }
    await flushPromises()

    // La garde bloque le second démarrage
    expect(driverFactoryMock).toHaveBeenCalledOnce()
  })
})
