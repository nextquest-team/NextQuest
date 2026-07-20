export function useLoginForm() {
  const { t } = useI18n()
  const { login, loginWithOAuth, isLoading, error } = useAuth()

  const email = ref('')
  const password = ref('')
  const form = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)

  const emailRules = [
    (v: string) => !!v || t('auth.validation.emailRequired'),
    (v: string) => /.+@.+\..+/.test(v) || t('auth.validation.emailInvalid'),
  ]

  const passwordRules = [
    (v: string) => !!v || t('auth.validation.passwordRequired'),
    (v: string) => v.length >= 8 || t('auth.validation.passwordMin'),
  ]

  async function handleLogin() {
    const { valid } = await form.value!.validate()
    if (!valid) return
    try {
      await login(email.value, password.value)
    } catch {
      // L'erreur est déjà gérée dans useAuth et exposée via `error`
    }
  }

  return {
    email,
    password,
    form,
    emailRules,
    passwordRules,
    isLoading,
    error,
    loginWithOAuth,
    handleLogin,
  }
}
