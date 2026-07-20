// @vitest-environment nuxt
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import LoginDesktop from '~/components/auth/LoginDesktop.vue'

const vuetify = createVuetify({ components, directives })

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
}))

const navigateToMock = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => navigateToMock)

const emailRef = ref('')
const passwordRef = ref('')
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)
const isLoadingRef = ref(false)
const errorRef = ref<string | null>(null)
const loginWithOAuthMock = vi.fn()
const handleLoginMock = vi.fn()

mockNuxtImport('useLoginForm', () => () => ({
  email: emailRef,
  password: passwordRef,
  form: formRef,
  emailRules: [],
  passwordRules: [],
  isLoading: isLoadingRef,
  error: errorRef,
  loginWithOAuth: loginWithOAuthMock,
  handleLogin: handleLoginMock,
}))

const stubs = {
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
}

const globalOpts = { plugins: [vuetify], stubs }

describe('LoginDesktop', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    emailRef.value = ''
    passwordRef.value = ''
    formRef.value = null
    isLoadingRef.value = false
    errorRef.value = null
    loginWithOAuthMock.mockReset()
    handleLoginMock.mockReset()
    navigateToMock.mockReset()
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  it('utilise le UiPageHeader unifié : le bouton retour navigue vers /', async () => {
    wrapper = mount(LoginDesktop, { global: globalOpts })
    await wrapper.find('.patch-btn-back').trigger('click')
    expect(navigateToMock).toHaveBeenCalledWith('/')
  })

  it('appelle handleLogin à la soumission du formulaire', async () => {
    wrapper = mount(LoginDesktop, { global: globalOpts })
    await wrapper.find('form').trigger('submit')
    expect(handleLoginMock).toHaveBeenCalledTimes(1)
  })

  it("n'affiche pas de message d'erreur par défaut", () => {
    wrapper = mount(LoginDesktop, { global: globalOpts })
    expect(wrapper.find('.auth-error').exists()).toBe(false)
  })

  it("affiche le message d'erreur quand error est renseigné", () => {
    errorRef.value = 'Email ou mot de passe incorrect'
    wrapper = mount(LoginDesktop, { global: globalOpts })
    expect(wrapper.find('.auth-error').text()).toBe('Email ou mot de passe incorrect')
  })

  it('appelle loginWithOAuth("google") au clic sur le bouton Google', async () => {
    wrapper = mount(LoginDesktop, { global: globalOpts })
    await wrapper.find('.social-btn--google').trigger('click')
    expect(loginWithOAuthMock).toHaveBeenCalledWith('google')
  })

  it('appelle loginWithOAuth("microsoft") au clic sur le bouton Microsoft', async () => {
    wrapper = mount(LoginDesktop, { global: globalOpts })
    await wrapper.find('.social-btn--microsoft').trigger('click')
    expect(loginWithOAuthMock).toHaveBeenCalledWith('microsoft')
  })

  it('désactive le bouton Apple (provider pas encore disponible)', () => {
    wrapper = mount(LoginDesktop, { global: globalOpts })
    expect(wrapper.find('.social-btn--apple').attributes('disabled')).toBeDefined()
  })
})
