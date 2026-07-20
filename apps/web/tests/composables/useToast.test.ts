// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useToast, __resetToasts } from '~/composables/useToast'

describe('useToast', () => {
  beforeEach(() => {
    __resetToasts()
    vi.useRealTimers()
  })

  it('push ajoute un toast a la file', () => {
    const { toasts, push } = useToast()
    push({ type: 'success', text: 'Ajoute', timeout: 0 })
    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0].text).toBe('Ajoute')
    expect(toasts.value[0].type).toBe('success')
  })

  it('dismiss retire le toast par son id', () => {
    const { toasts, push, dismiss } = useToast()
    const id = push({ type: 'error', text: 'Oups', timeout: 0 })
    dismiss(id)
    expect(toasts.value).toHaveLength(0)
  })

  it('partage la file entre deux appels (singleton module)', () => {
    const a = useToast()
    const b = useToast()
    a.push({ type: 'info', text: 'x', timeout: 0 })
    expect(b.toasts.value).toHaveLength(1)
  })

  it('auto-dismiss apres le timeout', () => {
    vi.useFakeTimers()
    const { toasts, push } = useToast()
    push({ type: 'success', text: 'temporaire', timeout: 1000 })
    expect(toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(toasts.value).toHaveLength(0)
  })
})
