// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import GameListImportProgressModal from '~/components/game-list/GameListImportProgressModal.vue'
import type { ImportStatus } from '~/types/game'

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key.split('.').pop() ?? key,
}))

const stubs = {
  VIcon: { template: '<span v-bind="$attrs" />' },
  VProgressCircular: { template: '<div class="v-progress-circular" />' },
  Transition: { template: '<slot />' },
}

function statusWith(covers: number, placeholders: number): ImportStatus {
  const games = [
    ...Array.from({ length: covers }, (_, i) => ({ id: `c${i}`, coverUrl: `http://x/${i}.jpg`, isEnriched: true })),
    ...Array.from({ length: placeholders }, (_, i) => ({ id: `p${i}`, coverUrl: null, isEnriched: false })),
  ]
  return { status: 'running', total: games.length, done: covers, games }
}

describe('GameListImportProgressModal', () => {
  it('ne rend rien quand open=false', () => {
    const wrapper = mount(GameListImportProgressModal, {
      props: { open: false, status: null },
      global: { stubs },
    })
    expect(wrapper.find('.ip-modal').exists()).toBe(false)
  })

  it('affiche un loader et seulement les jaquettes recuperees (pas de placeholder)', () => {
    const wrapper = mount(GameListImportProgressModal, {
      props: { open: true, status: statusWith(2, 3) },
      global: { stubs },
    })
    expect(wrapper.find('.ip-modal__loader').exists()).toBe(true)
    expect(wrapper.findAll('.ip-modal__cover')).toHaveLength(2)
    expect(wrapper.findAll('.ip-modal__cell')).toHaveLength(2)
  })

  it('plafonne le nombre de vignettes affichees (grosse biblio)', () => {
    const wrapper = mount(GameListImportProgressModal, {
      props: { open: true, status: statusWith(50, 0) },
      global: { stubs },
    })
    expect(wrapper.findAll('.ip-modal__cover')).toHaveLength(24)
  })

  it('le bouton arriere-plan emet background', async () => {
    const wrapper = mount(GameListImportProgressModal, {
      props: { open: true, status: statusWith(1, 0) },
      global: { stubs },
    })
    await wrapper.find('.ip-modal__bg-btn').trigger('click')
    expect(wrapper.emitted('background')).toBeTruthy()
  })

  it('Echap emet background (pas de fermeture : l\'import continue en fond)', async () => {
    const wrapper = mount(GameListImportProgressModal, {
      props: { open: true, status: statusWith(1, 0) },
      global: { stubs },
      attachTo: document.body,
    })
    await flushPromises()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('background')).toBeTruthy()
    wrapper.unmount()
  })
})
