type Visibility = 'private' | 'friends_only' | 'public'

export const VISIBILITY_OPTIONS: Visibility[] = ['private', 'friends_only', 'public']
export const BIO_MAX = 500

export function useProfil() {
  const { t, locale } = useI18n()
  const { user, logout, fetchProfile } = useAuth()
  const store = useAuthStore()
  const { authFetch, apiBase } = useAuthFetch()

  // ── État ─────────────────────────────────────────────────
  const isLoggingOut = ref(false)

  const isEditingBio = ref(false)
  const bioInput = ref('')
  const isSavingBio = ref(false)
  const bioError = ref<string | null>(null)

  const isEditingVisibility = ref(false)
  const isSavingVisibility = ref(false)
  const visibilityError = ref<string | null>(null)

  // ── Computed ─────────────────────────────────────────────
  const avatarSrc = computed(() => {
    if (user.value?.avatarUrl) return user.value.avatarUrl
    const seed = encodeURIComponent(user.value?.username ?? 'user')
    return `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&backgroundColor=5C3317&backgroundType=solid`
  })

  const displayName = computed(() => user.value?.displayName ?? user.value?.username ?? '')

  const memberSince = computed(() => {
    if (!user.value?.createdAt) return ''
    return new Date(user.value.createdAt).toLocaleDateString(locale.value, {
      year: 'numeric',
      month: 'long',
    })
  })

  const visibilityKey = computed(() => {
    const v = user.value?.visibility
    if (v === 'private') return 'profil.visibility.private'
    if (v === 'friends_only') return 'profil.visibility.friends_only'
    return 'profil.visibility.public'
  })

  // ── Bio ───────────────────────────────────────────────────
  function startEditBio() {
    bioInput.value = user.value?.bio ?? ''
    bioError.value = null
    isEditingBio.value = true
  }

  function cancelEditBio() {
    isEditingBio.value = false
    bioError.value = null
  }

  async function saveBio() {
    if (bioInput.value.length > BIO_MAX) return
    isSavingBio.value = true
    bioError.value = null
    try {
      const updated = await authFetch<{ bio: string | null }>(`${apiBase}/api/users/me`, {
        method: 'PATCH',
        body: { bio: bioInput.value || null },
      })
      if (user.value) {
        store.setAuth({ ...user.value, bio: updated.bio ?? null }, store.accessToken!)
      }
      isEditingBio.value = false
    } catch {
      bioError.value = t('profil.bioSaveError')
    } finally {
      isSavingBio.value = false
    }
  }

  // ── Visibilité ────────────────────────────────────────────
  async function saveVisibility(v: Visibility) {
    if (v === user.value?.visibility) { isEditingVisibility.value = false; return }
    isSavingVisibility.value = true
    visibilityError.value = null
    try {
      await authFetch(`${apiBase}/api/users/me`, {
        method: 'PATCH',
        body: { visibility: v },
      })
      if (user.value) {
        store.setAuth({ ...user.value, visibility: v }, store.accessToken!)
      }
      isEditingVisibility.value = false
    } catch {
      visibilityError.value = t('profil.visibilitySaveError')
    } finally {
      isSavingVisibility.value = false
    }
  }

  // ── Déconnexion ───────────────────────────────────────────
  async function handleLogout() {
    isLoggingOut.value = true
    await logout()
  }

  function init() {
    fetchProfile()
  }

  return {
    // Auth
    user,
    // État édition
    isLoggingOut,
    isEditingBio, bioInput, isSavingBio, bioError,
    isEditingVisibility, isSavingVisibility, visibilityError,
    // Computed
    avatarSrc, displayName, memberSince, visibilityKey,
    // Actions
    startEditBio, cancelEditBio, saveBio,
    saveVisibility,
    handleLogout,
    init,
  }
}
