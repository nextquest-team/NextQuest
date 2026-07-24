// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import ProfilDesktop from '~/components/profil/ProfilDesktop.vue'
import { useAuthStore } from '~/stores/auth'
import type { FavoritePlatform, SocialLinks } from '@nextquest/shared'

// ──────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────
// Mocks Nuxt auto-imports
// ──────────────────────────────────────────────────────────
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

// useAuthFetch remplace $fetch direct dans useProfil.ts
const authFetchMock = vi.fn()

mockNuxtImport('useAuthFetch', () => () => ({
  authFetch: authFetchMock,
  apiBase: 'http://localhost:3000',
}))

// ──────────────────────────────────────────────────────────
// Stubs composants Nuxt / Vuetify
// ──────────────────────────────────────────────────────────
const stubs = {
  NuxtLink: { template: '<a :href="to" v-bind="$attrs"><slot /></a>', props: ['to'] },
  VIcon: { template: '<span v-bind="$attrs"><slot /></span>' },
  VProgressCircular: { template: '<span v-bind="$attrs"><slot /></span>' },
  ClientOnly: { template: '<slot />' },
  UiPageHeader: { template: '<div><slot /></div>' },
  UiBackButton: { template: '<button v-bind="$attrs"><slot /></button>', props: ['to'] },
}

// ──────────────────────────────────────────────────────────
// Suite
// ──────────────────────────────────────────────────────────
describe('ProfilDesktop', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const store = useAuthStore()
    store.setAuth(fakeUser, 'jwt-test')
    mockUser.value = { ...fakeUser }
    fetchProfileMock.mockReset()
    logoutMock.mockReset().mockResolvedValue(undefined)
    authFetchMock.mockReset()
  })

  // ── Montage ────────────────────────────────────────────
  it('appelle fetchProfile au montage', async () => {
    mount(ProfilDesktop, { global: { stubs } })
    await flushPromises()
    expect(fetchProfileMock).toHaveBeenCalledOnce()
  })

  // ── Affichage identité ──────────────────────────────────
  it('affiche le username quand displayName est null', async () => {
    const wrapper = mount(ProfilDesktop, { global: { stubs } })
    expect(wrapper.find('h2.pd__name').text()).toBe('lo')
  })

  it('affiche le displayName et le @username quand displayName est défini', async () => {
    mockUser.value = { ...fakeUser, displayName: 'Lorelei' }
    const wrapper = mount(ProfilDesktop, { global: { stubs } })
    expect(wrapper.find('h2.pd__name').text()).toBe('Lorelei')
    expect(wrapper.find('.pd__username').text()).toBe('@lo')
  })

  // ── Avatar ─────────────────────────────────────────────
  it('génère un avatar DiceBear quand avatarUrl est null', () => {
    const wrapper = mount(ProfilDesktop, { global: { stubs } })
    const src = wrapper.find('.pd__avatar-img').attributes('src')
    expect(src).toContain('dicebear.com')
    expect(src).toContain('lo')
  })

  it('utilise avatarUrl quand elle est renseignée', () => {
    mockUser.value = { ...fakeUser, avatarUrl: 'https://cdn.example.com/avatar.png' }
    const wrapper = mount(ProfilDesktop, { global: { stubs } })
    expect(wrapper.find('.pd__avatar-img').attributes('src')).toBe('https://cdn.example.com/avatar.png')
  })

  // ── Édition de bio ─────────────────────────────────────
  describe('édition de bio', () => {
    it('ouvre le textarea au clic sur le bouton édition', async () => {
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      expect(wrapper.find('textarea.pd__bio-textarea').exists()).toBe(false)
      await wrapper.find('.pd__section-header .pd__edit-btn').trigger('click')
      expect(wrapper.find('textarea.pd__bio-textarea').exists()).toBe(true)
    })

    it("ferme l'éditeur au clic sur Annuler", async () => {
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      await wrapper.find('.pd__section-header .pd__edit-btn').trigger('click')
      await wrapper.find('.pd__action-btn--cancel').trigger('click')
      expect(wrapper.find('textarea.pd__bio-textarea').exists()).toBe(false)
    })

    it('affiche le compteur format longueur/500', async () => {
      mockUser.value = { ...fakeUser, bio: 'Hello !' }
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      await wrapper.find('.pd__section-header .pd__edit-btn').trigger('click')
      expect(wrapper.find('.pd__bio-count').text()).toContain('/500')
    })

    it("appelle PATCH /api/users/me et ferme l'éditeur si succès", async () => {
      authFetchMock.mockResolvedValue({ bio: 'Nouvelle bio' })
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      await wrapper.find('.pd__section-header .pd__edit-btn').trigger('click')
      await wrapper.find('textarea.pd__bio-textarea').setValue('Nouvelle bio')
      await wrapper.find('.pd__action-btn--save').trigger('click')
      await flushPromises()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: { bio: 'Nouvelle bio' } }),
      )
      expect(wrapper.find('textarea.pd__bio-textarea').exists()).toBe(false)
    })

    it("affiche un message d'erreur si PATCH échoue", async () => {
      authFetchMock.mockRejectedValue(new Error('network'))
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      await wrapper.find('.pd__section-header .pd__edit-btn').trigger('click')
      await wrapper.find('.pd__action-btn--save').trigger('click')
      await flushPromises()

      expect(wrapper.find('.pd__error').exists()).toBe(true)
      expect(wrapper.find('textarea.pd__bio-textarea').exists()).toBe(true)
    })

    it('désactive le bouton Enregistrer quand la bio dépasse 500 caractères', async () => {
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      await wrapper.find('.pd__section-header .pd__edit-btn').trigger('click')
      await wrapper.find('textarea.pd__bio-textarea').setValue('a'.repeat(501))
      expect(wrapper.find('.pd__action-btn--save').attributes('disabled')).toBeDefined()
    })

    it('accepte une bio de exactement 500 caractères et envoie le PATCH', async () => {
      authFetchMock.mockResolvedValue({ bio: 'a'.repeat(500) })
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      await wrapper.find('.pd__section-header .pd__edit-btn').trigger('click')
      await wrapper.find('textarea.pd__bio-textarea').setValue('a'.repeat(500))

      expect(wrapper.find('.pd__action-btn--save').attributes('disabled')).toBeUndefined()

      await wrapper.find('.pd__action-btn--save').trigger('click')
      await flushPromises()
      expect(authFetchMock).toHaveBeenCalled()
    })

    it('envoie null si la textarea est vide', async () => {
      authFetchMock.mockResolvedValue({ bio: null })
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      await wrapper.find('.pd__section-header .pd__edit-btn').trigger('click')
      await wrapper.find('textarea.pd__bio-textarea').setValue('')
      await wrapper.find('.pd__action-btn--save').trigger('click')
      await flushPromises()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ body: { bio: null } }),
      )
    })
  })

  // ── Visibilité ─────────────────────────────────────────
  describe('visibilité', () => {
    it('ouvre les 3 options de visibilité au clic sur le bouton édition', async () => {
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      expect(wrapper.findAll('.pd__visibility-opt')).toHaveLength(0)
      await wrapper.find('.pd__info-row--visibility .pd__edit-btn').trigger('click')
      expect(wrapper.findAll('.pd__visibility-opt')).toHaveLength(3)
    })

    it('appelle PATCH avec la nouvelle visibilité (private)', async () => {
      authFetchMock.mockResolvedValue({})
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      await wrapper.find('.pd__info-row--visibility .pd__edit-btn').trigger('click')
      await wrapper.findAll('.pd__visibility-opt')[0].trigger('click')
      await flushPromises()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: { visibility: 'private' } }),
      )
    })

    it("ne fait pas d'appel API si la visibilité est inchangée (public → public)", async () => {
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      await wrapper.find('.pd__info-row--visibility .pd__edit-btn').trigger('click')
      await wrapper.findAll('.pd__visibility-opt')[2].trigger('click')
      await flushPromises()

      expect(authFetchMock).not.toHaveBeenCalled()
    })

    it('affiche une erreur si PATCH visibilité échoue', async () => {
      authFetchMock.mockRejectedValue(new Error('network'))
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      await wrapper.find('.pd__info-row--visibility .pd__edit-btn').trigger('click')
      await wrapper.findAll('.pd__visibility-opt')[0].trigger('click')
      await flushPromises()

      expect(wrapper.find('.pd__error').exists()).toBe(true)
    })

    it('ferme le sélecteur sans appel API quand on clique sur la valeur identique', async () => {
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      await wrapper.find('.pd__info-row--visibility .pd__edit-btn').trigger('click')
      await wrapper.findAll('.pd__visibility-opt')[2].trigger('click')
      await flushPromises()

      expect(wrapper.findAll('.pd__visibility-opt')).toHaveLength(0)
    })
  })

  // ── Déconnexion ────────────────────────────────────────
  it('appelle logout() au clic sur le bouton Déconnexion', async () => {
    const wrapper = mount(ProfilDesktop, { global: { stubs } })
    await wrapper.find('.pd__logout').trigger('click')
    await flushPromises()
    expect(logoutMock).toHaveBeenCalledOnce()
  })

  // ── Avatar : upload / suppression ──────────────────────
  describe('avatar', () => {
    it("n'affiche pas le bouton de suppression si avatarUrl est null", () => {
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      expect(wrapper.find('.pd__avatar-remove-btn').exists()).toBe(false)
    })

    it('affiche le bouton de suppression si avatarUrl est renseignée', () => {
      mockUser.value = { ...fakeUser, avatarUrl: 'https://cdn.example.com/a.png' }
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      expect(wrapper.find('.pd__avatar-remove-btn').exists()).toBe(true)
    })

    it('envoie un POST multipart quand un fichier est sélectionné', async () => {
      authFetchMock.mockResolvedValue({ ...fakeUser, avatarUrl: 'https://cdn.example.com/new.png' })
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      const file = new File([new Uint8Array(10)], 'avatar.png', { type: 'image/png' })
      const input = wrapper.find('.pd__avatar-input').element as HTMLInputElement
      Object.defineProperty(input, 'files', { value: [file] })
      await wrapper.find('.pd__avatar-input').trigger('change')
      await flushPromises()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me/avatar',
        expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
      )
    })

    it('appelle DELETE au clic sur le bouton de suppression', async () => {
      mockUser.value = { ...fakeUser, avatarUrl: 'https://cdn.example.com/a.png' }
      authFetchMock.mockResolvedValue(undefined)
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      await wrapper.find('.pd__avatar-remove-btn').trigger('click')
      await flushPromises()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me/avatar',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })

    it("affiche une erreur si l'upload échoue", async () => {
      authFetchMock.mockRejectedValue(new Error('network'))
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      const file = new File([new Uint8Array(10)], 'avatar.png', { type: 'image/png' })
      const input = wrapper.find('.pd__avatar-input').element as HTMLInputElement
      Object.defineProperty(input, 'files', { value: [file] })
      await wrapper.find('.pd__avatar-input').trigger('change')
      await flushPromises()

      expect(wrapper.find('.pd__error').exists()).toBe(true)
    })
  })

  // ── Pays ────────────────────────────────────────────────
  describe('pays', () => {
    it('ouvre le select au clic sur édition', async () => {
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      expect(wrapper.find('.pd__info-row--visibility select').exists()).toBe(false)
      await wrapper.findAll('.pd__info-row--visibility .pd__edit-btn')[1].trigger('click')
      expect(wrapper.find('.pd__info-row--visibility select').exists()).toBe(true)
    })

    it('appelle PATCH avec le pays sélectionné', async () => {
      authFetchMock.mockResolvedValue({ ...fakeUser, country: 'BE' })
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      await wrapper.findAll('.pd__info-row--visibility .pd__edit-btn')[1].trigger('click')
      await wrapper.find('.pd__info-row--visibility select').setValue('BE')
      await wrapper.find('.pd__info-row--visibility .pd__action-btn--save').trigger('click')
      await flushPromises()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: { country: 'BE' } }),
      )
    })
  })

  // ── Date de naissance ───────────────────────────────────
  describe('date de naissance', () => {
    it('ouvre le champ date au clic sur édition', async () => {
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      await wrapper.findAll('.pd__info-row--visibility .pd__edit-btn')[2].trigger('click')
      expect(wrapper.find('input[type="date"]').exists()).toBe(true)
    })

    it('appelle PATCH avec la date saisie', async () => {
      authFetchMock.mockResolvedValue({ ...fakeUser, birthdate: '1990-01-01' })
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      await wrapper.findAll('.pd__info-row--visibility .pd__edit-btn')[2].trigger('click')
      await wrapper.find('input[type="date"]').setValue('1990-01-01')
      await wrapper.find('.pd__info-row--visibility .pd__action-btn--save').trigger('click')
      await flushPromises()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: { birthdate: '1990-01-01' } }),
      )
    })
  })

  // ── Plateforme favorite ─────────────────────────────────
  describe('plateforme favorite', () => {
    it('ouvre le picker au clic sur édition', async () => {
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      await wrapper.findAll('.pd__info-row--visibility .pd__edit-btn')[3].trigger('click')
      expect(wrapper.findAll('.pd__info-row--visibility .pd__visibility-opt').length).toBeGreaterThan(0)
    })

    it('appelle PATCH avec la plateforme choisie', async () => {
      authFetchMock.mockResolvedValue({ ...fakeUser, favoritePlatform: 'pc' })
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      await wrapper.findAll('.pd__info-row--visibility .pd__edit-btn')[3].trigger('click')
      await wrapper.findAll('.pd__info-row--visibility .pd__visibility-opt')[0].trigger('click')
      await flushPromises()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: { favoritePlatform: 'pc' } }),
      )
    })
  })

  // ── Réseaux sociaux ─────────────────────────────────────
  describe('réseaux sociaux', () => {
    it("affiche l'état vide quand aucun lien n'est renseigné", () => {
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      expect(wrapper.find('.pd__social-list').exists()).toBe(false)
    })

    it('affiche les liens quand ils sont renseignés', () => {
      mockUser.value = { ...fakeUser, socialLinks: { twitch: 'https://twitch.tv/lo' } }
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      expect(wrapper.find('.pd__social-list').exists()).toBe(true)
      expect(wrapper.find('.pd__social-link').attributes('href')).toBe('https://twitch.tv/lo')
    })

    it('ouvre le formulaire au clic sur édition', async () => {
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      const socialSection = wrapper.findAll('.pd__section')[1]
      await socialSection.find('.pd__section-header .pd__edit-btn').trigger('click')
      expect(wrapper.find('.pd__social-form').exists()).toBe(true)
    })

    it('appelle PATCH avec les liens saisis', async () => {
      authFetchMock.mockResolvedValue({ ...fakeUser, socialLinks: { twitch: 'https://twitch.tv/lo' } })
      const wrapper = mount(ProfilDesktop, { global: { stubs } })
      const socialSection = wrapper.findAll('.pd__section')[1]
      await socialSection.find('.pd__section-header .pd__edit-btn').trigger('click')
      await wrapper.find('.pd__social-field input').setValue('https://twitch.tv/lo')
      await socialSection.find('.pd__action-btn--save').trigger('click')
      await flushPromises()

      expect(authFetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: { socialLinks: { twitch: 'https://twitch.tv/lo' } } }),
      )
    })
  })
})
