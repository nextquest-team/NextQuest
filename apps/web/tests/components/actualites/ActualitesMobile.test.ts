// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import ActualitesMobile from '~/components/actualites/ActualitesMobile.vue'

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key.split('.').pop() ?? key,
}))

const stubs = {
  VIcon: { template: '<span v-bind="$attrs" />' },
  UiPageHeader: { template: '<div><slot /></div>' },
}

describe('ActualitesMobile', () => {
  it('affiche le titre depuis i18n', () => {
    const wrapper = mount(ActualitesMobile, { global: { stubs } })
    expect(wrapper.find('h1.am__title').exists()).toBe(true)
  })

  it('affiche le placeholder', () => {
    const wrapper = mount(ActualitesMobile, { global: { stubs } })
    expect(wrapper.find('.am__placeholder').exists()).toBe(true)
  })

  it('affiche le texte placeholder', () => {
    const wrapper = mount(ActualitesMobile, { global: { stubs } })
    expect(wrapper.find('.am__placeholder-text').exists()).toBe(true)
  })
})
