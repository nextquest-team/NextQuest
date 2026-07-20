// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import GameCatalogDetailDesktop from '~/components/games/catalog/GameCatalogDetailDesktop.vue'
import type { RecoGame } from '~/types/recommendations'

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key.split('.').pop() ?? key,
}))

const catalogPreviewRef = ref<RecoGame | null>(null)

mockNuxtImport('useState', () => (key: string, init?: () => unknown) => {
  if (key === 'catalog-preview') return catalogPreviewRef
  return ref(init?.() ?? null)
})

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

const stubs = {
  VIcon: { template: '<span v-bind="$attrs" />' },
  UiPageHeader: { template: '<div><slot /></div>' },
  UiBackButton: { template: '<button />' },
}

describe('GameCatalogDetailDesktop', () => {
  beforeEach(() => {
    catalogPreviewRef.value = null
  })

  it('affiche le not-found quand game est null', () => {
    const wrapper = mount(GameCatalogDetailDesktop, { global: { stubs } })
    expect(wrapper.find('.cdd__not-found').exists()).toBe(true)
    expect(wrapper.find('.cdd__title').exists()).toBe(false)
  })

  it('affiche le titre du jeu quand le state est renseigné', () => {
    catalogPreviewRef.value = fakeGame
    const wrapper = mount(GameCatalogDetailDesktop, { global: { stubs } })
    expect(wrapper.find('.cdd__title').text()).toBe('Disco Elysium')
  })

  it('affiche la cover quand coverUrl est défini', () => {
    catalogPreviewRef.value = fakeGame
    const wrapper = mount(GameCatalogDetailDesktop, { global: { stubs } })
    const img = wrapper.find('.cdd__cover-img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe(fakeGame.coverUrl)
  })

  it('affiche la note IGDB', () => {
    catalogPreviewRef.value = fakeGame
    const wrapper = mount(GameCatalogDetailDesktop, { global: { stubs } })
    expect(wrapper.find('.cdd__rating-num').text()).toContain('9.4/10')
  })

  it('affiche les genres', () => {
    catalogPreviewRef.value = fakeGame
    const wrapper = mount(GameCatalogDetailDesktop, { global: { stubs } })
    expect(wrapper.find('.cdd__chip').text()).toBe('RPG')
  })
})
