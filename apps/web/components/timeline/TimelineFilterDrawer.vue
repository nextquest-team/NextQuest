<script setup lang="ts">
import type { TimelineTab } from '~/types/timeline'

const props = defineProps<{
  activeTab: TimelineTab
}>()

const { t } = useI18n()

const {
  drawerOpen, availableGenres, selectedGenres, activeFilterCount,
  toggleGenre, resetFilters, applyFilters,
  sort, setSort, searchActive,
} = inject<ReturnType<typeof useTimeline>>('timeline')!

// Les resultats de recherche (GET /api/games/igdb/search) n'exposent pas les
// genres : un genre coche pendant une recherche filtrerait sans effet visible.
const genresDisabled = computed(() => props.activeTab === 'upcoming' && searchActive.value)
</script>

<template>
  <v-navigation-drawer v-model="drawerOpen" location="right" temporary width="300">
    <div class="tl-drawer">
      <div class="tl-drawer__header">
        <span class="tl-drawer__title">{{ t('timeline.filterBtn') }}</span>
        <div class="tl-drawer__header-actions">
          <button v-if="activeFilterCount > 0" class="tl-drawer__reset" @click="resetFilters">
            {{ t('timeline.filterReset') }}
          </button>
          <button class="tl-drawer__close" :aria-label="t('timeline.filterClose')" @click="drawerOpen = false">
            <v-icon size="20">mdi-close</v-icon>
          </button>
        </div>
      </div>

      <div v-if="activeTab === 'upcoming'" class="tl-drawer__section">
        <p class="tl-drawer__section-title">{{ t('timeline.sortLabel') }}</p>
        <div class="tl-drawer__seg">
          <button
            class="tl-drawer__seg-btn"
            :class="{ 'tl-drawer__seg-btn--active': sort === 'hype' }"
            @click="setSort('hype')"
          >
            {{ t('timeline.sortHype') }}
          </button>
          <button
            class="tl-drawer__seg-btn"
            :class="{ 'tl-drawer__seg-btn--active': sort === 'date' }"
            @click="setSort('date')"
          >
            {{ t('timeline.sortDate') }}
          </button>
        </div>
      </div>

      <div class="tl-drawer__section">
        <p class="tl-drawer__section-title">{{ t('timeline.filterGenres') }}</p>
        <p v-if="genresDisabled" class="tl-drawer__soon-hint">{{ t('timeline.filterGenresDisabledSearch') }}</p>
        <div v-if="availableGenres.length" class="tl-drawer__checks" :class="{ 'tl-drawer__checks--disabled': genresDisabled }">
          <label v-for="g in availableGenres" :key="g.slug" class="tl-drawer__check-item">
            <input
              type="checkbox"
              class="tl-drawer__checkbox"
              :checked="selectedGenres.includes(g.slug)"
              :disabled="genresDisabled"
              @change="toggleGenre(g.slug)"
            />
            <span>{{ g.name }}</span>
          </label>
        </div>
        <p v-else-if="!genresDisabled" class="tl-drawer__soon-hint">{{ t('timeline.filterGenresEmpty') }}</p>
      </div>

      <div class="tl-drawer__footer">
        <button class="tl__btn" style="width:100%;justify-content:center" @click="applyFilters">
          {{ t('timeline.filterApply') }}
        </button>
      </div>
    </div>
  </v-navigation-drawer>
</template>

<style scoped>
.tl-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: var(--nq-font);
}

.tl-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1rem 0.75rem;
  border-bottom: 1px solid rgba(var(--nq-brown-rgb), 0.1);
}

.tl-drawer__title { font-size: 1rem; font-weight: 700; color: var(--nq-brown-dark, #3A1A0A); }
.tl-drawer__header-actions { display: flex; align-items: center; gap: 8px; }

.tl-drawer__reset {
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--nq-font);
  font-size: 0.78rem;
  color: var(--nq-brown, #5C3317);
  text-decoration: underline;
  padding: 0;
}

.tl-drawer__close {
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(var(--nq-brown-dark-rgb), 0.5);
  padding: 2px;
  border-radius: 4px;
  display: flex;
}

.tl-drawer__close:hover { color: var(--nq-brown-dark, #3A1A0A); }

.tl-drawer__section { padding: 1rem 1rem 0.5rem; border-bottom: 1px solid rgba(var(--nq-brown-rgb), 0.08); }

.tl-drawer__section-title {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(var(--nq-brown-dark-rgb), 0.7);
  margin: 0 0 0.75rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tl-drawer__soon-hint { font-size: 0.78rem; color: rgba(var(--nq-brown-dark-rgb), 0.45); margin: 0; }

.tl-drawer__checks { display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; }
.tl-drawer__checks--disabled { opacity: 0.5; }
.tl-drawer__checks--disabled .tl-drawer__check-item { cursor: not-allowed; }
.tl-drawer__checks--disabled .tl-drawer__checkbox { cursor: not-allowed; }

.tl-drawer__seg { display: flex; gap: 6px; }
.tl-drawer__seg-btn {
  flex: 1;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid rgba(92, 51, 23, 0.25);
  background: transparent;
  color: rgba(58, 26, 10, 0.6);
  font-family: var(--nq-font);
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}
.tl-drawer__seg-btn--active {
  background: var(--nq-brown, #5C3317);
  color: #edc78e;
  border-color: var(--nq-brown, #5C3317);
}

.tl-drawer__check-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.88rem;
  color: var(--nq-brown-dark, #3A1A0A);
  transition: background 0.12s;
}

.tl-drawer__check-item:hover { background: rgba(var(--nq-brown-rgb), 0.06); }

.tl-drawer__checkbox { width: 16px; height: 16px; accent-color: var(--nq-brown, #5C3317); cursor: pointer; flex-shrink: 0; }

.tl-drawer__footer { margin-top: auto; padding: 1rem; border-top: 1px solid rgba(var(--nq-brown-rgb), 0.1); }

.tl__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-family: var(--nq-font);
  font-size: 0.85rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  min-height: 40px;
  white-space: nowrap;
  background: var(--nq-brown, #5C3317);
  color: #edc78e;
  transition: background 0.15s;
}

.tl__btn:hover { background: var(--nq-brown-dark, #3A1A0A); }
</style>
