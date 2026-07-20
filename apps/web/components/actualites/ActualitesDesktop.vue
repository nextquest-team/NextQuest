<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="ad">
    <UiPageHeader>
      <h1 class="ad__title">{{ t('nav.actualites') }}</h1>
    </UiPageHeader>

    <!-- TODO: contenu actualités desktop -->
    <div class="ad__placeholder">
      <v-icon size="64" color="primary-light">mdi-newspaper-variant-outline</v-icon>
      <p class="ad__placeholder-text">Actualités — à venir</p>
    </div>
  </div>
</template>

<style scoped>
.ad {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 2rem 3rem;
  font-family: var(--nq-font);
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.ad__title {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
}

.ad__placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  text-align: center;
  padding: 3rem;
}

.ad__placeholder-text {
  font-size: 1.1rem;
  color: rgba(var(--nq-brown-dark-rgb), 0.5);
  margin: 0;
  font-style: italic;
}
</style>
