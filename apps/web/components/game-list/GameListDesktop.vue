<script setup lang="ts">
const { t } = useI18n()

const {
  steamConnected, steamPersona, steamLoading, importLoading, importMessage,
  linkSteam, importSteam,
  enrichLoading, enrichGames,
  drawerOpen, searchQuery, selectedStatuses, activeFilterCount, STATUS_OPTIONS,
  toggleStatus, applyFilters, resetFilters,
  currentPage, totalPages, goToPage,
  gamesLoading, games,
  onStatusChange, onDeleteGame, onCardClick,
  addModalOpen,
} = inject<ReturnType<typeof useGameList>>('gameList')!
</script>

<template>
  <div class="gl">
    <!-- En-tête -->
    <div class="gl__header">
      <UiPageHeader>
        <h1 class="gl__title">{{ t('gameList.title') }}</h1>
      </UiPageHeader>

      <div class="gl__actions">
        <button
          v-if="!steamConnected"
          class="gl__btn gl__btn--steam"
          :disabled="steamLoading"
          @click="linkSteam"
        >
          <v-icon size="18">mdi-steam</v-icon>
          {{ steamLoading ? '…' : t('gameList.linkSteam') }}
        </button>

        <div v-else class="gl__steam-connected">
          <v-icon size="16" color="primary">mdi-steam</v-icon>
          <span class="gl__steam-name">{{ steamPersona ?? t('gameList.steamLinked') }}</span>
          <button class="gl__btn gl__btn--steam" :disabled="importLoading" @click="importSteam">
            <v-icon size="16">mdi-download</v-icon>
            {{ importLoading ? t('gameList.importing') : t('gameList.importSteam') }}
          </button>
        </div>

        <button
          v-if="games.length > 0"
          class="gl__btn gl__btn--igdb"
          :disabled="enrichLoading"
          :title="t('gameList.enrichIgdb')"
          @click="enrichGames"
        >
          <v-icon size="18">mdi-database-refresh-outline</v-icon>
          {{ enrichLoading ? t('gameList.enriching') : t('gameList.enrichIgdb') }}
        </button>

        <button class="gl__btn gl__btn--add" @click="addModalOpen = true">
          <v-icon size="18">mdi-plus</v-icon>
          {{ t('gameList.addGame') }}
        </button>
      </div>
    </div>

    <!-- Message import -->
    <Transition name="fade">
      <div
        v-if="importMessage"
        class="gl__import-msg"
        :class="`gl__import-msg--${importMessage.type}`"
      >
        <v-icon size="16">{{ importMessage.type === 'success' ? 'mdi-check-circle' : 'mdi-alert-circle' }}</v-icon>
        {{ importMessage.text }}
      </div>
    </Transition>

    <!-- Barre recherche + filtre -->
    <div class="gl__toolbar">
      <div class="gl__search-wrap">
        <label for="gl-search" class="sr-only">{{ t('gameList.searchPlaceholder') }}</label>
        <v-icon class="gl__search-icon" size="18">mdi-magnify</v-icon>
        <input
          id="gl-search"
          v-model="searchQuery"
          class="gl__search"
          type="search"
          :placeholder="t('gameList.searchPlaceholder')"
        />
      </div>
      <button class="gl__filter-toggle" :class="{ 'gl__filter-toggle--active': activeFilterCount > 0 }" @click="drawerOpen = true">
        <v-icon size="18">mdi-tune-variant</v-icon>
        {{ t('gameList.filterBtn') }}
        <span v-if="activeFilterCount > 0" class="gl__filter-badge">{{ activeFilterCount }}</span>
      </button>
    </div>

    <!-- Drawer filtres -->
    <v-navigation-drawer v-model="drawerOpen" location="right" temporary width="300">
      <div class="gl-drawer">
        <div class="gl-drawer__header">
          <span class="gl-drawer__title">{{ t('gameList.filterBtn') }}</span>
          <div class="gl-drawer__header-actions">
            <button v-if="activeFilterCount > 0" class="gl-drawer__reset" @click="resetFilters">
              {{ t('gameList.filterReset') }}
            </button>
            <button class="gl-drawer__close" :aria-label="t('gameList.filterClose')" @click="drawerOpen = false">
              <v-icon size="20">mdi-close</v-icon>
            </button>
          </div>
        </div>

        <div class="gl-drawer__section">
          <p class="gl-drawer__section-title">{{ t('gameList.status.label') }}</p>
          <div class="gl-drawer__checks">
            <label v-for="s in STATUS_OPTIONS" :key="s.key" class="gl-drawer__check-item">
              <input type="checkbox" class="gl-drawer__checkbox" :checked="selectedStatuses.includes(s.key)" @change="toggleStatus(s.key)" />
              <v-icon size="16">{{ s.icon }}</v-icon>
              <span>{{ t(`gameList.status.${s.key}`) }}</span>
            </label>
          </div>
        </div>

        <div class="gl-drawer__section gl-drawer__section--soon">
          <p class="gl-drawer__section-title">
            {{ t('gameList.filterPlatform') }}
            <span class="gl-drawer__soon">{{ t('gameList.soon') }}</span>
          </p>
          <div class="gl-drawer__chips">
            <span v-for="p in ['Steam', 'Switch', 'Xbox', 'PSN']" :key="p" class="gl-drawer__chip">{{ p }}</span>
          </div>
        </div>

        <div class="gl-drawer__section gl-drawer__section--soon">
          <p class="gl-drawer__section-title">
            {{ t('gameList.filterTags') }}
            <span class="gl-drawer__soon">{{ t('gameList.soon') }}</span>
          </p>
          <p class="gl-drawer__soon-hint">{{ t('gameList.filterTagsHint') }}</p>
        </div>

        <div class="gl-drawer__footer">
          <button class="gl__btn gl__btn--add" style="width:100%;justify-content:center" @click="applyFilters">
            {{ t('gameList.filterApply') }}
          </button>
        </div>
      </div>
    </v-navigation-drawer>

    <!-- Loader -->
    <div v-if="gamesLoading" class="gl__loader">
      <v-progress-circular indeterminate size="32" color="primary" />
    </div>

    <!-- Liste vide -->
    <div v-else-if="games.length === 0" class="gl__empty">
      <v-icon size="56" color="primary-light">mdi-gamepad-variant-outline</v-icon>
      <p class="gl__empty-title">{{ t('gameList.empty') }}</p>
      <p class="gl__empty-hint">{{ t('gameList.emptyHint') }}</p>
    </div>

    <!-- Grille de cards -->
    <div v-else class="gl__grid">
      <GameListCard
        v-for="game in games"
        :key="game.id"
        :game="game"
        @status-change="onStatusChange"
        @delete="onDeleteGame"
        @click="onCardClick"
      />
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="gl__pagination">
      <button class="gl__page-btn" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">
        <v-icon size="18">mdi-chevron-left</v-icon>
        {{ t('gameList.pagination.prev') }}
      </button>
      <span class="gl__page-info">
        {{ t('gameList.pagination.page', { current: currentPage, total: totalPages }) }}
      </span>
      <button class="gl__page-btn" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)">
        {{ t('gameList.pagination.next') }}
        <v-icon size="18">mdi-chevron-right</v-icon>
      </button>
    </div>

    <GameListAddModal :open="addModalOpen" @close="addModalOpen = false" />
  </div>
</template>

<style scoped>
.gl {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 1.25rem 1.25rem 3rem;
  font-family: var(--nq-font);
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.gl__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.gl__title {
  font-size: clamp(1.1rem, 3vw, 1.5rem);
  font-weight: bold;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
}

.gl__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.gl__btn {
  display: inline-flex;
  align-items: center;
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
  transition: background 0.15s, opacity 0.15s;
}

.gl__btn:disabled { opacity: 0.6; cursor: not-allowed; }
.gl__btn--steam { background: var(--brand-steam-bg); color: var(--brand-steam-text); }
.gl__btn--steam:hover:not(:disabled) { background: var(--brand-steam-bg-hover); }
.gl__btn--igdb { background: rgba(var(--nq-brown-rgb), 0.1); color: var(--nq-brown, #5C3317); border: 1px solid rgba(var(--nq-brown-rgb), 0.2); }
.gl__btn--igdb:hover:not(:disabled) { background: rgba(var(--nq-brown-rgb), 0.18); }
.gl__btn--add { background: var(--nq-brown, #5C3317); color: #edc78e; }
.gl__btn--add:hover { background: var(--nq-brown-dark, #3A1A0A); }

.gl__steam-connected {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(var(--nq-brown-rgb), 0.07);
  border-radius: 8px;
  padding: 6px 10px;
  flex-wrap: wrap;
}

.gl__steam-name { font-size: 0.8rem; color: var(--nq-brown, #5C3317); font-weight: 600; }

.gl__import-msg {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}

.gl__import-msg--success { background: var(--nq-success-bg); color: var(--nq-success-text); }
.gl__import-msg--error   { background: var(--nq-warning-bg); color: var(--nq-warning-text); }

.gl__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  text-align: center;
}

.gl__empty-title { font-size: 1.1rem; font-weight: bold; color: var(--nq-brown-dark, #3A1A0A); margin: 0; }
.gl__empty-hint { font-size: 0.9rem; color: rgba(var(--nq-brown-dark-rgb), 0.65); margin: 0; max-width: 340px; }

.gl__toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 1.25rem;
}

.gl__search-wrap { flex: 1; position: relative; display: flex; align-items: center; }

.gl__search-icon {
  position: absolute;
  left: 10px;
  color: rgba(var(--nq-brown-dark-rgb), 0.45);
  pointer-events: none;
}

.gl__search {
  width: 100%;
  padding: 8px 12px 8px 34px;
  border-radius: 10px;
  /* WCAG 1.4.11 : la bordure à 0.22 d'opacité ne ressortait pas assez du
     fond tricoté (1.46:1, Silktide). Même bordure que PatchInput.vue. */
  border: 1.5px solid var(--nq-brown-mid);
  background: rgba(var(--nq-white-rgb), 0.65);
  font-family: var(--nq-font);
  font-size: 0.88rem;
  color: var(--nq-brown-dark, #3A1A0A);
  outline: none;
  transition: border-color 0.15s, background 0.15s;
  height: 40px;
}

.gl__search::placeholder { color: rgba(var(--nq-brown-dark-rgb), 0.4); }
.gl__search:focus { border-color: rgba(var(--nq-brown-rgb), 0.5); background: #fff; }
.gl__search::-webkit-search-cancel-button { cursor: pointer; }

.gl__filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid rgba(var(--nq-brown-rgb), 0.22);
  background: rgba(var(--nq-white-rgb), 0.65);
  color: var(--nq-brown-dark, #3A1A0A);
  font-family: var(--nq-font);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  position: relative;
  transition: background 0.15s, border-color 0.15s;
}

.gl__filter-toggle:hover { background: rgba(var(--nq-brown-rgb), 0.06); border-color: rgba(var(--nq-brown-rgb), 0.4); }
.gl__filter-toggle--active { border-color: var(--nq-brown, #5C3317); color: var(--nq-brown, #5C3317); }

.gl__filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--nq-brown, #5C3317);
  color: var(--nq-cream-light);
  font-size: 0.65rem;
  font-weight: 700;
}

.gl-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: var(--nq-font);
}

.gl-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1rem 0.75rem;
  border-bottom: 1px solid rgba(var(--nq-brown-rgb), 0.1);
}

.gl-drawer__title { font-size: 1rem; font-weight: 700; color: var(--nq-brown-dark, #3A1A0A); }
.gl-drawer__header-actions { display: flex; align-items: center; gap: 8px; }

.gl-drawer__reset {
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--nq-font);
  font-size: 0.78rem;
  color: var(--nq-brown, #5C3317);
  text-decoration: underline;
  padding: 0;
}

.gl-drawer__close {
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(var(--nq-brown-dark-rgb), 0.5);
  padding: 2px;
  border-radius: 4px;
  display: flex;
}

.gl-drawer__close:hover { color: var(--nq-brown-dark, #3A1A0A); }

.gl-drawer__section { padding: 1rem 1rem 0.5rem; border-bottom: 1px solid rgba(var(--nq-brown-rgb), 0.08); }
.gl-drawer__section--soon { opacity: 0.55; pointer-events: none; user-select: none; }

.gl-drawer__section-title {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  /* WCAG 1.4.3 : 0.55 donnait 3.61:1 sur le fond crème (Silktide), sous
     les 4.5:1 requis pour ce texte de petite taille (9.4pt). */
  color: rgba(var(--nq-brown-dark-rgb), 0.7);
  margin: 0 0 0.75rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.gl-drawer__soon {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
  background: rgba(var(--nq-brown-rgb), 0.12);
  color: var(--nq-brown, #5C3317);
  padding: 2px 7px;
  border-radius: 999px;
}

.gl-drawer__soon-hint { font-size: 0.78rem; color: rgba(var(--nq-brown-dark-rgb), 0.45); margin: 0; }

.gl-drawer__checks { display: flex; flex-direction: column; gap: 6px; }

.gl-drawer__check-item {
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

.gl-drawer__check-item:hover { background: rgba(var(--nq-brown-rgb), 0.06); }

.gl-drawer__checkbox { width: 16px; height: 16px; accent-color: var(--nq-brown, #5C3317); cursor: pointer; flex-shrink: 0; }

.gl-drawer__chips { display: flex; flex-wrap: wrap; gap: 6px; }

.gl-drawer__chip {
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid rgba(var(--nq-brown-rgb), 0.2);
  font-size: 0.78rem;
  color: rgba(var(--nq-brown-dark-rgb), 0.6);
  background: transparent;
}

.gl-drawer__footer { margin-top: auto; padding: 1rem; border-top: 1px solid rgba(var(--nq-brown-rgb), 0.1); }

.gl__loader { display: flex; justify-content: center; padding: 3rem 0; }

.gl__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 12px;
}

.gl__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
}

.gl__page-btn {
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
  transition: background 0.15s;
}

.gl__page-btn:hover:not(:disabled) { background: rgba(var(--nq-brown-rgb), 0.08); }
.gl__page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.gl__page-info { font-size: 0.85rem; color: rgba(var(--nq-brown-dark-rgb), 0.7); font-variant-numeric: tabular-nums; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
