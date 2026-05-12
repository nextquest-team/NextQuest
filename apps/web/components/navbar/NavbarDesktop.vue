<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()

const items = [
  { key: 'dashboard', to: '/dashboard', icon: 'mdi-home-variant' },
  { key: 'gameList', to: '/game-list', icon: 'mdi-controller' },
  { key: 'actualites', to: '/actualites', icon: 'mdi-newspaper-variant-outline' },
  { key: 'nextQuest', to: '/next-quest', icon: 'mdi-lightning-bolt' },
  { key: 'timeline', to: '/timeline', icon: 'mdi-cards-outline' },
  { key: 'profil', to: '/profil', icon: 'mdi-account' },
]

function isActive(to: string) {
  return route.path === to
}
</script>

<template>
  <nav class="nd" role="navigation" :aria-label="t('nav.label')">
    <div class="nd__logo">
      <img src="/images/logo/logo.png" alt="NextQuest" class="nd__logo-img" />
    </div>

    <NuxtLink
      v-for="item in items"
      :key="item.key"
      :to="item.to"
      class="nd__item"
      :class="{ 'nd__item--active': isActive(item.to) }"
      :aria-current="isActive(item.to) ? 'page' : undefined"
    >
      <v-icon class="nd__icon" aria-hidden="true">{{ item.icon }}</v-icon>
      <span class="nd__label">{{ t(`nav.${item.key}`) }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.nd {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 200px;
  display: flex;
  flex-direction: column;
  background: rgba(20, 10, 3, 0.9);
  border-right: 1.5px solid #7a3e2a;
  z-index: 100;
  padding: 16px 0;
  backdrop-filter: blur(6px);
}

.nd__logo {
  display: flex;
  justify-content: center;
  padding: 8px 24px 28px;
  border-bottom: 1px solid rgba(122, 62, 42, 0.4);
  margin-bottom: 8px;
}

.nd__logo-img {
  width: 75%;
  height: auto;
  object-fit: contain;
}

.nd__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 20px;
  text-decoration: none;
  color: rgba(237, 199, 142, 0.45);
  font-family: var(--nq-font);
  font-size: clamp(0.875rem, 1.1vw, 1rem);
  transition: color 0.2s, background 0.2s;
  border-left: 3px solid transparent;
}

.nd__item:hover {
  color: rgba(237, 199, 142, 0.8);
  background: rgba(122, 62, 42, 0.15);
}

.nd__item--active {
  color: #edc78e;
  background: rgba(122, 62, 42, 0.3);
  border-left-color: #edc78e;
}

.nd__icon {
  font-size: 20px !important;
  color: inherit !important;
  flex-shrink: 0;
}

.nd__label {
  white-space: nowrap;
}
</style>
