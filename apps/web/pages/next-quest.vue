<script setup lang="ts">
import type { RecommendationDTO, GroupedRecommendations, FeedbackAction } from '~/types/recommendations'

definePageMeta({ ssr: false })

const { t } = useI18n()
const { authFetch, apiBase } = useAuthFetch()

// ── State ────────────────────────────────────────────────────────────────
const loading = ref(false)
const generating = ref(false)
const error = ref(false)
const feedbackPending = ref<string | null>(null)

const discovery = ref<RecommendationDTO | null>(null)
const libraryUnplayed = ref<RecommendationDTO | null>(null)
const upcoming = ref<RecommendationDTO | null>(null)

const hasAnyReco = computed(() =>
  discovery.value || libraryUnplayed.value || upcoming.value,
)

// ── Fetch ─────────────────────────────────────────────────────────────────
async function fetchRecos() {
  loading.value = true
  error.value = false
  try {
    const res = await authFetch<GroupedRecommendations>(`${apiBase}/api/recommendations`)
    discovery.value = res.discovery[0] ?? null
    libraryUnplayed.value = res.libraryUnplayed[0] ?? null
    upcoming.value = res.upcoming[0] ?? null
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

async function generate() {
  generating.value = true
  error.value = false
  try {
    await authFetch(`${apiBase}/api/recommendations/generate`, { method: 'POST' })
    await fetchRecos()
  } catch {
    error.value = true
  } finally {
    generating.value = false
  }
}

// ── Feedback ──────────────────────────────────────────────────────────────
async function sendFeedback(reco: RecommendationDTO, action: FeedbackAction) {
  if (feedbackPending.value) return
  feedbackPending.value = reco.id
  try {
    await authFetch(`${apiBase}/api/recommendations/${reco.id}/feedback`, {
      method: 'POST',
      body: { action },
    })
    if (reco.bucket === 'discovery') discovery.value = null
    if (reco.bucket === 'library_unplayed') libraryUnplayed.value = null
    if (reco.bucket === 'upcoming') upcoming.value = null
  } catch { /* conserve l'état en cas d'erreur réseau */ }
  finally {
    feedbackPending.value = null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
}

function ratingStars(rating: number | null): string {
  if (rating === null) return ''
  const r = Math.round(rating / 2)
  return '★'.repeat(Math.min(r, 5)) + '☆'.repeat(Math.max(0, 5 - r))
}

onMounted(() => fetchRecos())
</script>

<template>
  <div class="nq-page">

    <!-- ── Topbar ─────────────────────────────────────────── -->
    <div class="nq-topbar">
      <NuxtLink to="/dashboard" class="nq-back">
        <v-icon size="16">mdi-arrow-left</v-icon>
        {{ t('nav.dashboard') }}
      </NuxtLink>
      <header class="nq-header">
        <h1 class="nq-title">{{ t('nextQuest.title') }}</h1>
        <p class="nq-subtitle">{{ t('nextQuest.subtitle') }}</p>
      </header>
    </div>

    <!-- ── Chargement ─────────────────────────────────────── -->
    <div v-if="loading" class="nq-state">
      <v-progress-circular indeterminate size="40" color="#5C3317" />
    </div>

    <!-- ── Erreur ─────────────────────────────────────────── -->
    <div v-else-if="error" class="nq-state">
      <v-icon size="48" color="#8B1F1F">mdi-alert-circle-outline</v-icon>
      <p class="nq-state__title">Impossible de charger les recommandations</p>
      <button class="patch-btn" @click="fetchRecos">Réessayer</button>
    </div>

    <!-- ── Vide : pas encore de recos ────────────────────── -->
    <div v-else-if="!hasAnyReco" class="nq-state">
      <img src="/images/dashboard/turning-wheel.png" alt="" class="nq-state__wheel" />
      <p class="nq-state__title">{{ t('nextQuest.emptyTitle') }}</p>
      <p class="nq-state__hint">{{ t('nextQuest.emptyHint') }}</p>
      <button class="patch-btn" :disabled="generating" @click="generate">
        <v-icon size="18">mdi-compass-rose</v-icon>
        {{ generating ? t('nextQuest.generating') : t('nextQuest.generate') }}
      </button>
    </div>

    <!-- ── Stage : carte + cartes overlay ────────────────── -->
    <div v-else class="nq-map-stage">

      <!-- Bannière portrait (mobile uniquement) -->
      <img
        class="nq-mobile-map"
        src="/images/next-quest/carte-au-tresor.png"
        alt="Carte des aventures"
      />

      <!-- ── Slot Découverte ─────────────────────────────── -->
      <div class="nq-slot nq-slot--discovery">
        <template v-if="discovery">
          <div class="nq-quest-card nq-quest-card--main">
            <div class="nq-card-badge nq-card-badge--discovery">
              <v-icon size="13">mdi-compass-rose</v-icon>
              {{ t('nextQuest.buckets.discovery') }}
            </div>
            <div class="nq-card-body">
              <div class="nq-card-cover">
                <img
                  v-if="discovery.game.coverUrl"
                  :src="discovery.game.coverUrl"
                  :alt="discovery.game.title"
                />
                <div v-else class="nq-card-cover-ph">
                  <v-icon size="32" color="#a07850">mdi-gamepad-variant</v-icon>
                </div>
              </div>
              <div class="nq-card-info">
                <span class="nq-card-title">{{ discovery.game.title }}</span>
                <div v-if="discovery.game.genres.length" class="nq-tags">
                  <span
                    v-for="g in discovery.game.genres.slice(0, 3)"
                    :key="g.id"
                    class="nq-tag"
                  >{{ g.name }}</span>
                </div>
                <div class="nq-card-meta">
                  <span v-if="discovery.game.igdbRating" class="nq-rating">
                    {{ ratingStars(discovery.game.igdbRating) }}
                    <span class="nq-rating__num">{{ (discovery.game.igdbRating / 10).toFixed(1) }}/10</span>
                  </span>
                  <span v-if="discovery.game.releaseDate" class="nq-date">
                    <v-icon size="12">mdi-calendar</v-icon>
                    {{ formatDate(discovery.game.releaseDate) }}
                  </span>
                </div>
                <p class="nq-card-reason">
                  <v-icon size="12" color="#a07850">mdi-lightning-bolt</v-icon>
                  {{ discovery.reason.text }}
                </p>
              </div>
            </div>
            <div class="nq-card-footer">
              <button
                class="nq-quest-cta"
                :disabled="feedbackPending === discovery.id"
                @click="sendFeedback(discovery, 'added')"
              >
                <v-icon size="15">mdi-sword</v-icon>
                {{ t('nextQuest.actions.add') }}
              </button>
              <button
                class="nq-quest-dismiss"
                :disabled="feedbackPending === discovery.id"
                @click="sendFeedback(discovery, 'dismissed')"
              >
                {{ t('nextQuest.actions.dismiss') }}
              </button>
            </div>
          </div>
        </template>
        <div v-else class="nq-slot-empty">
          <v-icon size="28" color="rgba(92,51,23,0.4)">mdi-compass-rose</v-icon>
          <p>{{ t('nextQuest.noReco') }}</p>
        </div>
      </div>

      <!-- ── Grille secondaire (bibliothèque + à venir) ──── -->
      <div class="nq-secondary">

        <!-- Slot Bibliothèque ────────────────────────────── -->
        <div class="nq-slot nq-slot--library">
          <template v-if="libraryUnplayed">
            <div class="nq-quest-card">
              <div class="nq-card-badge nq-card-badge--library">
                <v-icon size="11">mdi-bookshelf</v-icon>
                {{ t('nextQuest.buckets.libraryUnplayed') }}
              </div>
              <div class="nq-card-body">
                <div class="nq-card-cover nq-card-cover--sm">
                  <img
                    v-if="libraryUnplayed.game.coverUrl"
                    :src="libraryUnplayed.game.coverUrl"
                    :alt="libraryUnplayed.game.title"
                  />
                  <div v-else class="nq-card-cover-ph">
                    <v-icon size="22" color="#a07850">mdi-gamepad-variant</v-icon>
                  </div>
                </div>
                <div class="nq-card-info nq-card-info--sm">
                  <span class="nq-card-title">{{ libraryUnplayed.game.title }}</span>
                  <div v-if="libraryUnplayed.game.genres.length" class="nq-tags">
                    <span
                      v-for="g in libraryUnplayed.game.genres.slice(0, 2)"
                      :key="g.id"
                      class="nq-tag"
                    >{{ g.name }}</span>
                  </div>
                  <p class="nq-card-reason nq-card-reason--sm">{{ libraryUnplayed.reason.text }}</p>
                </div>
              </div>
              <div class="nq-card-footer">
                <button
                  class="nq-quest-cta nq-quest-cta--sm"
                  :disabled="feedbackPending === libraryUnplayed.id"
                  @click="sendFeedback(libraryUnplayed, 'liked')"
                >
                  <v-icon size="13">mdi-play</v-icon>
                  {{ t('nextQuest.actions.play') }}
                </button>
                <button
                  class="nq-quest-dismiss nq-quest-dismiss--sm"
                  :disabled="feedbackPending === libraryUnplayed.id"
                  @click="sendFeedback(libraryUnplayed, 'dismissed')"
                >
                  {{ t('nextQuest.actions.dismiss') }}
                </button>
              </div>
            </div>
          </template>
          <div v-else class="nq-slot-empty">
            <v-icon size="24" color="rgba(92,51,23,0.4)">mdi-bookshelf</v-icon>
            <p>{{ t('nextQuest.noReco') }}</p>
          </div>
        </div>

        <!-- Slot À venir ────────────────────────────────── -->
        <div class="nq-slot nq-slot--upcoming">
          <template v-if="upcoming">
            <div class="nq-quest-card">
              <div class="nq-card-badge nq-card-badge--upcoming">
                <v-icon size="11">mdi-calendar-star</v-icon>
                {{ t('nextQuest.buckets.upcoming') }}
              </div>
              <div class="nq-card-body">
                <div class="nq-card-cover nq-card-cover--sm">
                  <img
                    v-if="upcoming.game.coverUrl"
                    :src="upcoming.game.coverUrl"
                    :alt="upcoming.game.title"
                  />
                  <div v-else class="nq-card-cover-ph">
                    <v-icon size="22" color="#a07850">mdi-gamepad-variant</v-icon>
                  </div>
                </div>
                <div class="nq-card-info nq-card-info--sm">
                  <span class="nq-card-title">{{ upcoming.game.title }}</span>
                  <p v-if="upcoming.game.releaseDate" class="nq-date">
                    <v-icon size="12">mdi-calendar</v-icon>
                    {{ t('nextQuest.release') }} : {{ formatDate(upcoming.game.releaseDate) }}
                  </p>
                  <p class="nq-card-reason nq-card-reason--sm">{{ upcoming.reason.text }}</p>
                </div>
              </div>
              <div class="nq-card-footer">
                <button
                  class="nq-quest-cta nq-quest-cta--sm"
                  :disabled="feedbackPending === upcoming.id"
                  @click="sendFeedback(upcoming, 'liked')"
                >
                  <v-icon size="13">mdi-bell-outline</v-icon>
                  {{ t('nextQuest.actions.remind') }}
                </button>
                <button
                  class="nq-quest-dismiss nq-quest-dismiss--sm"
                  :disabled="feedbackPending === upcoming.id"
                  @click="sendFeedback(upcoming, 'dismissed')"
                >
                  {{ t('nextQuest.actions.dismiss') }}
                </button>
              </div>
            </div>
          </template>
          <div v-else class="nq-slot-empty">
            <v-icon size="24" color="rgba(92,51,23,0.4)">mdi-calendar-star</v-icon>
            <p>{{ t('nextQuest.noReco') }}</p>
          </div>
        </div>

      </div>

      <!-- ── Régénérer ────────────────────────────────────── -->
      <div class="nq-regen">
        <button class="patch-btn" :disabled="generating" @click="generate">
          <v-icon size="16">mdi-refresh</v-icon>
          {{ generating ? t('nextQuest.generating') : t('nextQuest.regenerate') }}
        </button>
      </div>

    </div>

  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════ */
.nq-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 0.75rem 1rem 1.5rem;
  font-family: var(--nq-font);
}

@media (min-width: 960px) {
  .nq-page {
    height: 100dvh;
    min-height: unset;
    overflow: hidden;
    padding: 0.5rem 1.25rem 0.75rem;
  }
}

/* ═══════════════════════════════════════════════════════
   TOPBAR
═══════════════════════════════════════════════════════ */
.nq-topbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.nq-back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--nq-brown-dark, #3A1A0A);
  font-size: 0.82rem;
  text-decoration: none;
  opacity: 0.6;
  flex-shrink: 0;
  transition: opacity 0.15s;
}
.nq-back:hover { opacity: 1; }

.nq-header { flex: 1; }

.nq-title {
  font-size: clamp(1.35rem, 4vw, 2rem);
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
  line-height: 1.1;
}

.nq-subtitle {
  font-size: 0.82rem;
  color: rgba(58, 26, 10, 0.5);
  margin: 0;
  font-style: italic;
}

@media (min-width: 960px) {
  .nq-topbar { margin-bottom: 0.4rem; }
  .nq-title  { font-size: 1.25rem; }
}

/* ═══════════════════════════════════════════════════════
   ÉTATS (chargement / erreur / vide)
═══════════════════════════════════════════════════════ */
.nq-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  text-align: center;
  padding: 2rem 1rem;
}

.nq-state__wheel {
  width: 100px;
  opacity: 0.5;
  animation: spin-slow 8s linear infinite;
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.nq-state__title {
  font-size: 1.05rem;
  font-weight: bold;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
}

.nq-state__hint {
  font-size: 0.85rem;
  color: rgba(58, 26, 10, 0.55);
  margin: 0;
  max-width: 300px;
}

/* ═══════════════════════════════════════════════════════
   MAP STAGE
═══════════════════════════════════════════════════════ */
.nq-map-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

@media (min-width: 960px) {
  .nq-map-stage {
    position: relative;
    display: block;
    background: url('/images/next-quest/carte-landscape.png') center / 100% 100% no-repeat;
    border-radius: 16px;
    overflow: hidden;
    box-shadow:
      0 10px 40px rgba(58, 26, 10, 0.28),
      0 2px 8px rgba(58, 26, 10, 0.12);
  }
}

/* ═══════════════════════════════════════════════════════
   BANNIÈRE PORTRAIT (mobile uniquement)
═══════════════════════════════════════════════════════ */
.nq-mobile-map {
  width: 100%;
  height: 200px;
  object-fit: cover;
  object-position: center 25%;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(58, 26, 10, 0.2);
}

@media (min-width: 960px) {
  .nq-mobile-map { display: none; }
}

/* ═══════════════════════════════════════════════════════
   SLOTS
═══════════════════════════════════════════════════════ */
/* Mobile : flux normal — position static par défaut */

@media (min-width: 960px) {
  /* Desktop : positionnement absolu sur la carte */
  .nq-slot { position: absolute; }

  /* Découverte : grande carte à gauche, centrée verticalement */
  .nq-slot--discovery {
    left: 2%;
    top: 50%;
    transform: translateY(-50%);
    width: 36%;
  }

  /* Bibliothèque : petite carte en haut à droite */
  .nq-slot--library {
    right: 2%;
    top: 4%;
    width: 31%;
  }

  /* À venir : petite carte en bas à droite */
  .nq-slot--upcoming {
    right: 2%;
    bottom: 7%;
    width: 31%;
  }
}

/* ═══════════════════════════════════════════════════════
   GRILLE SECONDAIRE (mobile : 2 colonnes)
═══════════════════════════════════════════════════════ */
.nq-secondary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

@media (max-width: 480px) {
  .nq-secondary { grid-template-columns: 1fr; }
}

@media (min-width: 960px) {
  /* Sur desktop les slots sont absolus, la grille n'existe plus */
  .nq-secondary { display: contents; }
}

/* ═══════════════════════════════════════════════════════
   QUEST CARD  — bordure laine (même principe que patch-btn)
═══════════════════════════════════════════════════════ */
.nq-quest-card {
  display: flex;
  flex-direction: column;
  /* Bordure laine tressée */
  border: 20px solid transparent;
  border-image: url('/images/buttons/wooly-btn-final.png') 350 fill round;
  background: transparent;
}

.nq-quest-card--main {
  border-width: 24px;
}

/* Compact sur desktop */
@media (min-width: 960px) {
  .nq-quest-card     { border-width: 18px; }
  .nq-quest-card--main { border-width: 22px; }
}

/* ═══════════════════════════════════════════════════════
   BADGE BUCKET
═══════════════════════════════════════════════════════ */
.nq-card-badge {
  padding: 5px 10px;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-bottom: 1px solid transparent;
}

.nq-card-badge--discovery {
  background: rgba(92, 51, 23, 0.10);
  color: #5C3317;
  border-bottom-color: rgba(92, 51, 23, 0.14);
}

.nq-card-badge--library {
  background: rgba(26, 47, 72, 0.09);
  color: #1A2F48;
  border-bottom-color: rgba(26, 47, 72, 0.12);
}

.nq-card-badge--upcoming {
  background: rgba(40, 65, 40, 0.09);
  color: #284128;
  border-bottom-color: rgba(40, 65, 40, 0.12);
}

/* ═══════════════════════════════════════════════════════
   CORPS DE LA CARD
═══════════════════════════════════════════════════════ */
.nq-card-body {
  display: flex;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
}

/* Cover */
.nq-card-cover {
  flex-shrink: 0;
  width: 90px;
  height: 120px;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(92, 51, 23, 0.06);
}

.nq-card-cover--sm {
  width: 68px;
  height: 90px;
}

.nq-card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.nq-card-cover-ph {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Info */
.nq-card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.nq-card-info--sm { gap: 4px; }

.nq-card-title {
  font-family: var(--nq-font);
  font-size: 1rem;
  font-weight: 700;
  color: #2A0D00;
  line-height: 1.2;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  letter-spacing: 0.01em;
}

.nq-quest-card--main .nq-card-title { font-size: 1.15rem; }

.nq-card-meta {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.nq-card-reason {
  font-size: 0.75rem;
  color: rgba(58, 26, 10, 0.58);
  font-style: italic;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.nq-card-reason--sm { font-size: 0.7rem; }

/* Desktop : corps compact */
@media (min-width: 960px) {
  .nq-card-body      { padding: 0.45rem 0.6rem; gap: 0.6rem; }
  .nq-card-cover     { width: 100px; height: 134px; }
  .nq-card-cover--sm { width: 78px; height: 104px; }
  .nq-card-title     { font-size: 0.95rem; }
  .nq-quest-card--main .nq-card-title { font-size: 1.08rem; }
  .nq-card-reason    { font-size: 0.72rem; }
  .nq-card-reason--sm { font-size: 0.68rem; }
}

/* ═══════════════════════════════════════════════════════
   FOOTER  (CTAs)
═══════════════════════════════════════════════════════ */
.nq-card-footer {
  display: flex;
  align-items: center;
  border-top: 1px solid rgba(92, 51, 23, 0.10);
}

/* Bouton CTA principal */
.nq-quest-cta {
  flex: 1;
  background: #A65D52;
  color: #F5EDDF;
  border: none;
  padding: 9px 12px;
  font-family: var(--nq-font);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: background 0.15s;
}
.nq-quest-cta:hover:not(:disabled) { background: #8B3D33; }
.nq-quest-cta:disabled { opacity: 0.5; cursor: not-allowed; }
.nq-quest-cta--sm { padding: 7px 10px; font-size: 0.76rem; gap: 5px; }

/* Bouton Décliner */
.nq-quest-dismiss {
  background: rgba(92, 51, 23, 0.06);
  border: none;
  border-left: 1px solid rgba(92, 51, 23, 0.10);
  color: rgba(58, 26, 10, 0.42);
  font-family: var(--nq-font);
  font-size: 0.7rem;
  padding: 9px 10px;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.12s, background 0.12s;
}
.nq-quest-dismiss:hover:not(:disabled) {
  color: rgba(58, 26, 10, 0.72);
  background: rgba(92, 51, 23, 0.13);
}
.nq-quest-dismiss:disabled { opacity: 0.35; cursor: not-allowed; }
.nq-quest-dismiss--sm { font-size: 0.65rem; padding: 7px 8px; }

/* Desktop : CTAs compact */
@media (min-width: 960px) {
  .nq-quest-cta       { padding: 7px 10px; font-size: 0.78rem; }
  .nq-quest-cta--sm   { padding: 6px 9px; font-size: 0.7rem; }
  .nq-quest-dismiss   { padding: 7px 8px; font-size: 0.65rem; }
  .nq-quest-dismiss--sm { padding: 6px 7px; font-size: 0.6rem; }
}

/* ═══════════════════════════════════════════════════════
   SLOT VIDE
═══════════════════════════════════════════════════════ */
.nq-slot-empty {
  border: 18px solid transparent;
  border-image: url('/images/buttons/wooly-btn-final.png') 350 fill round;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem;
  text-align: center;
  opacity: 0.55;
}

.nq-slot-empty p {
  font-size: 0.72rem;
  color: rgba(58, 26, 10, 0.5);
  margin: 0;
}

/* ═══════════════════════════════════════════════════════
   TAGS / RATING / DATE
═══════════════════════════════════════════════════════ */
.nq-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.nq-tag {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(202, 164, 109, 0.18);
  border: 1px solid rgba(202, 164, 109, 0.42);
  font-size: 0.64rem;
  color: #5C3317;
  white-space: nowrap;
}

.nq-rating {
  color: #c8860a;
  font-size: 0.76rem;
  display: flex;
  align-items: center;
  gap: 4px;
}

.nq-rating__num {
  font-size: 0.67rem;
  color: rgba(58, 26, 10, 0.5);
}

.nq-date {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.67rem;
  color: rgba(58, 26, 10, 0.5);
  margin: 0;
}

/* ═══════════════════════════════════════════════════════
   RÉGÉNÉRER
═══════════════════════════════════════════════════════ */
.nq-regen {
  display: flex;
  justify-content: center;
  padding: 0.25rem 0;
}

@media (min-width: 960px) {
  .nq-regen {
    position: absolute;
    bottom: 3%;
    left: 50%;
    transform: translateX(-50%);
    padding: 0;
    z-index: 1;
  }
}
</style>
