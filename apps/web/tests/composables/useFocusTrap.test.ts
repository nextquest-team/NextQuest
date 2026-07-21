// @vitest-environment nuxt
import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useFocusTrap } from '~/composables/useFocusTrap'

// Petit composant hote : trois boutons focusables dans un conteneur monte/
// demonte selon `open`, comme le ferait une modale reelle (v-if sur la boite).
function makeHarness(onEscape: () => void) {
  return defineComponent({
    props: { open: { type: Boolean, default: false } },
    setup(props) {
      const box = ref<HTMLElement | null>(null)
      useFocusTrap(box, () => props.open, onEscape)
      return () =>
        props.open
          ? h('div', { ref: box }, [
              h('button', { class: 'first' }, 'first'),
              h('button', { class: 'middle' }, 'middle'),
              h('button', { class: 'last' }, 'last'),
            ])
          : null
    },
  })
}

function pressKey(key: string, shiftKey = false) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }))
}

describe('useFocusTrap', () => {
  it('pose le focus sur le premier element focusable a l\'ouverture', async () => {
    const wrapper = mount(makeHarness(() => {}), { props: { open: true }, attachTo: document.body })
    await flushPromises()
    expect((document.activeElement as HTMLElement)?.className).toBe('first')
    wrapper.unmount()
  })

  it('Tab depuis le dernier element revient au premier (boucle)', async () => {
    const wrapper = mount(makeHarness(() => {}), { props: { open: true }, attachTo: document.body })
    await flushPromises()
    ;(wrapper.find('.last').element as HTMLElement).focus()
    pressKey('Tab')
    expect((document.activeElement as HTMLElement)?.className).toBe('first')
    wrapper.unmount()
  })

  it('Shift+Tab depuis le premier element va au dernier (boucle inverse)', async () => {
    const wrapper = mount(makeHarness(() => {}), { props: { open: true }, attachTo: document.body })
    await flushPromises()
    ;(wrapper.find('.first').element as HTMLElement).focus()
    pressKey('Tab', true)
    expect((document.activeElement as HTMLElement)?.className).toBe('last')
    wrapper.unmount()
  })

  it('Echap declenche le callback fourni', async () => {
    const onEscape = vi.fn()
    const wrapper = mount(makeHarness(onEscape), { props: { open: true }, attachTo: document.body })
    await flushPromises()
    pressKey('Escape')
    expect(onEscape).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('restaure le focus sur l\'element precedent a la fermeture', async () => {
    const outsideBtn = document.createElement('button')
    document.body.appendChild(outsideBtn)
    outsideBtn.focus()

    const wrapper = mount(makeHarness(() => {}), { props: { open: false }, attachTo: document.body })
    await wrapper.setProps({ open: true })
    await flushPromises()
    await wrapper.setProps({ open: false })
    await flushPromises()

    expect(document.activeElement).toBe(outsideBtn)
    wrapper.unmount()
    outsideBtn.remove()
  })
})
