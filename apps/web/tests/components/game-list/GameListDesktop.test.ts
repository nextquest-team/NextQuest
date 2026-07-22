// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import GameListDesktop from '~/components/game-list/GameListDesktop.vue'
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
const initMock = vi.fn()
const linkSteamMock = vi.fn()

const gameListMock = {
  steamConnected: mockSteamConnected,
  steamPersona: ref(null),
  steamLoading: ref(false),
  importLoading: ref(false),
  importMessage: ref(null),
  linkSteam: linkSteamMock,
  importSteam: vi.fn(),
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
  platforms: ref([]),
  selectedPlatformIds: ref([]),
  togglePlatform: vi.fn(),
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
}

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

const globalOpts = { stubs, provide: { gameList: gameListMock } }

describe('GameListDesktop', () => {
  beforeEach(() => {
    mockGames.value = []
    mockGamesLoading.value = false
    mockSteamConnected.value = false
    mockTotalPages.value = 1
    mockCurrentPage.value = 1
    mockActiveFilterCount.value = 0
    initMock.mockReset()
    linkSteamMock.mockReset()
  })

  it('affiche le bouton Steam Lier quand non connecté', () => {
    const wrapper = mount(GameListDesktop, { global: globalOpts })
    expect(wrapper.find('.gl__btn--steam').exists()).toBe(true)
  })

  it('affiche le loader quand gamesLoading=true', () => {
    mockGamesLoading.value = true
    const wrapper = mount(GameListDesktop, { global: globalOpts })
    expect(wrapper.find('.gl__loader').exists()).toBe(true)
    expect(wrapper.find('.gl__empty').exists()).toBe(false)
  })

  it('affiche le message vide quand la liste est vide', () => {
    mockGamesLoading.value = false
    mockGames.value = []
    const wrapper = mount(GameListDesktop, { global: globalOpts })
    expect(wrapper.find('.gl__empty').exists()).toBe(true)
    expect(wrapper.find('.gl__grid').exists()).toBe(false)
  })

  it('affiche la grille avec les jeux', () => {
    mockGamesLoading.value = false
    mockGames.value = [
      { id: 'g1', title: 'Celeste', status: 'completed' },
      { id: 'g2', title: 'Hades', status: 'playing' },
    ] as any[]
    const wrapper = mount(GameListDesktop, { global: globalOpts })
    expect(wrapper.find('.gl__grid').exists()).toBe(true)
    expect(wrapper.findAll('.game-list-card')).toHaveLength(2)
  })

  it('affiche le champ de recherche', () => {
    const wrapper = mount(GameListDesktop, { global: globalOpts })
    expect(wrapper.find('input.gl__search').exists()).toBe(true)
  })

  it('affiche le badge filtre quand activeFilterCount > 0', () => {
    mockActiveFilterCount.value = 1
    const wrapper = mount(GameListDesktop, { global: globalOpts })
    expect(wrapper.find('.gl__filter-toggle--active').exists()).toBe(true)
  })

  it("n'affiche pas la pagination quand totalPages <= 1", () => {
    mockTotalPages.value = 1
    const wrapper = mount(GameListDesktop, { global: globalOpts })
    expect(wrapper.find('.gl__pagination').exists()).toBe(false)
  })

  it('affiche la pagination quand totalPages > 1', () => {
    mockTotalPages.value = 5
    const wrapper = mount(GameListDesktop, { global: globalOpts })
    expect(wrapper.find('.gl__pagination').exists()).toBe(true)
  })

  it('appelle linkSteam au clic sur le bouton Steam', async () => {
    const wrapper = mount(GameListDesktop, { global: globalOpts })
    await wrapper.find('.gl__btn--steam').trigger('click')
    expect(linkSteamMock).toHaveBeenCalledOnce()
  })
})
