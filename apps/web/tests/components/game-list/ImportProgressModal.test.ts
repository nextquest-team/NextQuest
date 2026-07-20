// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import ImportProgressModal from '~/components/game-list/ImportProgressModal.vue'
import type { ImportStatus } from '~/types/game'

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key.split('.').pop() ?? key,
}))

const stubs = {
  VIcon: { template: '<span v-bind="$attrs" />' },
  Transition: { template: '<slot />' },
}

describe('ImportProgressModal', () => {
  it('ne rend rien quand open=false', () => {
    const wrapper = mount(ImportProgressModal, {
      props: { open: false, status: null },
      global: { stubs },
    })
    expect(wrapper.find('.ip-modal').exists()).toBe(false)
  })

  it('affiche la barre a 50% et une vignette par jeu', () => {
    const status: ImportStatus = {
      status: 'running',
      total: 4,
      done: 2,
      games: [
        { id: 'a', coverUrl: 'http://x/a.jpg', isEnriched: true },
        { id: 'b', coverUrl: null, isEnriched: false },
        { id: 'c', coverUrl: 'http://x/c.jpg', isEnriched: true },
        { id: 'd', coverUrl: null, isEnriched: false },
      ],
    }
    const wrapper = mount(ImportProgressModal, {
      props: { open: true, status },
      global: { stubs },
    })
    expect(wrapper.findAll('.ip-modal__cell')).toHaveLength(4)
    expect(wrapper.findAll('.ip-modal__cover')).toHaveLength(2)
    expect(wrapper.findAll('.ip-modal__placeholder')).toHaveLength(2)
    expect(wrapper.find('.ip-modal__bar-fill').attributes('style')).toContain('width: 50%')
  })

  it('le bouton arriere-plan emet background', async () => {
    const status: ImportStatus = { status: 'running', total: 1, done: 0, games: [] }
    const wrapper = mount(ImportProgressModal, {
      props: { open: true, status },
      global: { stubs },
    })
    await wrapper.find('.ip-modal__bg-btn').trigger('click')
    expect(wrapper.emitted('background')).toBeTruthy()
  })
})
