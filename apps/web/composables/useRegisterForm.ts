export function useRegisterForm() {
  const { t } = useI18n()
  const { register, isLoading, error } = useAuth()

  const username = ref('')
  const email = ref('')
  const password = ref('')
  const passwordConfirm = ref('')
  const form = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)

  const usernameRules = [
    (v: string) => !!v || t('auth.validation.usernameRequired'),
    (v: string) => v.length >= 3 || t('auth.validation.usernameMin'),
    (v: string) => v.length <= 30 || t('auth.validation.usernameMax'),
  ]

  const emailRules = [
    (v: string) => !!v || t('auth.validation.emailRequired'),
    (v: string) => /.+@.+\..+/.test(v) || t('auth.validation.emailInvalid'),
  ]

  const passwordRules = [
    (v: string) => !!v || t('auth.validation.passwordRequired'),
    (v: string) => v.length >= 8 || t('auth.validation.passwordMin'),
  ]

  const passwordConfirmRules = [
    (v: string) => !!v || t('auth.validation.confirmRequired'),
    (v: string) => v === password.value || t('auth.validation.passwordMismatch'),
  ]

  async function handleRegister() {
    const { valid } = await form.value!.validate()
    if (!valid) return
    try {
      await register(username.value, email.value, password.value)
    } catch {
      // L'erreur est déjà gérée dans useAuth et exposée via `error`
    }
  }

  return {
    username,
    email,
    password,
    passwordConfirm,
    form,
    usernameRules,
    emailRules,
    passwordRules,
    passwordConfirmRules,
    isLoading,
    error,
    handleRegister,
  }
}
