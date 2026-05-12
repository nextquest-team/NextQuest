<script setup lang="ts">
definePageMeta({ middleware: 'guest', layout: 'plain' })

const { t } = useI18n()
const { login, loginWithOAuth, isLoading, error } = useAuth()

const email = ref('')
const password = ref('')
const form = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)

const emailRules = [
  (v: string) => !!v || t('auth.validation.emailRequired'),
  (v: string) => /.+@.+\..+/.test(v) || t('auth.validation.emailInvalid'),
]

const passwordRules = [
  (v: string) => !!v || t('auth.validation.passwordRequired'),
  (v: string) => v.length >= 8 || t('auth.validation.passwordMin'),
]

async function handleLogin() {
  const { valid } = await form.value!.validate()
  if (!valid) return
  try {
    await login(email.value, password.value)
  } catch {
    // L'erreur est déjà gérée dans useAuth et exposée via `error`
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-content">
      <!-- Bouton retour -->
      <div class="auth-header">
        <UiPatchButton variant="back" @click="navigateTo('/')">
          <v-icon>mdi-arrow-left</v-icon>
        </UiPatchButton>
      </div>

      <v-form ref="form" @submit.prevent="handleLogin">
        <div class="auth-fields">
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
        </div>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <NuxtLink to="/auth/forgot-password" class="auth-forgot">
          {{ t('auth.forgotPassword') }}
        </NuxtLink>

        <UiPatchButton
          variant="primary"
          type="submit"
          size="large"
          block
          :loading="isLoading"
        >
          {{ t('auth.login') }}
        </UiPatchButton>
      </v-form>

      <div class="auth-separator"><span>{{ t('auth.orContinueWith') }}</span></div>

      <!-- Connexions sociales (boutons standards avec logos brand) -->
      <div class="social-stack">
        <UiSocialButton
          provider="google"
          :loading="isLoading"
          @click="loginWithOAuth('google')"
        />

        <UiSocialButton
          provider="microsoft"
          :loading="isLoading"
          @click="loginWithOAuth('microsoft')"
        />

        <!-- TODO: activer Apple quand JB aura ajouté le provider côté backend -->
        <UiSocialButton provider="apple" disabled />
      </div>
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
  margin-bottom: 1rem;
}

.auth-forgot {
  display: block;
  text-align: center;
  font-family: var(--nq-font);
  font-variant: small-caps;
  font-size: 0.9rem;
  color: var(--nq-red);
  text-decoration: none;
  letter-spacing: 0.05em;
  margin-bottom: 1.5rem;
}

.auth-forgot:hover {
  text-decoration: underline;
}

.auth-error {
  font-family: var(--nq-font);
  color: var(--nq-red);
  font-size: 0.85rem;
  text-align: center;
  margin-bottom: 0.75rem;
}

.auth-separator {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-family: var(--nq-font);
  font-variant: small-caps;
  font-size: 0.85rem;
  color: var(--nq-brown-dark);
  letter-spacing: 0.06em;
  margin: 0.5rem 0;
}

.auth-separator::before,
.auth-separator::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--nq-brown);
  opacity: 0.35;
}

.auth-separator span {
  white-space: nowrap;
}

.social-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>
