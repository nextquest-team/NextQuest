<script setup lang="ts">
definePageMeta({ middleware: 'guest' })

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
</script>

<template>
  <div class="auth-page">
    <div class="auth-content">
      <div class="auth-header">
        <UiPatchButton variant="back" @click="navigateTo('/')">
          <v-icon>mdi-arrow-left</v-icon>
        </UiPatchButton>
      </div>

      <v-form ref="form" @submit.prevent="handleRegister">
        <div class="auth-fields">
          <UiPatchInput
            v-model="username"
            :label="t('auth.fields.username')"
            :placeholder="t('auth.fields.usernamePlaceholder')"
            :rules="usernameRules"
          />

          <UiPatchInput
            v-model="email"
            :label="t('auth.fields.email')"
            type="email"
            :placeholder="t('auth.fields.emailPlaceholder')"
            :rules="emailRules"
          />

          <UiPatchInput
            v-model="password"
            :label="t('auth.fields.password')"
            type="password"
            :rules="passwordRules"
          />

          <UiPatchInput
            v-model="passwordConfirm"
            :label="t('auth.fields.passwordConfirm')"
            type="password"
            :rules="passwordConfirmRules"
          />
        </div>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <UiPatchButton
          variant="primary"
          type="submit"
          size="large"
          block
          :loading="isLoading"
        >
          {{ t('auth.register') }}
        </UiPatchButton>
      </v-form>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1.5rem;
}

.auth-content {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.auth-header {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
}

.auth-fields {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.auth-error {
  font-family: var(--nq-font);
  color: var(--nq-red);
  font-size: 0.85rem;
  text-align: center;
  margin-bottom: 0.75rem;
}
</style>
