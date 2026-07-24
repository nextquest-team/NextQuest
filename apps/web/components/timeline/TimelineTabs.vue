<script setup lang="ts">
import type { TimelineTab } from '~/types/timeline'

defineProps<{
  activeTab: TimelineTab
}>()

const emit = defineEmits<{
  'update:activeTab': [value: TimelineTab]
}>()

const { t } = useI18n()

const tabs: { key: TimelineTab; icon: string }[] = [
  { key: 'upcoming', icon: 'mdi-crystal-ball' },
  { key: 'followed', icon: 'mdi-sword-cross' },
]
</script>

<template>
  <div class="tl-tabs" role="tablist" :aria-label="t('timeline.title')">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="tl-tabs__btn"
      role="tab"
      :aria-selected="activeTab === tab.key"
      :class="{ 'tl-tabs__btn--active': activeTab === tab.key }"
      @click="emit('update:activeTab', tab.key)"
    >
      <v-icon size="26" class="tl-tabs__icon">{{ tab.icon }}</v-icon>
      <span class="tl-tabs__label">{{ t(`timeline.tabs.${tab.key}`) }}</span>
    </button>
  </div>
</template>

<style scoped>
.tl-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-shrink: 0;
}

.tl-tabs__btn {
  appearance: none;
  outline: none;
  font: inherit;
  background: rgba(var(--nq-white-rgb), 0.55);
  cursor: pointer;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 1.1rem 0.75rem;
  min-height: 92px;
  border-radius: 14px;
  border: 2px solid rgba(var(--nq-brown-rgb), 0.25);

  font-family: var(--nq-font);
  font-variant: small-caps;
  letter-spacing: 0.03em;
  color: rgba(var(--nq-brown-dark-rgb), 0.65);
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.tl-tabs__icon { transition: transform 0.15s ease; }

.tl-tabs__label {
  font-size: 1.05rem;
  font-weight: bold;
  text-align: center;
}

.tl-tabs__btn:hover {
  color: var(--nq-brown-dark);
  border-color: rgba(var(--nq-brown-rgb), 0.45);
}

.tl-tabs__btn:focus-visible {
  outline: 3px solid var(--nq-focus);
  outline-offset: 2px;
}

.tl-tabs__btn--active {
  color: var(--nq-cream-light);
  background: var(--nq-brown, #5C3317);
  border-color: var(--nq-brown, #5C3317);
  transform: translateY(-2px);
}

.tl-tabs__btn--active:hover { color: var(--nq-cream-light); }

@media (min-width: 960px) {
  .tl-tabs__btn { min-height: 108px; }
  .tl-tabs__label { font-size: 1.15rem; }
}
</style>
