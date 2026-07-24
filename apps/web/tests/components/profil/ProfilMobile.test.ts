// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import ProfilMobile from '~/components/profil/ProfilMobile.vue'
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
  t: (key: string) => key.split('.').pop() ?? key,
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

const stubs = {
  NuxtLink: { template: '<a :href="to" v-bind="$attrs"><slot /></a>', props: ['to'] },
  VIcon: { template: '<span v-bind="$attrs"><slot /></span>' },
  VProgressCircular: { template: '<span v-bind="$attrs"><slot /></span>' },
  ClientOnly: { template: '<slot />' },
  UiPageHeader: { template: '<div><slot /></div>' },
  UiBackButton: { template: '<button v-bind="$attrs"><slot /></button>', props: ['to'] },
}

describe('ProfilMobile', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const store = useAuthStore()
    store.setAuth(fakeUser, 'jwt-test')
    mockUser.value = { ...fakeUser }
    fetchProfileMock.mockReset()
    logoutMock.mockReset().mockResolvedValue(undefined)
    authFetchMock.mockReset()
  })

  it('appelle fetchProfile au montage', async () => {
    mount(ProfilMobile, { global: { stubs } })
    await flushPromises()
    expect(fetchProfileMock).toHaveBeenCalledOnce()
  })

  it('affiche le username quand displayName est null', () => {
    const wrapper = mount(ProfilMobile, { global: { stubs } })
    expect(wrapper.find('h2.pm__name').text()).toBe('lo')
  })

  it('affiche le displayName quand renseigné', () => {
    mockUser.value = { ...fakeUser, displayName: 'Lorelei' }
    const wrapper = mount(ProfilMobile, { global: { stubs } })
    expect(wrapper.find('h2.pm__name').text()).toBe('Lorelei')
  })

  it('affiche @username quand displayName est défini', () => {
    mockUser.value = { ...fakeUser, displayName: 'Lorelei' }
    const wrapper = mount(ProfilMobile, { global: { stubs } })
    expect(wrapper.find('.pm__username').text()).toBe('@lo')
  })

  it("génère un avatar DiceBear quand avatarUrl est null", () => {
    const wrapper = mount(ProfilMobile, { global: { stubs } })
    const src = wrapper.find('.pm__avatar-img').attributes('src')
    expect(src).toContain('dicebear.com')
  })

  it('utilise avatarUrl quand elle est renseignée', () => {
    mockUser.value = { ...fakeUser, avatarUrl: 'https://cdn.example.com/a.png' }
    const wrapper = mount(ProfilMobile, { global: { stubs } })
    expect(wrapper.find('.pm__avatar-img').attributes('src')).toBe('https://cdn.example.com/a.png')
  })

  describe('édition de bio', () => {
    it('ouvre le textarea au clic sur édition', async () => {
      const wrapper = mount(ProfilMobile, { global: { stubs } })
      expect(wrapper.find('textarea.pm__bio-textarea').exists()).toBe(false)
      await wrapper.find('.pm__section-header .pm__edit-btn').trigger('click')
      expect(wrapper.find('textarea.pm__bio-textarea').exists()).toBe(true)
    })

    it("ferme l'éditeur au clic sur Annuler", async () => {
      const wrapper = mount(ProfilMobile, { global: { stubs } })
      await wrapper.find('.pm__section-header .pm__edit-btn').trigger('click')
      await wrapper.find('.pm__action-btn--cancel').trigger('click')
      expect(wrapper.find('textarea.pm__bio-textarea').exists()).toBe(false)
    })

    it('désactive le bouton Enregistrer si bio > 500 chars', async () => {
      const wrapper = mount(ProfilMobile, { global: { stubs } })
      await wrapper.find('.pm__section-header .pm__edit-btn').trigger('click')
      await wrapper.find('textarea.pm__bio-textarea').setValue('a'.repeat(501))
      expect(wrapper.find('.pm__action-btn--save').attributes('disabled')).toBeDefined()
    })

    it('appelle PATCH bio et ferme si succès', async () => {
      authFetchMock.mockResolvedValue({ bio: 'Nouvelle bio' })
      const wrapper = mount(ProfilMobile, { global: { stubs } })
      await wrapper.find('.pm__section-header .pm__edit-btn').trigger('click')
      await wrapper.find('textarea.pm__bio-textarea').setValue('Nouvelle bio')
      await wrapper.find('.pm__action-btn--save').trigger('click')
      await flushPromises()
      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: { bio: 'Nouvelle bio' } }),
      )
      expect(wrapper.find('textarea.pm__bio-textarea').exists()).toBe(false)
    })

    it("affiche une erreur si PATCH échoue", async () => {
      authFetchMock.mockRejectedValue(new Error('network'))
      const wrapper = mount(ProfilMobile, { global: { stubs } })
      await wrapper.find('.pm__section-header .pm__edit-btn').trigger('click')
      await wrapper.find('.pm__action-btn--save').trigger('click')
      await flushPromises()
      expect(wrapper.find('.pm__error').exists()).toBe(true)
    })
  })

  describe('visibilité', () => {
    it('ouvre les 3 options de visibilité', async () => {
      const wrapper = mount(ProfilMobile, { global: { stubs } })
      expect(wrapper.findAll('.pm__visibility-opt')).toHaveLength(0)
      await wrapper.find('.pm__info-row--visibility .pm__edit-btn').trigger('click')
      expect(wrapper.findAll('.pm__visibility-opt')).toHaveLength(3)
    })

    it('appelle PATCH avec la nouvelle visibilité', async () => {
      authFetchMock.mockResolvedValue({})
      const wrapper = mount(ProfilMobile, { global: { stubs } })
      await wrapper.find('.pm__info-row--visibility .pm__edit-btn').trigger('click')
      await wrapper.findAll('.pm__visibility-opt')[0].trigger('click')
      await flushPromises()
      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: { visibility: 'private' } }),
      )
    })
  })

  it('appelle logout() au clic sur Déconnexion', async () => {
    const wrapper = mount(ProfilMobile, { global: { stubs } })
    await wrapper.find('.pm__logout').trigger('click')
    await flushPromises()
    expect(logoutMock).toHaveBeenCalledOnce()
  })

  describe('avatar', () => {
    it('affiche le bouton de suppression uniquement si avatarUrl est renseignée', () => {
      const wrapper = mount(ProfilMobile, { global: { stubs } })
      expect(wrapper.find('.pm__avatar-remove-btn').exists()).toBe(false)
    })

    it('envoie un POST multipart quand un fichier est sélectionné', async () => {
      authFetchMock.mockResolvedValue({ ...fakeUser, avatarUrl: 'https://cdn.example.com/new.png' })
      const wrapper = mount(ProfilMobile, { global: { stubs } })
      const file = new File([new Uint8Array(10)], 'avatar.png', { type: 'image/png' })
      const input = wrapper.find('.pm__avatar-input').element as HTMLInputElement
      Object.defineProperty(input, 'files', { value: [file] })
      await wrapper.find('.pm__avatar-input').trigger('change')
      await flushPromises()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me/avatar',
        expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
      )
    })

    it('appelle DELETE au clic sur le bouton de suppression', async () => {
      mockUser.value = { ...fakeUser, avatarUrl: 'https://cdn.example.com/a.png' }
      authFetchMock.mockResolvedValue(undefined)
      const wrapper = mount(ProfilMobile, { global: { stubs } })
      await wrapper.find('.pm__avatar-remove-btn').trigger('click')
      await flushPromises()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me/avatar',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })

  describe('pays', () => {
    it('appelle PATCH avec le pays sélectionné', async () => {
      authFetchMock.mockResolvedValue({ ...fakeUser, country: 'BE' })
      const wrapper = mount(ProfilMobile, { global: { stubs } })
      await wrapper.findAll('.pm__info-row--visibility .pm__edit-btn')[1].trigger('click')
      await wrapper.find('.pm__info-row--visibility select').setValue('BE')
      await wrapper.find('.pm__info-row--visibility .pm__action-btn--save').trigger('click')
      await flushPromises()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: { country: 'BE' } }),
      )
    })
  })

  describe('date de naissance', () => {
    it('appelle PATCH avec la date saisie', async () => {
      authFetchMock.mockResolvedValue({ ...fakeUser, birthdate: '1990-01-01' })
      const wrapper = mount(ProfilMobile, { global: { stubs } })
      await wrapper.findAll('.pm__info-row--visibility .pm__edit-btn')[2].trigger('click')
      await wrapper.find('input[type="date"]').setValue('1990-01-01')
      await wrapper.find('.pm__info-row--visibility .pm__action-btn--save').trigger('click')
      await flushPromises()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: { birthdate: '1990-01-01' } }),
      )
    })
  })

  describe('plateforme favorite', () => {
    it('appelle PATCH avec la plateforme choisie', async () => {
      authFetchMock.mockResolvedValue({ ...fakeUser, favoritePlatform: 'pc' })
      const wrapper = mount(ProfilMobile, { global: { stubs } })
      await wrapper.findAll('.pm__info-row--visibility .pm__edit-btn')[3].trigger('click')
      await wrapper.findAll('.pm__info-row--visibility .pm__visibility-opt')[0].trigger('click')
      await flushPromises()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: { favoritePlatform: 'pc' } }),
      )
    })
  })

  describe('réseaux sociaux', () => {
    it('affiche les liens quand ils sont renseignés', () => {
      mockUser.value = { ...fakeUser, socialLinks: { twitch: 'https://twitch.tv/lo' } }
      const wrapper = mount(ProfilMobile, { global: { stubs } })
      expect(wrapper.find('.pm__social-link').attributes('href')).toBe('https://twitch.tv/lo')
    })

    it('appelle PATCH avec les liens saisis', async () => {
      authFetchMock.mockResolvedValue({ ...fakeUser, socialLinks: { twitch: 'https://twitch.tv/lo' } })
      const wrapper = mount(ProfilMobile, { global: { stubs } })
      const socialSection = wrapper.findAll('.pm__section')[1]
      await socialSection.find('.pm__section-header .pm__edit-btn').trigger('click')
      await wrapper.find('.pm__social-field input').setValue('https://twitch.tv/lo')
      await socialSection.find('.pm__action-btn--save').trigger('click')
      await flushPromises()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: { socialLinks: { twitch: 'https://twitch.tv/lo' } } }),
      )
    })
  })
})
