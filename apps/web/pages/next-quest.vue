<script setup lang="ts">
import { $fetch } from 'ofetch'
import type { RecommendationDTO, GroupedRecommendations, FeedbackAction } from '~/types/recommendations'

definePageMeta({ ssr: false })

const { t } = useI18n()
const store = useAuthStore()
const config = useRuntimeConfig()
const apiBase = config.public.apiBase

function authHeaders() {
  return { Authorization: `Bearer ${store.accessToken}` }
}

// ── State ───────────────────────────────────────────────────
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

// ── Fetch ───────────────────────────────────────────────────
async function fetchRecos() {
  loading.value = true
  error.value = false
  try {
    const res = await $fetch<GroupedRecommendations>(`${apiBase}/api/recommendations`, {
      credentials: 'include',
      headers: authHeaders(),
    })
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
    await $fetch(`${apiBase}/api/recommendations/generate`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
    })
    await fetchRecos()
  } catch {
    error.value = true
  } finally {
    generating.value = false
  }
}

// ── Feedback ────────────────────────────────────────────────
async function sendFeedback(reco: RecommendationDTO, action: FeedbackAction) {
  if (feedbackPending.value) return
  feedbackPending.value = reco.id
  try {
    await $fetch(`${apiBase}/api/recommendations/${reco.id}/feedback`, {
      method: 'POST',
      body: { action },
      credentials: 'include',
      headers: authHeaders(),
    })
    if (reco.bucket === 'discovery') discovery.value = null
    if (reco.bucket === 'library_unplayed') libraryUnplayed.value = null
    if (reco.bucket === 'upcoming') upcoming.value = null
  } catch { /* conserve l'état en cas d'erreur réseau */ }
  finally {
    feedbackPending.value = null
  }
}

// ── Helpers ─────────────────────────────────────────────────
function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
}

function ratingStars(rating: number | null): string {
  if (rating === null) return ''
  const r = Math.round(rating / 2) // IGDB: /100 → /10 → /5 étoiles
  return '★'.repeat(Math.min(r, 5)) + '☆'.repeat(Math.max(0, 5 - r))
}

onMounted(() => fetchRecos())
</script>

<template>
  <div class="nq-page">

    <!-- Navigation retour -->
    <NuxtLink to="/dashboard" class="nq-back">
      <v-icon size="20">mdi-arrow-left</v-icon>
      {{ t('nav.dashboard') }}
    </NuxtLink>

    <!-- En-tête -->
    <header class="nq-header">
      <h1 class="nq-title">{{ t('nextQuest.title') }}</h1>
      <p class="nq-subtitle">{{ t('nextQuest.subtitle') }}</p>
    </header>

    <!-- Loader -->
    <div v-if="loading" class="nq-loader">
      <v-progress-circular indeterminate size="40" color="#5C3317" />
    </div>

    <!-- Erreur -->
    <div v-else-if="error" class="nq-empty">
      <v-icon size="48" color="#8B1F1F">mdi-alert-circle-outline</v-icon>
      <p class="nq-empty__title">Impossible de charger les recommandations</p>
      <button class="nq-btn nq-btn--primary" @click="fetchRecos">Réessayer</button>
    </div>

    <!-- Vide : pas encore de recos -->
    <div v-else-if="!hasAnyReco" class="nq-empty">
      <img src="/images/dashboard/turning-wheel.png" alt="" class="nq-empty__wheel" />
      <p class="nq-empty__title">{{ t('nextQuest.emptyTitle') }}</p>
      <p class="nq-empty__hint">{{ t('nextQuest.emptyHint') }}</p>
      <button
        class="nq-btn nq-btn--primary"
        :disabled="generating"
        @click="generate"
      >
        <v-icon size="18">mdi-compass-rose</v-icon>
        {{ generating ? t('nextQuest.generating') : t('nextQuest.generate') }}
      </button>
    </div>

    <!-- Recommandations -->
    <template v-else>

      <!-- ── Hero : Découverte ─────────────────────── -->
      <section v-if="discovery" class="nq-hero">
        <div class="nq-hero__label">
          <v-icon size="16" color="#edc78e">mdi-compass-rose</v-icon>
          {{ t('nextQuest.buckets.discovery') }}
        </div>

        <div class="nq-hero__card">
          <!-- Cover -->
          <div class="nq-hero__cover-wrap">
            <img
              v-if="discovery.game.coverUrl"
              :src="discovery.game.coverUrl"
              :alt="discovery.game.title"
              class="nq-hero__cover"
            />
            <div v-else class="nq-hero__cover-placeholder">
              <v-icon size="64" color="#a07850">mdi-gamepad-variant</v-icon>
            </div>
          </div>

          <!-- Infos -->
          <div class="nq-hero__body">
            <h2 class="nq-hero__title">{{ discovery.game.title }}</h2>

            <!-- Genres -->
            <div v-if="discovery.game.genres.length" class="nq-hero__genres">
              <span
                v-for="g in discovery.game.genres.slice(0, 4)"
                :key="g.id"
                class="nq-tag"
              >{{ g.name }}</span>
            </div>

            <!-- Méta -->
            <div class="nq-hero__meta">
              <span v-if="discovery.game.igdbRating" class="nq-hero__rating" :title="t('nextQuest.rating')">
                {{ ratingStars(discovery.game.igdbRating) }}
                <span class="nq-hero__rating-num">{{ (discovery.game.igdbRating / 10).toFixed(1) }}/10</span>
              </span>
              <span v-if="discovery.game.releaseDate" class="nq-hero__date">
                <v-icon size="14">mdi-calendar</v-icon>
                {{ formatDate(discovery.game.releaseDate) }}
              </span>
            </div>

            <!-- Raison -->
            <p class="nq-hero__reason">
              <v-icon size="14" color="#a07850">mdi-lightning-bolt</v-icon>
              {{ discovery.reason.text }}
            </p>

            <!-- Actions -->
            <div class="nq-hero__actions">
              <button
                class="nq-btn nq-btn--primary"
                :disabled="feedbackPending === discovery.id"
                @click="sendFeedback(discovery, 'added')"
              >
                <v-icon size="18">mdi-plus</v-icon>
                {{ t('nextQuest.actions.add') }}
              </button>
              <button
                class="nq-btn nq-btn--ghost"
                :disabled="feedbackPending === discovery.id"
                @click="sendFeedback(discovery, 'dismissed')"
              >
                {{ t('nextQuest.actions.dismiss') }}
              </button>
            </div>
          </div>
        </div>

        <p class="nq-hero__hint">{{ t('nextQuest.buckets.discoveryHint') }}</p>
      </section>

      <!-- ── Cartes secondaires ───────────────────── -->
      <div class="nq-secondary">

        <!-- Bibliothèque non jouée -->
        <div v-if="libraryUnplayed" class="nq-card">
          <div class="nq-card__label">
            <v-icon size="14" color="#5C3317">mdi-bookshelf</v-icon>
            {{ t('nextQuest.buckets.libraryUnplayed') }}
          </div>

          <div class="nq-card__inner">
            <div class="nq-card__cover-wrap">
              <img
                v-if="libraryUnplayed.game.coverUrl"
                :src="libraryUnplayed.game.coverUrl"
                :alt="libraryUnplayed.game.title"
                class="nq-card__cover"
              />
              <div v-else class="nq-card__cover-placeholder">
                <v-icon size="32" color="#a07850">mdi-gamepad-variant</v-icon>
              </div>
            </div>

            <div class="nq-card__body">
              <p class="nq-card__title">{{ libraryUnplayed.game.title }}</p>
              <div v-if="libraryUnplayed.game.genres.length" class="nq-card__genres">
                <span
                  v-for="g in libraryUnplayed.game.genres.slice(0, 2)"
                  :key="g.id"
                  class="nq-tag nq-tag--sm"
                >{{ g.name }}</span>
              </div>
              <p class="nq-card__reason">{{ libraryUnplayed.reason.text }}</p>
            </div>
          </div>

          <div class="nq-card__actions">
            <button
              class="nq-btn nq-btn--secondary"
              :disabled="feedbackPending === libraryUnplayed.id"
              @click="sendFeedback(libraryUnplayed, 'liked')"
            >
              <v-icon size="16">mdi-play</v-icon>
              {{ t('nextQuest.actions.play') }}
            </button>
            <button
              class="nq-btn nq-btn--ghost nq-btn--sm"
              :disabled="feedbackPending === libraryUnplayed.id"
              @click="sendFeedback(libraryUnplayed, 'dismissed')"
            >
              {{ t('nextQuest.actions.dismiss') }}
            </button>
          </div>
        </div>

        <!-- Aucun jeu dans la biblio -->
        <div v-else class="nq-card nq-card--empty">
          <v-icon size="32" color="rgba(92,51,23,0.25)">mdi-bookshelf</v-icon>
          <p class="nq-card__empty-label">{{ t('nextQuest.noReco') }}</p>
        </div>

        <!-- À venir -->
        <div v-if="upcoming" class="nq-card">
          <div class="nq-card__label">
            <v-icon size="14" color="#5C3317">mdi-calendar-star</v-icon>
            {{ t('nextQuest.buckets.upcoming') }}
          </div>

          <div class="nq-card__inner">
            <div class="nq-card__cover-wrap">
              <img
                v-if="upcoming.game.coverUrl"
                :src="upcoming.game.coverUrl"
                :alt="upcoming.game.title"
                class="nq-card__cover"
              />
              <div v-else class="nq-card__cover-placeholder">
                <v-icon size="32" color="#a07850">mdi-gamepad-variant</v-icon>
              </div>
            </div>

            <div class="nq-card__body">
              <p class="nq-card__title">{{ upcoming.game.title }}</p>
              <div v-if="upcoming.game.genres.length" class="nq-card__genres">
                <span
                  v-for="g in upcoming.game.genres.slice(0, 2)"
                  :key="g.id"
                  class="nq-tag nq-tag--sm"
                >{{ g.name }}</span>
              </div>
              <p v-if="upcoming.game.releaseDate" class="nq-card__date">
                <v-icon size="13">mdi-calendar</v-icon>
                {{ t('nextQuest.release') }} : {{ formatDate(upcoming.game.releaseDate) }}
              </p>
              <p class="nq-card__reason">{{ upcoming.reason.text }}</p>
            </div>
          </div>

          <div class="nq-card__actions">
            <button
              class="nq-btn nq-btn--secondary"
              :disabled="feedbackPending === upcoming.id"
              @click="sendFeedback(upcoming, 'liked')"
            >
              <v-icon size="16">mdi-bell-outline</v-icon>
              {{ t('nextQuest.actions.remind') }}
            </button>
            <button
              class="nq-btn nq-btn--ghost nq-btn--sm"
              :disabled="feedbackPending === upcoming.id"
              @click="sendFeedback(upcoming, 'dismissed')"
            >
              {{ t('nextQuest.actions.dismiss') }}
            </button>
          </div>
        </div>

        <!-- Aucune sortie à venir -->
        <div v-else class="nq-card nq-card--empty">
          <v-icon size="32" color="rgba(92,51,23,0.25)">mdi-calendar-star</v-icon>
          <p class="nq-card__empty-label">{{ t('nextQuest.noReco') }}</p>
        </div>

      </div>

      <!-- Régénérer -->
      <div class="nq-regen">
        <button
          class="nq-btn nq-btn--ghost"
          :disabled="generating"
          @click="generate"
        >
          <v-icon size="16">mdi-refresh</v-icon>
          {{ generating ? t('nextQuest.generating') : t('nextQuest.regenerate') }}
        </button>
      </div>

    </template>
  </div>
</template>

<style scoped>
/* ── Layout page ── */
.nq-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 1.25rem 1.25rem 3rem;
  font-family: var(--nq-font);
  max-width: 860px;
  margin: 0 auto;
  width: 100%;
}

@media (max-width: 600px) {
  .nq-page { padding: 1rem 0.75rem 3rem; }
}

@media (min-width: 960px) {
  .nq-page {
    height: 100dvh;
    overflow: hidden;
    padding: 0.75rem 1.25rem 0.75rem;
  }

  /* Retour + header très compacts */
  .nq-back { margin-bottom: 0.35rem; }
  .nq-header { margin-bottom: 0.5rem; }
  .nq-title { font-size: 1.4rem; margin-bottom: 0.2rem; }
  .nq-subtitle { font-size: 0.82rem; }

  /* Hero prend tout l'espace restant */
  .nq-hero {
    flex: 1;
    min-height: 0;
    margin-bottom: 0.6rem;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .nq-hero__label { margin-bottom: 0.4rem; padding: 4px 12px; font-size: 0.68rem; }
  .nq-hero__hint { margin-top: 0.2rem; font-size: 0.7rem; align-self: flex-end; }

  /* La card prend toute la largeur disponible */
  .nq-hero__card { width: 100%; }

  /* Les actions ne doivent plus pousser vers le bas — elles s'intègrent dans le flux */
  .nq-hero__actions { margin-top: 0; }

  /* Card remplit la zone hero sans scroll */
  .nq-hero__card { flex: 1; min-height: 0; }

  .nq-hero__cover-wrap { min-height: unset; width: 150px; }
  .nq-hero__cover-placeholder { min-height: unset; height: 100%; }

  .nq-hero__body { padding: 0.85rem 1rem; gap: 0.4rem; }
  .nq-hero__title { font-size: 1.15rem; }
  .nq-hero__actions { gap: 8px; margin-top: 0.2rem; }

  /* Boutons du hero plus petits */
  .nq-hero .nq-btn { padding: 7px 14px; font-size: 0.8rem; }

  /* Cartes secondaires compactes */
  .nq-secondary { margin-bottom: 0.4rem; gap: 0.6rem; }
  .nq-card__label { padding: 0.4rem 0.75rem 0; font-size: 0.62rem; }
  .nq-card__cover-wrap { width: 60px; min-height: 70px; }
  .nq-card__body { padding: 0.4rem 0.65rem; gap: 3px; }
  .nq-card__title { font-size: 0.82rem; }
  .nq-card__reason { -webkit-line-clamp: 1; line-clamp: 1; }
  .nq-card__actions { padding: 0.4rem 0.75rem; gap: 6px; }
  .nq-card .nq-btn { padding: 5px 10px; font-size: 0.75rem; }

  .nq-regen { margin-top: 0; }
  .nq-regen .nq-btn { padding: 6px 14px; font-size: 0.78rem; }
}

/* ── Retour ── */
.nq-back {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--nq-brown-dark, #3A1A0A);
  font-size: 0.85rem;
  text-decoration: none;
  opacity: 0.7;
  margin-bottom: 1.25rem;
  transition: opacity 0.15s;
}
.nq-back:hover { opacity: 1; }

/* ── Header ── */
.nq-header {
  text-align: center;
  margin-bottom: 2rem;
}
.nq-title {
  font-size: clamp(1.6rem, 5vw, 2.4rem);
  font-weight: bold;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0 0 0.4rem;
}
.nq-subtitle {
  font-size: 0.95rem;
  color: rgba(58, 26, 10, 0.6);
  margin: 0;
}

/* ── Loader ── */
.nq-loader {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 0;
}

/* ── Empty state ── */
.nq-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  text-align: center;
  padding: 2rem 1rem;
}
.nq-empty__wheel {
  width: 120px;
  opacity: 0.5;
  animation: spin-slow 8s linear infinite;
}
@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.nq-empty__title {
  font-size: 1.1rem;
  font-weight: bold;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
}
.nq-empty__hint {
  font-size: 0.88rem;
  color: rgba(58, 26, 10, 0.6);
  margin: 0;
  max-width: 340px;
}

/* ── Tags ── */
.nq-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid rgba(92, 51, 23, 0.25);
  font-size: 0.72rem;
  color: rgba(58, 26, 10, 0.7);
  background: rgba(92, 51, 23, 0.06);
}
.nq-tag--sm {
  font-size: 0.66rem;
  padding: 2px 8px;
}

/* ── Boutons ── */
.nq-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 10px;
  font-family: var(--nq-font);
  font-size: 0.88rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s, transform 0.1s;
  white-space: nowrap;
}
.nq-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.nq-btn:active:not(:disabled) { transform: translateY(1px); }

.nq-btn--primary {
  background: var(--nq-brown, #5C3317);
  color: #edc78e;
}
.nq-btn--primary:hover:not(:disabled) { background: var(--nq-brown-dark, #3A1A0A); }

.nq-btn--secondary {
  background: rgba(92, 51, 23, 0.1);
  color: var(--nq-brown, #5C3317);
  border: 1px solid rgba(92, 51, 23, 0.2);
}
.nq-btn--secondary:hover:not(:disabled) { background: rgba(92, 51, 23, 0.18); }

.nq-btn--ghost {
  background: transparent;
  color: rgba(58, 26, 10, 0.55);
  border: 1px solid rgba(92, 51, 23, 0.2);
}
.nq-btn--ghost:hover:not(:disabled) {
  background: rgba(92, 51, 23, 0.06);
  color: var(--nq-brown-dark, #3A1A0A);
}
.nq-btn--sm {
  padding: 7px 14px;
  font-size: 0.78rem;
}

/* ── Hero card ── */
.nq-hero {
  margin-bottom: 1.5rem;
}
.nq-hero__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--nq-brown, #5C3317);
  color: #edc78e;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 5px 14px;
  border-radius: 999px;
  margin-bottom: 0.75rem;
}
.nq-hero__card {
  display: flex;
  gap: 0;
  background: var(--nq-cream, #F8F4EA);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(58, 26, 10, 0.12), 0 1px 4px rgba(58, 26, 10, 0.08);
  overflow: hidden;
  border: 1px solid rgba(92, 51, 23, 0.12);
}
.nq-hero__cover-wrap {
  flex-shrink: 0;
  width: 180px;
  min-height: 240px;
  background: rgba(92, 51, 23, 0.08);
}
.nq-hero__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.nq-hero__cover-placeholder {
  width: 100%;
  height: 100%;
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nq-hero__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  gap: 0.75rem;
  min-width: 0;
}
.nq-hero__title {
  font-size: clamp(1.1rem, 3vw, 1.5rem);
  font-weight: bold;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
  line-height: 1.2;
}
.nq-hero__genres {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.nq-hero__meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.nq-hero__rating {
  color: #c8860a;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 5px;
}
.nq-hero__rating-num {
  font-size: 0.78rem;
  color: rgba(58, 26, 10, 0.6);
}
.nq-hero__date {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  color: rgba(58, 26, 10, 0.6);
}
.nq-hero__reason {
  font-size: 0.83rem;
  color: rgba(58, 26, 10, 0.65);
  font-style: italic;
  margin: 0;
  display: flex;
  align-items: flex-start;
  gap: 5px;
}
.nq-hero__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: auto;
}
.nq-hero__hint {
  font-size: 0.75rem;
  color: rgba(58, 26, 10, 0.45);
  margin: 0.5rem 0 0;
  text-align: right;
  font-style: italic;
}

/* Mobile hero */
@media (max-width: 600px) {
  .nq-hero__card { flex-direction: column; }
  .nq-hero__cover-wrap { width: 100%; min-height: 200px; max-height: 220px; }
  .nq-hero__body { padding: 1rem; }
}

/* ── Cartes secondaires ── */
.nq-secondary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
@media (max-width: 600px) {
  .nq-secondary { grid-template-columns: 1fr; }
}

.nq-card {
  background: var(--nq-cream, #F8F4EA);
  border-radius: 12px;
  border: 1px solid rgba(92, 51, 23, 0.1);
  box-shadow: 0 2px 10px rgba(58, 26, 10, 0.07);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.nq-card--empty {
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  gap: 0.5rem;
  opacity: 0.6;
  background: transparent;
  border-style: dashed;
}
.nq-card__empty-label {
  font-size: 0.8rem;
  color: rgba(58, 26, 10, 0.5);
  text-align: center;
  margin: 0;
}
.nq-card__label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.6rem 0.85rem 0;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(58, 26, 10, 0.5);
}
.nq-card__inner {
  display: flex;
  gap: 0;
  flex: 1;
}
.nq-card__cover-wrap {
  flex-shrink: 0;
  width: 72px;
  background: rgba(92, 51, 23, 0.08);
  min-height: 100px;
}
.nq-card__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.nq-card__cover-placeholder {
  width: 100%;
  height: 100%;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nq-card__body {
  flex: 1;
  padding: 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.nq-card__title {
  font-size: 0.88rem;
  font-weight: bold;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nq-card__genres {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.nq-card__date {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.72rem;
  color: rgba(58, 26, 10, 0.55);
  margin: 0;
}
.nq-card__reason {
  font-size: 0.72rem;
  color: rgba(58, 26, 10, 0.55);
  font-style: italic;
  margin: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.nq-card__actions {
  display: flex;
  gap: 8px;
  padding: 0.75rem 0.85rem;
  flex-wrap: wrap;
  align-items: center;
}

/* ── Régénérer ── */
.nq-regen {
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
}
</style>
