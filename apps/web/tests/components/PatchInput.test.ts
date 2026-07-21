// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import PatchInput from '~/components/ui/PatchInput.vue'

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
}))

const vuetify = createVuetify({ components, directives })

const globalConfig = { global: { plugins: [vuetify] } }

describe('PatchInput', () => {
  it('affiche le label fourni', () => {
    const wrapper = mount(PatchInput, {
      props: { label: 'Adresse Mail', modelValue: '' },
      ...globalConfig,
    })

    expect(wrapper.find('.nq-label').text()).toBe('Adresse Mail')
  })

  it('émet update:modelValue à la saisie', async () => {
    const wrapper = mount(PatchInput, {
      props: { label: 'Email', modelValue: '' },
      ...globalConfig,
    })

    const input = wrapper.find('input')
    await input.setValue('lo@test.fr')

    const events = wrapper.emitted('update:modelValue')
    expect(events).toBeTruthy()
    expect(events![events!.length - 1]).toEqual(['lo@test.fr'])
  })

  it('utilise le type password quand type="password"', () => {
    const wrapper = mount(PatchInput, {
      props: { label: 'Mot de passe', modelValue: 'secret', type: 'password' },
      ...globalConfig,
    })

    expect(wrapper.find('input').attributes('type')).toBe('password')
  })

  it('affiche un message d\'erreur quand error est fourni', () => {
    const wrapper = mount(PatchInput, {
      props: {
        label: 'Email',
        modelValue: '',
        error: 'Email invalide',
      },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('Email invalide')
  })
})
