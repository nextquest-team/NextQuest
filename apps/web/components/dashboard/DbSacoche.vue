<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="sacoche">
    <!-- Scène héro : landscape en fond, dragon au premier plan -->
    <img
      src="/images/dashboard/hero-landscape.png"
      alt=""
      class="sacoche__landscape"
    />
    <img
      src="/images/dashboard/hero-dragon.png"
      alt="Dragon"
      class="sacoche__dragon"
    />
    <button class="sacoche__btn">{{ t('dashboard.sacoche') }}</button>
  </div>
</template>

<style scoped>
.sacoche {
  flex: 0 0 30%;
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  aspect-ratio: 1 / 1.4;
}

.sacoche__landscape {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}

.sacoche__dragon {
  position: absolute;
  bottom: 20%;
  left: 50%;
  transform: translateX(-50%);
  width: 70%;
  height: auto;
  z-index: 2;
}

/* Bouton "Inventaire" en bas */
.sacoche__btn {
  position: absolute;
  bottom: 8%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  appearance: none;
  border: none;
  cursor: pointer;
  font-family: var(--nq-font);
  font-size: clamp(0.6rem, 1.8vw, 0.85rem);
  padding: 5px 14px;
  border-radius: 5px;
  background: #7a3e2a;
  color: #edc78e;
  white-space: nowrap;
}
</style>
