// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import { useProfil, AVATAR_MAX_BYTES } from '~/composables/useProfil'
import { useAuthStore } from '~/stores/auth'
import type { FavoritePlatform, SocialLinks } from '@nextquest/shared'

const fakeUser = {
  id: 'u-1',
  email: 'lo@test.fr',
  username: 'lo',
  displayName: null as string | null,
  avatarUrl: null as string | null,
  locale: 'fr' as const,
  bio: null as string | null,
  country: null as string | null,
  birthdate: null as string | null,
  favoritePlatform: null as FavoritePlatform | null,
  socialLinks: null as SocialLinks | null,
  visibility: 'public' as const,
  emailVerified: false,
  onboardingCompleted: false,
  createdAt: new Date().toISOString(),
}

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
  locale: { value: 'fr' },
}))

const mockUser = ref<typeof fakeUser | null>(null)
const fetchProfileMock = vi.fn()
const logoutMock = vi.fn()

mockNuxtImport('useAuth', () => () => ({
  user: mockUser,
  logout: logoutMock,
  fetchProfile: fetchProfileMock,
}))

const authFetchMock = vi.fn()
mockNuxtImport('useAuthFetch', () => () => ({
  authFetch: authFetchMock,
  apiBase: 'http://localhost:3000',
}))

function makeFile(opts: { type?: string; sizeBytes?: number } = {}) {
  const { type = 'image/png', sizeBytes = 100 } = opts
  return new File([new Uint8Array(sizeBytes)], 'avatar.png', { type })
}

describe('useProfil', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const store = useAuthStore()
    store.setAuth(fakeUser, 'jwt-test')
    mockUser.value = { ...fakeUser }
    fetchProfileMock.mockReset()
    logoutMock.mockReset().mockResolvedValue(undefined)
    authFetchMock.mockReset()
  })

  describe('avatarSrc', () => {
    it('est null quand avatarUrl est null (repli sur avatarInitial côté template)', () => {
      const { avatarSrc } = useProfil()
      expect(avatarSrc.value).toBeNull()
    })

    it('utilise avatarUrl quand elle est renseignée', () => {
      mockUser.value = { ...fakeUser, avatarUrl: 'https://cdn.example.com/a.png' }
      const { avatarSrc } = useProfil()
      expect(avatarSrc.value).toBe('https://cdn.example.com/a.png')
    })
  })

  describe('uploadAvatar', () => {
    it("refuse un fichier qui n'est pas une image", async () => {
      const { uploadAvatar, avatarError } = useProfil()
      await uploadAvatar(makeFile({ type: 'application/pdf' }))
      expect(avatarError.value).toBe('profil.avatar.invalidType')
      expect(authFetchMock).not.toHaveBeenCalled()
    })

    it('refuse un fichier de plus de 5 Mo', async () => {
      const { uploadAvatar, avatarError } = useProfil()
      await uploadAvatar(makeFile({ sizeBytes: AVATAR_MAX_BYTES + 1 }))
      expect(avatarError.value).toBe('profil.avatar.tooLarge')
      expect(authFetchMock).not.toHaveBeenCalled()
    })

    it('envoie un POST multipart et met à jour le store en cas de succès', async () => {
      const updated = { ...fakeUser, avatarUrl: 'https://cdn.example.com/new.png' }
      authFetchMock.mockResolvedValue(updated)
      const { uploadAvatar } = useProfil()
      await uploadAvatar(makeFile())

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me/avatar',
        expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
      )
      expect(useAuthStore().user).toEqual(updated)
    })

    it("affiche une erreur si l'upload échoue", async () => {
      authFetchMock.mockRejectedValue(new Error('network'))
      const { uploadAvatar, avatarError } = useProfil()
      await uploadAvatar(makeFile())
      expect(avatarError.value).toBe('profil.avatar.uploadError')
    })
  })

  describe('removeAvatar', () => {
    it('appelle DELETE et met à jour le store avec le profil renvoyé (avatar généré)', async () => {
      mockUser.value = { ...fakeUser, avatarUrl: 'https://cdn.example.com/a.png' }
      const updated = { ...fakeUser, avatarUrl: 'https://cdn.example.com/default.webp' }
      authFetchMock.mockResolvedValue(updated)
      const { removeAvatar } = useProfil()
      await removeAvatar()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me/avatar',
        expect.objectContaining({ method: 'DELETE' }),
      )
      expect(useAuthStore().user).toEqual(updated)
    })

    it('affiche une erreur si la suppression échoue', async () => {
      authFetchMock.mockRejectedValue(new Error('network'))
      const { removeAvatar, avatarError } = useProfil()
      await removeAvatar()
      expect(avatarError.value).toBe('profil.avatar.deleteError')
    })
  })

  describe('pays', () => {
    it('pré-remplit countryInput avec la valeur actuelle au démarrage de l\'édition', () => {
      mockUser.value = { ...fakeUser, country: 'FR' }
      const { startEditCountry, countryInput, isEditingCountry } = useProfil()
      startEditCountry()
      expect(countryInput.value).toBe('FR')
      expect(isEditingCountry.value).toBe(true)
    })

    it('appelle PATCH avec le nouveau pays et ferme l\'éditeur', async () => {
      const updated = { ...fakeUser, country: 'BE' }
      authFetchMock.mockResolvedValue(updated)
      const { startEditCountry, countryInput, saveCountry, isEditingCountry } = useProfil()
      startEditCountry()
      countryInput.value = 'BE'
      await saveCountry()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: { country: 'BE' } }),
      )
      expect(isEditingCountry.value).toBe(false)
    })

    it('envoie null quand le pays est vidé', async () => {
      authFetchMock.mockResolvedValue({ ...fakeUser, country: null })
      const { startEditCountry, countryInput, saveCountry } = useProfil()
      startEditCountry()
      countryInput.value = ''
      await saveCountry()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ body: { country: null } }),
      )
    })

    it("affiche une erreur si le PATCH échoue", async () => {
      authFetchMock.mockRejectedValue(new Error('network'))
      const { saveCountry, countryError } = useProfil()
      await saveCountry()
      expect(countryError.value).toBe('profil.countrySaveError')
    })
  })

  describe('date de naissance', () => {
    it('pré-remplit birthdateInput au démarrage de l\'édition', () => {
      mockUser.value = { ...fakeUser, birthdate: '1990-01-01' }
      const { startEditBirthdate, birthdateInput } = useProfil()
      startEditBirthdate()
      expect(birthdateInput.value).toBe('1990-01-01')
    })

    it('appelle PATCH avec la nouvelle date', async () => {
      const updated = { ...fakeUser, birthdate: '1995-05-05' }
      authFetchMock.mockResolvedValue(updated)
      const { startEditBirthdate, birthdateInput, saveBirthdate, isEditingBirthdate } = useProfil()
      startEditBirthdate()
      birthdateInput.value = '1995-05-05'
      await saveBirthdate()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: { birthdate: '1995-05-05' } }),
      )
      expect(isEditingBirthdate.value).toBe(false)
    })

    it('affiche une erreur si le PATCH échoue', async () => {
      authFetchMock.mockRejectedValue(new Error('network'))
      const { saveBirthdate, birthdateError } = useProfil()
      await saveBirthdate()
      expect(birthdateError.value).toBe('profil.birthdateSaveError')
    })
  })

  describe('plateforme favorite', () => {
    it("ne fait pas d'appel API si la plateforme est inchangée", async () => {
      mockUser.value = { ...fakeUser, favoritePlatform: 'pc' }
      const { saveFavoritePlatform, isEditingFavoritePlatform } = useProfil()
      isEditingFavoritePlatform.value = true
      await saveFavoritePlatform('pc')
      expect(authFetchMock).not.toHaveBeenCalled()
      expect(isEditingFavoritePlatform.value).toBe(false)
    })

    it('appelle PATCH avec la nouvelle plateforme', async () => {
      const updated = { ...fakeUser, favoritePlatform: 'playstation' as FavoritePlatform }
      authFetchMock.mockResolvedValue(updated)
      const { saveFavoritePlatform } = useProfil()
      await saveFavoritePlatform('playstation')

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: { favoritePlatform: 'playstation' } }),
      )
    })

    it('affiche une erreur si le PATCH échoue', async () => {
      authFetchMock.mockRejectedValue(new Error('network'))
      const { saveFavoritePlatform, favoritePlatformError } = useProfil()
      await saveFavoritePlatform('xbox')
      expect(favoritePlatformError.value).toBe('profil.favoritePlatformSaveError')
    })
  })

  describe('liens sociaux', () => {
    it('pré-remplit socialLinksInput avec les valeurs actuelles', () => {
      mockUser.value = { ...fakeUser, socialLinks: { twitch: 'https://twitch.tv/lo' } }
      const { startEditSocialLinks, socialLinksInput } = useProfil()
      startEditSocialLinks()
      expect(socialLinksInput.twitch).toBe('https://twitch.tv/lo')
      expect(socialLinksInput.youtube).toBe('')
    })

    it('filtre les champs vides et envoie uniquement les liens renseignés', async () => {
      authFetchMock.mockResolvedValue({ ...fakeUser, socialLinks: { twitch: 'https://twitch.tv/lo' } })
      const { startEditSocialLinks, socialLinksInput, saveSocialLinks } = useProfil()
      startEditSocialLinks()
      socialLinksInput.twitch = 'https://twitch.tv/lo'
      socialLinksInput.youtube = '  '
      await saveSocialLinks()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: { socialLinks: { twitch: 'https://twitch.tv/lo' } } }),
      )
    })

    it('envoie null quand tous les champs sont vides', async () => {
      authFetchMock.mockResolvedValue({ ...fakeUser, socialLinks: null })
      const { startEditSocialLinks, saveSocialLinks } = useProfil()
      startEditSocialLinks()
      await saveSocialLinks()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ body: { socialLinks: null } }),
      )
    })

    it('affiche une erreur si le PATCH échoue', async () => {
      authFetchMock.mockRejectedValue(new Error('network'))
      const { saveSocialLinks, socialLinksError } = useProfil()
      await saveSocialLinks()
      expect(socialLinksError.value).toBe('profil.socialLinksSaveError')
    })

    it('socialLinksList ne retient que les liens définis', () => {
      mockUser.value = {
        ...fakeUser,
        socialLinks: { twitch: 'https://twitch.tv/lo', discord: 'https://discord.gg/lo' },
      }
      const { socialLinksList } = useProfil()
      expect(socialLinksList.value).toEqual([
        { key: 'twitch', url: 'https://twitch.tv/lo' },
        { key: 'discord', url: 'https://discord.gg/lo' },
      ])
    })
  })
})
