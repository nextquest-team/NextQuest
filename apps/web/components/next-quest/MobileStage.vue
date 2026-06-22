<script setup lang="ts">
import type { RecommendationDTO, FeedbackAction } from '~/types/recommendations'

defineProps<{
  discovery: RecommendationDTO | null
  libraryUnplayed: RecommendationDTO | null
  upcoming: RecommendationDTO | null
  feedbackPending: string | null
  generating: boolean
}>()

const emit = defineEmits<{
  feedback: [reco: RecommendationDTO, action: FeedbackAction]
  generate: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="nq-mobile-stage">

    <!-- Fond portrait fixe -->
    <div class="nq-portrait-bg" aria-hidden="true" />

    <!-- 3 cards identiques en colonne -->
    <div class="nq-cards">
      <NextQuestRecoCard
        :reco="discovery"
        bucket="discovery"
        compact
        :feedback-pending="feedbackPending === discovery?.id"
        @feedback="(reco, action) => emit('feedback', reco, action)"
      />
      <NextQuestRecoCard
        :reco="libraryUnplayed"
        bucket="library_unplayed"
        compact
        :feedback-pending="feedbackPending === libraryUnplayed?.id"
        @feedback="(reco, action) => emit('feedback', reco, action)"
      />
      <NextQuestRecoCard
        :reco="upcoming"
        bucket="upcoming"
        compact
        :feedback-pending="feedbackPending === upcoming?.id"
        @feedback="(reco, action) => emit('feedback', reco, action)"
      />
    </div>

    <!-- Régénérer -->
    <div class="nq-regen">
      <button class="patch-btn" :disabled="generating" @click="emit('generate')">
        <v-icon size="16">mdi-refresh</v-icon>
        {{ generating ? t('nextQuest.generating') : t('nextQuest.regenerate') }}
      </button>
    </div>

  </div>
</template>

<style scoped>
/* Fond portrait fixe derrière les cards */
.nq-portrait-bg {
  position: fixed;
  inset: 0;
  background-image: url('/images/next-quest/carte-portrait.png');
  background-size: contain;
  margin-top: 30%;
  z-index: -1;
  pointer-events: none;
  
}

/* Stage : colonne scrollable, z-index au-dessus du fond fixe */
.nq-mobile-stage {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 3 cards identiques en colonne */
.nq-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Bouton régénérer */
.nq-regen {
  display: flex;
  justify-content: center;
  padding: 0.25rem 0;
}
</style>
