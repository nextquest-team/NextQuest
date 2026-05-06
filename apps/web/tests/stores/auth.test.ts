import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '~/stores/auth'

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initialise un état non authentifié', () => {
    const store = useAuthStore()
    expect(store.user).toBeNull()
    expect(store.accessToken).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })

  it('setAuth stocke le user et le token', () => {
    const store = useAuthStore()
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

    store.setAuth(fakeUser, 'jwt-token-abc')

    expect(store.user).toEqual(fakeUser)
    expect(store.accessToken).toBe('jwt-token-abc')
    expect(store.isAuthenticated).toBe(true)
  })

  it('clearAuth remet le store à zéro', () => {
    const store = useAuthStore()
    store.setAuth(
      {
        id: 'u-1',
        email: 'lo@test.fr',
        username: 'lo',
        displayName: null,
        avatarUrl: null,
        locale: 'fr',
        isPublic: true,
        createdAt: new Date(),
        updatedAt: null,
      },
      'jwt-token-abc',
    )

    store.clearAuth()

    expect(store.user).toBeNull()
    expect(store.accessToken).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })
})
