<script setup lang="ts">
import type { UserGame, GameStatus, CollectionListResponse } from '~/types/game'
import { toUserGame } from '~/types/game'

definePageMeta({ ssr: false })

const { t } = useI18n()
const { authFetch, apiBase } = useAuthFetch()

// ── Steam ────────────────────────────────────────────────
const steamConnected = ref(false)
const steamPersona = ref<string | null>(null)
const steamLoading = ref(false)
const importLoading = ref(false)
const importMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

async function fetchSteamStatus() {
  try {
    const res = await authFetch<{ connected: boolean; personaName: string | null }>(
      `${apiBase}/api/platforms/steam`,
    )
    steamConnected.value = res.connected
    steamPersona.value = res.personaName
  } catch { /* pas de compte lié ou erreur réseau — on ignore silencieusement */ }
}

async function linkSteam() {
  steamLoading.value = true
  try {
    const res = await authFetch<{ url: string }>(
      `${apiBase}/api/platforms/steam/link`,
    )
    window.location.href = res.url
  } catch {
    steamLoading.value = false
  }
}

async function importSteam() {
  importLoading.value = true
  importMessage.value = null
  try {
    const res = await authFetch<{ imported: number; warning?: string }>(
      `${apiBase}/api/platforms/steam/import`,
      { method: 'POST' },
    )
    importMessage.value = {
      type: 'success',
      text: res.warning ?? `${res.imported} ${t('gameList.importSuccess')}`,
    }
    await fetchGames()
  } catch {
    importMessage.value = { type: 'error', text: t('gameList.importError') }
  } finally {
    importLoading.value = false
  }
}

// ── IGDB — enrichissement ────────────────────────────────
const enrichLoading = ref(false)

async function enrichGames() {
  enrichLoading.value = true
  try {
    await authFetch(`${apiBase}/api/users/me/library/enrich`, {
      method: 'POST',

    })
    await fetchGames()
  } catch { /* erreur silencieuse — l'enrich est best-effort */ }
  finally {
    enrichLoading.value = false
  }
}

// ── Filtres, recherche, drawer ───────────────────────────
const LIMIT = 20
const drawerOpen = ref(false)
const searchQuery = ref('')
const selectedStatuses = ref<GameStatus[]>([])

const STATUS_OPTIONS: { key: GameStatus; icon: string }[] = [
  { key: 'playing',   icon: 'mdi-play-circle-outline' },
  { key: 'backlog',   icon: 'mdi-bookmark-outline' },
  { key: 'completed', icon: 'mdi-check-circle-outline' },
  { key: 'abandoned', icon: 'mdi-close-circle-outline' },
]

const activeFilterCount = computed(() => selectedStatuses.value.length)

function toggleStatus(status: GameStatus) {
  const idx = selectedStatuses.value.indexOf(status)
  if (idx >= 0) selectedStatuses.value.splice(idx, 1)
  else selectedStatuses.value.push(status)
}

function applyFilters() {
  currentPage.value = 1
  drawerOpen.value = false
  fetchGames()
}

function resetFilters() {
  selectedStatuses.value = []
  currentPage.value = 1
  fetchGames()
  drawerOpen.value = false
}

// Debounce sur la recherche : attend 350 ms d'inactivité avant d'appeler l'API
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    fetchGames()
  }, 350)
})

// ── Pagination ───────────────────────────────────────────
const currentPage = ref(1)
const total = ref(0)
const totalPages = computed(() => Math.ceil(total.value / LIMIT))

function goToPage(page: number) {
  currentPage.value = page
  fetchGames()
}

// ── Liste des jeux ───────────────────────────────────────
const gamesLoading = ref(false)
const games = ref<UserGame[]>([])

async function fetchGames() {
  gamesLoading.value = true
  try {
    const query: Record<string, string | number> = {
      limit: LIMIT,
      offset: (currentPage.value - 1) * LIMIT,
    }
    if (searchQuery.value.trim()) query.search = searchQuery.value.trim()
    // API supporte un seul status pour l'instant — multi-select prévu côté API
    if (selectedStatuses.value.length === 1) query.status = selectedStatuses.value[0]

    const res = await authFetch<CollectionListResponse>(`${apiBase}/api/collection`, {
      query,

    })
    games.value = res.items.map(toUserGame)
    total.value = res.total
  } catch { /* conserve les données actuelles en cas d'erreur réseau */ }
  finally { gamesLoading.value = false }
}

// ── Actions sur les jeux ─────────────────────────────────
async function onStatusChange(userGameId: string, status: GameStatus) {
  const game = games.value.find(g => g.id === userGameId)
  if (!game) return
  const previous = game.status
  game.status = status
  try {
    await authFetch(`${apiBase}/api/collection/${userGameId}/status`, {
      method: 'PATCH',
      body: { status },

    })
    // Recharge si le statut sorti du filtre actif
    if (selectedStatuses.value.length === 1 && !selectedStatuses.value.includes(status)) {
      await fetchGames()
    }
  } catch {
    game.status = previous
  }
}

async function onDeleteGame(userGameId: string) {
  games.value = games.value.filter(g => g.id !== userGameId)
  total.value = Math.max(0, total.value - 1)
  // Revenir à la page précédente si la page courante est maintenant vide
  if (games.value.length === 0 && currentPage.value > 1) {
    currentPage.value--
  }
  try {
    await authFetch(`${apiBase}/api/collection/${userGameId}`, {
      method: 'DELETE',

    })
  } catch {
    await fetchGames()
  }
}

function onCardClick(userGameId: string) {
  navigateTo(`/games/${userGameId}`)
}

// ── Modale d'ajout ───────────────────────────────────────
const addModalOpen = ref(false)

// ── Init ─────────────────────────────────────────────────
onMounted(() => {
  fetchSteamStatus()
  fetchGames()

  // Message de confirmation après retour OAuth Steam
  const route = useRoute()
  if (route.query.steam === 'linked') {
    importMessage.value = { type: 'success', text: t('gameList.steamLinkedSuccess') }
    navigateTo('/game-list', { replace: true })
  }
})
</script>

<template>
  <div class="gl">
    <NuxtLink to="/dashboard" class="gl__back">
      <v-icon size="20">mdi-arrow-left</v-icon>
      {{ t('nav.dashboard') }}
    </NuxtLink>

    <!-- En-tête -->
    <div class="gl__header">
      <h1 class="gl__title">{{ t('gameList.title') }}</h1>

      <div class="gl__actions">
        <!-- Lier / Importer Steam -->
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
          <v-icon size="16" color="#5C3317">mdi-steam</v-icon>
          <span class="gl__steam-name">{{ steamPersona ?? t('gameList.steamLinked') }}</span>
          <button
            class="gl__btn gl__btn--steam"
            :disabled="importLoading"
            @click="importSteam"
          >
            <v-icon size="16">mdi-download</v-icon>
            {{ importLoading ? t('gameList.importing') : t('gameList.importSteam') }}
          </button>
        </div>

        <!-- Enrichir via IGDB -->
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

        <!-- Ajouter manuellement -->
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
        <v-icon class="gl__search-icon" size="18">mdi-magnify</v-icon>
        <input
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
            <button class="gl-drawer__close" @click="drawerOpen = false">
              <v-icon size="20">mdi-close</v-icon>
            </button>
          </div>
        </div>

        <!-- Statut -->
        <div class="gl-drawer__section">
          <p class="gl-drawer__section-title">{{ t('gameList.status.label') }}</p>
          <div class="gl-drawer__checks">
            <label v-for="s in STATUS_OPTIONS" :key="s.key" class="gl-drawer__check-item">
              <input
                type="checkbox"
                class="gl-drawer__checkbox"
                :checked="selectedStatuses.includes(s.key)"
                @change="toggleStatus(s.key)"
              />
              <v-icon size="16">{{ s.icon }}</v-icon>
              <span>{{ t(`gameList.status.${s.key}`) }}</span>
            </label>
          </div>
        </div>

        <!-- Plateforme -->
        <div class="gl-drawer__section gl-drawer__section--soon">
          <p class="gl-drawer__section-title">
            {{ t('gameList.filterPlatform') }}
            <span class="gl-drawer__soon">{{ t('gameList.soon') }}</span>
          </p>
          <div class="gl-drawer__chips">
            <span v-for="p in ['Steam', 'Switch', 'Xbox', 'PSN']" :key="p" class="gl-drawer__chip">{{ p }}</span>
          </div>
        </div>

        <!-- Tags / Catégories -->
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
      <v-progress-circular indeterminate size="32" color="#5C3317" />
    </div>

    <!-- Liste vide -->
    <div v-else-if="games.length === 0" class="gl__empty">
      <v-icon size="56" color="#a07850">mdi-gamepad-variant-outline</v-icon>
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
      <button
        class="gl__page-btn"
        :disabled="currentPage === 1"
        @click="goToPage(currentPage - 1)"
      >
        <v-icon size="18">mdi-chevron-left</v-icon>
        {{ t('gameList.pagination.prev') }}
      </button>

      <span class="gl__page-info">
        {{ t('gameList.pagination.page', { current: currentPage, total: totalPages }) }}
      </span>

      <button
        class="gl__page-btn"
        :disabled="currentPage === totalPages"
        @click="goToPage(currentPage + 1)"
      >
        {{ t('gameList.pagination.next') }}
        <v-icon size="18">mdi-chevron-right</v-icon>
      </button>
    </div>

    <!-- Modale d'ajout IGDB -->
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

@media (max-width: 600px) {
  .gl { padding: 1rem 0.75rem 3rem; }
}

.gl__back {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--nq-brown-dark, #3A1A0A);
  font-size: 0.85rem;
  text-decoration: none;
  opacity: 0.7;
  margin-bottom: 1rem;
  transition: opacity 0.15s;
}

.gl__back:hover { opacity: 1; }

/* ── En-tête ── */
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

@media (max-width: 600px) {
  .gl__header { flex-direction: column; align-items: flex-start; }
  .gl__actions { width: 100%; }
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

.gl__btn--steam {
  background: #1b2838;
  color: #c6d4df;
}

.gl__btn--steam:hover:not(:disabled) { background: #2a475e; }

.gl__btn--igdb {
  background: rgba(92, 51, 23, 0.1);
  color: var(--nq-brown, #5C3317);
  border: 1px solid rgba(92, 51, 23, 0.2);
}

.gl__btn--igdb:hover:not(:disabled) { background: rgba(92, 51, 23, 0.18); }

.gl__btn--add {
  background: var(--nq-brown, #5C3317);
  color: #edc78e;
}

.gl__btn--add:hover { background: var(--nq-brown-dark, #3A1A0A); }

/* ── Steam connecté ── */
.gl__steam-connected {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(92, 51, 23, 0.07);
  border-radius: 8px;
  padding: 6px 10px;
  flex-wrap: wrap;
}

.gl__steam-name {
  font-size: 0.8rem;
  color: var(--nq-brown, #5C3317);
  font-weight: 600;
}

@media (max-width: 600px) {
  .gl__btn { font-size: 0.78rem; padding: 7px 12px; }
  .gl__steam-name { display: none; }
}

/* ── Message import ── */
.gl__import-msg {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}

.gl__import-msg--success { background: #d4edda; color: #1a5c2a; }
.gl__import-msg--error   { background: #fdebc8; color: #7a4a00; }

/* ── Vide ── */
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

.gl__empty-title {
  font-size: 1.1rem;
  font-weight: bold;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
}

.gl__empty-hint {
  font-size: 0.9rem;
  color: rgba(58, 26, 10, 0.6);
  margin: 0;
  max-width: 340px;
}

/* ── Toolbar recherche + filtre ── */
.gl__toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 1.25rem;
}

.gl__search-wrap {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.gl__search-icon {
  position: absolute;
  left: 10px;
  color: rgba(58, 26, 10, 0.45);
  pointer-events: none;
}

.gl__search {
  width: 100%;
  padding: 8px 12px 8px 34px;
  border-radius: 10px;
  border: 1px solid rgba(92, 51, 23, 0.22);
  background: rgba(255, 255, 255, 0.65);
  font-family: var(--nq-font);
  font-size: 0.88rem;
  color: var(--nq-brown-dark, #3A1A0A);
  outline: none;
  transition: border-color 0.15s, background 0.15s;
  height: 40px;
}

.gl__search::placeholder { color: rgba(58, 26, 10, 0.4); }
.gl__search:focus {
  border-color: rgba(92, 51, 23, 0.5);
  background: #fff;
}
.gl__search::-webkit-search-cancel-button { cursor: pointer; }

.gl__filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid rgba(92, 51, 23, 0.22);
  background: rgba(255, 255, 255, 0.65);
  color: var(--nq-brown-dark, #3A1A0A);
  font-family: var(--nq-font);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  position: relative;
  transition: background 0.15s, border-color 0.15s;
}

.gl__filter-toggle:hover {
  background: rgba(92, 51, 23, 0.06);
  border-color: rgba(92, 51, 23, 0.4);
}

.gl__filter-toggle--active {
  border-color: var(--nq-brown, #5C3317);
  color: var(--nq-brown, #5C3317);
}

.gl__filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--nq-brown, #5C3317);
  color: #edc78e;
  font-size: 0.65rem;
  font-weight: 700;
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
  border-bottom: 1px solid rgba(92, 51, 23, 0.1);
}

.gl-drawer__title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--nq-brown-dark, #3A1A0A);
}

.gl-drawer__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

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
  color: rgba(58, 26, 10, 0.5);
  padding: 2px;
  border-radius: 4px;
  display: flex;
}

.gl-drawer__close:hover { color: var(--nq-brown-dark, #3A1A0A); }

.gl-drawer__section {
  padding: 1rem 1rem 0.5rem;
  border-bottom: 1px solid rgba(92, 51, 23, 0.08);
}

.gl-drawer__section--soon {
  opacity: 0.55;
  pointer-events: none;
  user-select: none;
}

.gl-drawer__section-title {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(58, 26, 10, 0.55);
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
  background: rgba(92, 51, 23, 0.12);
  color: var(--nq-brown, #5C3317);
  padding: 2px 7px;
  border-radius: 999px;
}

.gl-drawer__soon-hint {
  font-size: 0.78rem;
  color: rgba(58, 26, 10, 0.45);
  margin: 0;
}

.gl-drawer__checks {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

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

.gl-drawer__check-item:hover { background: rgba(92, 51, 23, 0.06); }

.gl-drawer__checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--nq-brown, #5C3317);
  cursor: pointer;
  flex-shrink: 0;
}

.gl-drawer__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.gl-drawer__chip {
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid rgba(92, 51, 23, 0.2);
  font-size: 0.78rem;
  color: rgba(58, 26, 10, 0.6);
  background: transparent;
}

.gl-drawer__footer {
  margin-top: auto;
  padding: 1rem;
  border-top: 1px solid rgba(92, 51, 23, 0.1);
}

/* ── Loader ── */
.gl__loader {
  display: flex;
  justify-content: center;
  padding: 3rem 0;
}

/* ── Grille ── */
.gl__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 12px;
}

/* ── Pagination ── */
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
  border: 1px solid rgba(92, 51, 23, 0.25);
  background: transparent;
  color: var(--nq-brown, #5C3317);
  font-family: var(--nq-font);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.gl__page-btn:hover:not(:disabled) {
  background: rgba(92, 51, 23, 0.08);
}

.gl__page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.gl__page-info {
  font-size: 0.85rem;
  color: rgba(58, 26, 10, 0.7);
  font-variant-numeric: tabular-nums;
}

/* ── Transitions ── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
