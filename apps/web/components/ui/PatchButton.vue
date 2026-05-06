<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  // 'primary' = bouton crème stitché | 'back' = bouton retour carré | 'social' = patch coloré
  variant?: 'primary' | 'back' | 'social'
  color?: string
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  block?: boolean
}>()

const isNative = computed(() => props.variant !== 'social')
</script>

<template>
  <!-- Boutons primary / back : <button> natif pour que border-image s'affiche correctement -->
  <button
    v-if="isNative"
    :type="type ?? 'button'"
    :disabled="disabled || loading"
    :class="[
      variant === 'back' ? 'patch-btn-back' : 'patch-btn',
      { 'patch-block': block },
    ]"
    v-bind="$attrs"
  >
    <slot />
  </button>

  <!-- Boutons sociaux : v-btn de Vuetify (couleur unie, pas de border-image) -->
  <v-btn
    v-else
    class="patch-social"
    :color="color"
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
