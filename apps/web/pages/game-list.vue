<script setup lang="ts">
import { $fetch } from 'ofetch'
import type { UserGame, GameStatus } from '~/types/game'

definePageMeta({ ssr: false })

const { t } = useI18n()
const store = useAuthStore()
const config = useRuntimeConfig()
const apiBase = config.public.apiBase

function authHeaders() {
  return { Authorization: `Bearer ${store.accessToken}` }
}

// ── Steam ────────────────────────────────────────────────
const steamConnected = ref(false)
const steamPersona = ref<string | null>(null)
const steamLoading = ref(false)
const importLoading = ref(false)
const importMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

async function fetchSteamStatus() {
  try {
    const res = await $fetch<{ connected: boolean; personaName: string | null }>(
      `${apiBase}/api/platforms/steam`,
      { credentials: 'include', headers: authHeaders() },
    )
    steamConnected.value = res.connected
    steamPersona.value = res.personaName
  } catch { /* pas de compte lié ou erreur réseau — on ignore silencieusement */ }
}

async function linkSteam() {
  steamLoading.value = true
  try {
    const res = await $fetch<{ url: string }>(
      `${apiBase}/api/platforms/steam/link`,
      { credentials: 'include', headers: authHeaders() },
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
    const res = await $fetch<{ imported: number; warning?: string }>(
      `${apiBase}/api/platforms/steam/import`,
      { method: 'POST', credentials: 'include', headers: authHeaders() },
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
    await $fetch(`${apiBase}/api/users/me/library/enrich`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
    })
    await fetchGames()
  } catch { /* erreur silencieuse — l'enrich est best-effort */ }
  finally {
    enrichLoading.value = false
  }
}

// ── Liste des jeux ───────────────────────────────────────
// TODO(JB): remplacer le stub par GET /api/collection quand l'endpoint sera disponible.
// Structure attendue : UserGame[] avec { id, gameId, title, coverUrl, status, playtimeMinutes }
const gamesLoading = ref(false)
const games = ref<UserGame[]>([
  { id: 'ug-1', gameId: 'g-1', title: 'Hollow Knight', coverUrl: null, status: 'playing', playtimeMinutes: 1240 },
  { id: 'ug-2', gameId: 'g-2', title: 'Zelda: Breath of the Wild', coverUrl: null, status: 'completed', playtimeMinutes: 3600 },
  { id: 'ug-3', gameId: 'g-3', title: 'Portal 2', coverUrl: null, status: 'backlog', playtimeMinutes: 0 },
])

async function fetchGames() {
  // TODO(JB): décommenter quand GET /api/collection est disponible
  // gamesLoading.value = true
  // try {
  //   games.value = await $fetch<UserGame[]>(`${apiBase}/api/collection`, {
  //     credentials: 'include',
  //     headers: authHeaders(),
  //   })
  // } catch { /* conserve les données actuelles en cas d'erreur */ }
  // finally { gamesLoading.value = false }
}

// ── Actions sur les jeux ─────────────────────────────────
async function onStatusChange(userGameId: string, status: GameStatus) {
  const game = games.value.find(g => g.id === userGameId)
  if (!game) return
  const previous = game.status
  game.status = status
  try {
    await $fetch(`${apiBase}/api/collection/${userGameId}/status`, {
      method: 'PATCH',
      body: { status },
      credentials: 'include',
      headers: authHeaders(),
    })
  } catch {
    game.status = previous
  }
}

function onDeleteGame(id: string) {
  games.value = games.value.filter(g => g.id !== id)
  // TODO(JB): DELETE /api/collection/:userGameId (endpoint à venir)
}

function onCardClick(gameId: string) {
  navigateTo(`/games/${gameId}`)
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

    <!-- Liste vide -->
    <div v-if="games.length === 0" class="gl__empty">
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

    <!-- Modale d'ajout IGDB -->
    <GameListAddModal :open="addModalOpen" @close="addModalOpen = false" />
  </div>
</template>

<style scoped>
.gl {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 1rem 3rem;
  font-family: var(--nq-font);
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
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
  font-size: clamp(1.2rem, 3vw, 1.5rem);
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
}

.gl__steam-name {
  font-size: 0.8rem;
  color: var(--nq-brown, #5C3317);
  font-weight: 600;
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

/* ── Grille ── */
.gl__grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Transitions ── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
