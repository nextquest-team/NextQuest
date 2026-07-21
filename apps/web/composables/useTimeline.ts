import type { TimelineGameDTO } from '~/types/timeline'

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

  // ── Filtrage client (recherche + genres) : l'API upcoming ne les supporte pas ──
  function filterGames(list: TimelineGameDTO[]) {
    let result = list
    const q = searchQuery.value.trim().toLowerCase()
    if (q) result = result.filter(g => g.title.toLowerCase().includes(q))
    if (selectedGenres.value.length) {
      result = result.filter(g => g.genres.some(genre => selectedGenres.value.includes(genre.slug)))
    }
    return result
  }

  const filteredUpcoming = computed(() => filterGames(upcomingGames.value))
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
    // Listes filtrees
    filteredUpcoming, filteredFollowed,
    // Suivi (stub local)
    isFollowed: followedStore.isFollowed,
    toggleFollow: followedStore.toggleFollow,
  }
}
