// @vitest-environment nuxt
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import RegisterDesktop from '~/components/auth/RegisterDesktop.vue'

const vuetify = createVuetify({ components, directives })

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
}))

const navigateToMock = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => navigateToMock)

const usernameRef = ref('')
const emailRef = ref('')
const passwordRef = ref('')
const passwordConfirmRef = ref('')
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)
const isLoadingRef = ref(false)
const errorRef = ref<string | null>(null)
const handleRegisterMock = vi.fn()

mockNuxtImport('useRegisterForm', () => () => ({
  username: usernameRef,
  email: emailRef,
  password: passwordRef,
  passwordConfirm: passwordConfirmRef,
  form: formRef,
  usernameRules: [],
  emailRules: [],
  passwordRules: [],
  passwordConfirmRules: [],
  isLoading: isLoadingRef,
  error: errorRef,
  handleRegister: handleRegisterMock,
}))

const globalOpts = { plugins: [vuetify] }

describe('RegisterDesktop', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    usernameRef.value = ''
    emailRef.value = ''
    passwordRef.value = ''
    passwordConfirmRef.value = ''
    formRef.value = null
    isLoadingRef.value = false
    errorRef.value = null
    handleRegisterMock.mockReset()
    navigateToMock.mockReset()
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  it('utilise le UiPageHeader unifié : le bouton retour navigue vers /', async () => {
    wrapper = mount(RegisterDesktop, { global: globalOpts })
    await wrapper.find('.patch-btn-back').trigger('click')
    expect(navigateToMock).toHaveBeenCalledWith('/')
  })

  it('appelle handleRegister à la soumission du formulaire', async () => {
    wrapper = mount(RegisterDesktop, { global: globalOpts })
    await wrapper.find('form').trigger('submit')
    expect(handleRegisterMock).toHaveBeenCalledTimes(1)
  })

  it("n'affiche pas de message d'erreur par défaut", () => {
    wrapper = mount(RegisterDesktop, { global: globalOpts })
    expect(wrapper.find('.auth-error').exists()).toBe(false)
  })

  it("affiche le message d'erreur quand error est renseigné", () => {
    errorRef.value = 'Cet email ou ce pseudo est déjà utilisé'
    wrapper = mount(RegisterDesktop, { global: globalOpts })
    expect(wrapper.find('.auth-error').text()).toBe('Cet email ou ce pseudo est déjà utilisé')
  })

  it('affiche les 4 champs username/email/password/passwordConfirm', () => {
    wrapper = mount(RegisterDesktop, { global: globalOpts })
    expect(wrapper.findAll('input')).toHaveLength(4)
  })
})
