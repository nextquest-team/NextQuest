<script setup lang="ts">
// TODO: implémentation complète du flow "mot de passe oublié" :
//   - Form email → POST /api/auth/forgot-password (à implémenter côté backend par JB)
//   - Email envoyé avec lien de reset → page /auth/reset-password?token=...
//   - Form nouveau mot de passe + confirmation → POST /api/auth/reset-password
// Pour l'instant : page placeholder pour éviter le warning Vue Router.

definePageMeta({ middleware: 'guest' })

const { t } = useI18n()
</script>

<template>
  <div class="forgot-page">
    <div class="forgot-content">
      <div class="forgot-header">
        <UiPatchButton variant="back" @click="navigateTo('/auth/login')">
          <v-icon>mdi-arrow-left</v-icon>
        </UiPatchButton>
      </div>

      <div class="forgot-message">
        <h1>{{ t('auth.forgotPassword') }}</h1>
        <p>{{ t('auth.comingSoon') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forgot-page {
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1.5rem;
}

.forgot-content {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.forgot-header {
  display: flex;
  align-items: center;
}

.forgot-message {
  text-align: center;
  font-family: var(--nq-font);
  color: var(--nq-brown-dark);
}

.forgot-message h1 {
  font-size: 1.5rem;
  font-variant: small-caps;
  margin-bottom: 1rem;
}

.forgot-message p {
  color: var(--nq-red);
  font-size: 1rem;
}
</style>
