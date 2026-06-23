// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import GameDetailDesktop from '~/components/games/GameDetailDesktop.vue'
import type { CollectionDetailDTO } from '~/types/game'

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key.split('.').pop() ?? key,
}))

const mockGame = ref<CollectionDetailDTO | null>(null)
const mockLoading = ref(true)
const mockShowRemoveConfirm = ref(false)
const loadMock = vi.fn()
const onStatusChangeMock = vi.fn()
const confirmRemoveMock = vi.fn()

mockNuxtImport('useGameDetail', () => () => ({
  game: mockGame,
  igdb: ref(null),
  loading: mockLoading,
  showRemoveConfirm: mockShowRemoveConfirm,
  load: loadMock,
  formatPlaytime: (min: number | null) => (min ? `${Math.floor(min / 60)}h ${min % 60}min` : null),
  formatReleaseDate: (d: string | null) => (d ? '15 octobre 2019' : null),
  onStatusChange: onStatusChangeMock,
  confirmRemove: confirmRemoveMock,
}))

const fakeGame: CollectionDetailDTO = {
  userGameId: 'ug-1',
  status: 'completed',
  playtimeMinutes: 120,
  genres: [],
  tags: [],
  similarGames: [],
  game: {
    title: 'Celeste',
    coverUrl: 'https://cdn.igdb.com/celeste.jpg',
    isEnriched: true,
    igdbId: 456,
    summary: null,
    developer: null,
    publisher: null,
    releaseDate: null,
    igdbRating: 96,
    description: null,
    screenshots: [],
    similarGames: [],
    platforms: [],
    genres: [],
  },
} as unknown as CollectionDetailDTO

const stubs = {
  VIcon: { template: '<span v-bind="$attrs" />' },
  VProgressCircular: { template: '<div class="v-progress-circular" />' },
  UiPageHeader: { template: '<div><slot /></div>' },
  UiBackButton: { template: '<button />' },
}

describe('GameDetailDesktop', () => {
  beforeEach(() => {
    mockGame.value = null
    mockLoading.value = true
    mockShowRemoveConfirm.value = false
    loadMock.mockReset()
    onStatusChangeMock.mockReset()
    confirmRemoveMock.mockReset()
  })

  it('appelle load() au montage', async () => {
    mount(GameDetailDesktop, { global: { stubs } })
    await flushPromises()
    expect(loadMock).toHaveBeenCalledOnce()
  })

  it('affiche le loader pendant le chargement', () => {
    mockLoading.value = true
    const wrapper = mount(GameDetailDesktop, { global: { stubs } })
    expect(wrapper.find('.gdd__not-found').exists()).toBe(true)
    expect(wrapper.find('.v-progress-circular').exists()).toBe(true)
  })

  it('affiche le not-found quand game=null et loading=false', () => {
    mockLoading.value = false
    mockGame.value = null
    const wrapper = mount(GameDetailDesktop, { global: { stubs } })
    expect(wrapper.find('.gdd__nf-title').exists()).toBe(true)
    expect(wrapper.find('.gdd__title').exists()).toBe(false)
  })

  it('affiche le titre du jeu quand game est chargé', () => {
    mockLoading.value = false
    mockGame.value = fakeGame
    const wrapper = mount(GameDetailDesktop, { global: { stubs } })
    expect(wrapper.find('.gdd__title').text()).toBe('Celeste')
  })

  it('affiche 4 boutons de statut', () => {
    mockLoading.value = false
    mockGame.value = fakeGame
    const wrapper = mount(GameDetailDesktop, { global: { stubs } })
    expect(wrapper.findAll('.gdd__status-btn')).toHaveLength(4)
  })

  it('le bouton du statut actif a la classe --active', () => {
    mockLoading.value = false
    mockGame.value = fakeGame
    const wrapper = mount(GameDetailDesktop, { global: { stubs } })
    const activeBtn = wrapper.find('.gdd__status-btn--active')
    expect(activeBtn.exists()).toBe(true)
  })

  it('appelle onStatusChange au clic sur un bouton de statut', async () => {
    mockLoading.value = false
    mockGame.value = fakeGame
    const wrapper = mount(GameDetailDesktop, { global: { stubs } })
    await wrapper.findAll('.gdd__status-btn')[1].trigger('click')
    expect(onStatusChangeMock).toHaveBeenCalledWith('playing')
  })

  it('ouvre la confirmation au clic sur Supprimer', async () => {
    mockLoading.value = false
    mockGame.value = fakeGame
    const wrapper = mount(GameDetailDesktop, { global: { stubs } })
    await wrapper.find('.gdd__remove-btn').trigger('click')
    expect(mockShowRemoveConfirm.value).toBe(true)
  })

  it('appelle confirmRemove depuis la modale', async () => {
    mockLoading.value = false
    mockGame.value = fakeGame
    mockShowRemoveConfirm.value = true
    const wrapper = mount(GameDetailDesktop, { global: { stubs } })
    await wrapper.find('.gdd__confirm-btn--delete').trigger('click')
    expect(confirmRemoveMock).toHaveBeenCalledOnce()
  })
})
