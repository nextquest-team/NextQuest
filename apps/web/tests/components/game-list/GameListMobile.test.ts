// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import GameListMobile from '~/components/game-list/GameListMobile.vue'
import type { UserGame } from '~/types/game'

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key.split('.').pop() ?? key,
}))

const mockGames = ref<UserGame[]>([])
const mockGamesLoading = ref(false)
const mockSteamConnected = ref(false)
const mockTotalPages = ref(1)
const mockCurrentPage = ref(1)
const mockActiveFilterCount = ref(0)
const mockImportMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const initMock = vi.fn()
const linkSteamMock = vi.fn()
const importSteamMock = vi.fn()

mockNuxtImport('useGameList', () => () => ({
  steamConnected: mockSteamConnected,
  steamPersona: ref(null),
  steamLoading: ref(false),
  importLoading: ref(false),
  importMessage: mockImportMessage,
  linkSteam: linkSteamMock,
  importSteam: importSteamMock,
  view: ref('library'),
  setView: vi.fn(),
  drawerOpen: ref(false),
  searchQuery: ref(''),
  selectedStatuses: ref([]),
  activeFilterCount: mockActiveFilterCount,
  STATUS_OPTIONS: [
    { key: 'playing', icon: 'mdi-play-circle-outline' },
    { key: 'backlog', icon: 'mdi-bookmark-outline' },
    { key: 'completed', icon: 'mdi-check-circle-outline' },
    { key: 'abandoned', icon: 'mdi-close-circle-outline' },
  ],
  toggleStatus: vi.fn(),
  applyFilters: vi.fn(),
  resetFilters: vi.fn(),
  currentPage: mockCurrentPage,
  total: ref(0),
  totalPages: mockTotalPages,
  goToPage: vi.fn(),
  gamesLoading: mockGamesLoading,
  games: mockGames,
  fetchGames: vi.fn(),
  onStatusChange: vi.fn(),
  onIgnoreGame: vi.fn(),
  onRestoreGame: vi.fn(),
  onCardClick: vi.fn(),
  addModalOpen: ref(false),
  progressOpen: ref(false),
  progressStatus: ref(null),
  onProgressBackground: vi.fn(),
  onProgressClose: vi.fn(),
  init: initMock,
}))

const stubs = {
  VIcon: { template: '<span v-bind="$attrs" />' },
  VProgressCircular: { template: '<div class="v-progress-circular" />' },
  VNavigationDrawer: { template: '<div><slot /></div>' },
  GameListCard: { template: '<div class="game-list-card" />' },
  GameListAddModal: { template: '<div />' },
  GameListImportProgressModal: { template: '<div />' },
  UiPageHeader: { template: '<div><slot /></div>' },
  UiBackButton: { template: '<button />' },
  ClientOnly: { template: '<slot />' },
  Transition: { template: '<slot />' },
}

describe('GameListMobile', () => {
  beforeEach(() => {
    mockGames.value = []
    mockGamesLoading.value = false
    mockSteamConnected.value = false
    mockTotalPages.value = 1
    mockCurrentPage.value = 1
    mockActiveFilterCount.value = 0
    mockImportMessage.value = null
    initMock.mockReset()
  })

  it('appelle init() au montage', async () => {
    mount(GameListMobile, { global: { stubs } })
    await flushPromises()
    expect(initMock).toHaveBeenCalledOnce()
  })

  it('affiche le bouton Steam Lier quand non connecté', () => {
    const wrapper = mount(GameListMobile, { global: { stubs } })
    expect(wrapper.find('.glm__btn--steam').exists()).toBe(true)
  })

  it('affiche le steam-row (avec bouton import) quand connecté', () => {
    mockSteamConnected.value = true
    const wrapper = mount(GameListMobile, { global: { stubs } })
    expect(wrapper.find('.glm__steam-row').exists()).toBe(true)
    // Le bouton "Lier Steam" (v-if="!steamConnected") est masqué
    // Le steam-row (v-else) avec son bouton d'import est affiché
    const steamRow = wrapper.find('.glm__steam-row')
    expect(steamRow.find('.glm__btn--steam').exists()).toBe(true)
  })

  it('affiche le loader quand gamesLoading=true', () => {
    mockGamesLoading.value = true
    const wrapper = mount(GameListMobile, { global: { stubs } })
    expect(wrapper.find('.glm__loader').exists()).toBe(true)
    expect(wrapper.find('.glm__empty').exists()).toBe(false)
    expect(wrapper.find('.glm__grid').exists()).toBe(false)
  })

  it('affiche le message vide quand games est vide et chargement terminé', () => {
    mockGamesLoading.value = false
    mockGames.value = []
    const wrapper = mount(GameListMobile, { global: { stubs } })
    expect(wrapper.find('.glm__empty').exists()).toBe(true)
    expect(wrapper.find('.glm__grid').exists()).toBe(false)
  })

  it('affiche la grille quand games est non vide', () => {
    mockGamesLoading.value = false
    mockGames.value = [{ id: 'g1', title: 'Jeu A', status: 'playing' }] as any[]
    const wrapper = mount(GameListMobile, { global: { stubs } })
    expect(wrapper.find('.glm__grid').exists()).toBe(true)
    expect(wrapper.find('.glm__empty').exists()).toBe(false)
  })

  it('affiche un GameListCard par jeu', () => {
    mockGamesLoading.value = false
    mockGames.value = [
      { id: 'g1', title: 'Jeu A', status: 'playing' },
      { id: 'g2', title: 'Jeu B', status: 'backlog' },
    ] as any[]
    const wrapper = mount(GameListMobile, { global: { stubs } })
    expect(wrapper.findAll('.game-list-card')).toHaveLength(2)
  })

  it('affiche le champ de recherche', () => {
    const wrapper = mount(GameListMobile, { global: { stubs } })
    expect(wrapper.find('input.glm__search').exists()).toBe(true)
  })

  it('affiche le bouton filtre avec badge quand activeFilterCount > 0', () => {
    mockActiveFilterCount.value = 2
    const wrapper = mount(GameListMobile, { global: { stubs } })
    expect(wrapper.find('.glm__filter-toggle--active').exists()).toBe(true)
  })

  it("n'affiche pas la pagination quand totalPages <= 1", () => {
    mockTotalPages.value = 1
    const wrapper = mount(GameListMobile, { global: { stubs } })
    expect(wrapper.find('.glm__pagination').exists()).toBe(false)
  })

  it('affiche la pagination quand totalPages > 1', () => {
    mockTotalPages.value = 3
    const wrapper = mount(GameListMobile, { global: { stubs } })
    expect(wrapper.find('.glm__pagination').exists()).toBe(true)
  })

  it("appelle linkSteam au clic sur le bouton Steam", async () => {
    const wrapper = mount(GameListMobile, { global: { stubs } })
    await wrapper.find('.glm__btn--steam').trigger('click')
    expect(linkSteamMock).toHaveBeenCalledOnce()
  })
})
