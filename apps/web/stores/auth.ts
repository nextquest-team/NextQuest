import type { User } from '@nextquest/shared'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  // Access token stocké en mémoire uniquement (jamais en localStorage pour des raisons de sécurité)
  const accessToken = ref<string | null>(null)
  const isAuthenticated = computed(() => !!user.value)
  // Passe à true une fois que le plugin auth.client a tenté la restauration de session
  const initialized = ref(false)

  function setAuth(newUser: User, token: string) {
    user.value = newUser
    accessToken.value = token
  }

  function clearAuth() {
    user.value = null
    accessToken.value = null
  }

  function setInitialized() {
    initialized.value = true
  }

  return { user, accessToken, isAuthenticated, initialized, setAuth, clearAuth, setInitialized }
})
