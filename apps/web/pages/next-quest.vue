<script setup lang="ts">
import type { RecommendationDTO, GroupedRecommendations, FeedbackAction } from '~/types/recommendations'

definePageMeta({ ssr: false })

const { t } = useI18n()
const { authFetch, apiBase } = useAuthFetch()

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

    <!-- Stage : carte + cards overlay -->
    <div v-else class="nq-map-stage">

      <!-- Bannière portrait (mobile uniquement) -->
      <img
        class="nq-mobile-map"
        src="/images/next-quest/carte-au-tresor.png"
        alt="Carte des aventures"
      />

      <!-- Rangée des cards (discovery hero + secondaires) -->
      <div class="nq-cards-row">

        <!-- Slot Découverte — hero -->
        <div class="nq-slot nq-slot--discovery">
          <NextQuestRecoCard
            :reco="discovery"
            bucket="discovery"
            :feedback-pending="feedbackPending === discovery?.id"
            @feedback="sendFeedback"
          />
        </div>

        <!-- Slots secondaires (bibliothèque + à venir) -->
        <div class="nq-secondary">
          <div class="nq-slot nq-slot--library">
            <NextQuestRecoCard
              :reco="libraryUnplayed"
              bucket="library_unplayed"
              :feedback-pending="feedbackPending === libraryUnplayed?.id"
              @feedback="sendFeedback"
            />
          </div>
          <div class="nq-slot nq-slot--upcoming">
            <NextQuestRecoCard
              :reco="upcoming"
              bucket="upcoming"
              :feedback-pending="feedbackPending === upcoming?.id"
              @feedback="sendFeedback"
            />
          </div>
        </div>

      </div>

      <!-- Régénérer -->
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



.nq-header {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

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
.nq-title  { font-size: 2.2rem; }
  .nq-subtitle { font-size: 1.6rem; }
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
  /* Desktop : colonne — rangée de cards en haut, regen en bas */
  .nq-map-stage {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 5% 5% 3%;
    background: url('/images/next-quest/carte-landscape.png') center / 100% 100% no-repeat;
    border-radius: 16px;
    overflow: hidden;
  }

  /* Rangée cards : hero à gauche, secondaires à droite */
  .nq-cards-row {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 1rem;
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
@media (min-width: 960px) {
  /* Discovery hero : colonne gauche, hauteur naturelle (centrée verticalement) */
  .nq-slot--discovery {
    display: flex;
    align-self: center;
    max-width: 320px;
    width: 100%;
  }
}

/* ═══════════════════════════════════════════════════════
   SECONDAIRES (mobile : 2 colonnes / desktop : colonne)
═══════════════════════════════════════════════════════ */
.nq-secondary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  padding-left: 10%;
}

@media (max-width: 480px) {
  .nq-secondary { grid-template-columns: 1fr; }
}

@media (min-width: 960px) {
  /* Colonne droite : library en haut, upcoming en bas, carte visible au milieu */
  .nq-secondary {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    max-width: 480px;
    width: 100%;
  }

  .nq-secondary .nq-slot {
    flex: 0 0 auto;
    display: flex;
    width: 100%;
  }
}

/* ═══════════════════════════════════════════════════════
   RÉGÉNÉRER
═══════════════════════════════════════════════════════ */
.nq-regen {
  display: flex;
  justify-content: center;
  padding: 0.25rem 0;
}
</style>
