// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PatchButton from '~/components/ui/PatchButton.vue'

describe('PatchButton', () => {
  it('rend un <button> natif pour la variante primary par défaut', () => {
    const wrapper = mount(PatchButton, {
      slots: { default: 'Connexion' },
    })

    const btn = wrapper.find('button.patch-btn')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('Connexion')
  })

  it('rend un <button> avec la classe patch-btn-back pour la variante back', () => {
    const wrapper = mount(PatchButton, {
      props: { variant: 'back' },
    })

    expect(wrapper.find('button.patch-btn-back').exists()).toBe(true)
    expect(wrapper.find('button.patch-btn').exists()).toBe(false)
  })

  it('émet un click au clic', async () => {
    const wrapper = mount(PatchButton, {
      slots: { default: 'OK' },
    })

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('désactive le bouton quand disabled=true', () => {
    const wrapper = mount(PatchButton, {
      props: { disabled: true },
    })

    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('applique la classe patch-block quand block=true', () => {
    const wrapper = mount(PatchButton, {
      props: { block: true },
    })

    expect(wrapper.find('button.patch-block').exists()).toBe(true)
  })
})
