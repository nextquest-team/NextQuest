<script setup lang="ts">
defineProps<{
  username: string
}>()

defineEmits<{
  logout: []
}>()
</script>

<template>
  <div class="dashboard-desktop">
    <aside class="dashboard-sidebar">
      <!-- TODO: navigation latérale -->
    </aside>

    <main class="dashboard-main">
      <h1 class="dashboard-title">Bienvenue {{ username }}</h1>

      <!-- TODO: contenu desktop (collection, recommandations, fil d'activité…) -->
    </main>
  </div>
</template>

<style scoped>
.dashboard-desktop {
  min-height: 100vh;
  display: flex;
}

.dashboard-sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
}

.dashboard-main {
  flex: 1;
  padding: 2rem 2.5rem;
}

.dashboard-title {
  font-family: var(--nq-font);
  font-variant: small-caps;
  font-size: 1.8rem;
  color: var(--nq-brown-dark);
  letter-spacing: 0.05em;
}
</style>
