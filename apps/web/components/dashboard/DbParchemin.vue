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
    <NuxtLink to="/actualites" class="parchemin__btn">{{ t('dashboard.parchemin.label') }}</NuxtLink>
  </div>
</template>

<style scoped>
.parchemin {
  flex: 0 0 32%;
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
  text-decoration: none;
  font-family: var(--nq-font);
  font-size: clamp(0.875rem, 1.8vw, 0.95rem);
  padding: 5px 14px;
  border-radius: 5px;
  background: var(--nq-brown-mid);
  color: var(--nq-cream-light);
  white-space: nowrap;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
</style>
