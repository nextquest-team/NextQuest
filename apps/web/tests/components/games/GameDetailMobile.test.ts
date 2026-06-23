// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import GameDetailMobile from '~/components/games/GameDetailMobile.vue'
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
  status: 'playing',
  playtimeMinutes: 90,
  genres: [],
  tags: [],
  similarGames: [],
  game: {
    title: 'Hollow Knight',
    coverUrl: 'https://cdn.igdb.com/hk.jpg',
    isEnriched: true,
    igdbId: 123,
    summary: 'Un metroidvania épique.',
    genres: [],
    screenshots: [],
    similarGames: [],
    platforms: [],
    releaseDate: '2017-02-24T00:00:00.000Z',
    igdbRating: 92,
    description: null,
    developer: null,
    publisher: null,
  },
} as unknown as CollectionDetailDTO

const stubs = {
  VIcon: { template: '<span v-bind="$attrs" />' },
  VProgressCircular: { template: '<div class="v-progress-circular" />' },
  UiPageHeader: { template: '<div><slot /></div>' },
  UiBackButton: { template: '<button />' },
}

describe('GameDetailMobile', () => {
  beforeEach(() => {
    mockGame.value = null
    mockLoading.value = true
    mockShowRemoveConfirm.value = false
    loadMock.mockReset()
    onStatusChangeMock.mockReset()
    confirmRemoveMock.mockReset()
  })

  it('appelle load() au montage', async () => {
    mount(GameDetailMobile, { global: { stubs } })
    await flushPromises()
    expect(loadMock).toHaveBeenCalledOnce()
  })

  it('affiche le loader pendant le chargement', () => {
    mockLoading.value = true
    const wrapper = mount(GameDetailMobile, { global: { stubs } })
    expect(wrapper.find('.gdm__state').exists()).toBe(true)
    expect(wrapper.find('.v-progress-circular').exists()).toBe(true)
  })

  it('affiche le not-found quand game=null et loading=false', () => {
    mockLoading.value = false
    mockGame.value = null
    const wrapper = mount(GameDetailMobile, { global: { stubs } })
    expect(wrapper.find('.gdm__nf-title').exists()).toBe(true)
    expect(wrapper.find('.gdm__title').exists()).toBe(false)
  })

  it('affiche le titre du jeu quand game est chargé', () => {
    mockLoading.value = false
    mockGame.value = fakeGame
    const wrapper = mount(GameDetailMobile, { global: { stubs } })
    expect(wrapper.find('.gdm__title').text()).toBe('Hollow Knight')
  })

  it('affiche 4 boutons de statut', () => {
    mockLoading.value = false
    mockGame.value = fakeGame
    const wrapper = mount(GameDetailMobile, { global: { stubs } })
    expect(wrapper.findAll('.gdm__status-btn')).toHaveLength(4)
  })

  it('le bouton de statut actif a la classe --active', () => {
    mockLoading.value = false
    mockGame.value = fakeGame
    const wrapper = mount(GameDetailMobile, { global: { stubs } })
    const activeBtn = wrapper.find('.gdm__status-btn--active')
    expect(activeBtn.exists()).toBe(true)
  })

  it('appelle onStatusChange au clic sur un bouton de statut', async () => {
    mockLoading.value = false
    mockGame.value = fakeGame
    const wrapper = mount(GameDetailMobile, { global: { stubs } })
    await wrapper.findAll('.gdm__status-btn')[0].trigger('click')
    expect(onStatusChangeMock).toHaveBeenCalledWith('backlog')
  })

  it('ouvre la confirmation de suppression au clic sur Supprimer', async () => {
    mockLoading.value = false
    mockGame.value = fakeGame
    const wrapper = mount(GameDetailMobile, { global: { stubs } })
    await wrapper.find('.gdm__remove-btn').trigger('click')
    expect(mockShowRemoveConfirm.value).toBe(true)
  })

  it('appelle confirmRemove depuis la modale de confirmation', async () => {
    mockLoading.value = false
    mockGame.value = fakeGame
    mockShowRemoveConfirm.value = true
    const wrapper = mount(GameDetailMobile, { global: { stubs } })
    await wrapper.find('.gdm__confirm-btn--delete').trigger('click')
    expect(confirmRemoveMock).toHaveBeenCalledOnce()
  })
})
