import type { User, FavoritePlatform, SocialLinks } from '@nextquest/shared'

type Visibility = 'private' | 'friends_only' | 'public'

export const VISIBILITY_OPTIONS: Visibility[] = ['private', 'friends_only', 'public']
export const BIO_MAX = 500

export const FAVORITE_PLATFORMS: FavoritePlatform[] = ['pc', 'playstation', 'xbox', 'nintendo', 'mobile']

export const FAVORITE_PLATFORM_ICONS: Record<FavoritePlatform, string> = {
  pc: 'mdi-microsoft-windows',
  playstation: 'mdi-sony-playstation',
  xbox: 'mdi-microsoft-xbox',
  nintendo: 'mdi-nintendo-switch',
  mobile: 'mdi-cellphone',
}

// Pays proposés au profil (whitelist courte, pas de dépendance ISO-3166 complète
// pour une simple liste déroulante). Codes conformes à la validation Zod cote API.
export const COUNTRIES = [
  'FR', 'BE', 'CH', 'CA', 'LU', 'GB', 'DE', 'ES', 'IT', 'US',
] as const

export const SOCIAL_LINK_KEYS = ['twitch', 'youtube', 'discord', 'twitter', 'instagram'] as const
export type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number]

// mdi-discord n'existe plus dans @mdi/font depuis la 7.x (retrait de marque upstream) :
// le rendu Discord passe par un SVG dédié, voir components/profil/SocialLinkIcon.vue
export const SOCIAL_LINK_ICONS: Record<SocialLinkKey, string> = {
  twitch: 'mdi-twitch',
  youtube: 'mdi-youtube',
  discord: '',
  twitter: 'mdi-twitter',
  instagram: 'mdi-instagram',
}

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024

type SocialLinksForm = Record<(typeof SOCIAL_LINK_KEYS)[number], string>

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

  const isUploadingAvatar = ref(false)
  const avatarError = ref<string | null>(null)

  const isEditingCountry = ref(false)
  const countryInput = ref('')
  const isSavingCountry = ref(false)
  const countryError = ref<string | null>(null)

  const isEditingBirthdate = ref(false)
  const birthdateInput = ref('')
  const isSavingBirthdate = ref(false)
  const birthdateError = ref<string | null>(null)

  const isEditingFavoritePlatform = ref(false)
  const isSavingFavoritePlatform = ref(false)
  const favoritePlatformError = ref<string | null>(null)

  const isEditingSocialLinks = ref(false)
  const socialLinksInput = reactive<SocialLinksForm>({
    twitch: '', youtube: '', discord: '', twitter: '', instagram: '',
  })
  const isSavingSocialLinks = ref(false)
  const socialLinksError = ref<string | null>(null)

  // ── Computed ─────────────────────────────────────────────
  const avatarSrc = computed(() => user.value?.avatarUrl ?? null)

  const displayName = computed(() => user.value?.displayName ?? user.value?.username ?? '')

  // Avatar de repli : première lettre du prénom/pseudo, tant qu'aucune image n'est définie
  const avatarInitial = computed(() => (displayName.value || '?').trim().charAt(0).toUpperCase() || '?')

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

  const socialLinksList = computed(() => {
    const links = user.value?.socialLinks ?? {}
    return SOCIAL_LINK_KEYS
      .map((key) => ({ key, url: links[key] }))
      .filter((entry): entry is { key: typeof entry.key; url: string } => !!entry.url)
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

  // ── Avatar ────────────────────────────────────────────────
  async function uploadAvatar(file: File) {
    avatarError.value = null
    if (!file.type.startsWith('image/')) {
      avatarError.value = t('profil.avatar.invalidType')
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      avatarError.value = t('profil.avatar.tooLarge')
      return
    }
    isUploadingAvatar.value = true
    try {
      const formData = new FormData()
      formData.append('file', file)
      const updated = await authFetch<User>(`${apiBase}/api/users/me/avatar`, {
        method: 'POST',
        body: formData,
      })
      store.setAuth(updated, store.accessToken!)
    } catch {
      avatarError.value = t('profil.avatar.uploadError')
    } finally {
      isUploadingAvatar.value = false
    }
  }

  async function removeAvatar() {
    isUploadingAvatar.value = true
    avatarError.value = null
    try {
      const updated = await authFetch<User>(`${apiBase}/api/users/me/avatar`, { method: 'DELETE' })
      store.setAuth(updated, store.accessToken!)
    } catch {
      avatarError.value = t('profil.avatar.deleteError')
    } finally {
      isUploadingAvatar.value = false
    }
  }

  // ── Pays ──────────────────────────────────────────────────
  function startEditCountry() {
    countryInput.value = user.value?.country ?? ''
    countryError.value = null
    isEditingCountry.value = true
  }

  function cancelEditCountry() {
    isEditingCountry.value = false
    countryError.value = null
  }

  async function saveCountry() {
    isSavingCountry.value = true
    countryError.value = null
    try {
      const updated = await authFetch<User>(`${apiBase}/api/users/me`, {
        method: 'PATCH',
        body: { country: countryInput.value || null },
      })
      store.setAuth(updated, store.accessToken!)
      isEditingCountry.value = false
    } catch {
      countryError.value = t('profil.countrySaveError')
    } finally {
      isSavingCountry.value = false
    }
  }

  // ── Date de naissance ─────────────────────────────────────
  function startEditBirthdate() {
    birthdateInput.value = user.value?.birthdate ?? ''
    birthdateError.value = null
    isEditingBirthdate.value = true
  }

  function cancelEditBirthdate() {
    isEditingBirthdate.value = false
    birthdateError.value = null
  }

  async function saveBirthdate() {
    isSavingBirthdate.value = true
    birthdateError.value = null
    try {
      const updated = await authFetch<User>(`${apiBase}/api/users/me`, {
        method: 'PATCH',
        body: { birthdate: birthdateInput.value || null },
      })
      store.setAuth(updated, store.accessToken!)
      isEditingBirthdate.value = false
    } catch {
      birthdateError.value = t('profil.birthdateSaveError')
    } finally {
      isSavingBirthdate.value = false
    }
  }

  // ── Plateforme favorite ───────────────────────────────────
  async function saveFavoritePlatform(v: FavoritePlatform | null) {
    if (v === (user.value?.favoritePlatform ?? null)) { isEditingFavoritePlatform.value = false; return }
    isSavingFavoritePlatform.value = true
    favoritePlatformError.value = null
    try {
      const updated = await authFetch<User>(`${apiBase}/api/users/me`, {
        method: 'PATCH',
        body: { favoritePlatform: v },
      })
      store.setAuth(updated, store.accessToken!)
      isEditingFavoritePlatform.value = false
    } catch {
      favoritePlatformError.value = t('profil.favoritePlatformSaveError')
    } finally {
      isSavingFavoritePlatform.value = false
    }
  }

  // ── Liens sociaux ─────────────────────────────────────────
  function startEditSocialLinks() {
    const current = user.value?.socialLinks ?? {}
    for (const key of SOCIAL_LINK_KEYS) socialLinksInput[key] = current[key] ?? ''
    socialLinksError.value = null
    isEditingSocialLinks.value = true
  }

  function cancelEditSocialLinks() {
    isEditingSocialLinks.value = false
    socialLinksError.value = null
  }

  async function saveSocialLinks() {
    isSavingSocialLinks.value = true
    socialLinksError.value = null
    const entries = SOCIAL_LINK_KEYS
      .map((key) => [key, socialLinksInput[key].trim()] as const)
      .filter(([, value]) => value.length > 0)
    const payload: SocialLinks | null = entries.length > 0 ? Object.fromEntries(entries) : null
    try {
      const updated = await authFetch<User>(`${apiBase}/api/users/me`, {
        method: 'PATCH',
        body: { socialLinks: payload },
      })
      store.setAuth(updated, store.accessToken!)
      isEditingSocialLinks.value = false
    } catch {
      socialLinksError.value = t('profil.socialLinksSaveError')
    } finally {
      isSavingSocialLinks.value = false
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
    isUploadingAvatar, avatarError,
    isEditingCountry, countryInput, isSavingCountry, countryError,
    isEditingBirthdate, birthdateInput, isSavingBirthdate, birthdateError,
    isEditingFavoritePlatform, isSavingFavoritePlatform, favoritePlatformError,
    isEditingSocialLinks, socialLinksInput, isSavingSocialLinks, socialLinksError,
    // Computed
    avatarSrc, avatarInitial, displayName, memberSince, visibilityKey, socialLinksList,
    // Actions
    startEditBio, cancelEditBio, saveBio,
    saveVisibility,
    uploadAvatar, removeAvatar,
    startEditCountry, cancelEditCountry, saveCountry,
    startEditBirthdate, cancelEditBirthdate, saveBirthdate,
    saveFavoritePlatform,
    startEditSocialLinks, cancelEditSocialLinks, saveSocialLinks,
    handleLogout,
    init,
  }
}
