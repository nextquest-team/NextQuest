<script setup lang="ts">
const { t } = useI18n()

// Active la rotation sur touch (mobile) — le hover CSS gère le desktop
const spinning = ref(false)

function onTouchStart() {
  spinning.value = true
}

function onTouchEnd() {
  setTimeout(() => { spinning.value = false }, 800)
}
</script>

<template>
  <NuxtLink
    to="/next-quest"
    class="wheel-btn"
    :class="{ 'wheel-btn--spinning': spinning }"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <img
      src="/images/dashboard/turning-wheel.png"
      :alt="t('dashboard.wheel.alt')"
      class="wheel-btn__img"
    />
  </NuxtLink>
</template>

<style scoped>
.wheel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  cursor: pointer;
}

.wheel-btn__img {
  width: min(62vw, 300px);
  height: auto;
  animation: none;
}

@media (min-width: 768px) {
  .wheel-btn__img {
    width: min(16vw, 240px);
  }
}

/* Desktop : hover déclenche l'animation */
.wheel-btn:hover .wheel-btn__img {
  animation: wheel-turn 0.8s ease-in-out;
}

/* Mobile : classe ajoutée au touchstart */
.wheel-btn--spinning .wheel-btn__img {
  animation: wheel-turn 0.8s ease-in-out;
}

/* Quart de tour à droite puis retour à gauche */
@keyframes wheel-turn {
  0%   { transform: rotate(0deg); }
  50%  { transform: rotate(90deg); }
  100% { transform: rotate(0deg); }
}
</style>
