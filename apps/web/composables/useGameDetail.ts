import type { GameStatus, CollectionDetailDTO, IgdbGameDetail } from '~/types/game'

export const GAME_STATUSES: { key: GameStatus; icon: string }[] = [
  { key: 'backlog',    icon: 'mdi-bookmark-outline' },
  { key: 'playing',   icon: 'mdi-play-circle-outline' },
  { key: 'completed', icon: 'mdi-check-circle-outline' },
  { key: 'abandoned', icon: 'mdi-close-circle-outline' },
]

export function useGameDetail() {
  const { t } = useI18n()
  const route = useRoute()
  const { authFetch, apiBase } = useAuthFetch()

  const game = ref<CollectionDetailDTO | null>(null)
  const igdb = ref<IgdbGameDetail | null>(null)
  const loading = ref(true)
  const showRemoveConfirm = ref(false)

  async function load() {
    try {
      game.value = await authFetch<CollectionDetailDTO>(
        `${apiBase}/api/collection/${route.params.gameId}`,
      )
      const igdbId = game.value?.game.igdbId
      if (igdbId != null) {
        try {
          igdb.value = await authFetch<IgdbGameDetail>(`${apiBase}/api/games/igdb/${igdbId}`)
        } catch { /* igdb reste null, fallback sur données BDD */ }
      }
    } catch { /* game reste null → écran "introuvable" */ }
    finally { loading.value = false }
  }

  function formatPlaytime(minutes: number | null | undefined) {
    if (!minutes) return null
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return t('gameDetail.playtimeValue', { h, m: m.toString().padStart(2, '00') })
  }

  function formatReleaseDate(raw: string | null) {
    if (!raw) return null
    return new Date(raw).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  }

  async function onStatusChange(status: GameStatus) {
    if (!game.value) return
    const previous = game.value.status
    game.value.status = status
    try {
      await authFetch(`${apiBase}/api/collection/${game.value.userGameId}/status`, {
        method: 'PATCH',
        body: { status },
      })
    } catch {
      game.value.status = previous
    }
  }

  async function confirmRemove() {
    showRemoveConfirm.value = false
    try {
      await authFetch(`${apiBase}/api/collection/${game.value?.userGameId}`, { method: 'DELETE' })
    } catch { /* on navigue quand même */ }
    navigateTo('/game-list')
  }

  return {
    game, igdb, loading,
    showRemoveConfirm,
    load,
    formatPlaytime,
    formatReleaseDate,
    onStatusChange,
    confirmRemove,
  }
}
