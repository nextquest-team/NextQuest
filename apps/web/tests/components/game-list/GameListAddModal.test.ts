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

  it('ne recherche pas en dessous de 2 caracteres', async () => {
    const wrapper = mount(GameListAddModal, { props: { open: true }, global: { stubs } })
    await wrapper.find('.gl-modal__search').setValue('a')
    await vi.advanceTimersByTimeAsync(300)
    expect(authFetchMock).not.toHaveBeenCalled()
  })

  it('recherche IGDB (debounce) et affiche resultats + badge deja ajoute', async () => {
    authFetchMock.mockResolvedValue({
      items: [
        { igdbId: 1, name: 'Celeste', coverUrl: 'http://x/c.jpg', releaseYear: 2018, alreadyInCollection: false, platforms: [{ id: 'p1', name: 'PC' }] },
        { igdbId: 2, name: 'Hades', coverUrl: null, releaseYear: 2020, alreadyInCollection: true, platforms: [] },
      ],
    })
    const wrapper = mount(GameListAddModal, { props: { open: true }, global: { stubs } })
    await wrapper.find('.gl-modal__search').setValue('celeste')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(authFetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/games/igdb/search',
      expect.objectContaining({ query: { q: 'celeste' } }),
    )
    expect(wrapper.findAll('.gl-add__card')).toHaveLength(2)
    expect(wrapper.findAll('.gl-add__badge')).toHaveLength(1)
    expect(wrapper.findAll('.gl-add__plus')).toHaveLength(1)
  })

  it('propose les plateformes du jeu et ajoute avec celle choisie', async () => {
    authFetchMock.mockResolvedValueOnce({
      items: [
        {
          igdbId: 1,
          name: 'Forza Horizon',
          coverUrl: null,
          releaseYear: 2021,
          alreadyInCollection: false,
          platforms: [
            { id: 'p1', name: 'PC' },
            { id: 'p2', name: 'Xbox Series X|S' },
          ],
        },
      ],
    })
    const wrapper = mount(GameListAddModal, { props: { open: true }, global: { stubs } })
    await wrapper.find('.gl-modal__search').setValue('forza')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    await wrapper.find('.gl-add__plus').trigger('click')
    // Deux plateformes du jeu + l'option "sans plateforme"
    const platformBtns = wrapper.findAll('.gl-add__platform-btn')
    expect(platformBtns).toHaveLength(3)

    authFetchMock.mockResolvedValueOnce({})
    await platformBtns[1].trigger('click') // Xbox Series X|S
    await flushPromises()

    expect(authFetchMock).toHaveBeenCalledWith('http://localhost:3000/api/collection/from-igdb', {
      method: 'POST',
      body: { igdbId: 1, platformId: 'p2' },
    })
    expect(pushMock).toHaveBeenCalled()
    expect(wrapper.emitted('added')).toBeTruthy()
  })
})
