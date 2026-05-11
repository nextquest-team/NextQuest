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
  --frame-bg: transparent;
  position: relative;
  overflow: hidden;
  border-radius: 8% / 10%;
}

/* Fond inséré à l'intérieur de la zone opaque du cadre (~5.5% transparent tout autour) */
.green-frame::before {
  content: '';
  position: absolute;
  inset: 6%;
  background: var(--frame-bg);
  border-radius: 15%;
  z-index: 0;
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
