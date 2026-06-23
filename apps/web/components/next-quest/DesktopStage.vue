<script setup lang="ts">
import type { RecommendationDTO, FeedbackAction } from '~/types/recommendations'

defineProps<{
  discovery: RecommendationDTO | null
  libraryUnplayed: RecommendationDTO | null
  upcoming: RecommendationDTO | null
  feedbackPending: string | null
  refreshing: boolean
}>()

const emit = defineEmits<{
  feedback: [reco: RecommendationDTO, action: FeedbackAction]
  refresh: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="nq-desktop-stage">

    <!-- Rangée : hero à gauche, secondaires à droite -->
    <div class="nq-cards-row">

      <div class="nq-slot--discovery">
        <NextQuestRecoCard
          :reco="discovery"
          bucket="discovery"
          :feedback-pending="feedbackPending === discovery?.id"
          @feedback="(reco, action) => emit('feedback', reco, action)"
        />
      </div>

      <div class="nq-secondary">
        <NextQuestRecoCard
          :reco="libraryUnplayed"
          bucket="library_unplayed"
          :feedback-pending="feedbackPending === libraryUnplayed?.id"
          @feedback="(reco, action) => emit('feedback', reco, action)"
        />
        <NextQuestRecoCard
          :reco="upcoming"
          bucket="upcoming"
          :feedback-pending="feedbackPending === upcoming?.id"
          @feedback="(reco, action) => emit('feedback', reco, action)"
        />
      </div>

    </div>

    <!-- Régénérer -->
    <div class="nq-regen">
      <button class="patch-btn" :disabled="refreshing" @click="emit('refresh')">
        <v-icon size="16">mdi-refresh</v-icon>
        {{ refreshing ? t('nextQuest.generating') : t('nextQuest.regenerate') }}
      </button>
    </div>

  </div>
</template>

<style scoped>
/* Stage : fond carte paysage, hauteur fixe 100dvh (géré par la page parente) */
.nq-desktop-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 5% 5% 3%;
  background: url('/images/next-quest/carte-landscape.png') center / 100% 100% no-repeat;
  border-radius: 16px;
  overflow: hidden;
}

/* Rangée hero + secondaires */
.nq-cards-row {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

/* Slot discovery : colonne gauche */
.nq-slot--discovery {
  display: flex;
  align-self: center;
  max-width: 320px;
  width: 100%;
}

/* Secondaires : colonne droite */
.nq-secondary {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  max-width: 480px;
  width: 100%;
}

/* Bouton régénérer */
.nq-regen {
  display: flex;
  justify-content: center;
  padding: 0.25rem 0;
}
</style>
