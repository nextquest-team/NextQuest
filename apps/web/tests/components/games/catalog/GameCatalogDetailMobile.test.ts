// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import GameCatalogDetailMobile from '~/components/games/catalog/GameCatalogDetailMobile.vue'
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
  slug: 'disco-elysium',
  title: 'Disco Elysium',
  coverUrl: 'https://cdn.igdb.com/disco.jpg',
  genres: [{ id: '3', name: 'RPG', slug: 'role-playing-rpg' }],
  igdbRating: 94,
  releaseDate: '2019-10-15T00:00:00.000Z',
  releaseStatus: null,
}

const stubs = {
  VIcon: { template: '<span v-bind="$attrs" />' },
  UiPageHeader: { template: '<div><slot /></div>' },
  UiBackButton: { template: '<button />' },
}

describe('GameCatalogDetailMobile', () => {
  beforeEach(() => {
    catalogPreviewRef.value = null
  })

  it('affiche le not-found quand game est null', () => {
    const wrapper = mount(GameCatalogDetailMobile, { global: { stubs } })
    expect(wrapper.find('.cdm__not-found').exists()).toBe(true)
    expect(wrapper.find('.cdm__title').exists()).toBe(false)
  })

  it("affiche le titre du jeu quand le state est renseigné", () => {
    catalogPreviewRef.value = fakeGame
    const wrapper = mount(GameCatalogDetailMobile, { global: { stubs } })
    expect(wrapper.find('.cdm__title').text()).toBe('Disco Elysium')
  })

  it("affiche la cover quand coverUrl est défini", () => {
    catalogPreviewRef.value = fakeGame
    const wrapper = mount(GameCatalogDetailMobile, { global: { stubs } })
    const img = wrapper.find('.cdm__cover-img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe(fakeGame.coverUrl)
  })

  it("affiche la note IGDB", () => {
    catalogPreviewRef.value = fakeGame
    const wrapper = mount(GameCatalogDetailMobile, { global: { stubs } })
    expect(wrapper.find('.cdm__rating').exists()).toBe(true)
    expect(wrapper.find('.cdm__rating-num').text()).toContain('9.4/10')
  })

  it("affiche les genres", () => {
    catalogPreviewRef.value = fakeGame
    const wrapper = mount(GameCatalogDetailMobile, { global: { stubs } })
    expect(wrapper.find('.cdm__chip').text()).toBe('RPG')
  })

  it("n'affiche pas le not-found si game est présent", () => {
    catalogPreviewRef.value = fakeGame
    const wrapper = mount(GameCatalogDetailMobile, { global: { stubs } })
    expect(wrapper.find('.cdm__not-found').exists()).toBe(false)
  })
})
