// @vitest-environment nuxt
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import GameCatalogDetailDesktop from '~/components/games/catalog/GameCatalogDetailDesktop.vue'
import type { RecoGame } from '~/types/recommendations'

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key.split('.').pop() ?? key,
}))

const fakeGame: RecoGame = {
  id: 'game-42',
  title: 'Disco Elysium',
  slug: 'disco-elysium',
  coverUrl: 'https://cdn.igdb.com/disco.jpg',
  genres: [{ id: '3', name: 'RPG', slug: 'rpg' }],
  igdbRating: 94,
  releaseDate: '2019-10-15T00:00:00.000Z',
  releaseStatus: null,
}

const gameRef = ref<RecoGame | null>(null)
const loadingRef = ref(false)
const loadMock = vi.fn()

mockNuxtImport('useGameCatalogDetail', () => () => ({
  game: gameRef,
  loading: loadingRef,
  load: loadMock,
}))

const stubs = {
  VIcon: { template: '<span v-bind="$attrs" />' },
  VProgressCircular: { template: '<div class="v-progress-circular" />' },
  UiPageHeader: { template: '<div><slot /></div>' },
  UiBackButton: { template: '<button />' },
}

describe('GameCatalogDetailDesktop', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    gameRef.value = null
    loadingRef.value = false
    loadMock.mockReset()
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  it('affiche le not-found quand game est null', () => {
    wrapper = mount(GameCatalogDetailDesktop, { global: { stubs } })
    expect(wrapper.find('.cdd__not-found').exists()).toBe(true)
    expect(wrapper.find('.cdd__title').exists()).toBe(false)
  })

  it('affiche le titre du jeu quand le state est renseigné', () => {
    gameRef.value = fakeGame
    wrapper = mount(GameCatalogDetailDesktop, { global: { stubs } })
    expect(wrapper.find('.cdd__title').text()).toBe('Disco Elysium')
  })

  it('affiche la cover quand coverUrl est défini', () => {
    gameRef.value = fakeGame
    wrapper = mount(GameCatalogDetailDesktop, { global: { stubs } })
    const img = wrapper.find('.cdd__cover-img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe(fakeGame.coverUrl)
  })

  it('affiche la note IGDB', () => {
    gameRef.value = fakeGame
    wrapper = mount(GameCatalogDetailDesktop, { global: { stubs } })
    expect(wrapper.find('.cdd__rating-num').text()).toContain('9.4/10')
  })

  it('affiche les genres', () => {
    gameRef.value = fakeGame
    wrapper = mount(GameCatalogDetailDesktop, { global: { stubs } })
    expect(wrapper.find('.cdd__chip').text()).toBe('RPG')
  })
})
