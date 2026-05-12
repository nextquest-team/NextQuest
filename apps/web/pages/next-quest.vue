<script setup lang="ts">
// TODO: implémenter la page Next Quest (sélection de quête)
definePageMeta({ ssr: false })
</script>

<template>
  <div class="nq-page">
    <NuxtLink to="/dashboard" class="nq-back">
      <v-icon>mdi-arrow-left</v-icon>
    </NuxtLink>
    <p>Next Quest — à venir</p>
  </div>
</template>

<style scoped>
.nq-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: var(--nq-font);
  gap: 1rem;
}

.nq-back {
  position: absolute;
  top: 1.5rem;
  left: 1.5rem;
  color: var(--nq-brown-dark);
}
</style>
