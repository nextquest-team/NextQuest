<script setup lang="ts">
definePageMeta({ ssr: false })
</script>

<template>
  <div class="page">
    <UiPageHeader />
    <h1>Ajouter un jeu — à venir</h1>
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

.page h1 {
  font-size: 1rem;
  font-weight: normal;
  margin: 0;
}
</style>
