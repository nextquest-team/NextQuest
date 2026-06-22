<script setup lang="ts">
defineProps<{
  to?: string
}>()
</script>

<template>
  <div class="ui-page-header">
    <UiBackButton :to="to" />
    <div class="ui-page-header__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.ui-page-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-shrink: 0;
  width: 100%;
}

.ui-page-header__content {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
}

/* ── Mobile : header fixe en haut, fond étendu pleine largeur ── */
@media (max-width: 959px) {
  .ui-page-header {
    position: sticky;
    top: 0;
    z-index: 50;
    margin-bottom: 0.75rem;
    padding: 0.75rem 0 0.5rem;
    /* Le ::before étend le fond au-delà du padding parent pour couvrir toute la largeur */
    isolation: isolate;
  }

  .ui-page-header::before {
    content: '';
    position: absolute;
    inset: 0;
    left: -100vw;
    right: -100vw;
    background: rgba(248, 244, 234, 0.96);
    z-index: -1;
  }
}
</style>
