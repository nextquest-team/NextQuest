// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useTimeline } from '~/composables/useTimeline'

const authFetchMock = vi.fn()
mockNuxtImport('useAuthFetch', () => () => ({
  authFetch: authFetchMock,
  apiBase: 'http://localhost:3000',
}))

function upcomingGame(igdbId: number, overrides: Record<string, unknown> = {}) {
  return {
    igdbId,
    title: `Game ${igdbId}`,
    releaseDate: null,
    coverUrl: null,
    hypes: null,
    genres: [],
    platforms: [],
    ...overrides,
  }
}

describe('useTimeline — recherche live "Propheties a venir"', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    authFetchMock.mockReset()
    authFetchMock.mockResolvedValue({ items: [] })
  })
  afterEach(() => vi.useRealTimers())

  it('ne declenche pas de recherche en dessous de 2 caracteres', async () => {
    const { searchQuery, searchActive } = useTimeline()
    searchQuery.value = 'a'
    await vi.advanceTimersByTimeAsync(300)
    expect(searchActive.value).toBe(false)
    expect(authFetchMock).not.toHaveBeenCalled()
  })

  it('debounce : une seule requete apres 300ms de silence', async () => {
    const { searchQuery } = useTimeline()
    searchQuery.value = 'ze'
    await vi.advanceTimersByTimeAsync(100)
    searchQuery.value = 'zel'
    await vi.advanceTimersByTimeAsync(100)
    searchQuery.value = 'zeld'
    await vi.advanceTimersByTimeAsync(300)

    expect(authFetchMock).toHaveBeenCalledTimes(1)
    expect(authFetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/games/igdb/search',
      expect.objectContaining({ query: { q: 'zeld', scope: 'upcoming' } }),
    )
  })

  it("n'efface pas les resultats quand une requete abortee resout apres la suivante (race corrigee)", async () => {
    // Reproduit le bug remonte en review : la requete pour "ze" est encore en
    // vol (abortee par la frappe suivante) quand celle pour "zeld" resout.
    // Avant le fix, le catch de la requete abortee (sans AbortError detectable
    // via ofetch) effacait les resultats fraichement arrives.
    let resolveFirst!: (v: unknown) => void
    const firstCall = new Promise((resolve) => { resolveFirst = resolve })
    authFetchMock
      .mockImplementationOnce(() => firstCall)
      .mockResolvedValueOnce({ items: [upcomingGame(1, { title: 'Zelda' })] })

    const { searchQuery, filteredUpcoming } = useTimeline()
    searchQuery.value = 'ze'
    await vi.advanceTimersByTimeAsync(300)

    searchQuery.value = 'zeld'
    await vi.advanceTimersByTimeAsync(300)
    await Promise.resolve() // laisse la 2e requete (deja mockee resolue) se propager

    expect(filteredUpcoming.value.map(g => g.igdbId)).toEqual([1])

    // La 1re requete (perimee) resout enfin : son resultat ne doit pas ecraser
    // les resultats de la recherche la plus recente.
    resolveFirst({ items: [upcomingGame(99, { title: 'Ze stale result' })] })
    await Promise.resolve()
    await Promise.resolve()

    expect(filteredUpcoming.value.map(g => g.igdbId)).toEqual([1])
  })

  it('searchLoading repasse a false apres la resolution', async () => {
    const { searchQuery, searchLoading } = useTimeline()
    searchQuery.value = 'zelda'
    await vi.advanceTimersByTimeAsync(300)
    expect(searchLoading.value).toBe(false)
  })

  it('searchError passe a true sur un echec reseau et le message ne cache pas juste "aucun resultat"', async () => {
    authFetchMock.mockRejectedValue(new Error('network down'))
    const { searchQuery, searchError, filteredUpcoming, searchLoading } = useTimeline()
    searchQuery.value = 'zelda'
    await vi.advanceTimersByTimeAsync(300)

    expect(searchError.value).toBe(true)
    expect(filteredUpcoming.value).toEqual([])
    expect(searchLoading.value).toBe(false)
  })

  it('searchError se reinitialise sur une recherche suivante reussie', async () => {
    authFetchMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ items: [upcomingGame(1)] })

    const { searchQuery, searchError } = useTimeline()
    searchQuery.value = 'zelda'
    await vi.advanceTimersByTimeAsync(300)
    expect(searchError.value).toBe(true)

    searchQuery.value = 'zelda2'
    await vi.advanceTimersByTimeAsync(300)
    expect(searchError.value).toBe(false)
  })

  it('repasser sous 2 caracteres vide les resultats et reinitialise erreur/loading', async () => {
    authFetchMock.mockResolvedValue({ items: [upcomingGame(1)] })
    const { searchQuery, filteredUpcoming, searchActive } = useTimeline()
    searchQuery.value = 'zelda'
    await vi.advanceTimersByTimeAsync(300)
    expect(filteredUpcoming.value).toHaveLength(1)

    searchQuery.value = 'z'
    await vi.advanceTimersByTimeAsync(300)
    expect(searchActive.value).toBe(false)
    expect(filteredUpcoming.value).toEqual([])
  })
})

describe('useTimeline — filtres genres (onglet suivi)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    authFetchMock.mockReset()
    authFetchMock.mockResolvedValue({ items: [], limit: 20, offset: 0 })
  })
  afterEach(() => vi.useRealTimers())

  it('toggleGenre ajoute puis retire un genre des filtres actifs', () => {
    const { selectedGenres, toggleGenre, activeFilterCount } = useTimeline()
    toggleGenre('rpg')
    expect(selectedGenres.value).toContain('rpg')
    expect(activeFilterCount.value).toBe(1)

    toggleGenre('rpg')
    expect(selectedGenres.value).not.toContain('rpg')
    expect(activeFilterCount.value).toBe(0)
  })

  it('resetFilters vide les genres selectionnes et ferme le drawer', () => {
    const { selectedGenres, toggleGenre, resetFilters, drawerOpen } = useTimeline()
    toggleGenre('rpg')
    drawerOpen.value = true
    resetFilters()
    expect(selectedGenres.value).toHaveLength(0)
    expect(drawerOpen.value).toBe(false)
  })
})
