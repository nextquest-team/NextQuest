// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import { useRegisterForm } from '~/composables/useRegisterForm'

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
}))

const registerMock = vi.fn()
const isLoadingRef = ref(false)
const errorRef = ref<string | null>(null)

mockNuxtImport('useAuth', () => () => ({
  register: registerMock,
  isLoading: isLoadingRef,
  error: errorRef,
}))

describe('useRegisterForm', () => {
  beforeEach(() => {
    registerMock.mockReset()
    isLoadingRef.value = false
    errorRef.value = null
  })

  it('expose des refs vides par défaut', () => {
    const { username, email, password, passwordConfirm } = useRegisterForm()
    expect(username.value).toBe('')
    expect(email.value).toBe('')
    expect(password.value).toBe('')
    expect(passwordConfirm.value).toBe('')
  })

  describe('usernameRules', () => {
    it('rejette un pseudo vide', () => {
      const { usernameRules } = useRegisterForm()
      expect(usernameRules[0]('')).not.toBe(true)
    })

    it('rejette un pseudo trop court', () => {
      const { usernameRules } = useRegisterForm()
      expect(usernameRules[1]('ab')).not.toBe(true)
    })

    it('rejette un pseudo trop long', () => {
      const { usernameRules } = useRegisterForm()
      expect(usernameRules[2]('a'.repeat(31))).not.toBe(true)
    })

    it('accepte un pseudo valide', () => {
      const { usernameRules } = useRegisterForm()
      expect(usernameRules[1]('lorelei')).toBe(true)
      expect(usernameRules[2]('lorelei')).toBe(true)
    })
  })

  describe('passwordConfirmRules', () => {
    it('rejette une confirmation vide', () => {
      const { passwordConfirmRules } = useRegisterForm()
      expect(passwordConfirmRules[0]('')).not.toBe(true)
    })

    it('rejette une confirmation différente du mot de passe', () => {
      const { password, passwordConfirmRules } = useRegisterForm()
      password.value = 'password123'
      expect(passwordConfirmRules[1]('autrepassword')).not.toBe(true)
    })

    it('accepte une confirmation identique au mot de passe', () => {
      const { password, passwordConfirmRules } = useRegisterForm()
      password.value = 'password123'
      expect(passwordConfirmRules[1]('password123')).toBe(true)
    })
  })

  describe('handleRegister', () => {
    it("n'appelle pas register si le formulaire est invalide", async () => {
      const { form, handleRegister } = useRegisterForm()
      form.value = { validate: vi.fn().mockResolvedValue({ valid: false }) }

      await handleRegister()

      expect(registerMock).not.toHaveBeenCalled()
    })

    it('appelle register avec username/email/password si le formulaire est valide', async () => {
      const { username, email, password, form, handleRegister } = useRegisterForm()
      username.value = 'lorelei'
      email.value = 'lo@test.fr'
      password.value = 'password123'
      form.value = { validate: vi.fn().mockResolvedValue({ valid: true }) }

      await handleRegister()

      expect(registerMock).toHaveBeenCalledWith('lorelei', 'lo@test.fr', 'password123')
    })

    it("n'expose pas d'exception si register rejette (déjà géré par useAuth)", async () => {
      registerMock.mockRejectedValue(new Error('409'))
      const { form, handleRegister } = useRegisterForm()
      form.value = { validate: vi.fn().mockResolvedValue({ valid: true }) }

      await expect(handleRegister()).resolves.toBeUndefined()
    })
  })
})
