// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '~/stores/auth'
import authMiddleware from '~/middleware/auth.global'
import guestMiddleware from '~/middleware/guest'

// mockNuxtImport remplace navigateTo dans tout le module (compile-time transform).
// On retourne directement le chemin pour pouvoir l'asserter.
mockNuxtImport('navigateTo', () => (path: string) => path)

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

describe('middleware/auth.global', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('laisse passer les routes publiques sans authentification', () => {
    for (const path of ['/', '/auth/login', '/auth/register', '/auth/forgot-password', '/auth/callback']) {
      const result = (authMiddleware as any)({ path }, {})
      expect(result).toBeUndefined()
    }
  })

  it('redirige vers /auth/login si route privée et non authentifié', () => {
    const result = (authMiddleware as any)({ path: '/dashboard' }, {})
    expect(result).toBe('/auth/login')
  })

  it('laisse passer une route privée si authentifié', () => {
    const store = useAuthStore()
    store.setAuth(fakeUser, 'jwt')

    const result = (authMiddleware as any)({ path: '/dashboard' }, {})
    expect(result).toBeUndefined()
  })
})

describe('middleware/guest', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('redirige vers /dashboard si déjà authentifié', () => {
    const store = useAuthStore()
    store.setAuth(fakeUser, 'jwt')

    const result = (guestMiddleware as any)({}, {})
    expect(result).toBe('/dashboard')
  })

  it('laisse passer si non authentifié', () => {
    const result = (guestMiddleware as any)({}, {})
    expect(result).toBeUndefined()
  })
})
