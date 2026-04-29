<script setup lang="ts">
defineOptions({ inheritAttrs: false })

defineProps<{
  // 'primary' = bouton crème stitché | 'back' = bouton retour carré | 'social' = patch coloré
  variant?: 'primary' | 'back' | 'social'
  color?: string
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  block?: boolean
}>()
</script>

<template>
  <v-btn
    :class="{
      'patch-btn': variant !== 'back' && variant !== 'social',
      'patch-btn-back': variant === 'back',
      'patch-social': variant === 'social',
    }"
    :color="variant === 'social' ? color : undefined"
    :loading="loading"
    :disabled="disabled"
    :type="type ?? 'button'"
    :block="block"
    variant="flat"
    v-bind="$attrs"
  >
    <slot />
  </v-btn>
</template>
