// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SocialButton from '~/components/ui/SocialButton.vue'

describe('SocialButton', () => {
  it('affiche le label "Continuer avec Google" pour le provider google', () => {
    const wrapper = mount(SocialButton, { props: { provider: 'google' } })
    expect(wrapper.text()).toContain('Continuer avec Google')
  })

  it('affiche le label "Continuer avec Microsoft" pour le provider microsoft', () => {
    const wrapper = mount(SocialButton, { props: { provider: 'microsoft' } })
    expect(wrapper.text()).toContain('Continuer avec Microsoft')
  })

  it('affiche le label "Continuer avec Apple" pour le provider apple', () => {
    const wrapper = mount(SocialButton, { props: { provider: 'apple' } })
    expect(wrapper.text()).toContain('Continuer avec Apple')
  })

  it('rend un SVG pour le logo', () => {
    const wrapper = mount(SocialButton, { props: { provider: 'google' } })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('applique la classe spécifique au provider', () => {
    const wrapper = mount(SocialButton, { props: { provider: 'apple' } })
    expect(wrapper.find('.social-btn--apple').exists()).toBe(true)
  })

  it('désactive le bouton quand disabled=true', () => {
    const wrapper = mount(SocialButton, { props: { provider: 'google', disabled: true } })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('désactive le bouton quand loading=true', () => {
    const wrapper = mount(SocialButton, { props: { provider: 'google', loading: true } })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('émet un click au clic', async () => {
    const wrapper = mount(SocialButton, { props: { provider: 'google' } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })
})
