// @vitest-environment nuxt
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import GameListAddModal from '~/components/game-list/GameListAddModal.vue'

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key.split('.').pop() ?? key,
}))

const authFetchMock = vi.fn()
mockNuxtImport('useAuthFetch', () => () => ({
  authFetch: authFetchMock,
  apiBase: 'http://localhost:3000',
}))

const pushMock = vi.fn()
mockNuxtImport('useToast', () => () => ({
  push: pushMock,
  dismiss: vi.fn(),
  toasts: ref([]),
}))

mockNuxtImport('usePlatforms', () => () => ({
  platforms: ref([{ id: 'p1', name: 'PC', code: 'pc', iconUrl: null }]),
  loading: ref(false),
  fetchPlatforms: vi.fn(),
}))

const stubs = {
  VIcon: { template: '<span v-bind="$attrs" />' },
  VProgressCircular: { template: '<div class="v-progress-circular" />' },
  Transition: { template: '<slot />' },
}

describe('GameListAddModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    authFetchMock.mockReset()
    pushMock.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('recherche IGDB (debounce) et affiche resultats + badge deja ajoute', async () => {
    authFetchMock.mockResolvedValue({
      items: [
        { igdbId: 1, name: 'Celeste', coverUrl: 'http://x/c.jpg', releaseYear: 2018, alreadyInCollection: false },
        { igdbId: 2, name: 'Hades', coverUrl: null, releaseYear: 2020, alreadyInCollection: true },
      ],
    })
    const wrapper = mount(GameListAddModal, { props: { open: true }, global: { stubs } })
    await wrapper.find('.gl-modal__search').setValue('a')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(authFetchMock).toHaveBeenCalledWith('http://localhost:3000/api/games/igdb/search', {
      query: { q: 'a' },
    })
    expect(wrapper.findAll('.gl-add__card')).toHaveLength(2)
    expect(wrapper.findAll('.gl-add__badge')).toHaveLength(1)
    expect(wrapper.findAll('.gl-add__plus')).toHaveLength(1)
  })

  it('ajoute un jeu avec la plateforme choisie et emet added', async () => {
    authFetchMock.mockResolvedValueOnce({
      items: [
        { igdbId: 1, name: 'Celeste', coverUrl: null, releaseYear: 2018, alreadyInCollection: false },
      ],
    })
    const wrapper = mount(GameListAddModal, { props: { open: true }, global: { stubs } })
    await wrapper.find('.gl-modal__search').setValue('cel')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    await wrapper.find('.gl-add__plus').trigger('click')
    authFetchMock.mockResolvedValueOnce({})
    await wrapper.find('.gl-add__platform-btn').trigger('click')
    await flushPromises()

    expect(authFetchMock).toHaveBeenCalledWith('http://localhost:3000/api/collection/from-igdb', {
      method: 'POST',
      body: { igdbId: 1, platformId: 'p1' },
    })
    expect(pushMock).toHaveBeenCalled()
    expect(wrapper.emitted('added')).toBeTruthy()
  })
})
