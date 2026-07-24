import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFollowedGamesStore } from '~/stores/followedGames'
import type { TimelineGameDTO } from '~/types/timeline'

const STORAGE_KEY = 'nq-followed-games'

function makeGame(igdbId: number, title = `Game ${igdbId}`): TimelineGameDTO {
  return {
    igdbId,
    title,
    releaseDate: null,
    coverUrl: null,
    hypes: null,
    genres: [],
    platforms: [],
  }
}

describe('useFollowedGamesStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('initialise un état vide sans localStorage', () => {
    const store = useFollowedGamesStore()
    expect(store.followedList).toEqual([])
    expect(store.isFollowed(1)).toBe(false)
  })

  it('hydrate depuis le localStorage existant au boot du store', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 42: makeGame(42) }))
    const store = useFollowedGamesStore()
    expect(store.isFollowed(42)).toBe(true)
    expect(store.followedList).toHaveLength(1)
  })

  it('follow ajoute le jeu et persiste en localStorage', () => {
    const store = useFollowedGamesStore()
    store.follow(makeGame(1, 'Zelda'))

    expect(store.isFollowed(1)).toBe(true)
    expect(store.followedList).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ 1: makeGame(1, 'Zelda') })
  })

  it('unfollow retire le jeu et met a jour le localStorage', () => {
    const store = useFollowedGamesStore()
    store.follow(makeGame(1))
    store.unfollow(1)

    expect(store.isFollowed(1)).toBe(false)
    expect(store.followedList).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({})
  })

  it('toggleFollow bascule suivi/non-suivi', () => {
    const store = useFollowedGamesStore()
    store.toggleFollow(makeGame(7))
    expect(store.isFollowed(7)).toBe(true)

    store.toggleFollow(makeGame(7))
    expect(store.isFollowed(7)).toBe(false)
  })

  it('conserve les jeux deja suivis en ajoutant un nouveau suivi', () => {
    const store = useFollowedGamesStore()
    store.follow(makeGame(1))
    store.follow(makeGame(2))

    expect(store.isFollowed(1)).toBe(true)
    expect(store.isFollowed(2)).toBe(true)
    expect(store.followedList).toHaveLength(2)
  })

  it('un JSON corrompu en localStorage reinitialise a vide sans planter', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json')
    const store = useFollowedGamesStore()
    expect(store.followedList).toEqual([])
  })
})
