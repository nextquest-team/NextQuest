import type { TimelineGameDTO } from '~/types/timeline'

const STORAGE_KEY = 'nq-followed-games'

// TODO(backend) : stub local en attendant un endpoint de suivi (POST/DELETE/GET
// /api/games/:igdbId/follow). Persiste en localStorage, propre au navigateur —
// a remplacer par un appel API des que JB expose la route.
export const useFollowedGamesStore = defineStore('followedGames', () => {
  const games = ref<Record<number, TimelineGameDTO>>({})
  let hydrated = false

  function hydrate() {
    if (hydrated || !import.meta.client) return
    hydrated = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) games.value = JSON.parse(raw)
    } catch {
      games.value = {}
    }
  }

  function persist() {
    if (!import.meta.client) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(games.value))
  }

  const followedList = computed(() => Object.values(games.value))

  function isFollowed(igdbId: number) {
    return igdbId in games.value
  }

  function follow(game: TimelineGameDTO) {
    games.value[game.igdbId] = game
    persist()
  }

  function unfollow(igdbId: number) {
    delete games.value[igdbId]
    persist()
  }

  function toggleFollow(game: TimelineGameDTO) {
    if (isFollowed(game.igdbId)) unfollow(game.igdbId)
    else follow(game)
  }

  hydrate()

  return { games, followedList, isFollowed, follow, unfollow, toggleFollow, hydrate }
})
