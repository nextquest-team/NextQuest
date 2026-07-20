// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useExclusions, __resetExclusions } from '~/composables/useExclusions'

const authFetchMock = vi.fn()
mockNuxtImport('useAuthFetch', () => () => ({
  authFetch: authFetchMock,
  apiBase: 'http://localhost:3000',
}))

describe('useExclusions', () => {
  beforeEach(() => {
    __resetExclusions()
    authFetchMock.mockReset()
  })

  it('charge les jeux exclus et expose le compteur', async () => {
    authFetchMock.mockResolvedValue({
      items: [
        { gameId: 'g1', title: 'Celeste', coverUrl: null, releaseDate: null, isEnriched: true, excludedAt: '2026-07-20' },
        { gameId: 'g2', title: 'Hades', coverUrl: null, releaseDate: null, isEnriched: true, excludedAt: '2026-07-19' },
      ],
    })
    const { exclusions, count, fetchExclusions } = useExclusions()
    await fetchExclusions()
    expect(authFetchMock).toHaveBeenCalledWith('http://localhost:3000/api/collection/exclusions')
    expect(count.value).toBe(2)
    expect(exclusions.value[0].title).toBe('Celeste')
  })

  it('restore retire le jeu de la liste et POST sans body', async () => {
    authFetchMock.mockResolvedValue({
      items: [{ gameId: 'g1', title: 'Celeste', coverUrl: null, releaseDate: null, isEnriched: true, excludedAt: '2026-07-20' }],
    })
    const { count, fetchExclusions, restore } = useExclusions()
    await fetchExclusions()
    expect(count.value).toBe(1)

    authFetchMock.mockResolvedValue({})
    const ok = await restore('g1')
    expect(ok).toBe(true)
    expect(authFetchMock).toHaveBeenLastCalledWith(
      'http://localhost:3000/api/collection/exclusions/g1/restore',
      { method: 'POST' },
    )
    expect(count.value).toBe(0)
  })
})
