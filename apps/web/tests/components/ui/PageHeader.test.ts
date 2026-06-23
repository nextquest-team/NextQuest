// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import PageHeader from '~/components/ui/PageHeader.vue'

describe('PageHeader', () => {
  it('monte sans erreur', () => {
    const wrapper = shallowMount(PageHeader)
    expect(wrapper.find('.ui-page-header').exists()).toBe(true)
  })

  it('rend le contenu du slot', () => {
    const wrapper = shallowMount(PageHeader, {
      slots: { default: '<h1 class="test-slot">Titre</h1>' },
    })
    expect(wrapper.find('.test-slot').text()).toBe('Titre')
  })

  it('transmet la prop to à UiBackButton', () => {
    const wrapper = shallowMount(PageHeader, { props: { to: '/home' } })
    // shallowMount génère un stub DOM avec les attributs passés au composant
    const stub = wrapper.find('[to="/home"]')
    expect(stub.exists()).toBe(true)
  })

  it('rend le wrapper .ui-page-header__content', () => {
    const wrapper = shallowMount(PageHeader)
    expect(wrapper.find('.ui-page-header__content').exists()).toBe(true)
  })
})
