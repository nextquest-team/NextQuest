// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import { useLoginForm } from '~/composables/useLoginForm'

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
}))

const loginMock = vi.fn()
const loginWithOAuthMock = vi.fn()
const isLoadingRef = ref(false)
const errorRef = ref<string | null>(null)

mockNuxtImport('useAuth', () => () => ({
  login: loginMock,
  loginWithOAuth: loginWithOAuthMock,
  isLoading: isLoadingRef,
  error: errorRef,
}))

describe('useLoginForm', () => {
  beforeEach(() => {
    loginMock.mockReset()
    loginWithOAuthMock.mockReset()
    isLoadingRef.value = false
    errorRef.value = null
  })

  it('expose les refs email/password vides par défaut', () => {
    const { email, password } = useLoginForm()
    expect(email.value).toBe('')
    expect(password.value).toBe('')
  })

  describe('emailRules', () => {
    it('rejette un email vide', () => {
      const { emailRules } = useLoginForm()
      expect(emailRules[0]('')).not.toBe(true)
    })

    it('rejette un email mal formé', () => {
      const { emailRules } = useLoginForm()
      expect(emailRules[1]('pas-un-email')).not.toBe(true)
    })

    it('accepte un email valide', () => {
      const { emailRules } = useLoginForm()
      expect(emailRules[0]('lo@test.fr')).toBe(true)
      expect(emailRules[1]('lo@test.fr')).toBe(true)
    })
  })

  describe('passwordRules', () => {
    it('rejette un mot de passe vide', () => {
      const { passwordRules } = useLoginForm()
      expect(passwordRules[0]('')).not.toBe(true)
    })

    it('rejette un mot de passe trop court', () => {
      const { passwordRules } = useLoginForm()
      expect(passwordRules[1]('short')).not.toBe(true)
    })

    it('accepte un mot de passe de 8 caractères ou plus', () => {
      const { passwordRules } = useLoginForm()
      expect(passwordRules[1]('password123')).toBe(true)
    })
  })

  describe('handleLogin', () => {
    it("n'appelle pas login si le formulaire est invalide", async () => {
      const { email, password, form, handleLogin } = useLoginForm()
      email.value = 'lo@test.fr'
      password.value = 'password123'
      form.value = { validate: vi.fn().mockResolvedValue({ valid: false }) }

      await handleLogin()

      expect(loginMock).not.toHaveBeenCalled()
    })

    it('appelle login avec email/password si le formulaire est valide', async () => {
      const { email, password, form, handleLogin } = useLoginForm()
      email.value = 'lo@test.fr'
      password.value = 'password123'
      form.value = { validate: vi.fn().mockResolvedValue({ valid: true }) }

      await handleLogin()

      expect(loginMock).toHaveBeenCalledWith('lo@test.fr', 'password123')
    })

    it("n'expose pas d'exception si login rejette (déjà géré par useAuth)", async () => {
      loginMock.mockRejectedValue(new Error('401'))
      const { form, handleLogin } = useLoginForm()
      form.value = { validate: vi.fn().mockResolvedValue({ valid: true }) }

      await expect(handleLogin()).resolves.toBeUndefined()
    })
  })
})
