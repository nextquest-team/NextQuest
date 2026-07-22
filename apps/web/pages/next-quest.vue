<script setup lang="ts">
import type { RecommendationDTO, GroupedRecommendations, FeedbackAction, RecoBucket } from '~/types/recommendations'

definePageMeta({ ssr: false })

const { t } = useI18n()
const { authFetch, apiBase } = useAuthFetch()
const { mdAndUp } = useDisplay()

// ── State ─────────────────────────────────────────────────────────────────
const loading = ref(false)
const generating = ref(false)
const error = ref(false)
const lastFailedOp = ref<'fetch' | 'generate' | 'refresh' | null>(null)
const feedbackPending = ref<string | null>(null)

const discoveryQueue = ref<RecommendationDTO[]>([])
const libraryUnplayedQueue = ref<RecommendationDTO[]>([])
const upcomingQueue = ref<RecommendationDTO[]>([])

const discovery = computed(() => discoveryQueue.value[0] ?? null)
const libraryUnplayed = computed(() => libraryUnplayedQueue.value[0] ?? null)
const upcoming = computed(() => upcomingQueue.value[0] ?? null)

const hasAnyReco = computed(() =>
  discovery.value || libraryUnplayed.value || upcoming.value,
)

// ── Fetch ──────────────────────────────────────────────────────────────────
async function fetchRecos() {
  loading.value = true
  error.value = false
  lastFailedOp.value = null
  try {
    const res = await authFetch<GroupedRecommendations>(`${apiBase}/api/recommendations`)
    discoveryQueue.value = res.discovery
    libraryUnplayedQueue.value = res.libraryUnplayed
    upcomingQueue.value = res.upcoming
  } catch {
    error.value = true
    lastFailedOp.value = 'fetch'
  } finally {
    loading.value = false
  }
}

async function generate() {
  generating.value = true
  error.value = false
  lastFailedOp.value = null
  try {
    await authFetch(`${apiBase}/api/recommendations/generate`, { method: 'POST' })
    await fetchRecos()
  } catch {
    error.value = true
    lastFailedOp.value = 'generate'
  } finally {
    generating.value = false
  }
}

// Fait tourner la sélection (passe les cartes affichées derrière le pool) sans
// tout recalculer : contrairement à generate(), garantit des cartes différentes.
async function refresh() {
  generating.value = true
  error.value = false
  lastFailedOp.value = null
  try {
    const skip = [discovery.value?.id, libraryUnplayed.value?.id, upcoming.value?.id]
      .filter((id): id is string => !!id)
    const res = await authFetch<GroupedRecommendations>(`${apiBase}/api/recommendations/refresh`, {
      method: 'POST',
      body: { skip },
    })
    discoveryQueue.value = res.discovery
    libraryUnplayedQueue.value = res.libraryUnplayed
    upcomingQueue.value = res.upcoming
  } catch {
    error.value = true
    lastFailedOp.value = 'refresh'
  } finally {
    generating.value = false
  }
}

function retry() {
  if (lastFailedOp.value === 'generate') generate()
  else if (lastFailedOp.value === 'refresh') refresh()
  else fetchRecos()
}

const bucketQueue: Record<RecoBucket, Ref<RecommendationDTO[]>> = {
  discovery: discoveryQueue,
  library_unplayed: libraryUnplayedQueue,
  upcoming: upcomingQueue,
}

// Ré-approvisionne un bucket vide sans toucher aux états globaux loading/error :
// les 2 autres cartes restent affichées et interactives.
// IMPORTANT : le replenish-when-dry (côté API, recommendations.service.ts) n'existe
// que sur GET /api/recommendations SANS le paramètre "bucket" (getGroupedRecommendations).
// L'endpoint filtré par bucket (?bucket=X, listRecommendations) ne fait qu'une lecture
// paginée brute et ne déclenche jamais de réapprovisionnement — d'où le besoin de
// repasser par l'appel groupé ici.
async function refillBucket(bucket: RecoBucket) {
  try {
    const res = await authFetch<GroupedRecommendations>(`${apiBase}/api/recommendations`)
    discoveryQueue.value = res.discovery
    libraryUnplayedQueue.value = res.libraryUnplayed
    upcomingQueue.value = res.upcoming
  } catch {
    // Le refetch a échoué : on vide la file plutôt que de laisser la carte
    // déclinée affichée à tort (fantôme). La card "Aucune suggestion" prend le relais.
    bucketQueue[bucket].value = []
  }
}

// ── Feedback ───────────────────────────────────────────────────────────────
async function sendFeedback(reco: RecommendationDTO, action: FeedbackAction) {
  if (feedbackPending.value) return
  feedbackPending.value = reco.id
  try {
    await authFetch(`${apiBase}/api/recommendations/${reco.id}/feedback`, {
      method: 'POST',
      body: { action },
    })
    const remaining = bucketQueue[reco.bucket].value.slice(1)

    // On n'assigne jamais un array vide directement : ça déclenche un re-render
    // avec la card "Aucune suggestion" avant même que refillBucket ait fini.
    if (remaining.length) {
      bucketQueue[reco.bucket].value = remaining
    } else {
      await refillBucket(reco.bucket)
    }
  } catch {
    // La requête a échoué avant toute mutation de la file : rien à rattraper,
    // la carte affichée reste celle qu'on vient d'essayer de traiter.
  }
  finally {
    feedbackPending.value = null
  }
}

onMounted(() => fetchRecos())
</script>

<template>
  <!-- ── Vue Desktop ── -->
  <div v-if="mdAndUp" class="nq-page nq-page--desktop">
    <UiPageHeader>
      <img src="/images/dashboard/turning-wheel.png" alt="" class="nq-title-wheel" />
      <div class="nq-title-text">
        <h1 class="nq-title">{{ t('nextQuest.title') }}</h1>
        <p class="nq-subtitle">{{ t('nextQuest.subtitle') }}</p>
      </div>
    </UiPageHeader>

    <div v-if="loading" class="nq-state">
      <v-progress-circular :aria-label="t('common.loading')" indeterminate size="40" color="primary" />
    </div>
    <div v-else-if="error" class="nq-state">
      <v-icon size="48" color="error">mdi-alert-circle-outline</v-icon>
      <p class="nq-state__title">{{ t('nextQuest.loadError') }}</p>
      <button class="patch-btn" @click="retry">{{ t('nextQuest.retry') }}</button>
    </div>
    <div v-else-if="!hasAnyReco" class="nq-state">
      <img src="/images/dashboard/turning-wheel.png" alt="" class="nq-state__wheel" />
      <p class="nq-state__title">{{ t('nextQuest.emptyTitle') }}</p>
      <p class="nq-state__hint">{{ t('nextQuest.emptyHint') }}</p>
      <button class="patch-btn" :disabled="generating" @click="generate">
        <v-icon size="18">mdi-compass-rose</v-icon>
        {{ generating ? t('nextQuest.generating') : t('nextQuest.generate') }}
      </button>
    </div>
    <NextQuestDesktopStage
      v-else
      :discovery="discovery"
      :library-unplayed="libraryUnplayed"
      :upcoming="upcoming"
      :feedback-pending="feedbackPending"
      :generating="generating"
      @feedback="sendFeedback"
      @generate="refresh"
    />
  </div>

  <!-- ── Vue Mobile ── -->
  <div v-else class="nq-page nq-page--mobile">

    <!-- Header sticky (hors de la zone scrollable) -->
    <div class="nq-mobile-header">
      <UiPageHeader>
        <img src="/images/dashboard/turning-wheel.png" alt="" class="nq-title-wheel" />
        <div class="nq-title-text">
          <h1 class="nq-title">{{ t('nextQuest.title') }}</h1>
          <p class="nq-subtitle">{{ t('nextQuest.subtitle') }}</p>
        </div>
      </UiPageHeader>
    </div>

    <!-- Contenu scrollable -->
    <div class="nq-mobile-body">
      <div v-if="loading" class="nq-state">
        <v-progress-circular :aria-label="t('common.loading')" indeterminate size="40" color="primary" />
      </div>
      <div v-else-if="error" class="nq-state">
        <v-icon size="48" color="error">mdi-alert-circle-outline</v-icon>
        <p class="nq-state__title">{{ t('nextQuest.loadError') }}</p>
        <button class="patch-btn" @click="retry">{{ t('nextQuest.retry') }}</button>
      </div>
      <div v-else-if="!hasAnyReco" class="nq-state">
        <img src="/images/dashboard/turning-wheel.png" alt="" class="nq-state__wheel" />
        <p class="nq-state__title">{{ t('nextQuest.emptyTitle') }}</p>
        <p class="nq-state__hint">{{ t('nextQuest.emptyHint') }}</p>
        <button class="patch-btn" :disabled="generating" @click="generate">
          <v-icon size="18">mdi-compass-rose</v-icon>
          {{ generating ? t('nextQuest.generating') : t('nextQuest.generate') }}
        </button>
      </div>
      <NextQuestMobileStage
        v-else
        :discovery="discovery"
        :library-unplayed="libraryUnplayed"
        :upcoming="upcoming"
        :feedback-pending="feedbackPending"
        :generating="generating"
        @feedback="sendFeedback"
        @generate="refresh"
      />
    </div>

  </div>
</template>

<style scoped>
/* ── Page desktop : hauteur fixe, pas de scroll body ── */
.nq-page--desktop {
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 0.5rem 1.25rem 0.75rem;
  font-family: var(--nq-font);
}

/* ── Page mobile : header fixe + contenu scrollable ── */
.nq-page--mobile {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 64px); /* 64px = bottom nav */
  overflow: hidden;
  font-family: var(--nq-font);
}

.nq-mobile-header {
  flex-shrink: 0;
  padding: 0 1rem;
  /* Le UiPageHeader gère sa propre sticky via son ::before */
}

.nq-mobile-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0.5rem 1rem 1.5rem;
}

/* ── Header ── */
.nq-title-text {
  display: flex;
  flex-direction: column;
}

.nq-title-wheel {
  width: 5rem;
  height: 5rem;
  animation: spin-slow 8s linear infinite;
}

@media (min-width: 960px) {
  .nq-title-wheel { width: 6.5rem; height: 6.5rem; }
}

.nq-title {
  font-size: clamp(1.6rem, 4vw, 2.2rem);
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
  line-height: 1.1;
}

.nq-subtitle {
  font-size: 1rem;
  /* WCAG 1.4.3 : alpha 0.5 ne faisait que ~3.13:1 (< 4.5:1 requis) */
  color: rgba(var(--nq-brown-dark-rgb), 0.7);
  margin: 0;
  font-style: italic;
}

@media (min-width: 960px) {
  .nq-title    { font-size: 2.2rem; }
  .nq-subtitle { font-size: 1.6rem; }
}

/* ── États (chargement / erreur / vide) ── */
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

.nq-state__title {
  font-size: 1.05rem;
  font-weight: bold;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
}

.nq-state__hint {
  font-size: 0.85rem;
  /* WCAG 1.4.3 : alpha 0.55 ne faisait que 3.61:1 (< 4.5:1 requis) */
  color: rgba(var(--nq-brown-dark-rgb), 0.7);
  margin: 0;
  max-width: 300px;
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
