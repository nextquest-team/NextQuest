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
  <nav class="nm" :aria-label="t('nav.label')">
    <NuxtLink
      v-for="item in items"
      :key="item.key"
      :to="item.to"
      class="nm__item"
      :class="{ 'nm__item--active': isActive(item.to) }"
      :aria-current="isActive(item.to) ? 'page' : undefined"
    >
      <v-icon class="nm__icon" aria-hidden="true">{{ item.icon }}</v-icon>
      <span class="nm__label">{{ t(`nav.${item.key}`) }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.nm {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  display: flex;
  align-items: stretch;
  background: #1e0f05;
  border-top: 1.5px solid #7a3e2a;
  z-index: 100;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.4);
}

.nm__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  text-decoration: none;
  color: rgba(237, 199, 142, 0.6);
  transition: color 0.2s;
  padding: 0 2px;
  min-width: 0;
  border-top: 2px solid transparent;
}

.nm__item--active {
  color: #edc78e;
  border-top-color: #edc78e;
}

.nm__item:hover {
  color: rgba(237, 199, 142, 0.85);
}

.nm__item:focus-visible {
  outline: 2px solid #edc78e;
  outline-offset: -3px;
  border-radius: 4px;
}

.nm__icon {
  font-size: 20px !important;
  color: inherit !important;
}

.nm__label {
  font-family: var(--nq-font);
  font-size: 0.625rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
</style>
