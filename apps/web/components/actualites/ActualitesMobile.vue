<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="am">

    <!-- ── Header fixe ── -->
    <div class="am__head">
      <UiPageHeader>
        <h1 class="am__title">{{ t('nav.actualites') }}</h1>
      </UiPageHeader>
    </div>

    <!-- ── Zone scrollable ── -->
    <div class="am__body">
      <!-- TODO: contenu actualités mobile -->
      <div class="am__placeholder">
        <v-icon size="48" color="primary-light">mdi-newspaper-variant-outline</v-icon>
        <p class="am__placeholder-text">Actualités — à venir</p>
      </div>
    </div>

  </div>
</template>

<style scoped>
.am {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 64px);
  overflow: hidden;
  font-family: var(--nq-font);
}

.am__head {
  flex-shrink: 0;
  padding: 0 1rem;
}

.am__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
}

.am__body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0.5rem 1rem 1.5rem;
}

.am__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  height: 100%;
  text-align: center;
  padding: 2rem;
}

.am__placeholder-text {
  font-size: 1rem;
  color: rgba(var(--nq-brown-dark-rgb), 0.5);
  margin: 0;
  font-style: italic;
}
</style>
