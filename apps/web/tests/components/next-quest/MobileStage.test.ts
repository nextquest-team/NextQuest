// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import MobileStage from '~/components/next-quest/MobileStage.vue'

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key.split('.').pop() ?? key,
}))

mockNuxtImport('useState', () => (_key: string, init?: () => unknown) => {
  const { ref } = require('vue')
  return ref(init?.() ?? null)
})

mockNuxtImport('navigateTo', () => () => {})

const stubs = {
  VIcon: { template: '<span />' },
}

const defaultProps = {
  discovery: null,
  libraryUnplayed: null,
  upcoming: null,
  feedbackPending: null,
  generating: false,
}

describe('MobileStage', () => {
  // Quand reco=null, RecoCard affiche .nq-slot-empty — on vérifie 3 slots vides
  it('rend 3 zones de recommendation', () => {
    const wrapper = mount(MobileStage, { props: defaultProps, global: { stubs } })
    expect(wrapper.findAll('.nq-slot-empty')).toHaveLength(3)
  })

  it('chaque slot vide est dans .nq-cards', () => {
    const wrapper = mount(MobileStage, { props: defaultProps, global: { stubs } })
    const cards = wrapper.find('.nq-cards')
    expect(cards.exists()).toBe(true)
    expect(cards.findAll('.nq-slot-empty')).toHaveLength(3)
  })

  it('émet generate au clic sur le bouton régénérer', async () => {
    const wrapper = mount(MobileStage, { props: defaultProps, global: { stubs } })
    await wrapper.find('.patch-btn').trigger('click')
    expect(wrapper.emitted('generate')).toBeTruthy()
  })

  it('le bouton régénérer est désactivé si generating=true', () => {
    const wrapper = mount(MobileStage, {
      props: { ...defaultProps, generating: true },
      global: { stubs },
    })
    expect(wrapper.find('.patch-btn').attributes('disabled')).toBeDefined()
  })
})
