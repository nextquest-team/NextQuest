<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="parchemin">
    <img
      src="/images/dashboard/parchemin-ferme.png"
      alt="Parchemin"
      class="parchemin__img"
    />
    <button class="parchemin__btn">{{ t('dashboard.parchemin') }}</button>
  </div>
</template>

<style scoped>
.parchemin {
  flex: 0 0 28%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.parchemin__img {
  width: 100%;
  height: auto;
  display: block;
}

/* Badge "Actualités" centré sur le parchemin */
.parchemin__btn {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
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
