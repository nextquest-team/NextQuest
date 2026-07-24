<script setup lang="ts">
import type { TimelineTab } from '~/types/timeline'

defineProps<{
  activeTab: TimelineTab
}>()

defineEmits<{
  'update:activeTab': [value: TimelineTab]
}>()

const { t } = useI18n()

const {
  drawerOpen, searchQuery, activeFilterCount,
  upcomingLoading, upcomingError, hasMore, fetchUpcoming, loadMoreUpcoming,
  searchActive, searchLoading, searchError,
  filteredUpcoming, filteredFollowed,
  isFollowed, toggleFollow,
} = inject<ReturnType<typeof useTimeline>>('timeline')!
</script>

<template>
  <div class="tl tl--mobile">
    <!-- Header sticky (hors de la zone scrollable) -->
    <div class="tl-mobile-header">
      <UiPageHeader>
        <div class="tl-title-text">
          <h1 class="tl-title">{{ t('timeline.title') }}</h1>
          <p class="tl-subtitle">{{ t('timeline.subtitle') }}</p>
        </div>
      </UiPageHeader>

      <TimelineTabs
        :active-tab="activeTab"
        @update:active-tab="$emit('update:activeTab', $event)"
      />

      <!-- Toolbar recherche + filtre -->
      <div class="tl__toolbar">
        <div class="tl__search-wrap">
          <label for="tlm-search" class="sr-only">{{ t('timeline.searchPlaceholder') }}</label>
          <v-icon class="tl__search-icon" size="16">mdi-magnify</v-icon>
          <input
            id="tlm-search"
            v-model="searchQuery"
            class="tl__search"
            type="search"
            :placeholder="t('timeline.searchPlaceholder')"
          />
        </div>
        <button
          class="tl__filter-toggle"
          :class="{ 'tl__filter-toggle--active': activeFilterCount > 0 }"
          :aria-label="t('timeline.filterBtn')"
          @click="drawerOpen = true"
        >
          <v-icon size="16">mdi-tune-variant</v-icon>
          <span v-if="activeFilterCount > 0" class="tl__filter-badge">{{ activeFilterCount }}</span>
        </button>
      </div>
    </div>

    <!-- Contenu scrollable -->
    <div class="tl-mobile-body">
      <!-- Onglet "Propheties a venir" -->
      <template v-if="activeTab === 'upcoming'">
        <div v-if="(searchActive ? searchLoading : upcomingLoading) && filteredUpcoming.length === 0" class="tl__loader">
          <v-progress-circular :aria-label="t('common.loading')" indeterminate size="28" color="primary" />
        </div>
        <div v-else-if="searchActive ? searchError : upcomingError" class="tl__empty">
          <v-icon size="48" color="error">mdi-alert-circle-outline</v-icon>
          <p class="tl__empty-title">{{ t('timeline.loadError') }}</p>
          <button v-if="!searchActive" class="tl__btn" @click="fetchUpcoming()">{{ t('timeline.retry') }}</button>
        </div>
        <div v-else-if="filteredUpcoming.length === 0" class="tl__empty">
          <v-icon size="48" color="primary-light">mdi-crystal-ball</v-icon>
          <p class="tl__empty-title">{{ t('timeline.upcomingEmpty') }}</p>
        </div>
        <template v-else>
          <div class="tl__grid">
            <TimelineGameCard
              v-for="game in filteredUpcoming"
              :key="game.igdbId"
              :game="game"
              :followed="isFollowed(game.igdbId)"
              @toggle-follow="toggleFollow"
            />
          </div>
          <div v-if="!searchActive && hasMore" class="tl__load-more">
            <button class="tl__load-more-btn" :disabled="upcomingLoading" @click="loadMoreUpcoming">
              {{ upcomingLoading ? t('common.loading') : t('timeline.loadMore') }}
            </button>
          </div>
        </template>
      </template>

      <!-- Onglet "Quetes annoncees" (suivi, stub local) -->
      <template v-else>
        <div v-if="filteredFollowed.length === 0" class="tl__empty">
          <v-icon size="48" color="primary-light">mdi-sword-cross</v-icon>
          <p class="tl__empty-title">{{ t('timeline.followedEmpty') }}</p>
          <p class="tl__empty-hint">{{ t('timeline.followedEmptyHint') }}</p>
        </div>
        <div v-else class="tl__grid">
          <TimelineGameCard
            v-for="game in filteredFollowed"
            :key="game.igdbId"
            :game="game"
            :followed="true"
            @toggle-follow="toggleFollow"
          />
        </div>
      </template>
    </div>

    <!-- Drawer filtres -->
    <TimelineFilterDrawer :active-tab="activeTab" />
  </div>
</template>

<style scoped>
.tl--mobile {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 64px); /* 64px = bottom nav */
  overflow: hidden;
  font-family: var(--nq-font);
}

.tl-mobile-header {
  flex-shrink: 0;
  padding: 0 1rem;
}

.tl-mobile-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0 1rem 1.5rem;
}

.tl-title-text {
  display: flex;
  flex-direction: column;
}

.tl-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
}

.tl-subtitle {
  font-size: 0.85rem;
  color: rgba(var(--nq-brown-dark-rgb), 0.7);
  margin: 0;
  font-style: italic;
}

.tl__toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding-bottom: 0.75rem;
}

.tl__search-wrap { flex: 1; position: relative; display: flex; align-items: center; }

.tl__search-icon {
  position: absolute;
  left: 8px;
  color: rgba(var(--nq-brown-dark-rgb), 0.45);
  pointer-events: none;
}

.tl__search {
  width: 100%;
  padding: 7px 10px 7px 30px;
  border-radius: 10px;
  border: 1.5px solid var(--nq-brown-mid);
  background: rgba(var(--nq-white-rgb), 0.65);
  font-family: var(--nq-font);
  font-size: 0.85rem;
  color: var(--nq-brown-dark, #3A1A0A);
  outline: none;
  height: 38px;
}

.tl__search::placeholder { color: rgba(var(--nq-brown-dark-rgb), 0.4); }
.tl__search:focus { border-color: rgba(var(--nq-brown-rgb), 0.5); background: #fff; }

.tl__filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid rgba(var(--nq-brown-rgb), 0.22);
  background: rgba(var(--nq-white-rgb), 0.65);
  color: var(--nq-brown-dark, #3A1A0A);
  font-family: var(--nq-font);
  cursor: pointer;
  position: relative;
}

.tl__filter-toggle--active { border-color: var(--nq-brown, #5C3317); color: var(--nq-brown, #5C3317); }

.tl__filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--nq-brown, #5C3317);
  color: var(--nq-cream-light);
  font-size: 0.6rem;
  font-weight: 700;
}

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

.tl__load-more-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid rgba(var(--nq-brown-rgb), 0.25);
  background: transparent;
  color: var(--nq-brown, #5C3317);
  font-family: var(--nq-font);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.tl__load-more-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.tl__loader { display: flex; justify-content: center; padding: 2rem 0; }

.tl__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem 1rem;
  text-align: center;
}

.tl__empty-title { font-size: 1rem; font-weight: bold; color: var(--nq-brown-dark, #3A1A0A); margin: 0; }
.tl__empty-hint { font-size: 0.85rem; color: rgba(var(--nq-brown-dark-rgb), 0.6); margin: 0; max-width: 280px; }

.tl__grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tl__load-more {
  display: flex;
  justify-content: center;
  margin-top: 1.25rem;
  padding-bottom: 0.5rem;
}

</style>
