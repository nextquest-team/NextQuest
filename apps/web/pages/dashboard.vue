<script setup lang="ts">
// Page protégée par le middleware global auth.global.ts
const { user, logout, isLoading } = useAuth()
</script>

<template>
  <div class="dashboard-page">
    <div class="dashboard-content">
      <h1 class="dashboard-title">Bienvenue {{ user?.displayName ?? user?.username }}</h1>

      <!-- TODO: contenu du dashboard à implémenter (collection, recommandations, fil d'activité…) -->

      <UiPatchButton
        variant="primary"
        size="large"
        :loading="isLoading"
        @click="logout"
      >
        Déconnexion
      </UiPatchButton>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2.5rem;
  width: 100%;
  max-width: 420px;
  text-align: center;
}

.dashboard-title {
  font-family: var(--nq-font);
  font-variant: small-caps;
  font-size: 1.5rem;
  color: var(--nq-brown-dark);
  letter-spacing: 0.05em;
}
</style>
