// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import NavbarMobile from '~/components/navbar/NavbarMobile.vue'

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key.split('.').pop() ?? key,
}))

mockNuxtImport('useRoute', () => () => ({
  path: '/dashboard',
}))

const stubs = {
  NuxtLink: { template: '<a :href="to" v-bind="$attrs"><slot /></a>', props: ['to'] },
  VIcon: { template: '<span v-bind="$attrs"><slot /></span>' },
}

describe('NavbarMobile', () => {
  it('rend un <nav> avec aria-label', () => {
    const wrapper = mount(NavbarMobile, { global: { stubs } })
    const nav = wrapper.find('nav')
    expect(nav.exists()).toBe(true)
    expect(nav.attributes('aria-label')).toBeTruthy()
  })

  it('rend exactement 6 liens de navigation', () => {
    const wrapper = mount(NavbarMobile, { global: { stubs } })
    expect(wrapper.findAll('a')).toHaveLength(6)
  })

  it('marque le lien actif avec nm__item--active', () => {
    const wrapper = mount(NavbarMobile, { global: { stubs } })
    const activeLinks = wrapper.findAll('a.nm__item--active')
    expect(activeLinks).toHaveLength(1)
    expect(activeLinks[0].attributes('href')).toBe('/dashboard')
  })

  it('ajoute aria-current="page" uniquement sur le lien actif', () => {
    const wrapper = mount(NavbarMobile, { global: { stubs } })
    const withCurrent = wrapper.findAll('[aria-current="page"]')
    expect(withCurrent).toHaveLength(1)
    expect(withCurrent[0].attributes('href')).toBe('/dashboard')
  })

  it('les 5 liens inactifs n\'ont pas de aria-current', () => {
    const wrapper = mount(NavbarMobile, { global: { stubs } })
    const withoutCurrent = wrapper.findAll('a:not([aria-current])')
    expect(withoutCurrent).toHaveLength(5)
  })

  it('toutes les icônes sont masquées aux lecteurs d\'écran', () => {
    const wrapper = mount(NavbarMobile, { global: { stubs } })
    const icons = wrapper.findAll('.nm__icon')
    expect(icons.length).toBeGreaterThan(0)
    icons.forEach(icon => {
      expect(icon.attributes('aria-hidden')).toBe('true')
    })
  })

  it('chaque lien contient un label visible', () => {
    const wrapper = mount(NavbarMobile, { global: { stubs } })
    wrapper.findAll('.nm__label').forEach(label => {
      expect(label.text().trim()).not.toBe('')
    })
  })
})
