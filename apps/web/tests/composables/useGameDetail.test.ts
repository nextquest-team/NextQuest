// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { GAME_STATUSES, useGameDetail } from '~/composables/useGameDetail'

mockNuxtImport('useI18n', () => () => ({
  t: (key: string, params?: Record<string, unknown>) => {
    if (key === 'gameDetail.playtimeValue' && params) {
      return `${params.h}h ${params.m}min`
    }
    return key
  },
}))

mockNuxtImport('useRoute', () => () => ({
  params: { gameId: 'game-test-1' },
}))

const authFetchMock = vi.fn()
mockNuxtImport('useAuthFetch', () => () => ({
  authFetch: authFetchMock,
  apiBase: 'http://localhost:3000',
}))

mockNuxtImport('navigateTo', () => vi.fn())

describe('GAME_STATUSES', () => {
  it('contient 4 statuts', () => {
    expect(GAME_STATUSES).toHaveLength(4)
  })

  it('contient les statuts attendus dans le bon ordre', () => {
    const keys = GAME_STATUSES.map(s => s.key)
    expect(keys).toEqual(['backlog', 'playing', 'completed', 'abandoned'])
  })

  it('chaque statut a une icône mdi', () => {
    GAME_STATUSES.forEach(s => {
      expect(s.icon).toMatch(/^mdi-/)
    })
  })
})

describe('useGameDetail', () => {
  beforeEach(() => {
    authFetchMock.mockReset()
  })

  describe('formatPlaytime', () => {
    it('retourne null si minutes est null', () => {
      const { formatPlaytime } = useGameDetail()
      expect(formatPlaytime(null)).toBeNull()
    })

    it('retourne null si minutes est 0', () => {
      const { formatPlaytime } = useGameDetail()
      expect(formatPlaytime(0)).toBeNull()
    })

    it('retourne null si minutes est undefined', () => {
      const { formatPlaytime } = useGameDetail()
      expect(formatPlaytime(undefined)).toBeNull()
    })

    it('formate 90 minutes en 1h 30min', () => {
      const { formatPlaytime } = useGameDetail()
      expect(formatPlaytime(90)).toBe('1h 30min')
    })

    it('formate 60 minutes en 1h 00min', () => {
      const { formatPlaytime } = useGameDetail()
      expect(formatPlaytime(60)).toBe('1h 00min')
    })

    it('formate 150 minutes en 2h 30min', () => {
      const { formatPlaytime } = useGameDetail()
      expect(formatPlaytime(150)).toBe('2h 30min')
    })
  })

  describe('formatReleaseDate', () => {
    it('retourne null si raw est null', () => {
      const { formatReleaseDate } = useGameDetail()
      expect(formatReleaseDate(null)).toBeNull()
    })

    it('retourne une chaîne non vide pour une date ISO valide', () => {
      const { formatReleaseDate } = useGameDetail()
      const result = formatReleaseDate('2020-01-15T00:00:00.000Z')
      expect(typeof result).toBe('string')
      expect(result!.length).toBeGreaterThan(0)
    })
  })

  describe('onStatusChange', () => {
    it('met à jour le statut de façon optimiste', async () => {
      authFetchMock.mockResolvedValue({})
      const { game, onStatusChange } = useGameDetail()
      game.value = {
        userGameId: 'ug-1',
        status: 'backlog',
        game: { title: 'Test' },
      } as any
      await onStatusChange('playing')
      expect(game.value!.status).toBe('playing')
    })

    it('revient au statut précédent si PATCH échoue', async () => {
      authFetchMock.mockRejectedValue(new Error('fail'))
      const { game, onStatusChange } = useGameDetail()
      game.value = { userGameId: 'ug-1', status: 'backlog', game: { title: 'Test' } } as any
      await onStatusChange('playing')
      expect(game.value!.status).toBe('backlog')
    })

    it('ne fait rien si game est null', async () => {
      const { game, onStatusChange } = useGameDetail()
      game.value = null
      await expect(onStatusChange('playing')).resolves.toBeUndefined()
      expect(authFetchMock).not.toHaveBeenCalled()
    })
  })
})
