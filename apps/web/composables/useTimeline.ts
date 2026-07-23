import type { TimelineGameDTO } from '~/types/timeline'
import type { IgdbSearchResult } from '~/types/game'

export type TimelineSort = 'hype' | 'date'

export function useTimeline() {
  const { authFetch, apiBase } = useAuthFetch()
  const followedStore = useFollowedGamesStore()

  // ── Filtres partages entre les deux onglets ──────────────
  const drawerOpen = ref(false)
  const searchQuery = ref('')
  const selectedGenres = ref<string[]>([])
  const sort = ref<TimelineSort>('hype')

  const activeFilterCount = computed(() => selectedGenres.value.length)

  function toggleGenre(slug: string) {
    const idx = selectedGenres.value.indexOf(slug)
    if (idx >= 0) selectedGenres.value.splice(idx, 1)
    else selectedGenres.value.push(slug)
  }

  function resetFilters() {
    selectedGenres.value = []
    drawerOpen.value = false
  }

  function applyFilters() {
    drawerOpen.value = false
  }

  // ── Onglet "Propheties a venir" : feed IGDB pagine ───────
  const LIMIT = 20
  const upcomingLoading = ref(false)
  const upcomingError = ref(false)
  const upcomingGames = ref<TimelineGameDTO[]>([])
  const offset = ref(0)
  const hasMore = ref(true)

  async function fetchUpcoming(reset = true) {
    if (reset) {
      offset.value = 0
      hasMore.value = true
      upcomingGames.value = []
    }
    upcomingLoading.value = true
    upcomingError.value = false
    try {
      const res = await authFetch<{ items: TimelineGameDTO[]; limit: number; offset: number }>(
        `${apiBase}/api/games/upcoming`,
        { query: { limit: LIMIT, offset: offset.value, sort: sort.value } },
      )
      upcomingGames.value = reset ? res.items : [...upcomingGames.value, ...res.items]
      hasMore.value = res.items.length === LIMIT
      offset.value += res.items.length
    } catch {
      upcomingError.value = true
    } finally {
      upcomingLoading.value = false
    }
  }

  function loadMoreUpcoming() {
    if (!hasMore.value || upcomingLoading.value) return
    fetchUpcoming(false)
  }

  function setSort(s: TimelineSort) {
    if (sort.value === s) return
    sort.value = s
    fetchUpcoming(true)
  }

  // ── Recherche "Propheties a venir" : appelle GET /api/games/igdb/search
  // (scope=upcoming) a chaque frappe plutot que de filtrer les 20 jeux
  // precharges, pour chercher dans tout le catalogue IGDB a venir. Debounce +
  // annulation + garde de sequence, meme pattern que GameListAddModal.
  const SEARCH_MIN_QUERY = 2
  const SEARCH_DEBOUNCE_MS = 300
  const searchActive = computed(() => searchQuery.value.trim().length >= SEARCH_MIN_QUERY)
  const searchLoading = ref(false)
  const searchResults = ref<TimelineGameDTO[]>([])

  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
  let searchInFlight: AbortController | null = null
  let searchSeq = 0

  function toTimelineGame(r: IgdbSearchResult): TimelineGameDTO {
    return {
      igdbId: r.igdbId,
      title: r.name,
      releaseDate: null,
      releaseYear: r.releaseYear,
      coverUrl: r.coverUrl,
      hypes: null,
      genres: [],
      platforms: [],
    }
  }

  async function runUpcomingSearch(query: string) {
    const seq = ++searchSeq
    const controller = new AbortController()
    searchInFlight = controller
    try {
      const res = await authFetch<{ items: IgdbSearchResult[] }>(
        `${apiBase}/api/games/igdb/search`,
        { query: { q: query, scope: 'upcoming' }, signal: controller.signal },
      )
      if (seq !== searchSeq) return // une recherche plus recente a pris le relais
      searchResults.value = res.items.map(toTimelineGame)
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return
      if (seq !== searchSeq) return
      searchResults.value = []
    } finally {
      if (seq === searchSeq) searchLoading.value = false
      if (searchInFlight === controller) searchInFlight = null
    }
  }

  watch(searchQuery, (q) => {
    const query = q.trim()
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    if (searchInFlight) {
      searchInFlight.abort()
      searchInFlight = null
    }
    if (query.length < SEARCH_MIN_QUERY) {
      searchResults.value = []
      searchLoading.value = false
      return
    }
    searchLoading.value = true
    searchDebounceTimer = setTimeout(() => runUpcomingSearch(query), SEARCH_DEBOUNCE_MS)
  })

  // ── Filtrage client (genres, + recherche texte pour l'onglet suivi) ──
  function filterGames(list: TimelineGameDTO[], applyTextSearch = true) {
    let result = list
    if (applyTextSearch) {
      const q = searchQuery.value.trim().toLowerCase()
      if (q) result = result.filter(g => g.title.toLowerCase().includes(q))
    }
    if (selectedGenres.value.length) {
      result = result.filter(g => g.genres.some(genre => selectedGenres.value.includes(genre.slug)))
    }
    return result
  }

  // Recherche active -> resultats de l'API (deja filtres par texte cote back,
  // sans genres disponibles). Sinon -> feed precharge, filtre cote client.
  const filteredUpcoming = computed(() =>
    searchActive.value ? searchResults.value : filterGames(upcomingGames.value),
  )
  // Onglet "suivi" : toujours le filtrage client sur les jeux etoiles (liste deja en memoire).
  const filteredFollowed = computed(() => filterGames(followedStore.followedList))

  const availableGenres = computed(() => {
    const map = new Map<string, string>()
    for (const g of upcomingGames.value) {
      for (const genre of g.genres) map.set(genre.slug, genre.name)
    }
    return [...map.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  return {
    // Filtres
    drawerOpen, searchQuery, selectedGenres, availableGenres, activeFilterCount,
    toggleGenre, resetFilters, applyFilters,
    // Tri
    sort, setSort,
    // Onglet upcoming
    upcomingLoading, upcomingError, hasMore, fetchUpcoming, loadMoreUpcoming,
    // Recherche live (onglet upcoming uniquement)
    searchActive, searchLoading,
    // Listes filtrees
    filteredUpcoming, filteredFollowed,
    // Suivi (stub local)
    isFollowed: followedStore.isFollowed,
    toggleFollow: followedStore.toggleFollow,
  }
}
