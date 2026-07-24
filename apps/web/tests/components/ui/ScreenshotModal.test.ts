// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import ScreenshotModal from '~/components/ui/ScreenshotModal.vue'

mockNuxtImport('useI18n', () => () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key.split('.').pop()}:${JSON.stringify(params)}` : (key.split('.').pop() ?? key),
}))

const stubs = {
  VIcon: { template: '<span v-bind="$attrs" />' },
  Transition: { template: '<slot />' },
}

const screenshots = ['http://x/1.jpg', 'http://x/2.jpg', 'http://x/3.jpg']

describe('ScreenshotModal', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it("n'affiche rien quand index est null", () => {
    const wrapper = mount(ScreenshotModal, { props: { screenshots, index: null, alt: 'jeu' }, global: { stubs } })
    expect(wrapper.find('.ssm__backdrop').exists()).toBe(false)
  })

  it("affiche l'image courante quand index est defini", () => {
    const wrapper = mount(ScreenshotModal, { props: { screenshots, index: 1, alt: 'jeu' }, global: { stubs } })
    expect(wrapper.find('.ssm__backdrop').exists()).toBe(true)
    expect(wrapper.find('.ssm__img').attributes('src')).toBe(screenshots[1])
  })

  it('les fleches prev/next ne sont pas affichees pour un seul screenshot', () => {
    const wrapper = mount(ScreenshotModal, { props: { screenshots: [screenshots[0]], index: 0, alt: 'jeu' }, global: { stubs } })
    expect(wrapper.find('.ssm__nav--prev').exists()).toBe(false)
    expect(wrapper.find('.ssm__nav--next').exists()).toBe(false)
    expect(wrapper.find('.ssm__counter').exists()).toBe(false)
  })

  it('next fait defiler vers le screenshot suivant avec bouclage', async () => {
    const wrapper = mount(ScreenshotModal, { props: { screenshots, index: 2, alt: 'jeu' }, global: { stubs } })
    await wrapper.find('.ssm__nav--next').trigger('click')
    expect(wrapper.emitted('update:index')?.[0]).toEqual([0])
  })

  it('prev fait defiler vers le screenshot precedent avec bouclage', async () => {
    const wrapper = mount(ScreenshotModal, { props: { screenshots, index: 0, alt: 'jeu' }, global: { stubs } })
    await wrapper.find('.ssm__nav--prev').trigger('click')
    expect(wrapper.emitted('update:index')?.[0]).toEqual([2])
  })

  it('les fleches du clavier naviguent aussi entre les screenshots', async () => {
    const wrapper = mount(ScreenshotModal, { props: { screenshots, index: 0, alt: 'jeu' }, global: { stubs } })
    await wrapper.find('.ssm__backdrop').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:index')?.[0]).toEqual([1])

    await wrapper.find('.ssm__backdrop').trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('update:index')?.[1]).toEqual([2])
  })

  it('le bouton fermer emet update:index avec null', async () => {
    const wrapper = mount(ScreenshotModal, { props: { screenshots, index: 1, alt: 'jeu' }, global: { stubs } })
    await wrapper.find('.ssm__close').trigger('click')
    expect(wrapper.emitted('update:index')?.[0]).toEqual([null])
  })

  it('le clic sur le backdrop (hors boite) ferme la modale', async () => {
    const wrapper = mount(ScreenshotModal, { props: { screenshots, index: 1, alt: 'jeu' }, global: { stubs } })
    await wrapper.find('.ssm__backdrop').trigger('click')
    expect(wrapper.emitted('update:index')?.[0]).toEqual([null])
  })

  it('Echap ferme la modale (focus trap)', async () => {
    const wrapper = mount(ScreenshotModal, { props: { screenshots, index: 1, alt: 'jeu' }, global: { stubs }, attachTo: document.body })
    await flushPromises()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('update:index')?.[0]).toEqual([null])
    wrapper.unmount()
  })
})
