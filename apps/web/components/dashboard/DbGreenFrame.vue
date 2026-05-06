<script setup lang="ts">
withDefaults(defineProps<{
  borderWidth?: string
}>(), {
  borderWidth: '32px'
})
</script>

<template>
  <div class="green-frame" :style="{ '--bw': borderWidth }">
    <slot />
  </div>
</template>

<style scoped>
.green-frame {
  position: relative;
}

/* Cadre en overlay par-dessus le contenu */
.green-frame::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('/images/dashboard/encadrement-vert-90.png');
  background-size: 100% 100%;
  pointer-events: none;
  z-index: 2;
}
</style>
