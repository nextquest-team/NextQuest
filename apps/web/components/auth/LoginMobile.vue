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
  <div class="auth-page">
    <h1 class="sr-only">{{ t('auth.login') }}</h1>
    <div class="auth-content">
      <div class="auth-header">
        <UiPageHeader to="/" />
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

      <AuthSocialButtons :loading="isLoading" @oauth="loginWithOAuth" />
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
</style>
