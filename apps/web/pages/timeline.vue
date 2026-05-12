<script setup lang="ts">
definePageMeta({ ssr: false })

const { t } = useI18n()
</script>

<template>
  <div class="page">
    <p>{{ t('nav.timeline') }} — à venir</p>
  </div>
</template>

<style scoped>
.page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--nq-font);
  color: #332b25;
}
</style>
