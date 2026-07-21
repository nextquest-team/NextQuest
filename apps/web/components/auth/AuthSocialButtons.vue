<script setup lang="ts">
defineProps<{
  loading?: boolean
}>()

const emit = defineEmits<{
  oauth: [provider: 'google' | 'microsoft']
}>()
</script>

<template>
  <div class="social-stack">
    <UiSocialButton
      provider="google"
      :loading="loading"
      @click="emit('oauth', 'google')"
    />

    <UiSocialButton
      provider="microsoft"
      :loading="loading"
      @click="emit('oauth', 'microsoft')"
    />

    <!-- TODO: activer Apple quand JB aura ajouté le provider côté backend -->
    <UiSocialButton provider="apple" disabled />
  </div>
</template>

<style scoped>
.social-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}
</style>
