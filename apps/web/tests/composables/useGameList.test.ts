// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useGameList } from '~/composables/useGameList'

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key.split('.').pop() ?? key,
}))

mockNuxtImport('useRoute', () => () => ({
  params: {},
  query: {},
}))

const authFetchMock = vi.fn()
mockNuxtImport('useAuthFetch', () => () => ({
  authFetch: authFetchMock,
  apiBase: 'http://localhost:3000',
}))

mockNuxtImport('navigateTo', () => vi.fn())

describe('useGameList', () => {
  beforeEach(() => {
    authFetchMock.mockReset()
    authFetchMock.mockResolvedValue({ items: [], total: 0 })
  })

  describe('STATUS_OPTIONS', () => {
    it('contient 4 options de statut', () => {
      const { STATUS_OPTIONS } = useGameList()
      expect(STATUS_OPTIONS).toHaveLength(4)
    })

    it('les clés sont playing, backlog, completed, abandoned', () => {
      const { STATUS_OPTIONS } = useGameList()
      const keys = STATUS_OPTIONS.map(o => o.key)
      expect(keys).toContain('playing')
      expect(keys).toContain('backlog')
      expect(keys).toContain('completed')
      expect(keys).toContain('abandoned')
    })
  })

  describe('toggleStatus', () => {
    it('ajoute un statut absent', () => {
      const { selectedStatuses, toggleStatus } = useGameList()
      expect(selectedStatuses.value).toHaveLength(0)
      toggleStatus('playing')
      expect(selectedStatuses.value).toContain('playing')
    })

    it('supprime un statut déjà sélectionné', () => {
      const { selectedStatuses, toggleStatus } = useGameList()
      toggleStatus('playing')
      toggleStatus('playing')
      expect(selectedStatuses.value).not.toContain('playing')
    })

    it('permet de sélectionner plusieurs statuts', () => {
      const { selectedStatuses, toggleStatus } = useGameList()
      toggleStatus('playing')
      toggleStatus('backlog')
      expect(selectedStatuses.value).toHaveLength(2)
    })
  })

  describe('activeFilterCount', () => {
    it('vaut 0 quand aucun filtre', () => {
      const { activeFilterCount } = useGameList()
      expect(activeFilterCount.value).toBe(0)
    })

    it('reflète le nombre de statuts sélectionnés', () => {
      const { activeFilterCount, toggleStatus } = useGameList()
      toggleStatus('playing')
      toggleStatus('completed')
      expect(activeFilterCount.value).toBe(2)
    })
  })

  describe('resetFilters', () => {
    it('vide selectedStatuses et remet currentPage à 1', async () => {
      const { selectedStatuses, currentPage, toggleStatus, goToPage, resetFilters } = useGameList()
      toggleStatus('playing')
      goToPage(3)
      await resetFilters()
      expect(selectedStatuses.value).toHaveLength(0)
      expect(currentPage.value).toBe(1)
    })
  })

  describe('goToPage', () => {
    it('met à jour currentPage', async () => {
      const { currentPage, goToPage } = useGameList()
      await goToPage(4)
      expect(currentPage.value).toBe(4)
    })
  })

  describe('onDeleteGame', () => {
    it('supprime le jeu de la liste de façon optimiste', async () => {
      authFetchMock.mockResolvedValue({})
      const { games, total, onDeleteGame } = useGameList()
      games.value = [
        { id: 'ug-1', title: 'Jeu A', status: 'backlog' },
        { id: 'ug-2', title: 'Jeu B', status: 'playing' },
      ] as any[]
      total.value = 2

      await onDeleteGame('ug-1')
      expect(games.value.find(g => g.id === 'ug-1')).toBeUndefined()
      expect(total.value).toBe(1)
    })

    it('décremente le total au minimum à 0', async () => {
      authFetchMock.mockResolvedValue({})
      const { games, total, onDeleteGame } = useGameList()
      games.value = [{ id: 'ug-1', title: 'Jeu A', status: 'backlog' }] as any[]
      total.value = 1

      await onDeleteGame('ug-1')
      expect(total.value).toBe(0)
    })
  })

  describe('totalPages', () => {
    it('calcule le nombre de pages correct (ceil total/20)', () => {
      const { total, totalPages } = useGameList()
      total.value = 45
      expect(totalPages.value).toBe(3)
    })

    it('vaut 0 si total est 0', () => {
      const { total, totalPages } = useGameList()
      total.value = 0
      expect(totalPages.value).toBe(0)
    })
  })
})
