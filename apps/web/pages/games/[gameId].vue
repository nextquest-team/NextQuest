<script setup lang="ts">
import { $fetch } from 'ofetch'
import type { GameStatus, GameDetail } from '~/types/game'

definePageMeta({ ssr: false })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useAuthStore()
const config = useRuntimeConfig()
const apiBase = config.public.apiBase

function authHeaders() {
  return { Authorization: `Bearer ${store.accessToken}` }
}

// TODO(JB): remplacer le stub par GET /api/collection/:userGameId + données IGDB quand disponible.
// Structure attendue : GameDetail avec { id, gameId, title, coverUrl, status, playtimeMinutes, igdb: IgdbData | null }
const STUB_GAMES: GameDetail[] = [
  {
    id: 'ug-1',
    gameId: 'g-1',
    title: 'Hollow Knight',
    coverUrl: null,
    status: 'playing',
    playtimeMinutes: 1240,
    igdb: {
      summary: 'Forge your own path in Hollow Knight! An epic action adventure through a vast ruined kingdom of insects and heroes. Explore twisting caverns, battle tainted creatures and befriend bizarre bugs, all while unraveling an ancient mystery at the kingdom\'s heart.',
      releaseDate: '2017-02-24',
      developer: 'Team Cherry',
      publisher: 'Team Cherry',
      genres: ['Platformer', 'Action', 'Adventure'],
      platforms: ['PC', 'Nintendo Switch', 'PS4', 'Xbox One'],
      igdbRating: 91,
    },
  },
  {
    id: 'ug-2',
    gameId: 'g-2',
    title: 'Zelda: Breath of the Wild',
    coverUrl: null,
    status: 'completed',
    playtimeMinutes: 3600,
    igdb: {
      summary: 'Step into a world of discovery, exploration, and adventure in The Legend of Zelda: Breath of the Wild. Travel across vast fields, through forests, and to mountain peaks as you discover what has become of the ruined kingdom of Hyrule.',
      releaseDate: '2017-03-03',
      developer: 'Nintendo EPD',
      publisher: 'Nintendo',
      genres: ['RPG', 'Action', 'Adventure'],
      platforms: ['Nintendo Switch', 'Wii U'],
      igdbRating: 97,
    },
  },
  {
    id: 'ug-3',
    gameId: 'g-3',
    title: 'Portal 2',
    coverUrl: null,
    status: 'backlog',
    playtimeMinutes: 0,
    igdb: {
      summary: 'The single-player portion of Portal 2 introduces a cast of dynamic new characters, a host of fresh puzzle elements, and a much larger set of devious test chambers.',
      releaseDate: '2011-04-18',
      developer: 'Valve',
      publisher: 'Valve',
      genres: ['Puzzle', 'Platformer'],
      platforms: ['PC', 'PS3', 'Xbox 360'],
      igdbRating: 95,
    },
  },
]

const STATUSES: { key: GameStatus; icon: string }[] = [
  { key: 'backlog',   icon: 'mdi-bookmark-outline' },
  { key: 'playing',  icon: 'mdi-play-circle-outline' },
  { key: 'completed', icon: 'mdi-check-circle-outline' },
  { key: 'abandoned', icon: 'mdi-close-circle-outline' },
]

// TODO(JB): décommenter quand GET /api/collection/:userGameId est disponible
// const game = ref<GameDetail | null>(null)
// onMounted(async () => {
//   try {
//     game.value = await $fetch<GameDetail>(`${apiBase}/api/collection/${route.params.gameId}`, {
//       credentials: 'include',
//       headers: authHeaders(),
//     })
//   } catch { /* game reste null → affiche l'écran "introuvable" */ }
// })
const game = ref<GameDetail | null>(
  STUB_GAMES.find(g => g.gameId === route.params.gameId) ?? null,
)

function formatPlaytime(minutes: number | undefined) {
  if (!minutes) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return t('gameDetail.playtimeValue', { h, m: m.toString().padStart(2, '0') })
}

function formatReleaseDate(raw: string | null) {
  if (!raw) return null
  return new Date(raw).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

async function onStatusChange(status: GameStatus) {
  if (!game.value) return
  const previous = game.value.status
  game.value.status = status
  try {
    await $fetch(`${apiBase}/api/collection/${game.value.id}/status`, {
      method: 'PATCH',
      body: { status },
      credentials: 'include',
      headers: authHeaders(),
    })
  } catch {
    game.value.status = previous
  }
}

const showRemoveConfirm = ref(false)

async function confirmRemove() {
  showRemoveConfirm.value = false
  // TODO(JB): DELETE /api/collection/:userGameId quand l'endpoint sera disponible
  // try {
  //   await $fetch(`${apiBase}/api/collection/${game.value?.id}`, {
  //     method: 'DELETE',
  //     credentials: 'include',
  //     headers: authHeaders(),
  //   })
  // } catch { /* ignorer — on navigue quand même */ }
  router.back()
}
</script>

<template>
  <div class="gd">
    <!-- Bouton retour -->
    <button class="gd__back" @click="router.back()">
      <v-icon size="20">mdi-arrow-left</v-icon>
      {{ t('gameDetail.back') }}
    </button>

    <!-- Jeu introuvable -->
    <div v-if="!game" class="gd__not-found">
      <v-icon size="56" color="#a07850">mdi-help-circle-outline</v-icon>
      <p class="gd__nf-title">{{ t('gameDetail.notFound') }}</p>
      <p class="gd__nf-hint">{{ t('gameDetail.notFoundHint') }}</p>
    </div>

    <template v-else>
      <!-- Hero : cover + titre + statut -->
      <div class="gd__hero">
        <div class="gd__cover">
          <img v-if="game.coverUrl" :src="game.coverUrl" :alt="game.title" class="gd__cover-img" />
          <div v-else class="gd__cover-placeholder">
            <v-icon size="56" color="#a07850">mdi-gamepad-variant</v-icon>
          </div>
        </div>

        <div class="gd__hero-info">
          <h1 class="gd__title">{{ game.title }}</h1>

          <!-- Statut -->
          <p class="gd__label">{{ t('gameDetail.status') }}</p>
          <div class="gd__statuses">
            <button
              v-for="s in STATUSES"
              :key="s.key"
              class="gd__status-btn"
              :class="{ 'gd__status-btn--active': game.status === s.key }"
              :aria-pressed="game.status === s.key"
              :title="t(`gameList.status.${s.key}`)"
              @click="onStatusChange(s.key)"
            >
              <v-icon size="15">{{ s.icon }}</v-icon>
              {{ t(`gameList.status.${s.key}`) }}
            </button>
          </div>

          <!-- Temps de jeu -->
          <p class="gd__label">{{ t('gameDetail.playtime') }}</p>
          <p class="gd__value">
            {{ formatPlaytime(game.playtimeMinutes) ?? t('gameDetail.playtimeNone') }}
          </p>
        </div>
      </div>

      <!-- Bannière IGDB coming soon si pas de données -->
      <div v-if="!game.igdb" class="gd__coming-soon">
        <v-icon size="18" color="#a07850">mdi-information-outline</v-icon>
        {{ t('gameDetail.comingSoon') }}
      </div>

      <template v-else>
        <!-- Synopsis -->
        <section class="gd__section">
          <h2 class="gd__section-title">{{ t('gameDetail.summary') }}</h2>
          <p class="gd__summary">{{ game.igdb.summary ?? t('gameDetail.noSummary') }}</p>
        </section>

        <!-- Infos IGDB -->
        <section class="gd__section">
          <dl class="gd__meta">
            <template v-if="game.igdb.releaseDate">
              <dt class="gd__dt">{{ t('gameDetail.releaseDate') }}</dt>
              <dd class="gd__dd">{{ formatReleaseDate(game.igdb.releaseDate) }}</dd>
            </template>

            <template v-if="game.igdb.developer">
              <dt class="gd__dt">{{ t('gameDetail.developer') }}</dt>
              <dd class="gd__dd">{{ game.igdb.developer }}</dd>
            </template>

            <template v-if="game.igdb.publisher && game.igdb.publisher !== game.igdb.developer">
              <dt class="gd__dt">{{ t('gameDetail.publisher') }}</dt>
              <dd class="gd__dd">{{ game.igdb.publisher }}</dd>
            </template>

            <template v-if="game.igdb.genres.length">
              <dt class="gd__dt">{{ t('gameDetail.genres') }}</dt>
              <dd class="gd__dd">
                <span v-for="g in game.igdb.genres" :key="g" class="gd__chip">{{ g }}</span>
              </dd>
            </template>

            <template v-if="game.igdb.platforms.length">
              <dt class="gd__dt">{{ t('gameDetail.platforms') }}</dt>
              <dd class="gd__dd">
                <span v-for="p in game.igdb.platforms" :key="p" class="gd__chip">{{ p }}</span>
              </dd>
            </template>

            <template v-if="game.igdb.igdbRating !== null">
              <dt class="gd__dt">{{ t('gameDetail.igdbRating') }}</dt>
              <dd class="gd__dd">
                <span class="gd__rating">
                  <v-icon size="16" color="#c8a44a">mdi-star</v-icon>
                  {{ game.igdb.igdbRating }}<span class="gd__rating-max">/100</span>
                </span>
              </dd>
            </template>
          </dl>
        </section>
      </template>

      <!-- Retirer de la liste -->
      <div class="gd__danger">
        <button class="gd__remove-btn" @click="showRemoveConfirm = true">
          <v-icon size="16">mdi-trash-can-outline</v-icon>
          {{ t('gameDetail.removeGame') }}
        </button>
      </div>

      <!-- Confirmation suppression -->
      <Transition name="modal">
        <div v-if="showRemoveConfirm" class="gd__confirm-backdrop" role="dialog" aria-modal="true" @click.self="showRemoveConfirm = false">
          <div class="gd__confirm-box">
            <p class="gd__confirm-text">{{ t('gameDetail.removeConfirm') }}</p>
            <div class="gd__confirm-actions">
              <button class="gd__confirm-btn gd__confirm-btn--cancel" @click="showRemoveConfirm = false">
                {{ t('profil.cancel') }}
              </button>
              <button class="gd__confirm-btn gd__confirm-btn--delete" @click="confirmRemove">
                {{ t('gameDetail.removeGame') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
.gd {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 1rem 3rem;
  font-family: var(--nq-font);
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}

/* ── Retour ── */
.gd__back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--nq-brown, #5C3317);
  font-family: var(--nq-font);
  font-size: 0.85rem;
  font-weight: 600;
  padding: 4px 0;
  margin-bottom: 1.25rem;
  opacity: 0.8;
  transition: opacity 0.15s;
  align-self: flex-start;
}

.gd__back:hover { opacity: 1; }

/* ── Not found ── */
.gd__not-found {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  text-align: center;
  padding: 3rem 1rem;
}

.gd__nf-title {
  font-size: 1.1rem;
  font-weight: bold;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
}

.gd__nf-hint {
  font-size: 0.9rem;
  color: rgba(58, 26, 10, 0.6);
  margin: 0;
}

/* ── Hero ── */
.gd__hero {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
  margin-bottom: 1.75rem;
}

.gd__cover {
  flex-shrink: 0;
  width: 140px;
  min-height: 190px;
  background: rgba(92, 51, 23, 0.08);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gd__cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.gd__cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 190px;
}

.gd__hero-info {
  flex: 1;
  min-width: 0;
}

.gd__title {
  font-size: clamp(1.2rem, 3.5vw, 1.6rem);
  font-weight: bold;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0 0 1rem;
  line-height: 1.25;
}

/* ── Label / Value ── */
.gd__label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(58, 26, 10, 0.5);
  margin: 0 0 6px;
}

.gd__value {
  font-size: 0.9rem;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0 0 1rem;
}

/* ── Statuts ── */
.gd__statuses {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 1rem;
}

.gd__status-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid rgba(92, 51, 23, 0.25);
  background: transparent;
  color: rgba(58, 26, 10, 0.6);
  font-family: var(--nq-font);
  font-size: 0.75rem;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
  min-height: 30px;
}

.gd__status-btn:hover:not(.gd__status-btn--active) {
  background: rgba(92, 51, 23, 0.08);
  color: var(--nq-brown-dark, #3A1A0A);
}

.gd__status-btn--active {
  background: var(--nq-brown, #5C3317);
  color: #edc78e;
  border-color: var(--nq-brown, #5C3317);
}

/* ── Coming soon ── */
.gd__coming-soon {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(200, 164, 74, 0.1);
  border: 1px solid rgba(200, 164, 74, 0.3);
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 0.85rem;
  color: rgba(58, 26, 10, 0.7);
  margin-bottom: 1.5rem;
}

/* ── Sections ── */
.gd__section {
  margin-bottom: 1.75rem;
}

.gd__section-title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(58, 26, 10, 0.5);
  margin: 0 0 0.6rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid rgba(92, 51, 23, 0.1);
}

.gd__summary {
  font-size: 0.9rem;
  line-height: 1.65;
  color: rgba(58, 26, 10, 0.85);
  margin: 0;
}

/* ── Meta DL ── */
.gd__meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 16px;
  margin: 0;
}

.gd__dt {
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(58, 26, 10, 0.5);
  white-space: nowrap;
  align-self: start;
  padding-top: 2px;
}

.gd__dd {
  font-size: 0.875rem;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* ── Chips ── */
.gd__chip {
  display: inline-block;
  background: rgba(92, 51, 23, 0.08);
  color: var(--nq-brown, #5C3317);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 0.78rem;
  font-weight: 600;
}

/* ── Note IGDB ── */
.gd__rating {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--nq-brown-dark, #3A1A0A);
}

.gd__rating-max {
  font-size: 0.75rem;
  font-weight: 400;
  color: rgba(58, 26, 10, 0.45);
}

/* ── Danger zone ── */
.gd__danger {
  margin-top: auto;
  padding-top: 2rem;
  display: flex;
  justify-content: flex-end;
}

.gd__remove-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid rgba(139, 31, 31, 0.3);
  border-radius: 8px;
  padding: 8px 14px;
  font-family: var(--nq-font);
  font-size: 0.82rem;
  font-weight: 600;
  color: rgba(139, 31, 31, 0.65);
  cursor: pointer;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}

.gd__remove-btn:hover {
  background: rgba(139, 31, 31, 0.06);
  color: #8B1F1F;
  border-color: rgba(139, 31, 31, 0.5);
}

/* ── Confirm ── */
.gd__confirm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(30, 14, 4, 0.55);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.gd__confirm-box {
  background: var(--nq-cream, #F8F4EA);
  border-radius: 14px;
  padding: 1.5rem;
  max-width: 340px;
  width: 100%;
  box-shadow: 0 8px 32px rgba(58, 26, 10, 0.2);
}

.gd__confirm-text {
  font-size: 0.95rem;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0 0 1.25rem;
  text-align: center;
}

.gd__confirm-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.gd__confirm-btn {
  flex: 1;
  padding: 9px 16px;
  border-radius: 8px;
  font-family: var(--nq-font);
  font-size: 0.85rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}

.gd__confirm-btn--cancel {
  background: rgba(92, 51, 23, 0.1);
  color: var(--nq-brown, #5C3317);
}

.gd__confirm-btn--cancel:hover { background: rgba(92, 51, 23, 0.18); }

.gd__confirm-btn--delete {
  background: #8B1F1F;
  color: #fff;
}

.gd__confirm-btn--delete:hover { background: #6e1818; }

/* ── Transition ── */
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

/* ── Responsive ── */
@media (max-width: 480px) {
  .gd__hero { flex-direction: column; }
  .gd__cover { width: 100%; min-height: 220px; }
}
</style>
