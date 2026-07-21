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
  <div class="glm">

    <!-- ── Header fixe ── -->
    <div class="glm__head">
      <UiPageHeader>
        <h1 class="glm__title">{{ t('gameList.title') }}</h1>
      </UiPageHeader>

      <!-- Actions Steam / IGDB / Ajouter -->
      <div class="glm__actions">
        <button
          v-if="!steamConnected"
          class="glm__btn glm__btn--steam"
          :disabled="steamLoading"
          @click="linkSteam"
        >
          <v-icon size="16">mdi-steam</v-icon>
          {{ steamLoading ? '…' : t('gameList.linkSteam') }}
        </button>

        <div v-else class="glm__steam-row">
          <v-icon size="14" color="primary">mdi-steam</v-icon>
          <span class="glm__steam-name">{{ steamPersona ?? t('gameList.steamLinked') }}</span>
          <button class="glm__btn glm__btn--steam" :disabled="importLoading" @click="importSteam">
            <v-icon size="14">mdi-download</v-icon>
            {{ importLoading ? t('gameList.importing') : t('gameList.importSteam') }}
          </button>
        </div>

        <button class="glm__btn glm__btn--add" @click="addModalOpen = true">
          <v-icon size="16">mdi-plus</v-icon>
          {{ t('gameList.addGame') }}
        </button>
      </div>

      <!-- Message import -->
      <Transition name="fade">
        <div
          v-if="importMessage"
          class="glm__import-msg"
          :class="`glm__import-msg--${importMessage.type}`"
        >
          <v-icon size="14">{{ importMessage.type === 'success' ? 'mdi-check-circle' : 'mdi-alert-circle' }}</v-icon>
          {{ importMessage.text }}
        </div>
      </Transition>

      <!-- Toolbar recherche + filtre -->
      <div class="glm__toolbar">
        <div class="glm__search-wrap">
          <label for="glm-search" class="sr-only">{{ t('gameList.searchPlaceholder') }}</label>
          <v-icon class="glm__search-icon" size="16">mdi-magnify</v-icon>
          <input
            id="glm-search"
            v-model="searchQuery"
            class="glm__search"
            type="search"
            :placeholder="t('gameList.searchPlaceholder')"
          />
        </div>
        <button
          class="glm__filter-toggle"
          :class="{ 'glm__filter-toggle--active': activeFilterCount > 0 }"
          :aria-label="t('gameList.filterBtn')"
          @click="drawerOpen = true"
        >
          <v-icon size="16">mdi-tune-variant</v-icon>
          <span v-if="activeFilterCount > 0" class="glm__filter-badge">{{ activeFilterCount }}</span>
        </button>
      </div>
    </div>

    <!-- ── Zone scrollable ── -->
    <div class="glm__body">

      <!-- Enrichir IGDB (caché sur mobile pour gain de place, accessible via actions) -->
      <button
        v-if="games.length > 0"
        class="glm__enrich-btn"
        :disabled="enrichLoading"
        @click="enrichGames"
      >
        <v-icon size="14">mdi-database-refresh-outline</v-icon>
        {{ enrichLoading ? t('gameList.enriching') : t('gameList.enrichIgdb') }}
      </button>

      <!-- Loader -->
      <div v-if="gamesLoading" class="glm__loader">
        <v-progress-circular indeterminate size="28" color="primary" />
      </div>

      <!-- Vide -->
      <div v-else-if="games.length === 0" class="glm__empty">
        <v-icon size="48" color="primary-light">mdi-gamepad-variant-outline</v-icon>
        <p class="glm__empty-title">{{ t('gameList.empty') }}</p>
        <p class="glm__empty-hint">{{ t('gameList.emptyHint') }}</p>
      </div>

      <!-- Grille -->
      <div v-else class="glm__grid">
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
      <div v-if="totalPages > 1" class="glm__pagination">
        <button class="glm__page-btn" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">
          <v-icon size="16">mdi-chevron-left</v-icon>
        </button>
        <span class="glm__page-info">{{ currentPage }} / {{ totalPages }}</span>
        <button class="glm__page-btn" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)">
          <v-icon size="16">mdi-chevron-right</v-icon>
        </button>
      </div>
    </div>

    <!-- ── Drawer filtres ── -->
    <v-navigation-drawer v-model="drawerOpen" location="right" temporary width="300">
      <div class="gl-drawer">
        <div class="gl-drawer__header">
          <span class="gl-drawer__title">{{ t('gameList.filterBtn') }}</span>
          <div class="gl-drawer__header-actions">
            <button v-if="activeFilterCount > 0" class="gl-drawer__reset" @click="resetFilters">
              {{ t('gameList.filterReset') }}
            </button>
            <button class="gl-drawer__close" @click="drawerOpen = false">
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
        </div>

        <div class="gl-drawer__footer">
          <button class="glm__btn glm__btn--add" style="width:100%;justify-content:center" @click="applyFilters">
            {{ t('gameList.filterApply') }}
          </button>
        </div>
      </div>
    </v-navigation-drawer>

    <GameListAddModal :open="addModalOpen" @close="addModalOpen = false" />
  </div>
</template>

<style scoped>
/* ── Conteneur principal : hauteur fixe, pas de scroll body ── */
.glm {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 64px); /* 64px = bottom nav */
  overflow: hidden;
  font-family: var(--nq-font);
}

/* ── Zone header fixe (ne scrolle pas) ── */
.glm__head {
  flex-shrink: 0;
  padding: 0 0.75rem;
  /* Le UiPageHeader sticky gère son propre top:0 */
}

.glm__title {
  font-size: 1.25rem;
  font-weight: bold;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
}

/* ── Actions ── */
.glm__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding-bottom: 0.5rem;
}

.glm__steam-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(var(--nq-brown-rgb), 0.07);
  border-radius: 8px;
  padding: 5px 8px;
}

.glm__steam-name {
  font-size: 0.75rem;
  color: var(--nq-brown, #5C3317);
  font-weight: 600;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.glm__btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border-radius: 8px;
  font-family: var(--nq-font);
  font-size: 0.78rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  min-height: 36px;
  white-space: nowrap;
  transition: background 0.15s, opacity 0.15s;
}

.glm__btn:disabled { opacity: 0.6; cursor: not-allowed; }

.glm__btn--steam { background: var(--brand-steam-bg); color: var(--brand-steam-text); }
.glm__btn--steam:hover:not(:disabled) { background: var(--brand-steam-bg-hover); }

.glm__btn--add { background: var(--nq-brown, #5C3317); color: #edc78e; }
.glm__btn--add:hover { background: var(--nq-brown-dark, #3A1A0A); }

/* ── Message import ── */
.glm__import-msg {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 0.8rem;
  margin-bottom: 0.5rem;
}
.glm__import-msg--success { background: var(--nq-success-bg); color: var(--nq-success-text); }
.glm__import-msg--error   { background: var(--nq-warning-bg); color: var(--nq-warning-text); }

/* ── Toolbar ── */
.glm__toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding-bottom: 0.5rem;
}

.glm__search-wrap {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.glm__search-icon {
  position: absolute;
  left: 8px;
  color: rgba(var(--nq-brown-dark-rgb), 0.45);
  pointer-events: none;
}

.glm__search {
  width: 100%;
  padding: 7px 10px 7px 30px;
  border-radius: 10px;
  /* WCAG 1.4.11 : la bordure à 0.22 d'opacité ne ressortait pas assez du
     fond tricoté (1.46:1, Silktide). Même bordure que PatchInput.vue. */
  border: 1.5px solid var(--nq-brown-mid);
  background: rgba(var(--nq-white-rgb), 0.65);
  font-family: var(--nq-font);
  font-size: 0.85rem;
  color: var(--nq-brown-dark, #3A1A0A);
  outline: none;
  height: 38px;
}

.glm__search::placeholder { color: rgba(var(--nq-brown-dark-rgb), 0.4); }
.glm__search:focus { border-color: rgba(var(--nq-brown-rgb), 0.5); background: #fff; }

.glm__filter-toggle {
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

.glm__filter-toggle--active { border-color: var(--nq-brown, #5C3317); color: var(--nq-brown, #5C3317); }

.glm__filter-badge {
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

/* ── Zone scrollable ── */
.glm__body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0.25rem 0.75rem 1rem;
}

.glm__enrich-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 6px;
  font-family: var(--nq-font);
  font-size: 0.72rem;
  background: rgba(var(--nq-brown-rgb), 0.08);
  color: var(--nq-brown, #5C3317);
  border: 1px solid rgba(var(--nq-brown-rgb), 0.18);
  cursor: pointer;
  margin-bottom: 0.75rem;
}

.glm__loader {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}

.glm__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  text-align: center;
}

.glm__empty-title {
  font-size: 1rem;
  font-weight: bold;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
}

.glm__empty-hint {
  font-size: 0.85rem;
  color: rgba(var(--nq-brown-dark-rgb), 0.6);
  margin: 0;
  max-width: 280px;
}

.glm__grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.glm__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.25rem;
  padding-bottom: 0.5rem;
}

.glm__page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid rgba(var(--nq-brown-rgb), 0.25);
  background: transparent;
  color: var(--nq-brown, #5C3317);
  cursor: pointer;
}

.glm__page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.glm__page-btn:hover:not(:disabled) { background: rgba(var(--nq-brown-rgb), 0.08); }

.glm__page-info {
  font-size: 0.85rem;
  color: rgba(var(--nq-brown-dark-rgb), 0.7);
}

/* ── Drawer ── */
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

.gl-drawer__section {
  padding: 1rem 1rem 0.5rem;
  border-bottom: 1px solid rgba(var(--nq-brown-rgb), 0.08);
}

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

.gl-drawer__checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--nq-brown, #5C3317);
  cursor: pointer;
  flex-shrink: 0;
}

.gl-drawer__footer {
  margin-top: auto;
  padding: 1rem;
  border-top: 1px solid rgba(var(--nq-brown-rgb), 0.1);
}

/* ── Transitions ── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
