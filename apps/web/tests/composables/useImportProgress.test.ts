// @vitest-environment nuxt
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useImportProgress, __resetImportProgress } from '~/composables/useImportProgress'

const authFetchMock = vi.fn()
mockNuxtImport('useAuthFetch', () => () => ({
  authFetch: authFetchMock,
  apiBase: 'http://localhost:3000',
}))

const pushMock = vi.fn()
mockNuxtImport('useToast', () => () => ({
  push: pushMock,
  dismiss: vi.fn(),
  toasts: { value: [] },
}))

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key.split('.').pop() ?? key,
}))

describe('useImportProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    __resetImportProgress()
    authFetchMock.mockReset()
    pushMock.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('start ouvre la modale et poll le status', async () => {
    authFetchMock.mockResolvedValue({ status: 'running', total: 3, done: 1, games: [] })
    const { open, status, start } = useImportProgress()
    start()
    expect(open.value).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(authFetchMock).toHaveBeenCalledWith('http://localhost:3000/api/platforms/steam/import/status')
    expect(status.value?.done).toBe(1)
  })

  it('se ferme et appelle onDone quand status passe a done', async () => {
    authFetchMock
      .mockResolvedValueOnce({ status: 'running', total: 3, done: 1, games: [] })
      .mockResolvedValueOnce({ status: 'done', total: 3, done: 3, games: [] })
    const done = vi.fn()
    const { open, start, onDone } = useImportProgress()
    onDone(done)
    start()
    await vi.advanceTimersByTimeAsync(0)
    expect(open.value).toBe(true)
    await vi.advanceTimersByTimeAsync(500)
    expect(open.value).toBe(false)
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('stopBackground ferme la modale mais garde le polling', async () => {
    authFetchMock.mockResolvedValue({ status: 'running', total: 3, done: 1, games: [] })
    const { open, start, stopBackground } = useImportProgress()
    start()
    await vi.advanceTimersByTimeAsync(0)
    stopBackground()
    expect(open.value).toBe(false)
    authFetchMock.mockClear()
    await vi.advanceTimersByTimeAsync(500)
    expect(authFetchMock).toHaveBeenCalled()
  })
})
