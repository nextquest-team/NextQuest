<script setup lang="ts">
import type { RecommendationDTO, GroupedRecommendations, FeedbackAction } from '~/types/recommendations'

definePageMeta({ ssr: false })

const { t } = useI18n()
const { authFetch, apiBase } = useAuthFetch()
const { mdAndUp } = useDisplay()

// ── State ─────────────────────────────────────────────────────────────────
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

// ── Fetch ──────────────────────────────────────────────────────────────────
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

// ── Feedback ───────────────────────────────────────────────────────────────
async function sendFeedback(reco: RecommendationDTO, action: FeedbackAction) {
  if (feedbackPending.value) return
  feedbackPending.value = reco.id
  try {
    await authFetch(`${apiBase}/api/recommendations/${reco.id}/feedback`, {
      method: 'POST',
      body: { action },
    })
    if (reco.bucket === 'discovery')        discovery.value = null
    if (reco.bucket === 'library_unplayed') libraryUnplayed.value = null
    if (reco.bucket === 'upcoming')         upcoming.value = null
  } catch { /* conserve l'état en cas d'erreur réseau */ }
  finally {
    feedbackPending.value = null
  }
}

onMounted(() => fetchRecos())
</script>

<template>
  <div class="nq-page">

    <!-- Topbar -->
    <UiPageHeader>
      <img src="/images/dashboard/turning-wheel.png" alt="" class="nq-title-wheel" />
      <div class="nq-title-text">
        <h1 class="nq-title">{{ t('nextQuest.title') }}</h1>
        <p class="nq-subtitle">{{ t('nextQuest.subtitle') }}</p>
      </div>
    </UiPageHeader>

    <!-- Chargement -->
    <div v-if="loading" class="nq-state">
      <v-progress-circular indeterminate size="40" color="#5C3317" />
    </div>

    <!-- Erreur -->
    <div v-else-if="error" class="nq-state">
      <v-icon size="48" color="#8B1F1F">mdi-alert-circle-outline</v-icon>
      <p class="nq-state__title">Impossible de charger les recommandations</p>
      <button class="patch-btn" @click="fetchRecos">Réessayer</button>
    </div>

    <!-- Vide -->
    <div v-else-if="!hasAnyReco" class="nq-state">
      <img src="/images/dashboard/turning-wheel.png" alt="" class="nq-state__wheel" />
      <p class="nq-state__title">{{ t('nextQuest.emptyTitle') }}</p>
      <p class="nq-state__hint">{{ t('nextQuest.emptyHint') }}</p>
      <button class="patch-btn" :disabled="generating" @click="generate">
        <v-icon size="18">mdi-compass-rose</v-icon>
        {{ generating ? t('nextQuest.generating') : t('nextQuest.generate') }}
      </button>
    </div>

    <!-- Layouts -->
    <template v-else>
      <NextQuestMobileStage
        v-if="!mdAndUp"
        :discovery="discovery"
        :library-unplayed="libraryUnplayed"
        :upcoming="upcoming"
        :feedback-pending="feedbackPending"
        :generating="generating"
        @feedback="sendFeedback"
        @generate="generate"
      />
      <NextQuestDesktopStage
        v-else
        :discovery="discovery"
        :library-unplayed="libraryUnplayed"
        :upcoming="upcoming"
        :feedback-pending="feedbackPending"
        :generating="generating"
        @feedback="sendFeedback"
        @generate="generate"
      />
    </template>

  </div>
</template>

<style scoped>
/* ── Page ── */
.nq-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 1.25rem 1rem 1.5rem;
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
  color: rgba(58, 26, 10, 0.5);
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
  color: rgba(58, 26, 10, 0.55);
  margin: 0;
  max-width: 300px;
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
