<script setup lang="ts">
definePageMeta({ ssr: false })

const { t } = useI18n()
</script>

<template>
  <div class="page">
    <h1>{{ t('nav.timeline') }} — à venir</h1>
  </div>
</template>

<style scoped>
.page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--nq-font);
  color: var(--nq-text-alt);
}

.page h1 {
  font-size: 1rem;
  font-weight: normal;
  margin: 0;
}
</style>
