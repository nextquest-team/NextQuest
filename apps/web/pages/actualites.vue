<script setup lang="ts">
definePageMeta({ ssr: false })
</script>

<template>
  <div class="page">
    <NuxtLink to="/dashboard" class="page__back">
      <v-icon>mdi-arrow-left</v-icon>
    </NuxtLink>
    <p>Actualités — à venir</p>
  </div>
</template>

<style scoped>
.page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: var(--nq-font);
  gap: 1rem;
}

.page__back {
  position: absolute;
  top: 1.5rem;
  left: 1.5rem;
  color: var(--nq-brown-dark);
}
</style>
