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
</style>
