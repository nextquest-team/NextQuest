<script setup lang="ts">
// Landing réservée aux visiteurs non connectés (le middleware redirige
// les utilisateurs authentifiés vers /dashboard).
definePageMeta({ middleware: 'guest', layout: 'plain' })

const { t } = useI18n()

useHead({
  title: computed(() => t('meta.landingTitle')),
})
</script>

<template>
  <div class="landing-page">
    <div class="landing-content">
      <h1 class="sr-only">{{ t('meta.landingHeading') }}</h1>

      <!-- Logo badge brodé -->
      <img src="/images/logo/logo.png" alt="My Next Quest is..." class="landing-logo" />

      <div class="landing-actions">
        <UiPatchButton
          variant="primary"
          size="large"
          block
          @click="navigateTo('/auth/login')"
        >
          {{ t('auth.login') }}
        </UiPatchButton>

        <NuxtLink to="/auth/forgot-password" class="landing-forgot">
          {{ t('auth.forgotPassword') }}
        </NuxtLink>

        <UiPatchButton
          variant="primary"
          size="large"
          block
          @click="navigateTo('/auth/register')"
        >
          {{ t('auth.register') }}
        </UiPatchButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.landing-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
}

.landing-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2.5rem;
  width: 100%;
  max-width: 360px;
}

.landing-logo {
  width: 160px;
  height: 160px;
  object-fit: contain;
}

.landing-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  width: 100%;
}

.landing-forgot {
  display: block;
  width: fit-content;
  padding: 0.85rem 1rem;
  font-family: var(--nq-font);
  font-variant: small-caps;
  font-size: 0.9rem;
  color: var(--nq-red);
  text-decoration: none;
  letter-spacing: 0.05em;
}

.landing-forgot:hover {
  text-decoration: underline;
}
</style>
