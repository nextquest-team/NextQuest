// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import ProfilPage from '~/pages/profil.vue'
import { useAuthStore } from '~/stores/auth'

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

// mockUser est un ref Vue : auto-unwrapped dans les templates.
// Sa valeur est mise à jour dans beforeEach pour isoler chaque test.
const mockUser = ref<typeof fakeUser | null>(null)
const fetchProfileMock = vi.fn()
const logoutMock = vi.fn()

mockNuxtImport('useAuth', () => () => ({
  user: mockUser,
  logout: logoutMock,
  fetchProfile: fetchProfileMock,
}))

// ──────────────────────────────────────────────────────────
// Mock $fetch (import explicite depuis 'ofetch' dans profil.vue)
// ──────────────────────────────────────────────────────────
const $fetchMock = vi.fn()
vi.mock('ofetch', () => ({
  $fetch: (...args: any[]) => $fetchMock(...args),
}))

// ──────────────────────────────────────────────────────────
// Stubs composants Nuxt / Vuetify
// ──────────────────────────────────────────────────────────
const stubs = {
  NuxtLink: { template: '<a :href="to" v-bind="$attrs"><slot /></a>', props: ['to'] },
  VIcon: { template: '<span v-bind="$attrs"><slot /></span>' },
  ClientOnly: { template: '<slot />' },
  UiBackButton: { template: '<button v-bind="$attrs"><slot /></button>', props: ['to'] },
}

// ──────────────────────────────────────────────────────────
// Suite
// ──────────────────────────────────────────────────────────
describe('ProfilPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const store = useAuthStore()
    store.setAuth(fakeUser, 'jwt-test')
    mockUser.value = { ...fakeUser }
    fetchProfileMock.mockReset()
    logoutMock.mockReset().mockResolvedValue(undefined)
    $fetchMock.mockReset()
  })

  // ── Montage ────────────────────────────────────────────
  it('appelle fetchProfile au montage', async () => {
    mount(ProfilPage, { global: { stubs } })
    await flushPromises()
    expect(fetchProfileMock).toHaveBeenCalledOnce()
  })

  // ── Affichage identité ──────────────────────────────────
  it('affiche le username quand displayName est null', async () => {
    const wrapper = mount(ProfilPage, { global: { stubs } })
    expect(wrapper.find('h1.profil__name').text()).toBe('lo')
  })

  it('affiche le displayName et le @username quand displayName est défini', async () => {
    mockUser.value = { ...fakeUser, displayName: 'Lorelei' }
    const wrapper = mount(ProfilPage, { global: { stubs } })
    expect(wrapper.find('h1.profil__name').text()).toBe('Lorelei')
    expect(wrapper.find('.profil__username').text()).toBe('@lo')
  })

  // ── Avatar ─────────────────────────────────────────────
  it('génère un avatar DiceBear quand avatarUrl est null', () => {
    const wrapper = mount(ProfilPage, { global: { stubs } })
    const src = wrapper.find('.profil__avatar-img').attributes('src')
    expect(src).toContain('dicebear.com')
    expect(src).toContain('lo') // seed = username encodé
  })

  it('utilise avatarUrl quand elle est renseignée', () => {
    mockUser.value = { ...fakeUser, avatarUrl: 'https://cdn.example.com/avatar.png' }
    const wrapper = mount(ProfilPage, { global: { stubs } })
    expect(wrapper.find('.profil__avatar-img').attributes('src')).toBe('https://cdn.example.com/avatar.png')
  })

  // ── Édition de bio ─────────────────────────────────────
  describe('édition de bio', () => {
    it('ouvre le textarea au clic sur le bouton édition', async () => {
      const wrapper = mount(ProfilPage, { global: { stubs } })
      expect(wrapper.find('textarea.profil__bio-textarea').exists()).toBe(false)
      await wrapper.find('.profil__section-header .profil__edit-btn').trigger('click')
      expect(wrapper.find('textarea.profil__bio-textarea').exists()).toBe(true)
    })

    it('ferme l\'éditeur au clic sur Annuler', async () => {
      const wrapper = mount(ProfilPage, { global: { stubs } })
      await wrapper.find('.profil__section-header .profil__edit-btn').trigger('click')
      await wrapper.find('.profil__action-btn--cancel').trigger('click')
      expect(wrapper.find('textarea.profil__bio-textarea').exists()).toBe(false)
    })

    it('affiche le compteur format longueur/500', async () => {
      mockUser.value = { ...fakeUser, bio: 'Hello !' }
      const wrapper = mount(ProfilPage, { global: { stubs } })
      await wrapper.find('.profil__section-header .profil__edit-btn').trigger('click')
      expect(wrapper.find('.profil__bio-count').text()).toContain('/500')
    })

    it('appelle PATCH /api/users/me et ferme l\'éditeur si succès', async () => {
      $fetchMock.mockResolvedValue({ bio: 'Nouvelle bio' })
      const wrapper = mount(ProfilPage, { global: { stubs } })
      await wrapper.find('.profil__section-header .profil__edit-btn').trigger('click')
      await wrapper.find('textarea.profil__bio-textarea').setValue('Nouvelle bio')
      await wrapper.find('.profil__action-btn--save').trigger('click')
      await flushPromises()

      expect($fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: { bio: 'Nouvelle bio' } }),
      )
      expect(wrapper.find('textarea.profil__bio-textarea').exists()).toBe(false)
    })

    it('affiche un message d\'erreur si PATCH échoue', async () => {
      $fetchMock.mockRejectedValue(new Error('network'))
      const wrapper = mount(ProfilPage, { global: { stubs } })
      await wrapper.find('.profil__section-header .profil__edit-btn').trigger('click')
      await wrapper.find('.profil__action-btn--save').trigger('click')
      await flushPromises()

      expect(wrapper.find('.profil__bio-error').exists()).toBe(true)
      expect(wrapper.find('textarea.profil__bio-textarea').exists()).toBe(true)
    })

    it('désactive le bouton Enregistrer quand la bio dépasse 500 caractères', async () => {
      const wrapper = mount(ProfilPage, { global: { stubs } })
      await wrapper.find('.profil__section-header .profil__edit-btn').trigger('click')
      await wrapper.find('textarea.profil__bio-textarea').setValue('a'.repeat(501))
      expect(wrapper.find('.profil__action-btn--save').attributes('disabled')).toBeDefined()
    })

    it('accepte une bio de exactement 500 caractères et envoie le PATCH', async () => {
      $fetchMock.mockResolvedValue({ bio: 'a'.repeat(500) })
      const wrapper = mount(ProfilPage, { global: { stubs } })
      await wrapper.find('.profil__section-header .profil__edit-btn').trigger('click')
      await wrapper.find('textarea.profil__bio-textarea').setValue('a'.repeat(500))

      // Bouton actif à la borne exacte
      expect(wrapper.find('.profil__action-btn--save').attributes('disabled')).toBeUndefined()

      await wrapper.find('.profil__action-btn--save').trigger('click')
      await flushPromises()
      expect($fetchMock).toHaveBeenCalled()
    })

    it('envoie null si la textarea est vide', async () => {
      $fetchMock.mockResolvedValue({ bio: null })
      const wrapper = mount(ProfilPage, { global: { stubs } })
      await wrapper.find('.profil__section-header .profil__edit-btn').trigger('click')
      await wrapper.find('textarea.profil__bio-textarea').setValue('')
      await wrapper.find('.profil__action-btn--save').trigger('click')
      await flushPromises()

      expect($fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ body: { bio: null } }),
      )
    })
  })

  // ── Visibilité ─────────────────────────────────────────
  describe('visibilité', () => {
    it('ouvre les 3 options de visibilité au clic sur le bouton édition', async () => {
      const wrapper = mount(ProfilPage, { global: { stubs } })
      expect(wrapper.findAll('.profil__visibility-opt')).toHaveLength(0)
      await wrapper.find('.profil__info-row--visibility .profil__edit-btn').trigger('click')
      expect(wrapper.findAll('.profil__visibility-opt')).toHaveLength(3)
    })

    it('appelle PATCH avec la nouvelle visibilité (private)', async () => {
      $fetchMock.mockResolvedValue({})
      const wrapper = mount(ProfilPage, { global: { stubs } })
      await wrapper.find('.profil__info-row--visibility .profil__edit-btn').trigger('click')
      // VISIBILITY_OPTIONS = ['private', 'friends_only', 'public'] → index 0 = 'private'
      await wrapper.findAll('.profil__visibility-opt')[0].trigger('click')
      await flushPromises()

      expect($fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/me',
        expect.objectContaining({ method: 'PATCH', body: { visibility: 'private' } }),
      )
    })

    it('ne fait pas d\'appel API si la visibilité est inchangée (public → public)', async () => {
      // fakeUser.visibility = 'public', index 2 dans VISIBILITY_OPTIONS
      const wrapper = mount(ProfilPage, { global: { stubs } })
      await wrapper.find('.profil__info-row--visibility .profil__edit-btn').trigger('click')
      await wrapper.findAll('.profil__visibility-opt')[2].trigger('click')
      await flushPromises()

      expect($fetchMock).not.toHaveBeenCalled()
    })

    it('affiche une erreur si PATCH visibilité échoue', async () => {
      $fetchMock.mockRejectedValue(new Error('network'))
      const wrapper = mount(ProfilPage, { global: { stubs } })
      await wrapper.find('.profil__info-row--visibility .profil__edit-btn').trigger('click')
      // index 0 = 'private' (différent de 'public') → déclenche l'appel API
      await wrapper.findAll('.profil__visibility-opt')[0].trigger('click')
      await flushPromises()

      expect(wrapper.find('.profil__bio-error').exists()).toBe(true)
    })

    it('ferme le sélecteur sans appel API quand on clique sur la valeur identique', async () => {
      const wrapper = mount(ProfilPage, { global: { stubs } })
      await wrapper.find('.profil__info-row--visibility .profil__edit-btn').trigger('click')
      await wrapper.findAll('.profil__visibility-opt')[2].trigger('click')
      await flushPromises()

      expect(wrapper.findAll('.profil__visibility-opt')).toHaveLength(0)
    })
  })

  // ── Déconnexion ────────────────────────────────────────
  it('appelle logout() au clic sur le bouton Déconnexion', async () => {
    const wrapper = mount(ProfilPage, { global: { stubs } })
    await wrapper.find('.profil__logout').trigger('click')
    await flushPromises()
    expect(logoutMock).toHaveBeenCalledOnce()
  })
})
