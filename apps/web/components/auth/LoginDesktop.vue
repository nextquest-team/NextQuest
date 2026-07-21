<script setup lang="ts">
const { t } = useI18n()
const {
  email,
  password,
  form,
  emailRules,
  passwordRules,
  isLoading,
  error,
  loginWithOAuth,
  handleLogin,
} = useLoginForm()
</script>

<template>
  <div class="login-desktop-page">
    <h1 class="sr-only">{{ t('auth.login') }}</h1>
    <div class="login-desktop-header">
      <UiPageHeader to="/" />
    </div>

    <div class="login-desktop-layout">
      <!-- Colonne gauche : formulaire email/mot de passe -->
      <div class="login-left">
        <v-form ref="form" @submit.prevent="handleLogin">
          <div class="auth-fields">
            <UiPatchInput
              v-model="email"
              :label="t('auth.fields.email')"
              type="email"
              autocomplete="username"
              :placeholder="t('auth.fields.emailPlaceholder')"
              :rules="emailRules"
            />

            <UiPatchInput
              v-model="password"
              :label="t('auth.fields.password')"
              type="password"
              autocomplete="current-password"
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
      </div>

      <!-- Séparateur vertical -->
      <div class="login-divider">
        <div class="divider-line" />
        <span>{{ t('auth.orContinueWith') }}</span>
        <div class="divider-line" />
      </div>

      <!-- Colonne droite : méthodes OAuth -->
      <div class="login-right">
        <AuthSocialButtons :loading="isLoading" @oauth="loginWithOAuth" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-desktop-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.login-desktop-header {
  width: 100%;
  max-width: 860px;
  margin-bottom: 1.5rem;
}

.login-desktop-layout {
  width: 100%;
  max-width: 860px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 3rem;
}

.login-left {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.auth-fields {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-bottom: 1rem;
}

.auth-forgot {
  display: block;
  width: fit-content;
  margin: 0 auto 1rem;
  padding: 0.85rem 1rem;
  text-align: center;
  font-family: var(--nq-font);
  font-variant: small-caps;
  font-size: 0.9rem;
  color: var(--nq-red);
  text-decoration: none;
  letter-spacing: 0.05em;
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

.login-divider {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  font-family: var(--nq-font);
  font-variant: small-caps;
  font-size: 0.85rem;
  color: var(--nq-brown-dark);
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.divider-line {
  width: 1px;
  height: 60px;
  background: var(--nq-brown);
  opacity: 0.35;
}

.login-right {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
