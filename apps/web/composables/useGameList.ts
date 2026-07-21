import type { UserGame, GameStatus, CollectionListResponse } from '~/types/game'
import { toUserGame } from '~/types/game'

export type CollectionView = 'library' | 'ignored'

export function useGameList() {
  const { t } = useI18n()
  const { authFetch, apiBase } = useAuthFetch()
  const route = useRoute()

  // Modale de progression d'import (jaquettes live). Le re-fetch final de la
  // collection est declenche a la fin de l'enrichissement, via onDone.
  const progress = useImportProgress()
  progress.onDone(() => {
    void fetchGames()
  })

  // ── Steam ────────────────────────────────────────────────
  const steamConnected = ref(false)
  const steamPersona = ref<string | null>(null)
  const steamLoading = ref(false)
  const importLoading = ref(false)
  const importMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

  async function fetchSteamStatus() {
    try {
      const res = await authFetch<{ connected: boolean; personaName: string | null }>(
        `${apiBase}/api/platforms/steam`,
      )
      steamConnected.value = res.connected
      steamPersona.value = res.personaName
    } catch (e) {
      console.error('[useGameList] fetchSteamStatus', e)
    }
  }

  async function linkSteam() {
    steamLoading.value = true
    try {
      const res = await authFetch<{ url: string }>(`${apiBase}/api/platforms/steam/link`)
      window.location.href = res.url
    } catch (e) {
      console.error('[useGameList] linkSteam', e)
      importMessage.value = { type: 'error', text: t('gameList.steamLinkError') }
      steamLoading.value = false
    }
  }

  async function importSteam() {
    importLoading.value = true
    importMessage.value = null
    try {
      const res = await authFetch<{ imported: number; warning?: string }>(
        `${apiBase}/api/platforms/steam/import`,
        { method: 'POST' },
      )
      importMessage.value = {
        type: 'success',
        text: res.warning ?? `${res.imported} ${t('gameList.importSuccess')}`,
      }
      // Ouvre la modale de progression : elle poll l'enrichissement IGDB et
      // re-fetch la collection a la fin (via progress.onDone).
      progress.start()
    } catch {
      importMessage.value = { type: 'error', text: t('gameList.importError') }
    } finally {
      importLoading.value = false
    }
  }

  // ── Vue : bibliotheque (defaut) ou jeux ignores ──────────
  const view = ref<CollectionView>('library')
  function setView(v: CollectionView) {
    if (view.value === v) return
    view.value = v
    currentPage.value = 1
    fetchGames()
  }

  // ── Filtres, recherche, drawer ───────────────────────────
  const LIMIT = 20
  const drawerOpen = ref(false)
  const searchQuery = ref('')
  const selectedStatuses = ref<GameStatus[]>([])

  const STATUS_OPTIONS: { key: GameStatus; icon: string }[] = [
    { key: 'playing',   icon: 'mdi-play-circle-outline' },
    { key: 'backlog',   icon: 'mdi-bookmark-outline' },
    { key: 'completed', icon: 'mdi-check-circle-outline' },
    { key: 'abandoned', icon: 'mdi-close-circle-outline' },
  ]

  const activeFilterCount = computed(() => selectedStatuses.value.length)

  function toggleStatus(status: GameStatus) {
    const idx = selectedStatuses.value.indexOf(status)
    if (idx >= 0) selectedStatuses.value.splice(idx, 1)
    else selectedStatuses.value.push(status)
  }

  function applyFilters() {
    currentPage.value = 1
    drawerOpen.value = false
    fetchGames()
  }

  function resetFilters() {
    selectedStatuses.value = []
    currentPage.value = 1
    fetchGames()
    drawerOpen.value = false
  }

  let searchTimer: ReturnType<typeof setTimeout> | null = null
  watch(searchQuery, () => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      currentPage.value = 1
      fetchGames()
    }, 350)
  })

  // ── Pagination ───────────────────────────────────────────
  const currentPage = ref(1)
  const total = ref(0)
  const totalPages = computed(() => Math.ceil(total.value / LIMIT))

  function goToPage(page: number) {
    currentPage.value = page
    fetchGames()
  }

  // ── Liste des jeux ───────────────────────────────────────
  const gamesLoading = ref(false)
  const gamesError = ref(false)
  const games = ref<UserGame[]>([])

  async function fetchGames() {
    gamesLoading.value = true
    gamesError.value = false
    try {
      const query: Record<string, string | number> = {
        view: view.value,
        limit: LIMIT,
        offset: (currentPage.value - 1) * LIMIT,
      }
      if (searchQuery.value.trim()) query.search = searchQuery.value.trim()
      if (selectedStatuses.value.length === 1) query.status = selectedStatuses.value[0]

      const res = await authFetch<CollectionListResponse>(`${apiBase}/api/collection`, { query })
      games.value = res.items.map(toUserGame)
      total.value = res.total
    } catch (e) {
      console.error('[useGameList] fetchGames', e)
      gamesError.value = true
    } finally { gamesLoading.value = false }
  }

  // ── Actions sur les jeux ─────────────────────────────────
  async function onStatusChange(userGameId: string, status: GameStatus) {
    const game = games.value.find(g => g.id === userGameId)
    if (!game) return
    const previous = game.status
    game.status = status
    try {
      await authFetch(`${apiBase}/api/collection/${userGameId}/status`, {
        method: 'PATCH',
        body: { status },
      })
      if (selectedStatuses.value.length === 1 && !selectedStatuses.value.includes(status)) {
        await fetchGames()
      }
    } catch {
      game.status = previous
    }
  }

  // Retire de la liste courante (optimiste) et POST l'action. En cas d'echec, on
  // re-fetch pour resynchroniser.
  function removeFromList(userGameId: string) {
    games.value = games.value.filter(g => g.id !== userGameId)
    total.value = Math.max(0, total.value - 1)
    if (games.value.length === 0 && currentPage.value > 1) currentPage.value--
  }

  // Ignorer un jeu (vue bibliotheque) : il quitte la biblio mais garde son statut.
  async function onIgnoreGame(userGameId: string) {
    removeFromList(userGameId)
    try {
      await authFetch(`${apiBase}/api/collection/${userGameId}/ignore`, { method: 'POST' })
    } catch {
      await fetchGames()
    }
  }

  // Remettre un jeu ignore dans la bibliotheque (vue ignores).
  async function onRestoreGame(userGameId: string) {
    removeFromList(userGameId)
    try {
      await authFetch(`${apiBase}/api/collection/${userGameId}/restore`, { method: 'POST' })
    } catch {
      await fetchGames()
    }
  }

  function onCardClick(userGameId: string) {
    navigateTo(`/games/${userGameId}`)
  }

  // ── Modale d'ajout ───────────────────────────────────────
  const addModalOpen = ref(false)

  // ── Init ─────────────────────────────────────────────────
  function init() {
    fetchSteamStatus()
    fetchGames()

    if (route.query.steam === 'linked') {
      const firstLink = route.query.first === '1'
      // On nettoie l'URL tout de suite pour ne pas re-declencher au refresh.
      navigateTo('/game-list', { replace: true })
      if (firstLink) {
        // Premiere liaison : on importe automatiquement + modale de progression.
        void importSteam()
      } else {
        importMessage.value = { type: 'success', text: t('gameList.steamLinkedSuccess') }
      }
    }
  }

  return {
    // Steam
    steamConnected, steamPersona, steamLoading, importLoading, importMessage,
    linkSteam, importSteam,
    // Vue
    view, setView,
    // Filtres
    drawerOpen, searchQuery, selectedStatuses, activeFilterCount, STATUS_OPTIONS,
    toggleStatus, applyFilters, resetFilters,
    // Pagination
    currentPage, total, totalPages, goToPage,
    // Jeux
    gamesLoading, gamesError, games, fetchGames,
    // Actions
    onStatusChange, onIgnoreGame, onRestoreGame, onCardClick,
    // Modale d'ajout
    addModalOpen,
    // Modale de progression d'import
    progressOpen: progress.open,
    progressStatus: progress.status,
    onProgressBackground: progress.stopBackground,
    onProgressClose: progress.close,
    // Init
    init,
  }
}
