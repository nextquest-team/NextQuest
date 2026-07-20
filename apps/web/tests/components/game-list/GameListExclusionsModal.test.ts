// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import GameListExclusionsModal from '~/components/game-list/GameListExclusionsModal.vue'

mockNuxtImport('useI18n', () => () => ({ t: (k: string) => k.split('.').pop() ?? k }))

const exclusions = ref<any[]>([])
const fetchExclusionsMock = vi.fn()
const restoreMock = vi.fn()
mockNuxtImport('useExclusions', () => () => ({
  exclusions,
  count: ref(exclusions.value.length),
  loading: ref(false),
  fetchExclusions: fetchExclusionsMock,
  restore: restoreMock,
}))

const stubs = {
  VIcon: { template: '<span v-bind="$attrs" />' },
  VProgressCircular: { template: '<div class="v-progress-circular" />' },
  Transition: { template: '<slot />' },
}

describe('GameListExclusionsModal', () => {
  beforeEach(() => {
    exclusions.value = []
    fetchExclusionsMock.mockReset()
    restoreMock.mockReset()
  })

  it('charge les exclusions a l ouverture', async () => {
    const wrapper = mount(GameListExclusionsModal, { props: { open: false }, global: { stubs } })
    expect(fetchExclusionsMock).not.toHaveBeenCalled()
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(fetchExclusionsMock).toHaveBeenCalled()
  })

  it('liste les jeux exclus avec un bouton reintegrer', async () => {
    exclusions.value = [
      { gameId: 'g1', title: 'Celeste', coverUrl: 'http://x/c.jpg', releaseDate: null, isEnriched: true, excludedAt: '2026-07-20' },
    ]
    const wrapper = mount(GameListExclusionsModal, { props: { open: true }, global: { stubs } })
    await flushPromises()
    expect(wrapper.findAll('.gl-excl__card')).toHaveLength(1)
    expect(wrapper.text()).toContain('Celeste')
  })

  it('reintegrer appelle restore et emet restored', async () => {
    exclusions.value = [
      { gameId: 'g1', title: 'Celeste', coverUrl: null, releaseDate: null, isEnriched: true, excludedAt: '2026-07-20' },
    ]
    restoreMock.mockResolvedValue(true)
    const wrapper = mount(GameListExclusionsModal, { props: { open: true }, global: { stubs } })
    await wrapper.find('.gl-excl__restore').trigger('click')
    await flushPromises()
    expect(restoreMock).toHaveBeenCalledWith('g1')
    expect(wrapper.emitted('restored')).toBeTruthy()
  })
})
