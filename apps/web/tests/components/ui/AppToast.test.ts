// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AppToast from '~/components/ui/AppToast.vue'
import { useToast, __resetToasts } from '~/composables/useToast'

const stubs = {
  VIcon: { template: '<span v-bind="$attrs" />' },
}

describe('AppToast', () => {
  beforeEach(() => __resetToasts())

  it('affiche les toasts de la file', async () => {
    const { push } = useToast()
    push({ type: 'success', text: 'Jaquettes a jour', timeout: 0 })
    push({ type: 'error', text: 'Echec', timeout: 0 })
    const wrapper = mount(AppToast, { global: { stubs } })
    await flushPromises()
    expect(wrapper.findAll('.app-toast__item')).toHaveLength(2)
    expect(wrapper.text()).toContain('Jaquettes a jour')
  })

  it('un clic sur un toast le retire', async () => {
    const { push, toasts } = useToast()
    push({ type: 'info', text: 'coucou', timeout: 0 })
    const wrapper = mount(AppToast, { global: { stubs } })
    await wrapper.find('.app-toast__item').trigger('click')
    expect(toasts.value).toHaveLength(0)
  })
})
