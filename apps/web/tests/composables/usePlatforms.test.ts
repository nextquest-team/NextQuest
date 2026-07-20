// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { usePlatforms, __resetPlatformsCache } from '~/composables/usePlatforms'

const authFetchMock = vi.fn()
mockNuxtImport('useAuthFetch', () => () => ({
  authFetch: authFetchMock,
  apiBase: 'http://localhost:3000',
}))

describe('usePlatforms', () => {
  beforeEach(() => {
    __resetPlatformsCache()
    authFetchMock.mockReset()
    authFetchMock.mockResolvedValue({
      items: [
        { id: 'p1', name: 'PC', code: 'pc', iconUrl: null },
        { id: 'p2', name: 'PS5', code: 'ps5', iconUrl: 'https://x/ps5.png' },
      ],
    })
  })

  it('charge les plateformes via GET /api/platforms', async () => {
    const { platforms, fetchPlatforms } = usePlatforms()
    await fetchPlatforms()
    expect(authFetchMock).toHaveBeenCalledWith('http://localhost:3000/api/platforms')
    expect(platforms.value).toHaveLength(2)
    expect(platforms.value[0].code).toBe('pc')
  })

  it('ne re-fetch pas si deja charge (cache module partage)', async () => {
    const { fetchPlatforms } = usePlatforms()
    await fetchPlatforms()
    await fetchPlatforms()
    expect(authFetchMock).toHaveBeenCalledTimes(1)
  })
})
